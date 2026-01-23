/**
 * API Endpoint: Fetch Lookup Records with Filters
 * 
 * POST /api/tables/[tableId]/lookup-records
 * 
 * Fetches records from a lookup table with filters applied.
 * Supports static values, current record references, and context values.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { applyLookupFilters } from '@/lib/lookups/applyLookupFilters'
import type { LookupFieldFilter } from '@/types/fields'
import { getPrimaryFieldName } from '@/lib/fields/primary'
import { toPostgrestColumn } from '@/lib/supabase/postgrest'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params
    const body = await request.json()
    
    const {
      lookupFieldId, // ID of the lookup field
      currentRecordId, // Optional: current record ID for dynamic values
      searchQuery, // Optional: search query
      limit = 50,
    } = body
    
    if (!lookupFieldId) {
      return NextResponse.json(
        { error: 'lookupFieldId is required' },
        { status: 400 }
      )
    }
    
    const supabase = await createClient()
    
    // Get lookup field configuration
    const { data: lookupField, error: fieldError } = await supabase
      .from('table_fields')
      .select('*')
      .eq('id', lookupFieldId)
      .eq('table_id', tableId)
      .single()
    
    if (fieldError || !lookupField || lookupField.type !== 'lookup') {
      return NextResponse.json(
        { error: 'Lookup field not found' },
        { status: 404 }
      )
    }
    
    const options = lookupField.options || {}
    const lookupTableId = options.lookup_table_id
    const filters: LookupFieldFilter[] = options.lookup_filters || []
    
    if (!lookupTableId) {
      return NextResponse.json(
        { error: 'Lookup table not configured' },
        { status: 400 }
      )
    }
    
    // Get lookup table info
    const { data: lookupTable, error: tableError } = await supabase
      .from('tables')
      .select('id, name, supabase_table, primary_field_name')
      .eq('id', lookupTableId)
      .single()
    
    if (tableError || !lookupTable) {
      return NextResponse.json(
        { error: 'Lookup table not found' },
        { status: 404 }
      )
    }
    
    // Get lookup table fields
    const { data: lookupTableFields, error: fieldsError } = await supabase
      .from('table_fields')
      .select('name, type')
      .eq('table_id', lookupTableId)
    
    if (fieldsError || !lookupTableFields) {
      return NextResponse.json(
        { error: 'Failed to load lookup table fields' },
        { status: 500 }
      )
    }
    
    // Get current record if provided
    let currentRecord: Record<string, any> | undefined
    if (currentRecordId) {
      const { data: table } = await supabase
        .from('tables')
        .select('supabase_table')
        .eq('id', tableId)
        .single()
      
      if (table) {
        const { data: record } = await supabase
          .from(table.supabase_table)
          .select('*')
          .eq('id', currentRecordId)
          .single()
        
        currentRecord = record || undefined
      }
    }
    
    // Get current user info
    const { data: { user } } = await supabase.auth.getUser()
    const currentUserId = user?.id
    const currentUserEmail = user?.email
    
    // Build base query
    const configuredPrimary =
      typeof (lookupTable as any)?.primary_field_name === 'string' &&
      String((lookupTable as any).primary_field_name).trim().length > 0
        ? String((lookupTable as any).primary_field_name).trim()
        : null

    const computedPrimary = getPrimaryFieldName(lookupTableFields) || 'id'
    const candidate = configuredPrimary || computedPrimary
    const safeCandidate = candidate === 'id' ? 'id' : toPostgrestColumn(candidate)
    const primaryLabelField =
      safeCandidate &&
      (safeCandidate === 'id' || lookupTableFields.some((f) => f.name === safeCandidate))
        ? safeCandidate
        : 'id'
    const secondaryLabelFields: string[] = [] // table-level secondary labels can be added later
    const fieldsToSelect = [
      'id',
      primaryLabelField,
      ...secondaryLabelFields.slice(0, 2),
    ].filter(Boolean)
    
    let query = supabase
      .from(lookupTable.supabase_table)
      .select(fieldsToSelect.join(', '))
      .limit(limit)
    
    // Apply filters
    const filterResult = await applyLookupFilters({
      query,
      filters,
      lookupTableFields,
      context: {
        currentRecord,
        currentUserId,
        currentUserEmail,
      },
    })
    
    query = filterResult.query
    
    // Apply search query if provided
    if (searchQuery && searchQuery.trim()) {
      const primaryField = lookupTableFields.find(f => f.name === primaryLabelField)
      if (primaryField && (primaryField.type === 'text' || primaryField.type === 'long_text')) {
        query = query.ilike(primaryLabelField, `%${searchQuery}%`)
      }
    }
    
    // Execute query
    const { data: records, error: queryError } = await query
    
    if (queryError) {
      console.error('Error fetching lookup records:', queryError)
      return NextResponse.json(
        { error: queryError.message },
        { status: 500 }
      )
    }
    
    // Return results with filter information
    return NextResponse.json({
      records: records || [],
      activeFilters: filterResult.activeFilters.map(f => ({
        field: f.filter.field,
        operator: f.filter.operator,
        value: f.resolvedValue,
        value2: f.resolvedValue2,
      })),
      skippedFilters: filterResult.skippedFilters.map(f => ({
        field: f.field,
        reason: 'value_resolution_failed_or_field_not_found',
      })),
    })
  } catch (error: unknown) {
    console.error('Error fetching lookup records:', error)
    const errorMessage = (error as { message?: string })?.message || 'Failed to fetch lookup records'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
