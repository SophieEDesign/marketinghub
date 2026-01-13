import { createServerSupabaseClient } from './supabase'
import type { ViewFilter, ViewSort, ViewField, ViewFilterGroup } from '@/types/database'
import { dbFiltersToFilterTree } from '@/lib/filters/converters'
import { applyFiltersToQuery } from '@/lib/filters/evaluation'

export interface LoadRowsOptions {
  tableId: string
  viewId?: string
  limit?: number
  offset?: number
  // CRITICAL: Pass metadata to avoid reloading it (prevents connection exhaustion)
  filters?: ViewFilter[]
  sorts?: ViewSort[]
  visibleFields?: ViewField[]
}

export async function loadRows(options: LoadRowsOptions) {
  const supabase = await createServerSupabaseClient()
  const { tableId, viewId, limit = 50, offset = 0, filters: providedFilters, sorts: providedSorts, visibleFields: providedVisibleFields } = options

  // Load table to get supabase_table name
  const { data: table, error: tableError } = await supabase
    .from('tables')
    .select('supabase_table')
    .eq('id', tableId)
    .single()

  if (tableError || !table) {
    throw new Error(`Table not found: ${tableId}`)
  }

  // Use provided metadata if available, otherwise load it (but serialize to avoid parallel requests)
  let filters: ViewFilter[] = providedFilters || []
  let filterGroups: ViewFilterGroup[] = []
  let sorts: ViewSort[] = providedSorts || []
  let visibleFields: ViewField[] = providedVisibleFields || []

  // 🧯 Guardrail 2: Hard rule — rows must NEVER trigger metadata loads
  // Warn if viewId is provided but metadata is missing (should be supplied by useViewMeta)
  if (viewId && (!providedFilters || !providedSorts || !providedVisibleFields)) {
    console.warn(
      '[loadRows] Metadata missing for viewId — this should be supplied by useViewMeta hook. ' +
      'Loading metadata inline (this can cause connection exhaustion). ' +
      `viewId: ${viewId}, tableId: ${tableId}`
    )
  }

  // Only load metadata if not provided AND viewId is present
  if (viewId && (!providedFilters || !providedSorts || !providedVisibleFields)) {
    // CRITICAL: Serialize requests instead of Promise.all to avoid connection exhaustion
    // Load filter groups first
    const groupsRes = await supabase
      .from('view_filter_groups')
      .select('*')
      .eq('view_id', viewId)
      .order('order_index', { ascending: true })
    
    if (!providedFilters) {
      filterGroups = groupsRes.data || []
    }

    // Load filters
    const filtersRes = await supabase
      .from('view_filters')
      .select('*')
      .eq('view_id', viewId)
      .order('order_index', { ascending: true })
    
    if (!providedFilters) {
      filters = filtersRes.data || []
    }

    // Then load sorts
    const sortsRes = await supabase
      .from('view_sorts')
      .select('*')
      .eq('view_id', viewId)
    
    if (!providedSorts) {
      sorts = sortsRes.data || []
    }

    // Finally load fields
    const fieldsRes = await supabase
      .from('view_fields')
      .select('*')
      .eq('view_id', viewId)
      .eq('visible', true)
      .order('position', { ascending: true })
    
    if (!providedVisibleFields) {
      visibleFields = fieldsRes.data || []
    }
  }

  // CRITICAL: Query from table_rows (JSONB storage) instead of supabase_table
  // This matches how blocks load data and ensures data is visible in core data tables
  let query = supabase
    .from('table_rows')
    .select('*')
    .eq('table_id', tableId)
    .range(offset, offset + limit - 1)

  // Apply sorting - table_rows uses created_at by default
  if (sorts.length > 0) {
    const firstSort = sorts[0]
    // For table_rows, we can sort by created_at or try to sort by data field
    // For now, use created_at as primary sort
    query = query.order('created_at', {
      ascending: firstSort.direction === 'asc',
    })
  } else {
    // Default sort by created_at
    query = query.order('created_at', { ascending: false })
  }

  const { data: tableRowsData, error } = await query

  if (error) {
    // If table_rows doesn't exist or has issues, try fallback to supabase_table
    if (error.code === 'PGRST205' || error.message?.includes('table_rows')) {
      console.warn('[loadRows] table_rows not accessible, trying supabase_table fallback')
      
      // Load table_fields for filtering (only needed for fallback)
      let tableFields: any[] = []
      try {
        const fieldsRes = await supabase
          .from('table_fields')
          .select('*')
          .eq('table_id', tableId)
          .order('position', { ascending: true })
        tableFields = fieldsRes.data || []
      } catch (fieldsError) {
        console.warn('[loadRows] Could not load table_fields for filtering:', fieldsError)
      }
      
      // Fallback to supabase_table
      let fallbackQuery = supabase
        .from(table.supabase_table)
        .select('*')
        .range(offset, offset + limit - 1)

      // Convert database filters to canonical filter tree and apply using shared evaluation engine
      const filterTree = dbFiltersToFilterTree(filters, filterGroups)
      // Pass tableFields for field-aware filtering
      fallbackQuery = applyFiltersToQuery(fallbackQuery, filterTree, tableFields)

      // Apply sorting using field_name
      if (sorts.length > 0) {
        const firstSort = sorts[0]
        fallbackQuery = fallbackQuery.order(firstSort.field_name, {
          ascending: firstSort.direction === 'asc',
        })
      } else {
        fallbackQuery = fallbackQuery.order('id', { ascending: false })
      }

      const { data: fallbackData, error: fallbackError } = await fallbackQuery
      
      if (fallbackError) {
        throw fallbackError
      }

      return {
        rows: (fallbackData || []) as Record<string, any>[],
        filters,
        sorts,
        visibleFields,
      }
    }
    throw error
  }

  // Extract data from table_rows JSONB column and merge with row metadata
  const rows = (tableRowsData || []).map((row: any) => {
    // table_rows has: id, table_id, data (JSONB), created_at, updated_at, etc.
    // Merge the JSONB data with row metadata
    return {
      id: row.id,
      ...(row.data || {}),
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by,
      updated_by: row.updated_by,
    }
  })

  // Apply filters to the extracted rows (client-side filtering for JSONB data)
  // Note: This is a simplified approach - for production, consider server-side JSONB filtering
  let filteredRows = rows
  if (filters.length > 0 || filterGroups.length > 0) {
    const filterTree = dbFiltersToFilterTree(filters, filterGroups)
    // For now, we'll return all rows and let the client handle filtering
    // TODO: Implement proper JSONB filtering in Supabase query
    filteredRows = rows
  }

  return {
    rows: filteredRows as Record<string, any>[],
    filters,
    sorts,
    visibleFields,
  }
}

