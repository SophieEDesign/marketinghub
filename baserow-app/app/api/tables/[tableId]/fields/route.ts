import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/roles'
import { getTable } from '@/lib/crud/tables'
import { validateFieldName, validateFieldOptions, canChangeType, sanitizeFieldName } from '@/lib/fields/validation'
import {
  generateAddColumnSQL,
  generateRenameColumnSQL,
  generateChangeColumnTypeSQL,
  generateDropColumnSQL,
  isDestructiveTypeChange,
} from '@/lib/fields/sqlGenerator'
import { getTableFields } from '@/lib/fields/schema'
import { isTableNotFoundError, createErrorResponse, type ApiError } from '@/lib/api/error-handling'
import type { TableField, FieldType, FieldOptions } from '@/types/fields'

const SYSTEM_FIELD_NAMES = new Set(['created_at', 'created_by', 'updated_at', 'updated_by'])
function isSystemFieldName(name: string) {
  return SYSTEM_FIELD_NAMES.has(String(name || '').toLowerCase())
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v)
}

// GET: Get all fields for a table
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params
    
    // Validate tableId
    if (!tableId || typeof tableId !== 'string' || tableId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid tableId', fields: [] },
        { status: 400 }
      )
    }
    
    // Validate UUID format if it looks like a UUID
    if (tableId.includes('-') && !isUuid(tableId)) {
      console.warn(`[fields] Invalid UUID format for tableId: ${tableId}`)
      // Continue anyway - might be a different ID format
    }
    
    const fields = await getTableFields(tableId)
    
    // Do not cache: field metadata changes frequently (settings edits, reorder, etc.)
    // and caching causes the UI to show stale settings after a successful save.
    const response = NextResponse.json({ fields: fields || [] })
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error: unknown) {
    // If table doesn't exist, return empty array (graceful degradation)
    if (isTableNotFoundError(error as ApiError)) {
      const { tableId } = await params
      console.warn(`table_fields table may not exist for table ${tableId}, returning empty fields array`)
      const response = NextResponse.json({ fields: [] })
      response.headers.set('Cache-Control', 'no-store')
      return response
    }
    
    // Handle validation errors as 400
    const errorObj = error as { code?: string; message?: string } | null
    if (errorObj?.code === '22P02' || errorObj?.message?.includes('invalid input') || errorObj?.message?.includes('invalid uuid')) {
      console.error(`[fields] Invalid tableId format:`, error)
      return NextResponse.json(
        { error: 'Invalid tableId format', fields: [] },
        { status: 400 }
      )
    }
    
    console.error(`[fields] Error fetching fields:`, error)
    const errorResponse = createErrorResponse(error, 'Failed to fetch fields', 500)
    return NextResponse.json(errorResponse, { status: 500 })
  }
}

