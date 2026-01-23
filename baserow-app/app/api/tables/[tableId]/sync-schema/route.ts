import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTable } from '@/lib/crud/tables'
import { getTableFields } from '@/lib/fields/schema'
import { generateAddColumnSQL } from '@/lib/fields/sqlGenerator'
import type { TableField } from '@/types/fields'

const SYSTEM_FIELD_NAMES = new Set(['created_at', 'created_by', 'updated_at', 'updated_by'])
function isSystemFieldName(name: string) {
  return SYSTEM_FIELD_NAMES.has(String(name || '').toLowerCase())
}

function normalizeSupabaseTableName(raw: string): string {
  // All dynamic data tables live in `public`, but metadata might include `public.` prefix.
  return String(raw || '').trim().replace(/^public\./i, '')
}

function isVirtualType(type: string): boolean {
  return type === 'formula' || type === 'lookup'
}

/**
 * POST /api/tables/[tableId]/sync-schema
 *
 * Repairs drift between `table_fields` metadata and the physical data table:
 * - Ensures the physical table exists (creates it if missing)
 * - Adds any missing physical columns for non-virtual fields
 * - Best-effort triggers a PostgREST schema cache reload
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  let tableId: string | undefined
  try {
    const supabase = await createClient()

    const { data: auth } = await supabase.auth.getUser()
    if (!auth?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Safely await params
    try {
      const resolvedParams = await params
      tableId = resolvedParams?.tableId
      if (!tableId || typeof tableId !== 'string' || tableId.trim().length === 0) {
        return NextResponse.json({ error: 'Invalid tableId parameter' }, { status: 400 })
      }
    } catch (paramsError: unknown) {
      console.error('[sync-schema] Error resolving params:', paramsError)
      const errorMessage = (paramsError as { message?: string })?.message || 'Unknown error'
      return NextResponse.json(
        { error: 'Invalid request parameters', message: errorMessage },
        { status: 400 }
      )
    }

    // Safely get table
    let table
    try {
      table = await getTable(tableId)
    } catch (getTableError: unknown) {
      console.error(`[sync-schema] Error getting table "${tableId}":`, getTableError)
      const errorObj = getTableError as { message?: string; code?: string } | null
      // Check if it's a not found error
      const errorMsg = String(errorObj?.message || '').toLowerCase()
      if (errorMsg.includes('not found') || errorObj?.code === 'PGRST116') {
        return NextResponse.json({ error: 'Table not found' }, { status: 404 })
      }
      // Re-throw to be caught by outer catch
      throw getTableError
    }
    
    if (!table) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    }

    const rawTableName = String((table as { supabase_table?: string }).supabase_table || '')
    const tableName = normalizeSupabaseTableName(rawTableName)
    if (!tableName) {
      return NextResponse.json({ error: 'Missing supabase_table for table' }, { status: 400 })
    }

    const addedColumns: string[] = []

    // 1) Ensure the base physical table exists (id + audit fields + grants).
    // If the RPC doesn't exist, the call will error and we surface it.
    try {
      const { error: createError } = await supabase.rpc('create_dynamic_table', {
        table_name: tableName,
      })
      if (createError) {
        // If the table already exists, that's fine - continue
        const errorMsg = String(createError.message || '').toLowerCase()
        if (!errorMsg.includes('already exists') && !errorMsg.includes('duplicate')) {
          console.warn(`[sync-schema] Failed to ensure physical table "${tableName}":`, createError)
          // Don't return 500 - this might be expected in some cases (permissions, etc.)
          // Just log and continue
        }
      }
    } catch (err: unknown) {
      // If RPC doesn't exist or other unexpected error, log but don't fail completely
      console.warn(`[sync-schema] Error calling create_dynamic_table for "${tableName}":`, err)
      // Continue - the table might already exist
    }

  // Ensure audit fields/trigger exist (best-effort; not all envs have the function).
  try {
    await supabase.rpc('ensure_audit_fields_for_table', { p_schema: 'public', p_table: tableName })
  } catch {
    // best-effort only
  }

  // 2) Load field metadata.
  let fields: TableField[] = []
  try {
    fields = await getTableFields(tableId)
    if (!Array.isArray(fields)) {
      fields = []
    }
  } catch (err: unknown) {
    console.error(`[sync-schema] Error loading fields for table "${tableId}":`, err)
    // If it's a critical error (not just "table not found"), we might want to fail
    // But for now, continue with empty fields array - we can still check physical columns
    // This allows the endpoint to work even if table_fields table has issues
    const errorMsg = String(err?.message || '').toLowerCase()
    if (errorMsg.includes('permission denied') || errorMsg.includes('unauthorized')) {
      // Permission errors are critical - return 403
      return NextResponse.json(
        { 
          success: false,
          error: 'Permission denied loading field metadata',
          message: err?.message || 'Unknown error',
          tableId 
        },
        { status: 403 }
      )
    }
    // For other errors, continue with empty fields array
  }

  // 3) Load physical columns once via RPC.
  let cols: Array<{ column_name?: string }> | null = null
  let colsError: unknown = null
  try {
    const result = await supabase.rpc('get_table_columns', {
      table_name: tableName,
    })
    cols = result.data
    colsError = result.error
    if (colsError) {
      // Log but don't fail - we can still attempt to add columns
      console.warn(`[sync-schema] Error calling get_table_columns for "${tableName}":`, colsError)
    }
  } catch (err) {
    // Non-fatal - log and continue
    console.warn(`[sync-schema] Exception calling get_table_columns for "${tableName}":`, err)
    colsError = err
  }
  // If this RPC fails, we can still attempt ADD COLUMN IF NOT EXISTS for every field.
  const physical = new Set<string>(
    Array.isArray(cols) ? cols.map((c) => String(c?.column_name ?? '')).filter(Boolean) : []
  )

  // 4) Add any missing physical columns for non-virtual, non-system fields.
  const physicalFieldDefs = (fields || []).filter(
    (f: TableField) => f && !isVirtualType(String(f.type)) && !isSystemFieldName(String(f.name))
  )

  for (const f of physicalFieldDefs) {
    const colName = String((f as any).name || '').trim()
    if (!colName) continue

    if (!colsError && physical.has(colName)) {
      continue
    }

    try {
      // Generate SQL - this can throw if field type is invalid
      let sql: string
      try {
        sql = generateAddColumnSQL(`public.${tableName}`, colName, f.type, f.options)
      } catch (sqlGenError: unknown) {
        console.warn(
          `[sync-schema] Failed to generate SQL for column "${colName}" (type: ${f.type}) in "${tableName}":`,
          sqlGenError
        )
        // Skip this field - can't generate valid SQL for it
        continue
      }

      const { error: addError } = await supabase.rpc('execute_sql_safe', { sql_text: sql })
      if (!addError) {
        addedColumns.push(colName)
        physical.add(colName)
      } else {
        // Log but don't fail - column might already exist or there might be permissions issues
        const errorMsg = String(addError.message || '').toLowerCase()
        if (!errorMsg.includes('already exists') && !errorMsg.includes('duplicate')) {
          console.warn(`[sync-schema] Failed to add column "${colName}" to "${tableName}":`, addError)
        }
      }
    } catch (err: unknown) {
      // Non-fatal - log and continue with other columns
      console.warn(`[sync-schema] Exception adding column "${colName}" to "${tableName}":`, err)
    }
  }

  // 5) Best-effort: ask PostgREST to reload schema cache so new tables/columns are queryable immediately.
  if (addedColumns.length > 0) {
    // If we added columns, try multiple times to ensure PostgREST picks them up
    for (let i = 0; i < 3; i++) {
      try {
        await supabase.rpc('execute_sql_safe', { sql_text: "NOTIFY pgrst, 'reload schema';" })
        // Small delay between notifications
        if (i < 2) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      } catch {
        // best-effort only
      }
    }
  } else {
    // Still try once even if no columns were added
    try {
      await supabase.rpc('execute_sql_safe', { sql_text: "NOTIFY pgrst, 'reload schema';" })
    } catch {
      // best-effort only
    }
  }

  // 6) Identify fields in metadata that don't have physical columns (for reporting)
  const missingPhysicalColumns: string[] = []
  if (!colsError && Array.isArray(cols)) {
    for (const f of physicalFieldDefs) {
      const colName = String((f as any).name || '').trim()
      if (colName && !physical.has(colName)) {
        missingPhysicalColumns.push(colName)
      }
    }
  }

  return NextResponse.json({
    success: true,
    tableName,
    addedColumns,
    missingPhysicalColumns: missingPhysicalColumns.length > 0 ? missingPhysicalColumns : undefined,
    message: addedColumns.length > 0 
      ? `Added ${addedColumns.length} column(s): ${addedColumns.join(', ')}. PostgREST cache refresh requested.`
      : missingPhysicalColumns.length > 0
      ? `Schema sync completed. ${missingPhysicalColumns.length} field(s) in metadata have no physical column: ${missingPhysicalColumns.join(', ')}. These fields cannot be updated until columns are created.`
      : 'Schema is in sync. No columns added.',
  })
  } catch (err: unknown) {
    // Catch any unexpected errors and return a proper response instead of 500
    const errorTableId = tableId || 'unknown'
    const errorObj = err as { message?: string; code?: string | number; name?: string; stack?: string; details?: string; hint?: string } | null
    
    // Log full error details for debugging
    console.error(`[sync-schema] Unexpected error for table "${errorTableId}":`, {
      message: errorObj?.message,
      code: errorObj?.code,
      name: errorObj?.name,
      stack: errorObj?.stack,
      details: errorObj?.details,
      hint: errorObj?.hint,
      fullError: String(err),
    })
    
    // Provide more detailed error information
    const errorDetails: {
      success: boolean
      error: string
      message: string
      tableId: string
      errorCode: string | number | null
      errorName: string | null
      code?: string | number
      details?: string
    } = {
      success: false,
      error: 'An error occurred while syncing schema',
      message: errorObj?.message || 'Unknown error',
      tableId: errorTableId,
      errorCode: errorObj?.code || null,
      errorName: errorObj?.name || null,
      ...(errorObj?.code && { code: errorObj.code }),
      ...(errorObj?.details && { details: errorObj.details }),
    }
    
    // Add stack trace and full error in development
    if (process.env.NODE_ENV === 'development') {
      errorDetails.stack = errorObj?.stack
      errorDetails.fullError = String(err)
      errorDetails.details = errorObj?.details
      errorDetails.hint = errorObj?.hint
    }
    
    // Check if it's a known error type that should return a different status
    const errorMsg = String(errorObj?.message || '').toLowerCase()
    const errorCode = String(errorObj?.code || '')
    const errorName = String(errorObj?.name || '')
    
    if (errorMsg.includes('permission denied') || errorMsg.includes('unauthorized') || errorCode === '42501' || errorName === 'UnauthorizedError') {
      return NextResponse.json(errorDetails, { status: 403 })
    }
    if (errorMsg.includes('not found') || errorMsg.includes('does not exist') || errorCode === 'PGRST116' || errorCode === '42P01') {
      return NextResponse.json(errorDetails, { status: 404 })
    }
    if (errorMsg.includes('invalid') || errorCode === '22P02' || errorCode === '23505' || errorCode === '23503') {
      return NextResponse.json(errorDetails, { status: 400 })
    }
    
    // Default to 500 for unexpected errors, but include detailed info
    return NextResponse.json(errorDetails, { status: 500 })
  }
}

