import { createServerSupabaseClient } from './supabase'
import type { ViewFilter, ViewSort, ViewField } from '@/types/database'

export interface LoadRowsOptions {
  tableId: string
  viewId?: string
  limit?: number
  offset?: number
}

export async function loadRows(options: LoadRowsOptions) {
  const supabase = await createServerSupabaseClient()
  const { tableId, viewId, limit = 50, offset = 0 } = options

  // Load table to get supabase_table name
  const { data: table, error: tableError } = await supabase
    .from('tables')
    .select('supabase_table')
    .eq('id', tableId)
    .single()

  if (tableError || !table) {
    throw new Error(`Table not found: ${tableId}`)
  }

  // Load filters and sorts if viewId provided
  let filters: ViewFilter[] = []
  let sorts: ViewSort[] = []
  let visibleFields: ViewField[] = []

  if (viewId) {
    const [filtersRes, sortsRes, fieldsRes] = await Promise.all([
      supabase
        .from('view_filters')
        .select('*')
        .eq('view_id', viewId),
      supabase
        .from('view_sorts')
        .select('*')
        .eq('view_id', viewId),
      supabase
        .from('view_fields')
        .select('*')
        .eq('view_id', viewId)
        .eq('visible', true)
        .order('position', { ascending: true }),
    ])

    filters = filtersRes.data || []
    sorts = sortsRes.data || []
    visibleFields = fieldsRes.data || []
  }

  // Build query for actual Supabase table
  let query = supabase
    .from(table.supabase_table)
    .select('*')
    .range(offset, offset + limit - 1)

  // Apply filters using field_name
  for (const filter of filters) {
    const fieldValue = filter.value
    switch (filter.operator) {
      case 'equal':
        query = query.eq(filter.field_name, fieldValue)
        break
      case 'not_equal':
        query = query.neq(filter.field_name, fieldValue)
        break
      case 'contains':
        query = query.ilike(filter.field_name, `%${fieldValue}%`)
        break
      case 'not_contains':
        query = query.not(filter.field_name, 'ilike', `%${fieldValue}%`)
        break
      case 'is_empty':
        query = query.or(`${filter.field_name}.is.null,${filter.field_name}.eq.`)
        break
      case 'is_not_empty':
        query = query.not(filter.field_name, 'is', null)
        break
      case 'greater_than':
        query = query.gt(filter.field_name, fieldValue)
        break
      case 'less_than':
        query = query.lt(filter.field_name, fieldValue)
        break
      case 'greater_than_or_equal':
        query = query.gte(filter.field_name, fieldValue)
        break
      case 'less_than_or_equal':
        query = query.lte(filter.field_name, fieldValue)
        break
      case 'date_equal':
        query = query.eq(filter.field_name, fieldValue)
        break
      case 'date_before':
        query = query.lt(filter.field_name, fieldValue)
        break
      case 'date_after':
        query = query.gt(filter.field_name, fieldValue)
        break
      case 'date_on_or_before':
        query = query.lte(filter.field_name, fieldValue)
        break
      case 'date_on_or_after':
        query = query.gte(filter.field_name, fieldValue)
        break
    }
  }

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