// POST: Create a new field
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const supabase = await createClient()

  try {
    const { tableId } = await params
    const body = await request.json()
    const { name, label, type, required, default_value, options } = body

    // Backward compatibility:
    // - older clients send `name` as the human-facing title
    // - newer clients should send `label`
    const rawLabel = String((label ?? name) ?? '').trim()

    if (!rawLabel || !type) {
      return NextResponse.json(
        { error: 'Field name and type are required' },
        { status: 400 }
      )
    }

    // Get table to find supabase_table name
    const table = await getTable(tableId)
    if (!table) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      )
    }

    // Get existing fields to validate uniqueness
    const existingFields = await getTableFields(tableId)
    const existingNames = existingFields.map(f => f.name.toLowerCase())

    // Sanitize field name first (handles reserved words)
    const sanitizedName = sanitizeFieldName(rawLabel)
    
    // Check if sanitized name is a reserved word and handle it
    const { RESERVED_WORDS } = await import('@/types/fields')
    let finalSanitizedName = sanitizedName
    if (RESERVED_WORDS.includes(sanitizedName.toLowerCase())) {
      finalSanitizedName = `${sanitizedName}_field`
    }
    
    // Validate field name (using final sanitized name)
    const nameValidation = validateFieldName(finalSanitizedName, existingNames)
    if (!nameValidation.valid) {
      return NextResponse.json(
        { error: nameValidation.error },
        { status: 400 }
      )
    }

    if (isSystemFieldName(finalSanitizedName)) {
      return NextResponse.json(
        { error: `Field name "${finalSanitizedName}" is reserved for system audit fields.` },
        { status: 400 }
      )
    }

    // Validate options
    const optionsValidation = validateFieldOptions(type as FieldType, options)
    if (!optionsValidation.valid) {
      return NextResponse.json(
        { error: optionsValidation.error },
        { status: 400 }
      )
    }

    // Additional validation for lookup fields: lookup_field_id must be a linked field
    if (type === 'lookup' && options?.lookup_field_id && options?.lookup_table_id) {
      const { data: linkedField, error: linkedFieldError } = await supabase
        .from('table_fields')
        .select('id, type, options')
        .eq('id', options.lookup_field_id)
        .eq('table_id', tableId)
        .single()

      if (linkedFieldError || !linkedField) {
        return NextResponse.json(
          { error: 'Lookup field must reference a linked field (link_to_table) in the current table' },
          { status: 400 }
        )
      }

      if (linkedField.type !== 'link_to_table') {
        return NextResponse.json(
          { error: `Lookup field must reference a linked field, but field "${linkedField.id}" is of type "${linkedField.type}"` },
          { status: 400 }
        )
      }

      const linkedTableId = (linkedField.options as any)?.linked_table_id
      if (linkedTableId !== options.lookup_table_id) {
        return NextResponse.json(
          { error: `Lookup field references a linked field that points to a different table. The linked field must connect to the lookup table.` },
          { status: 400 }
        )
      }
    }

    const position = existingFields.length
    // Set order_index to the max order_index + 1, or use position if no order_index exists
    const maxOrderIndex = existingFields.reduce((max, f) => {
      const orderIndex = f.order_index ?? f.position ?? 0
      return Math.max(max, orderIndex)
    }, -1)
    const order_index = maxOrderIndex + 1

    // Normalize options early (we may mutate for bidirectional links).
    const normalizedOptions: FieldOptions = (options || {}) as FieldOptions

    // Start transaction-like operation
    // 1. Create metadata record (table_fields table must exist)
    const { data: fieldData, error: fieldError } = await supabase
      .from('table_fields')
      .insert([
        {
          table_id: tableId,
          name: finalSanitizedName,
          label: rawLabel,
          type: type as FieldType,
          position,
          order_index,
          required: required || false,
          // Preserve valid falsy defaults like 0/false
          default_value: default_value ?? null,
          options: normalizedOptions,
        },
      ])
      .select()
      .single()

    if (fieldError) {
      // If table_fields doesn't exist, provide helpful error
      if (isTableNotFoundError(fieldError)) {
        return NextResponse.json(
          { 
            error: 'table_fields table does not exist. Please run the migration create_table_fields.sql in Supabase.',
            code: 'MISSING_TABLE',
            details: 'The table_fields table is required for field management. Run the migration file: supabase/migrations/create_table_fields.sql'
          },
          { status: 500 }
        )
      }
      const errorResponse = createErrorResponse(fieldError, 'Failed to create field', 500)
      return NextResponse.json(errorResponse, { status: 500 })
    }

    // 2. Add column to physical table (if not virtual)
    if (type !== 'formula' && type !== 'lookup') {
      try {
        // First, verify the table exists before executing SQL
        const { error: tableCheckError } = await supabase
          .from(table.supabase_table)
          .select('id')
          .limit(1)
        
        if (tableCheckError) {
          if (isTableNotFoundError(tableCheckError)) {
            // Rollback: Delete metadata
            await supabase.from('table_fields').delete().eq('id', fieldData.id)
            
            return NextResponse.json(
              { 
                error: `Table "${table.supabase_table}" does not exist. Please create the table first or verify the table name in Settings.`,
                error_code: 'TABLE_NOT_FOUND',
                table_name: table.supabase_table
              },
              { status: 404 }
            )
          }
        }
        
        const sql = generateAddColumnSQL(table.supabase_table, finalSanitizedName, type as FieldType, normalizedOptions)
        
        const { error: sqlError } = await supabase.rpc('execute_sql_safe', {
          sql_text: sql
        })

        if (sqlError) {
          // Rollback: Delete metadata
          await supabase.from('table_fields').delete().eq('id', fieldData.id)
          
          if (isTableNotFoundError(sqlError)) {
            return NextResponse.json(
              { 
                error: `Table "${table.supabase_table}" does not exist. Please create the table first or verify the table name in Settings.`,
                error_code: 'TABLE_NOT_FOUND',
                table_name: table.supabase_table,
                details: sqlError.message
              },
              { status: 404 }
            )
          }
          
          const errorResponse = createErrorResponse(sqlError, 'Failed to create column', 500)
          return NextResponse.json(errorResponse, { status: 500 })
        }

        // Trigger PostgREST schema cache refresh so the new column is immediately queryable
        try {
          await supabase.rpc('execute_sql_safe', { sql_text: "NOTIFY pgrst, 'reload schema';" })
          // Small delay to allow PostgREST to process the notification
          await new Promise(resolve => setTimeout(resolve, 200))
        } catch {
          // Non-fatal: PostgREST will eventually pick up the new column
        }
      } catch (sqlErr: unknown) {
        // Rollback: Delete metadata
        await supabase.from('table_fields').delete().eq('id', fieldData.id)
        
        const errorResponse = createErrorResponse(sqlErr, 'Failed to create column', 500)
        return NextResponse.json(errorResponse, { status: 500 })
      }
    }

    // 3. If creating a link field, optionally create the reciprocal field in the target table.
    // Baserow-style link fields are bidirectional: both sides are created and reference each other.
    // This project stores links as UUID/UUID[] columns, so we mirror the schema and link metadata via `linked_field_id`.
    let reciprocalField: TableField | null = null
    let reciprocalColumnName: string | null = null
    let reciprocalTable: { id: string; name?: string | null; supabase_table: string } | null = null

    const shouldCreateReciprocal =
      (type as FieldType) === 'link_to_table' &&
      typeof normalizedOptions?.linked_table_id === 'string' &&
      normalizedOptions.linked_table_id.trim().length > 0 &&
      // Only auto-create when the caller didn't explicitly point at a reciprocal field.
      !normalizedOptions?.linked_field_id

    if (shouldCreateReciprocal) {
      const targetTableId = String(normalizedOptions.linked_table_id)

      // Prevent self-linking at the API level too.
      if (targetTableId === tableId) {
        // Rollback: best-effort cleanup of created metadata + column.
        try {
          const dropSql = generateDropColumnSQL(table.supabase_table, finalSanitizedName)
          await supabase.rpc('execute_sql_safe', { sql_text: dropSql })
        } catch {
          // ignore
        }
        await supabase.from('table_fields').delete().eq('id', fieldData.id)

        return NextResponse.json(
          { error: 'Cannot create a link field that targets the same table.' },
          { status: 400 }
        )
      }

      // Load target table and its fields for uniqueness checks.
      const targetTable = await getTable(targetTableId)
      if (!targetTable) {
        // Rollback the source field.
        try {
          const dropSql = generateDropColumnSQL(table.supabase_table, finalSanitizedName)
          await supabase.rpc('execute_sql_safe', { sql_text: dropSql })
        } catch {
          // ignore
        }
        await supabase.from('table_fields').delete().eq('id', fieldData.id)

        return NextResponse.json(
          { error: 'Linked table not found' },
          { status: 404 }
        )
      }
      reciprocalTable = targetTable as any

      const targetExistingFields = await getTableFields(targetTableId)
      const targetExistingNames = targetExistingFields.map((f) => f.name.toLowerCase())

      // Default reciprocal label: the source field name with the source table name in brackets.
      // Example: "Projects (Clients)" if the source field is "Projects" in the "Clients" table.
      const sourceTableLabel = String((table as any)?.name || '').trim()
      const sourceFieldLabel = rawLabel || 'Linked records'
      const reciprocalLabelRaw = sourceTableLabel 
        ? `${sourceFieldLabel} (${sourceTableLabel})`
        : sourceFieldLabel

      // Sanitize + ensure uniqueness in the target table.
      let desiredReciprocalName = sanitizeFieldName(reciprocalLabelRaw)
      const { RESERVED_WORDS } = await import('@/types/fields')
      if (RESERVED_WORDS.includes(desiredReciprocalName.toLowerCase())) {
        desiredReciprocalName = `${desiredReciprocalName}_field`
      }

      // If there's a conflict, append a suffix. We re-use validateFieldName for consistent rules.
      let attempt = 0
      let reciprocalSanitizedName = desiredReciprocalName
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const nv = validateFieldName(reciprocalSanitizedName, targetExistingNames)
        if (nv.valid && !isSystemFieldName(reciprocalSanitizedName)) break
        attempt += 1
        reciprocalSanitizedName = `${desiredReciprocalName}_${attempt}`
        // guard: don't loop forever
        if (attempt > 50) {
          // Rollback the source field.
          try {
            const dropSql = generateDropColumnSQL(table.supabase_table, finalSanitizedName)
            await supabase.rpc('execute_sql_safe', { sql_text: dropSql })
          } catch {
            // ignore
          }
          await supabase.from('table_fields').delete().eq('id', fieldData.id)

          return NextResponse.json(
            { error: 'Failed to generate a unique reciprocal field name in the linked table.' },
            { status: 500 }
          )
        }
      }

      // Create reciprocal metadata in the target table.
      const reciprocalPosition = targetExistingFields.length
      const targetMaxOrderIndex = targetExistingFields.reduce((max, f) => {
        const oi = f.order_index ?? f.position ?? 0
        return Math.max(max, oi)
      }, -1)
      const reciprocalOrderIndex = targetMaxOrderIndex + 1

      const reciprocalOptions: FieldOptions = {
        ...(normalizedOptions || {}),
        linked_table_id: tableId,
        linked_field_id: fieldData.id, // point back to the source field
      }

      const { data: reciprocalFieldData, error: reciprocalFieldError } = await supabase
        .from('table_fields')
        .insert([
          {
            table_id: targetTableId,
            name: reciprocalSanitizedName,
            label: reciprocalLabelRaw,
            type: 'link_to_table',
            position: reciprocalPosition,
            order_index: reciprocalOrderIndex,
            required: false,
            default_value: null,
            options: reciprocalOptions,
          },
        ])
        .select()
        .single()

      if (reciprocalFieldError || !reciprocalFieldData) {
        // Rollback the source field.
        try {
          const dropSql = generateDropColumnSQL(table.supabase_table, finalSanitizedName)
          await supabase.rpc('execute_sql_safe', { sql_text: dropSql })
        } catch {
          // ignore
        }
        await supabase.from('table_fields').delete().eq('id', fieldData.id)

        const errorResponse = createErrorResponse(reciprocalFieldError, 'Failed to create reciprocal linked field', 500)
        return NextResponse.json(errorResponse, { status: 500 })
      }

      reciprocalField = reciprocalFieldData as TableField
      reciprocalColumnName = reciprocalSanitizedName

      // Add reciprocal SQL column to the target physical table.
      try {
        const reciprocalSql = generateAddColumnSQL(
          (targetTable as any).supabase_table,
          reciprocalSanitizedName,
          'link_to_table',
          reciprocalOptions
        )
        const { error: reciprocalSqlError } = await supabase.rpc('execute_sql_safe', { sql_text: reciprocalSql })
        if (reciprocalSqlError) {
          // Rollback both sides best-effort.
          await supabase.from('table_fields').delete().eq('id', reciprocalFieldData.id)
          try {
            const dropSql = generateDropColumnSQL(table.supabase_table, finalSanitizedName)
            await supabase.rpc('execute_sql_safe', { sql_text: dropSql })
          } catch {
            // ignore
          }
          await supabase.from('table_fields').delete().eq('id', fieldData.id)

          const errorResponse = createErrorResponse(reciprocalSqlError, 'Failed to create reciprocal column', 500)
          return NextResponse.json(errorResponse, { status: 500 })
        }

        // Trigger PostgREST schema cache refresh for the target table
        try {
          await supabase.rpc('execute_sql_safe', { sql_text: "NOTIFY pgrst, 'reload schema';" })
          await new Promise(resolve => setTimeout(resolve, 200))
        } catch {
          // Non-fatal: PostgREST will eventually pick up the new column
        }
      } catch (e: unknown) {
        // Rollback both sides best-effort.
        await supabase.from('table_fields').delete().eq('id', reciprocalFieldData.id)
        try {
          const dropSql = generateDropColumnSQL(table.supabase_table, finalSanitizedName)
          await supabase.rpc('execute_sql_safe', { sql_text: dropSql })
        } catch {
          // ignore
        }
        await supabase.from('table_fields').delete().eq('id', fieldData.id)

        const errorResponse = createErrorResponse(e, 'Failed to create reciprocal column', 500)
        return NextResponse.json(errorResponse, { status: 500 })
      }

      // Finally, update the *source* field to point to the reciprocal.
      const updatedSourceOptions: FieldOptions = {
        ...(normalizedOptions || {}),
        linked_field_id: reciprocalFieldData.id,
      }

      const { error: updateSourceLinkError } = await supabase
        .from('table_fields')
        .update({ options: updatedSourceOptions, updated_at: new Date().toISOString() })
        .eq('id', fieldData.id)

      if (updateSourceLinkError) {
        // Rollback best-effort: remove reciprocal + source metadata + columns.
        try {
          const dropRecSql = generateDropColumnSQL((targetTable as any).supabase_table, reciprocalSanitizedName)
          await supabase.rpc('execute_sql_safe', { sql_text: dropRecSql })
        } catch {
          // ignore
        }
        await supabase.from('table_fields').delete().eq('id', reciprocalFieldData.id)
        try {
          const dropSql = generateDropColumnSQL(table.supabase_table, finalSanitizedName)
          await supabase.rpc('execute_sql_safe', { sql_text: dropSql })
        } catch {
          // ignore
        }
        await supabase.from('table_fields').delete().eq('id', fieldData.id)

        const errorResponse = createErrorResponse(updateSourceLinkError, 'Failed to finalize link field relationship', 500)
        return NextResponse.json(errorResponse, { status: 500 })
      }
    }

    // 4. Update all views to include this field (and reciprocal if created)
    const { data: views } = await supabase
      .from('views')
      .select('id')
      .eq('table_id', tableId)

    if (views && views.length > 0) {
      const viewFields = views.map((view: { id: string }) => ({
        view_id: view.id,
        field_name: finalSanitizedName,
        visible: true,
        position: position,
      }))

      await supabase.from('view_fields').insert(viewFields)
    }

    if (reciprocalField && reciprocalColumnName && reciprocalTable) {
      const { data: targetViews } = await supabase
        .from('views')
        .select('id')
        .eq('table_id', reciprocalTable.id)

      if (targetViews && targetViews.length > 0) {
        const reciprocalViewFields = targetViews.map((view: { id: string }) => ({
          view_id: view.id,
          field_name: reciprocalColumnName!,
          visible: true,
          position: (reciprocalField as any).position ?? 0,
        }))

        await supabase.from('view_fields').insert(reciprocalViewFields)
      }
    }

    // TODO (Future Enhancement): Invalidate view metadata cache when fields change
    // import { clearViewMetaCache } from '@/hooks/useViewMeta'
    // clearViewMetaCache(undefined, params.tableId) // Clear all views for this table

    // Return the created field; include reciprocal info when applicable for UI follow-up.
    return NextResponse.json({
      field: fieldData,
      reciprocal_field: reciprocalField,
    })
  } catch (error: unknown) {
    const errorResponse = createErrorResponse(error, 'Failed to create field', 500)
    return NextResponse.json(errorResponse, { status: 500 })
  }
}

