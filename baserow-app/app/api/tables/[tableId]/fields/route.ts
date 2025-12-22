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
  mapFieldTypeToPostgres,
} from '@/lib/fields/sqlGenerator'
import { getTableFields } from '@/lib/fields/schema'
import type { TableField, FieldType, FieldOptions } from '@/types/fields'

// GET: Get all fields for a table
export async function GET(
  request: NextRequest,
  { params }: { params: { tableId: string } }
) {
  try {
    const fields = await getTableFields(params.tableId)
    
    // If no fields exist, return empty array (table_fields table might not exist yet)
    return NextResponse.json({ fields: fields || [] })
  } catch (error: any) {
    // If table doesn't exist (42P01) or relation doesn't exist (PGRST116), return empty array
    // Also handle HTTP status codes and various error formats
    const errorCode = error.code || error.status || ''
    const errorMessage = error.message || ''
    const errorDetails = error.details || ''
    
    if (errorCode === '42P01' || 
        errorCode === 'PGRST116' || 
        errorCode === '404' ||
        errorCode === 404 ||
        errorMessage?.includes('relation') || 
        errorMessage?.includes('does not exist') ||
        errorMessage?.includes('table_fields') ||
        errorDetails?.includes('relation') ||
        errorDetails?.includes('does not exist')) {
      console.warn(`table_fields table may not exist for table ${params.tableId} (code: ${errorCode}), returning empty fields array`)
      return NextResponse.json({ fields: [] })
    }
    console.error('Error fetching fields:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch fields' },
      { status: 500 }
    )
  }
}

// POST: Create a new field
export async function POST(
  request: NextRequest,
  { params }: { params: { tableId: string } }
) {
  const supabase = await createClient()

  try {
    const body = await request.json()
    const { name, type, required, default_value, options } = body

    if (!name || !type) {
      return NextResponse.json(
        { error: 'Field name and type are required' },
        { status: 400 }
      )
    }

    // Get table to find supabase_table name
    const table = await getTable(params.tableId)
    if (!table) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      )
    }

    // Get existing fields to validate uniqueness
    const existingFields = await getTableFields(params.tableId)
    const existingNames = existingFields.map(f => f.name.toLowerCase())

    // Validate field name
    const nameValidation = validateFieldName(name, existingNames)
    if (!nameValidation.valid) {
      return NextResponse.json(
        { error: nameValidation.error },
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

    const sanitizedName = sanitizeFieldName(name)
    const position = existingFields.length

    // Start transaction-like operation
    // 1. Create metadata record (table_fields table must exist)
    const { data: fieldData, error: fieldError } = await supabase
      .from('table_fields')
      .insert([
        {
          table_id: params.tableId,
          name: sanitizedName,
          type: type as FieldType,
          position,
          required: required || false,
          default_value: default_value || null,
          options: options || {},
        },
      ])
      .select()
      .single()

    if (fieldError) {
      // If table_fields doesn't exist, provide helpful error
      // Supabase returns PGRST116 for missing tables, 42P01 for PostgreSQL errors
      if (fieldError.code === '42P01' || fieldError.code === 'PGRST116' || 
          fieldError.message?.includes('relation') || 
          fieldError.message?.includes('does not exist') ||
          fieldError.message?.includes('table_fields')) {
        return NextResponse.json(
          { 
            error: 'table_fields table does not exist. Please run the migration create_table_fields.sql in Supabase.',
            code: 'MISSING_TABLE',
            details: 'The table_fields table is required for field management. Run the migration file: supabase/migrations/create_table_fields.sql'
          },
          { status: 500 }
        )
      }
      console.error('Error creating field metadata:', fieldError)
      return NextResponse.json(
        { error: `Failed to create field: ${fieldError.message}` },
        { status: 500 }
      )
    }

    // 2. Add column to physical table (if not virtual)
    if (type !== 'formula' && type !== 'lookup') {
      try {
        const sql = generateAddColumnSQL(table.supabase_table, sanitizedName, type as FieldType, options)
        
        const { error: sqlError } = await supabase.rpc('execute_sql_safe', {
          sql_text: sql
        })

        if (sqlError) {
          // Rollback: Delete metadata
          await supabase.from('table_fields').delete().eq('id', fieldData.id)
          
          return NextResponse.json(
            { error: `Failed to create column: ${sqlError.message}` },
            { status: 500 }
          )
        }
      } catch (sqlErr: any) {
        // Rollback: Delete metadata
        await supabase.from('table_fields').delete().eq('id', fieldData.id)
        
        return NextResponse.json(
          { error: `Failed to create column: ${sqlErr.message}` },
          { status: 500 }
        )
      }
    }

    // 3. Update all views to include this field
    const { data: views } = await supabase
      .from('views')
      .select('id')
      .eq('table_id', params.tableId)

    if (views && views.length > 0) {
      const viewFields = views.map(view => ({
        view_id: view.id,
        field_name: sanitizedName,
        visible: true,
        position: position,
      }))

      await supabase.from('view_fields').insert(viewFields)
    }

    return NextResponse.json({ field: fieldData })
  } catch (error: any) {
    console.error('Error creating field:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create field' },
      { status: 500 }
    )
  }
}

