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

  // Build query for actual Supabase table
  let query = supabase
    .from(table.supabase_table)
    .select('*')
    .range(offset, offset + limit - 1)

  // Convert database filters to canonical filter tree and apply using shared evaluation engine
  const filterTree = dbFiltersToFilterTree(filters, filterGroups)
  // Pass tableFields for field-aware filtering
  query = applyFiltersToQuery(query, filterTree, tableFields)

  // Apply sorting using field_name
  if (sorts.length > 0) {
    const firstSort = sorts[0]
    query = query.order(firstSort.field_name, {
      ascending: firstSort.direction === 'asc',
    })
  } else {
    // Default sort by id if available, otherwise no sort
    query = query.order('id', { ascending: false })
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return {
    rows: (data || []) as Record<string, any>[],
    filters,
    sorts,
    visibleFields,
  }
}

export async function loadRow(tableId: string, rowId: string) {
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
