import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/views/[viewId]/initialize-fields
 * Initialize view_fields for a view by adding all table fields
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ viewId: string }> }
) {
  try {
    const supabase = await createClient()
    const { viewId } = await params

    // 1. Get the view to find its table_id
    const { data: view, error: viewError } = await supabase
      .from('views')
      .select('table_id')
      .eq('id', viewId)
      .single()

    if (viewError || !view) {
      return NextResponse.json(
        { error: 'View not found', error_code: 'VIEW_NOT_FOUND' },
        { status: 404 }
      )
    }

    // 2. Get all table fields for this table
    const { data: tableFields, error: fieldsError } = await supabase
      .from('table_fields')
      .select('name, position, order_index')
      .eq('table_id', view.table_id)
      .order('order_index', { ascending: true })
      .order('position', { ascending: true })

    if (fieldsError) {
      return NextResponse.json(
        { error: 'Failed to load table fields', error_code: 'FIELDS_ERROR', details: fieldsError.message },
        { status: 500 }
      )
    }

    if (!tableFields || tableFields.length === 0) {
      return NextResponse.json(
        { error: 'No fields found in table', error_code: 'NO_FIELDS' },
        { status: 400 }
      )
    }

    // 3. Get existing view_fields to avoid duplicates
    const { data: existingViewFields, error: existingError } = await supabase
      .from('view_fields')
      .select('field_name')
      .eq('view_id', viewId)

    if (existingError && existingError.code !== 'PGRST116') {
      // PGRST116 is "no rows returned", which is fine
      return NextResponse.json(
        { error: 'Failed to check existing fields', error_code: 'CHECK_ERROR', details: existingError.message },
        { status: 500 }
      )
    }

    const existingFieldNames = new Set(
      (existingViewFields || []).map((vf: any) => vf.field_name)
    )

    // 4. Create view_fields for fields that don't exist yet
    const fieldsToAdd = tableFields
      .filter((field) => !existingFieldNames.has(field.name))
      .map((field, index) => ({
        view_id: viewId,
        field_name: field.name,
        visible: true,
        position: field.order_index ?? field.position ?? index,
      }))

    if (fieldsToAdd.length === 0) {
      return NextResponse.json({
        message: 'All fields already configured',
        added: 0,
        total: tableFields.length,
      })
    }

    // 5. Insert the new view_fields
    const { data: insertedFields, error: insertError } = await supabase
      .from('view_fields')
      .insert(fieldsToAdd)
      .select()

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to add fields to view', error_code: 'INSERT_ERROR', details: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: `Successfully added ${fieldsToAdd.length} field(s) to view`,
      added: fieldsToAdd.length,
      total: tableFields.length,
      fields: insertedFields,
    })
  } catch (error: any) {
    console.error('Error initializing view fields:', error)
    return NextResponse.json(
      { error: 'Internal server error', error_code: 'INTERNAL_ERROR', details: error.message },
      { status: 500 }
    )
  }
}