// PATCH: Update a field (rename, change type, or update options)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { tableId: string } }
) {
  const supabase = await createClient()

  try {
    const body = await request.json()
    const { fieldId, name, type, required, default_value, options } = body

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

    // Get table
    const table = await getTable(params.tableId)
    if (!table) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      )
    }

    const updates: Partial<TableField> = {}
    let sqlOperations: string[] = []
    let isDestructive = false

    // Handle name change
    if (name && name !== existingField.name) {
      const existingFields = await getTableFields(params.tableId)
      const existingNames = existingFields
        .filter(f => f.id !== fieldId)
        .map(f => f.name.toLowerCase())

      const nameValidation = validateFieldName(name, existingNames)
      if (!nameValidation.valid) {
        return NextResponse.json(
          { error: nameValidation.error },
          { status: 400 }
        )
      }

      const newSanitizedName = sanitizeFieldName(name)
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
        .eq('table_id', params.tableId)
      
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

      // Only change SQL column if both are physical types
      if (existingField.type !== 'formula' && existingField.type !== 'lookup' &&
          type !== 'formula' && type !== 'lookup') {
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

    // Handle other updates
    if (required !== undefined) updates.required = required
    if (default_value !== undefined) updates.default_value = default_value

    // Execute SQL operations
    for (const sql of sqlOperations) {
      const { error: sqlError } = await supabase.rpc('execute_sql_safe', {
        sql_text: sql
      })

      if (sqlError) {
        console.error('SQL execution error:', sqlError)
        return NextResponse.json(
          { error: `Failed to update column: ${sqlError.message}` },
          { status: 500 }
        )
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
      return NextResponse.json(
        { error: `Failed to update field: ${updateError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      field: updatedField,
      warning: isDestructive ? 'Type change may result in data loss' : undefined,
    })
  } catch (error: any) {
    console.error('Error updating field:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update field' },
      { status: 500 }
    )
  }
}

// DELETE: Delete a field
export async function DELETE(
  request: NextRequest,
  { params }: { params: { tableId: string } }
) {
  const supabase = await createClient()

  try {
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

    // Check if field is used in links or lookups
    const { data: linkedFields } = await supabase
      .from('table_fields')
      .select('id, name, options')
      .eq('table_id', params.tableId)
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
    const table = await getTable(params.tableId)
    if (!table) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      )
    }

    // Delete SQL column if not virtual
    if (field.type !== 'formula' && field.type !== 'lookup') {
      const sql = generateDropColumnSQL(table.supabase_table, field.name)
      const { error: sqlError } = await supabase.rpc('execute_sql_safe', {
        sql_text: sql
      })

      if (sqlError) {
        console.error('Error dropping column:', sqlError)
        // Continue anyway - metadata cleanup is more important
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
      return NextResponse.json(
        { error: `Failed to delete field: ${deleteError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting field:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete field' },
      { status: 500 }
    )
  }
}