// PATCH: Update a field (rename, change type, or update options)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const supabase = await createClient()

  try {
    const { tableId } = await params
    const body = await request.json()
    const { fieldId, name, label, internal_name, type, required, default_value, options, group_name } = body

    if (!fieldId) {
      return NextResponse.json(
        { error: 'Field ID is required' },
        { status: 400 }
      )
    }

    // Get existing field
    const { data: existingField, error: fetchError } = await supabase
      .from('table_fields')
      .select('*')
      .eq('id', fieldId)
      .single()

    if (fetchError || !existingField) {
      return NextResponse.json(
        { error: 'Field not found' },
        { status: 404 }
      )
    }

    if (isSystemFieldName(existingField.name)) {
      return NextResponse.json(
        { error: `System field "${existingField.name}" cannot be edited.` },
        { status: 400 }
      )
    }

    // Get table
    const table = await getTable(tableId)
    if (!table) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      )
    }

    const updates: Partial<TableField> = {}
    const sqlOperations: string[] = []
    let isDestructive = false

    // Handle label change (preferred).
    // Backward compatibility: if `label` not provided, treat `name` as label-only and do not rename the underlying column.
    const nextLabel =
      typeof label === 'string'
        ? label.trim()
        : typeof name === 'string'
          ? name.trim()
          : undefined

    if (nextLabel !== undefined && nextLabel !== (existingField.label ?? '')) {
      updates.label = nextLabel || null
    }

    // Handle internal identifier change (rare; renames DB column + updates view_fields)
    if (internal_name && internal_name !== existingField.name) {
      const existingFields = await getTableFields(tableId)
      const existingNames = existingFields
        .filter(f => f.id !== fieldId)
        .map(f => f.name.toLowerCase())

      const desiredInternalName = sanitizeFieldName(String(internal_name))
      const nameValidation = validateFieldName(desiredInternalName, existingNames)
      if (!nameValidation.valid) {
        return NextResponse.json(
          { error: nameValidation.error },
          { status: 400 }
        )
      }

      const newSanitizedName = desiredInternalName
      updates.name = newSanitizedName

      // Only rename SQL column if field is not virtual
      if (existingField.type !== 'formula' && existingField.type !== 'lookup') {
        sqlOperations.push(
          generateRenameColumnSQL(table.supabase_table, existingField.name, newSanitizedName)
        )
      }

      // Update view_fields to use new name for all views of this table
      const { data: views } = await supabase
        .from('views')
        .select('id')
        .eq('table_id', tableId)
      
      if (views && views.length > 0) {
        for (const view of views) {
          await supabase
            .from('view_fields')
            .update({ field_name: newSanitizedName })
            .eq('view_id', view.id)
            .eq('field_name', existingField.name)
        }
      }
    }

    // Handle type change
    if (type && type !== existingField.type) {
      const typeChangeCheck = canChangeType(existingField.type as FieldType, type as FieldType)
      if (!typeChangeCheck.canChange) {
        return NextResponse.json(
          { error: typeChangeCheck.warning || 'Cannot change field type' },
          { status: 400 }
        )
      }

      isDestructive = isDestructiveTypeChange(existingField.type as FieldType, type as FieldType)

      // Validate new options
      const optionsValidation = validateFieldOptions(type as FieldType, options || existingField.options)
      if (!optionsValidation.valid) {
        return NextResponse.json(
          { error: optionsValidation.error },
          { status: 400 }
        )
      }

      updates.type = type as FieldType
      updates.options = options || existingField.options || {}

      // Only change SQL column type for certain conversions
      // For text → date/number/checkbox, we update metadata only (no data migration)
      const shouldMigrateData = !(
        existingField.type === 'text' && 
        (type === 'date' || type === 'number' || type === 'checkbox')
      )

      // Only change SQL column if both are physical types AND we should migrate data
      if (existingField.type !== 'formula' && existingField.type !== 'lookup' &&
          type !== 'formula' && type !== 'lookup' && shouldMigrateData) {
        sqlOperations.push(
          generateChangeColumnTypeSQL(
            table.supabase_table,
            updates.name || existingField.name,
            existingField.type as FieldType,
            type as FieldType,
            options || existingField.options
          )
        )
      } else if (existingField.type === 'formula' || existingField.type === 'lookup') {
        // Converting from virtual to physical - need to add column
        if (type !== 'formula' && type !== 'lookup') {
          sqlOperations.push(
            generateAddColumnSQL(table.supabase_table, updates.name || existingField.name, type as FieldType, options)
          )
        }
      } else if (type === 'formula' || type === 'lookup') {
        // Converting from physical to virtual - need to drop column
        sqlOperations.push(
          generateDropColumnSQL(table.supabase_table, existingField.name)
        )
      }
    }

    // Handle options update
    if (options && JSON.stringify(options) !== JSON.stringify(existingField.options)) {
      const optionsValidation = validateFieldOptions(
        (type || existingField.type) as FieldType,
        options
      )
      if (!optionsValidation.valid) {
        return NextResponse.json(
          { error: optionsValidation.error },
          { status: 400 }
        )
      }

      // Additional validation for lookup fields: lookup_field_id must be a linked field
      const fieldType = (type || existingField.type) as FieldType
      if (fieldType === 'lookup' && options.lookup_field_id && options.lookup_table_id) {
        const { data: linkedField, error: linkedFieldError } = await supabase
          .from('table_fields')
          .select('id, type, options')
          .eq('id', options.lookup_field_id)
          .eq('table_id', tableId)
          .single()

        if (linkedFieldError || !linkedField) {
          return NextResponse.json(
            { error: 'Lookup field must reference a linked field (link_to_table) in the current table' },
            { status: 400 }
          )
        }

        if (linkedField.type !== 'link_to_table') {
          return NextResponse.json(
            { error: `Lookup field must reference a linked field, but field "${linkedField.id}" is of type "${linkedField.type}"` },
            { status: 400 }
          )
        }

        const linkedTableId = (linkedField.options as any)?.linked_table_id
        if (linkedTableId !== options.lookup_table_id) {
          return NextResponse.json(
            { error: `Lookup field references a linked field that points to a different table. The linked field must connect to the lookup table.` },
            { status: 400 }
          )
        }
      }
      updates.options = options
    }

    // Handle group_name update
    if (group_name !== undefined) {
      updates.group_name = group_name || null
    }

    // Handle other updates
    if (required !== undefined) updates.required = required
    if (default_value !== undefined) updates.default_value = default_value

    // Verify table exists before executing SQL operations
    if (sqlOperations.length > 0) {
      const { error: tableCheckError } = await supabase
        .from(table.supabase_table)
        .select('id')
        .limit(1)
      
      if (tableCheckError) {
        if (isTableNotFoundError(tableCheckError)) {
          return NextResponse.json(
            { 
              error: `Table "${table.supabase_table}" does not exist. Please create the table first or verify the table name in Settings.`,
              error_code: 'TABLE_NOT_FOUND',
              table_name: table.supabase_table
            },
            { status: 404 }
          )
        }
      }
    }

    // Execute SQL operations
    for (const sql of sqlOperations) {
      const { error: sqlError } = await supabase.rpc('execute_sql_safe', {
        sql_text: sql
      })

      if (sqlError) {
        if (isTableNotFoundError(sqlError)) {
          return NextResponse.json(
            { 
              error: `Table "${table.supabase_table}" does not exist. Please create the table first or verify the table name in Settings.`,
              error_code: 'TABLE_NOT_FOUND',
              table_name: table.supabase_table,
              details: sqlError.message
            },
            { status: 404 }
          )
        }
        
        const errorResponse = createErrorResponse(sqlError, 'Failed to update column', 500)
        return NextResponse.json(errorResponse, { status: 500 })
      }
    }

    // Update metadata
    const { data: updatedField, error: updateError } = await supabase
      .from('table_fields')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', fieldId)
      .select()
      .single()

    if (updateError) {
      const errorResponse = createErrorResponse(updateError, 'Failed to update field', 500)
      return NextResponse.json(errorResponse, { status: 500 })
    }

    // TODO (Future Enhancement): Invalidate view metadata cache when fields change
    // import { clearViewMetaCache } from '@/hooks/useViewMeta'
    // clearViewMetaCache(undefined, params.tableId) // Clear all views for this table

    return NextResponse.json({
      field: updatedField,
      warning: isDestructive ? 'Type change may result in data loss' : undefined,
    })
  } catch (error: unknown) {
    const errorResponse = createErrorResponse(error, 'Failed to update field', 500)
    return NextResponse.json(errorResponse, { status: 500 })
  }
}

