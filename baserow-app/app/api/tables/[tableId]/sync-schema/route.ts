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
  const supabase = await createClient()

  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { tableId } = await params
  const table = await getTable(tableId)
  if (!table) {
    return NextResponse.json({ error: 'Table not found' }, { status: 404 })
  }

  const rawTableName = String((table as any).supabase_table || '')
  const tableName = normalizeSupabaseTableName(rawTableName)
  if (!tableName) {
    return NextResponse.json({ error: 'Missing supabase_table for table' }, { status: 400 })
  }

  const addedColumns: string[] = []

  // 1) Ensure the base physical table exists (id + audit fields + grants).
  // If the RPC doesn't exist, the call will error and we surface it.
  const { error: createError } = await supabase.rpc('create_dynamic_table', {
    table_name: tableName,
  })
  if (createError) {
    return NextResponse.json(
      {
        error: `Failed to ensure physical table "${tableName}": ${createError.message}`,
        code: createError.code,
      },
      { status: 500 }
    )
  }

  // Ensure audit fields/trigger exist (best-effort; not all envs have the function).
  try {
    await supabase.rpc('ensure_audit_fields_for_table', { p_schema: 'public', p_table: tableName })
  } catch {
    // best-effort only
  }

  // 2) Load field metadata.
  const fields = await getTableFields(tableId)

  // 3) Load physical columns once via RPC.
  const { data: cols, error: colsError } = await supabase.rpc('get_table_columns', {
    table_name: tableName,
  })
  // If this RPC fails, we can still attempt ADD COLUMN IF NOT EXISTS for every field.
  const physical = new Set<string>(
    Array.isArray(cols) ? cols.map((c: any) => String(c?.column_name ?? '')).filter(Boolean) : []
  )

  // 4) Add any missing physical columns for non-virtual, non-system fields.
  const physicalFieldDefs = (fields || []).filter(
    (f: TableField) => f && !isVirtualType(String((f as any).type)) && !isSystemFieldName(String((f as any).name))
  )

  for (const f of physicalFieldDefs) {
    const colName = String((f as any).name || '').trim()
    if (!colName) continue

    if (!colsError && physical.has(colName)) {
      continue
    }

    const sql = generateAddColumnSQL(`public.${tableName}`, colName, (f as any).type, (f as any).options)
    const { error: addError } = await supabase.rpc('execute_sql_safe', { sql_text: sql })
    if (!addError) {
      addedColumns.push(colName)
      physical.add(colName)
    }
  }

  // 5) Best-effort: ask PostgREST to reload schema cache so new tables/columns are queryable immediately.
  try {
    await supabase.rpc('execute_sql_safe', { sql_text: "NOTIFY pgrst, 'reload schema';" })
  } catch {
    // best-effort only
  }

  return NextResponse.json({
    success: true,
    tableName,
    addedColumns,
  })
}

