import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeUuid } from '@/lib/utils/ids'

const SYSTEM_FIELD_NAMES = new Set(['created_at', 'created_by', 'updated_at', 'updated_by'])
function isSystemFieldName(name: string) {
  return SYSTEM_FIELD_NAMES.has(String(name || '').toLowerCase())
}

/**
 * POST /api/views/[viewId]/initialize-fields
 * Initialize view_fields for a view by adding all table fields
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ viewId: string }> }
) {
  const { viewId } = await params
  const viewUuid = normalizeUuid(viewId)
  try {
    if (!viewUuid) {
      return NextResponse.json(
        { error: 'Invalid viewId (expected UUID)', error_code: 'INVALID_VIEW_ID', viewId },
        { status: 400 }
      )
    }
    const supabase = await createClient()
    console.log('🔥 initialize-fields CALLED', { viewId, viewUuid })

    // 1. Get the view to find its table_id
    const { data: view, error: viewError } = await supabase
      .from('views')
      .select('table_id')
      .eq('id', viewUuid)
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
      .eq('view_id', viewUuid)

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
        view_id: viewUuid,
        field_name: field.name,
        // System fields should exist for sorting/filtering but stay hidden by default.
        visible: !isSystemFieldName(field.name),
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
    // Try batch insert first for performance
    const { data: insertedFields, error: insertError } = await supabase
      .from('view_fields')
      .insert(fieldsToAdd)
      .select()

    if (insertError) {
      // Check for unique constraint violation - if so, try inserting individually to skip duplicates
      const isUniqueViolation = insertError.code === '23505' || 
                                insertError.message?.includes('unique') || 
                                insertError.message?.includes('duplicate')
      
      // Check for RLS policy violation
      const isRLSViolation = insertError.code === '42501' || 
                            insertError.message?.includes('permission') || 
                            insertError.message?.includes('policy') ||
                            insertError.message?.includes('row-level security')
      
      // Check if table doesn't exist (common during rapid mount/unmount)
      const isTableNotFound = insertError.code === '42P01' || 
                             insertError.code === 'PGRST205' ||
                             insertError.message?.includes('does not exist') ||
                             insertError.message?.includes('relation')
      
      if (isTableNotFound) {
        // Table doesn't exist - return success with warning (fields may already be initialized)
        console.warn('🔥 initialize-fields: view_fields table may not exist, but this is OK', {
          viewId,
          errorCode: insertError.code,
          errorMessage: insertError.message,
        })
        return NextResponse.json({
          message: 'Fields may already be initialized or table does not exist',
          added: 0,
          total: tableFields.length,
          warning: 'View fields table may not exist. Fields may already be configured.',
        })
      }
      
      if (isUniqueViolation) {
        // Try inserting individually to skip duplicates
        console.log(`Batch insert failed due to unique constraint, trying individual inserts for ${fieldsToAdd.length} fields`)
        const successfulInserts: any[] = []
        const skippedFields: string[] = []
        
        for (const fieldToAdd of fieldsToAdd) {
          const { data, error } = await supabase
            .from('view_fields')
            .insert(fieldToAdd)
            .select()
            .single()
          
          if (error) {
            if (error.code === '23505' || error.message?.includes('unique') || error.message?.includes('duplicate')) {
              skippedFields.push(fieldToAdd.field_name)
            } else {
              console.error(`Error inserting field ${fieldToAdd.field_name}:`, error)
            }
          } else if (data) {
            successfulInserts.push(data)
          }
        }
        
        if (successfulInserts.length > 0 || skippedFields.length === fieldsToAdd.length) {
          // Success if we added fields OR if all fields already existed (all skipped)
          return NextResponse.json({
            message: skippedFields.length === fieldsToAdd.length 
              ? 'All fields already configured'
              : `Successfully added ${successfulInserts.length} field(s) to view${skippedFields.length > 0 ? `, ${skippedFields.length} already existed` : ''}`,
            added: successfulInserts.length,
            total: tableFields.length,
            fields: successfulInserts,
            skipped: skippedFields,
          })
        }
      }
      
      // Enhanced error message with more context
      const errorMessage = isRLSViolation
        ? 'Permission denied. Check Row Level Security (RLS) policies for view_fields table.'
        : insertError.message || 'Unknown error'
      
      console.error('🔥 initialize-fields INSERT ERROR:', {
        viewId,
        viewUuid,
        tableId: view.table_id,
        fieldsToAddCount: fieldsToAdd.length,
        errorCode: insertError.code,
        errorMessage: insertError.message,
        errorDetails: insertError,
        isRLSViolation,
        isUniqueViolation,
        isTableNotFound,
      })
      
      return NextResponse.json(
        { 
          error: 'Failed to add fields to view', 
          error_code: isRLSViolation ? 'RLS_ERROR' : isTableNotFound ? 'TABLE_NOT_FOUND' : 'INSERT_ERROR', 
          details: errorMessage,
          viewId,
          viewUuid,
          tableId: view.table_id,
        },
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
    console.error('🔥 initialize-fields ERROR:', {
      viewId,
      viewUuid,
      error: error.message,
      errorCode: error.code,
      errorStack: error.stack,
      errorDetails: error,
    })
    return NextResponse.json(
      { error: 'Internal server error', error_code: 'INTERNAL_ERROR', details: error.message },
      { status: 500 }
    )
  }
}