export async function loadRow(tableId: string, rowId: string) {
  const supabase = await createServerSupabaseClient()
  
  // Try table_rows first (matches how blocks load data)
  const { data: tableRow, error: tableRowError } = await supabase
    .from('table_rows')
    .select('*')
    .eq('table_id', tableId)
    .eq('id', rowId)
    .single()

  if (!tableRowError && tableRow) {
    // Extract data from JSONB and merge with metadata
    return {
      id: tableRow.id,
      ...(tableRow.data || {}),
      created_at: tableRow.created_at,
      updated_at: tableRow.updated_at,
      created_by: tableRow.created_by,
      updated_by: tableRow.updated_by,
    } as Record<string, any>
  }

  // Fallback to supabase_table if table_rows doesn't have the row
  const { data: table, error: tableError } = await supabase
    .from('tables')
    .select('supabase_table')
    .eq('id', tableId)
    .single()

  if (tableError || !table) {
    throw new Error(`Table not found: ${tableId}`)
  }

  const { data, error } = await supabase
    .from(table.supabase_table)
    .select('*')
    .eq('id', rowId)
    .single()

  if (error) throw error
  return data as Record<string, any>
}

export async function createRow(tableId: string, data: Record<string, any>) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Load table to get supabase_table name
  const { data: table, error: tableError } = await supabase
    .from('tables')
    .select('supabase_table')
    .eq('id', tableId)
    .single()

  if (tableError || !table) {
    throw new Error(`Table not found: ${tableId}`)
  }

  const { data: row, error } = await supabase
    .from(table.supabase_table)
    .insert([data])
    .select()
    .single()

  if (error) throw error
  return row as Record<string, any>
}

// Client-side versions
export async function createRowClient(
  supabase: any,
  tableId: string,
  data: Record<string, any>
) {
  // Load table to get supabase_table name
  const { data: table, error: tableError } = await supabase
    .from('tables')
    .select('supabase_table')
    .eq('id', tableId)
    .single()

  if (tableError || !table) {
    throw new Error(`Table not found: ${tableId}`)
  }

  const { data: row, error } = await supabase
    .from(table.supabase_table)
    .insert([data])
    .select()
    .single()

  if (error) throw error
  return row as Record<string, any>
}

export async function updateRow(tableId: string, rowId: string, data: Record<string, any>) {
  const supabase = await createServerSupabaseClient()

  // Load table to get supabase_table name
  const { data: table, error: tableError } = await supabase
    .from('tables')
    .select('supabase_table')
    .eq('id', tableId)
    .single()

  if (tableError || !table) {
    throw new Error(`Table not found: ${tableId}`)
  }

  const { data: row, error } = await supabase
    .from(table.supabase_table)
    .update(data)
    .eq('id', rowId)
    .select()
    .single()

  if (error) throw error
  return row as Record<string, any>
}

// Client-side version
export async function updateRowClient(
  supabase: any,
  tableId: string,
  rowId: string,
  data: Record<string, any>
) {
  // Load table to get supabase_table name
  const { data: table, error: tableError } = await supabase
    .from('tables')
    .select('supabase_table')
    .eq('id', tableId)
    .single()

  if (tableError || !table) {
    throw new Error(`Table not found: ${tableId}`)
  }

  const { data: row, error } = await supabase
    .from(table.supabase_table)
    .update(data)
    .eq('id', rowId)
    .select()
    .single()

  if (error) throw error
  return row as Record<string, any>
}

export async function deleteRow(tableId: string, rowId: string) {
  const supabase = await createServerSupabaseClient()

  // Load table to get supabase_table name
  const { data: table, error: tableError } = await supabase
    .from('tables')
    .select('supabase_table')
    .eq('id', tableId)
    .single()

  if (tableError || !table) {
    throw new Error(`Table not found: ${tableId}`)
  }

  const { error } = await supabase
    .from(table.supabase_table)
    .delete()
    .eq('id', rowId)

  if (error) throw error
}
