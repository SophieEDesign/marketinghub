import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
import { isTableNotFoundError, createErrorResponse } from '@/lib/api/error-handling'
import type { TableField, FieldType, FieldOptions } from '@/types/fields'

const SYSTEM_FIELD_NAMES = new Set(['created_at', 'created_by', 'updated_at', 'updated_by'])
function isSystemFieldName(name: string) {
  return SYSTEM_FIELD_NAMES.has(String(name || '').toLowerCase())
}

// GET: Get all fields for a table
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params
    const fields = await getTableFields(tableId)
    
    // Do not cache: field metadata changes frequently (settings edits, reorder, etc.)
    // and caching causes the UI to show stale settings after a successful save.
    const response = NextResponse.json({ fields: fields || [] })
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error: any) {
    // If table doesn't exist, return empty array (graceful degradation)
    if (isTableNotFoundError(error)) {
      const { tableId } = await params
      console.warn(`table_fields table may not exist for table ${tableId}, returning empty fields array`)
      const response = NextResponse.json({ fields: [] })
      response.headers.set('Cache-Control', 'no-store')
      return response
    }
    
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
    const position = existingFields.length
    // Set order_index to the max order_index + 1, or use position if no order_index exists
    const maxOrderIndex = existingFields.reduce((max, f) => {
      const orderIndex = f.order_index ?? f.position ?? 0
      return Math.max(max, orderIndex)
    }, -1)
    const order_index = maxOrderIndex + 1

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
          options: options || {},
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
        
        const sql = generateAddColumnSQL(table.supabase_table, finalSanitizedName, type as FieldType, options)
        
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
      } catch (sqlErr: any) {
        // Rollback: Delete metadata
        await supabase.from('table_fields').delete().eq('id', fieldData.id)
        
        const errorResponse = createErrorResponse(sqlErr, 'Failed to create column', 500)
        return NextResponse.json(errorResponse, { status: 500 })
      }
    }

    // 3. Update all views to include this field
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

    // TODO (Future Enhancement): Invalidate view metadata cache when fields change
    // import { clearViewMetaCache } from '@/hooks/useViewMeta'
    // clearViewMetaCache(undefined, params.tableId) // Clear all views for this table

    return NextResponse.json({ field: fieldData })
  } catch (error: any) {
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
    let sqlOperations: string[] = []
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
  } catch (error: any) {
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
    const fieldId = searchParams.get('fieldId')

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
      .eq('table_id', tableId)
      .or('type.eq.link_to_table,type.eq.lookup')

    const isReferenced = linkedFields?.some((f: any) => {
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
    await supabase
      .from('view_fields')
      .delete()
      .eq('field_name', field.name)

    // Delete metadata
    const { error: deleteError } = await supabase
      .from('table_fields')
      .delete()
      .eq('id', fieldId)

    if (deleteError) {
      const errorResponse = createErrorResponse(deleteError, 'Failed to delete field', 500)
      return NextResponse.json(errorResponse, { status: 500 })
    }

    // TODO (Future Enhancement): Invalidate view metadata cache when fields change
    // import { clearViewMetaCache } from '@/hooks/useViewMeta'
    // clearViewMetaCache(undefined, params.tableId) // Clear all views for this table

    return NextResponse.json({ success: true })
  } catch (error: any) {
    const errorResponse = createErrorResponse(error, 'Failed to delete field', 500)
    return NextResponse.json(errorResponse, { status: 500 })
  }
}