// DELETE: Delete a field
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const supabase = await createClient()

  try {
    const { tableId } = await params
    const { searchParams } = new URL(request.url)
    // Prefer query param for REST-y semantics, but accept JSON body for backward compatibility.
    let fieldId = searchParams.get('fieldId')
    if (!fieldId) {
      try {
        const body = await request.json()
        if (body && typeof body.fieldId === 'string') {
          fieldId = body.fieldId
        }
      } catch {
        // ignore (no JSON body)
      }
    }

    if (!fieldId) {
      return NextResponse.json(
        { error: 'Field ID is required' },
        { status: 400 }
      )
    }

    // Get field
    const { data: field, error: fetchError } = await supabase
      .from('table_fields')
      .select('*')
      .eq('id', fieldId)
      .single()

    if (fetchError || !field) {
      return NextResponse.json(
        { error: 'Field not found' },
        { status: 404 }
      )
    }

    if (isSystemFieldName(field.name)) {
      return NextResponse.json(
        { error: `System field "${field.name}" cannot be deleted.` },
        { status: 400 }
      )
    }

    // Check if field is used in links or lookups
    const { data: linkedFields } = await supabase
      .from('table_fields')
      .select('id, name, options')
      .or('type.eq.link_to_table,type.eq.lookup')

    const isReferenced = linkedFields?.some((f) => {
      const opts = f.options || {}
      return opts.linked_field_id === fieldId || opts.lookup_field_id === fieldId
    })

    if (isReferenced) {
      return NextResponse.json(
        { error: 'Cannot delete field: it is referenced by other fields (links or lookups)' },
        { status: 400 }
      )
    }

    // Get table
    const table = await getTable(tableId)
    if (!table) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      )
    }

    // If deleting a bidirectional link field, also delete its reciprocal field (Baserow-style behavior).
    // We do this before deleting the current field so we can still read its options.
    if (field.type === 'link_to_table') {
      const linkedFieldId = (field.options as any)?.linked_field_id
      const linkedTableId = (field.options as any)?.linked_table_id

      if (isUuid(linkedFieldId) && typeof linkedTableId === 'string' && linkedTableId.trim().length > 0) {
        const { data: reciprocal, error: reciprocalFetchError } = await supabase
          .from('table_fields')
          .select('*')
          .eq('id', linkedFieldId)
          .maybeSingle()

        if (!reciprocalFetchError && reciprocal && reciprocal.type === 'link_to_table') {
          // Best-effort: delete reciprocal SQL column + metadata.
          const reciprocalTable = await getTable(reciprocal.table_id)
          if (reciprocalTable) {
            // Drop column if physical
            if (reciprocal.type !== 'formula' && reciprocal.type !== 'lookup') {
              try {
                const sql = generateDropColumnSQL((reciprocalTable as any).supabase_table, reciprocal.name)
                await supabase.rpc('execute_sql_safe', { sql_text: sql })
              } catch {
                // ignore
              }
            }

            // Delete reciprocal from view_fields
            await supabase.from('view_fields').delete().eq('field_name', reciprocal.name)

            // Delete reciprocal metadata
            await supabase.from('table_fields').delete().eq('id', reciprocal.id)
          }
        }
      }
    }

    // Delete SQL column if not virtual
    if (field.type !== 'formula' && field.type !== 'lookup') {
      // Verify table exists before executing SQL
      const { error: tableCheckError } = await supabase
        .from(table.supabase_table)
        .select('id')
        .limit(1)
      
      if (tableCheckError) {
        if (isTableNotFoundError(tableCheckError)) {
          // Table doesn't exist - continue with metadata cleanup only
          console.warn(`Table "${table.supabase_table}" does not exist, skipping column drop`)
        } else {
          // Other error - log but continue with metadata cleanup
          console.error('Error checking table existence:', tableCheckError)
        }
      } else {
        // Table exists - proceed with dropping column
        const sql = generateDropColumnSQL(table.supabase_table, field.name)
        const { error: sqlError } = await supabase.rpc('execute_sql_safe', {
          sql_text: sql
        })

        if (sqlError) {
          console.error('Error dropping column:', sqlError)
          // Continue anyway - metadata cleanup is more important
        }
      }
    }

    // Delete from view_fields
    const { error: viewFieldsDeleteError } = await supabase
      .from('view_fields')
      .delete()
      .eq('field_name', field.name)
    if (viewFieldsDeleteError) {
      // Non-fatal: this can fail under some RLS policies; field metadata deletion is the primary action.
      console.warn('Failed to delete view_fields rows for field:', {
        field_name: field.name,
        error: viewFieldsDeleteError,
      })
    }

    // Delete metadata
    // Check if user is admin first - if so, use SQL method directly to bypass RLS/triggers
    const userIsAdmin = await isAdmin()
    let deletedRows: unknown[] | null = null
    let deleteError: unknown = null

    if (userIsAdmin) {
      // For admins, use admin client directly (bypasses RLS)
      console.log('[Field Delete] User is admin, using admin client to bypass RLS...')
      console.log('[Field Delete] Field ID:', fieldId, 'Field name:', field?.name)
      
      // Check if it's a system field first (triggers will block these)
      if (field && isSystemFieldName(field.name)) {
        return NextResponse.json(
          { error: `System field "${field.name}" cannot be deleted.` },
          { status: 400 }
        )
      }
      
      try {
        // Use admin client directly - it bypasses RLS
        const adminClient = createAdminClient()
        const adminResult = await adminClient
          .from('table_fields')
          .delete()
          .eq('id', fieldId)
          .select('id')
        
        console.log('[Field Delete] Admin client result:', {
          data: adminResult.data,
          error: adminResult.error,
          dataLength: adminResult.data?.length || 0
        })
        
        if (adminResult.error) {
          console.error('[Field Delete] Admin client delete error:', adminResult.error)
          
          // Check if it's a trigger exception (system field protection)
          if (adminResult.error.message?.includes('cannot be deleted') || 
              adminResult.error.message?.includes('System field')) {
            deleteError = new Error(`Trigger blocked deletion: ${adminResult.error.message}. This field may be a system field.`)
          } else {
            deleteError = adminResult.error
          }
        } else if (adminResult.data && adminResult.data.length > 0) {
          // Successfully deleted
          deletedRows = adminResult.data
          deleteError = null
          console.log('[Field Delete] Successfully deleted via admin client')
        } else {
          // Admin client returned 0 rows - try SQL as fallback
          console.warn('[Field Delete] Admin client returned 0 rows, trying SQL fallback...')
          try {
            // Use simple SQL delete - execute_sql_safe will handle errors
            const sqlResult = await supabase.rpc('execute_sql_safe', {
              sql_text: `DELETE FROM public.table_fields WHERE id = '${fieldId}'::uuid;`
            })
            
            if (sqlResult.error) {
              console.error('[Field Delete] SQL fallback error:', sqlResult.error)
              const errorMsg = sqlResult.error.message || String(sqlResult.error) || ''
              
              // Check if it's a trigger exception
              if (errorMsg.includes('cannot be deleted') || 
                  errorMsg.includes('System field') ||
                  errorMsg.includes('trigger') ||
                  errorMsg.includes('prevent_system_field')) {
                deleteError = new Error(`Trigger blocked deletion: ${errorMsg}`)
              } else {
                deleteError = sqlResult.error
              }
            } else {
              // SQL executed without error - verify deletion
              try {
                await new Promise(resolve => setTimeout(resolve, 100)) // Small delay for transaction commit
                
                const verifyResult = await adminClient
                  .from('table_fields')
                  .select('id, name')
                  .eq('id', fieldId)
                  .maybeSingle()
                
                console.log('[Field Delete] SQL verification:', {
                  fieldExists: !!verifyResult.data,
                  fieldName: verifyResult.data?.name,
                  error: verifyResult.error
                })
                
                if (!verifyResult.data) {
                  deletedRows = [{ id: fieldId }]
                  deleteError = null
                  console.log('[Field Delete] Successfully deleted via SQL fallback')
                } else {
                  console.error('[Field Delete] SQL executed but field still exists:', verifyResult.data)
                  deleteError = new Error(`Field deletion failed: SQL executed but field still exists (${verifyResult.data.name}). This indicates a trigger or constraint is blocking the deletion.`)
                }
              } catch (verifyError: any) {
                console.error('[Field Delete] Verification error:', verifyError)
                // If verification fails, we can't be sure - don't assume success
                const verifyErrorMessage = (verifyError as { message?: string })?.message || String(verifyError)
                deleteError = new Error(`Field deletion verification failed: ${verifyErrorMessage}`)
              }
            }
          } catch (sqlError: unknown) {
            console.error('[Field Delete] SQL fallback exception:', sqlError)
            deleteError = sqlError instanceof Error ? sqlError : new Error(String(sqlError))
          }
        }
      } catch (adminError: unknown) {
        console.error('[Field Delete] Admin client operation failed:', adminError)
        deleteError = adminError instanceof Error ? adminError : new Error(String(adminError))
      }
    } else {
      // For non-admins, try regular client (respects RLS)
      console.log('[Field Delete] User is not admin, using regular client (respects RLS)...')
      const result = await supabase
        .from('table_fields')
        .delete()
        .eq('id', fieldId)
        .select('id')
      
      deletedRows = result.data
      deleteError = result.error
      
      // If delete failed with 0 rows (RLS blocking), provide helpful error
      if ((!deletedRows || deletedRows.length === 0) && !deleteError) {
        console.log('[Field Delete] Regular client delete returned 0 rows - RLS may be blocking')
      }
    }

    if (deleteError) {
      // Check if it's a trigger/constraint error - return 403 instead of 500
      const errorObj = deleteError as { message?: string } | null
      const errorMsg = errorObj?.message || String(deleteError) || ''
      const isBlockedError = errorMsg.includes('cannot be deleted') || 
                            errorMsg.includes('System field') ||
                            errorMsg.includes('trigger') ||
                            errorMsg.includes('prevent_system_field') ||
                            errorMsg.includes('constraint') ||
                            errorMsg.includes('blocking')
      
      const statusCode = isBlockedError ? 403 : 500
      const errorResponse = createErrorResponse(deleteError, 'Failed to delete field', statusCode)
      return NextResponse.json(errorResponse, { status: statusCode })
    }

    if (!deletedRows || deletedRows.length === 0) {
      // Check if there's a trigger that might be blocking (system field protection)
      const { data: fieldCheck } = await supabase
        .from('table_fields')
        .select('name')
        .eq('id', fieldId)
        .single()
      
      const isSystemField = fieldCheck?.name && isSystemFieldName(fieldCheck.name)
      
      // Build detailed error message
      let errorMessage = 'Field was not deleted.'
      if (isSystemField) {
        errorMessage = `System field "${fieldCheck.name}" cannot be deleted.`
      } else if (userIsAdmin) {
        errorMessage = 'Field was not deleted. Admin SQL method was used but deletion failed. This may be caused by a trigger blocking the delete. Check server logs for details.'
      } else {
        errorMessage = 'Field was not deleted. This is usually caused by Row Level Security (RLS) blocking deletes for your current user/session. If you are an admin, the code should have used the admin fallback - check server logs to see if admin detection is working.'
      }
      
      return NextResponse.json(
        {
          error: errorMessage,
          error_code: isSystemField ? 'SYSTEM_FIELD_DELETE_BLOCKED' : 'FIELD_DELETE_NOT_PERMITTED',
          details: !isSystemField ? {
            userIsAdmin: userIsAdmin,
            fieldId: fieldId,
            fieldName: field?.name || fieldCheck?.name,
            suggestion: userIsAdmin 
              ? 'Check server logs for [Field Delete] messages. The SQL method was used but may have been blocked by a trigger.'
              : 'Run CHECK_TABLE_FIELDS_RLS.sql in Supabase SQL editor to diagnose RLS policies. If you are an admin, check why admin detection failed.',
            migration: 'Run ensure_table_fields_delete_rls.sql migration if DELETE policy is missing'
          } : undefined
        },
        { status: 403 }
      )
    }

    // TODO (Future Enhancement): Invalidate view metadata cache when fields change
    // import { clearViewMetaCache } from '@/hooks/useViewMeta'
    // clearViewMetaCache(undefined, params.tableId) // Clear all views for this table

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const errorResponse = createErrorResponse(error, 'Failed to delete field', 500)
    return NextResponse.json(errorResponse, { status: 500 })
  }
}
