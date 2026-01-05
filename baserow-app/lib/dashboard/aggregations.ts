import { createClient } from '@/lib/supabase/server'
import type { TableField } from '@/types/database'

export type AggregateFunction = 'count' | 'sum' | 'avg' | 'min' | 'max'

export interface AggregationResult {
  value: number | null
  error?: string
}

export interface ComparisonResult {
  current: number | null
  previous: number | null
  change: number | null
  changePercent: number | null
  trend: 'up' | 'down' | 'neutral'
}

/**
 * Server-side aggregation for KPI blocks
 * Performs aggregation directly in database for efficiency
 */
export async function aggregateTableData(
  tableId: string,
  aggregate: AggregateFunction,
  fieldName?: string,
  filters?: any[]
): Promise<AggregationResult> {
  try {
    const supabase = await createClient()
    
    // Get table info
    const { data: table, error: tableError } = await supabase
      .from('tables')
      .select('supabase_table')
      .eq('id', tableId)
      .single()

    if (tableError || !table?.supabase_table) {
      return { value: null, error: 'Table not found' }
    }

    const supabaseTable = table.supabase_table

    // Build query based on aggregate type
    if (aggregate === 'count') {
      // Count all rows (with filters if provided)
      let query: any = supabase
        .from(supabaseTable)
        .select('*', { count: 'exact', head: true })

      // Apply filters if provided
      if (filters && filters.length > 0) {
        filters.forEach(filter => {
          if (filter.operator === 'eq') {
            query = query.eq(filter.field, filter.value)
          } else if (filter.operator === 'neq') {
            query = query.neq(filter.field, filter.value)
          } else if (filter.operator === 'gt') {
            query = query.gt(filter.field, filter.value)
          } else if (filter.operator === 'gte') {
            query = query.gte(filter.field, filter.value)
          } else if (filter.operator === 'lt') {
            query = query.lt(filter.field, filter.value)
          } else if (filter.operator === 'lte') {
            query = query.lte(filter.field, filter.value)
          } else if (filter.operator === 'contains') {
            query = query.ilike(filter.field, `%${filter.value}%`)
          }
        })
      }

      const { count, error } = await query

      if (error) {
        return { value: null, error: error.message }
      }

      return { value: count || 0 }
    }

    // For other aggregates, we need a field
    if (!fieldName) {
      return { value: null, error: 'Field required for this aggregation' }
    }

    // Get field info to determine type
    const { data: field, error: fieldError } = await supabase
      .from('table_fields')
      .select('type')
      .eq('table_id', tableId)
      .eq('name', fieldName)
      .single()

    if (fieldError || !field) {
      return { value: null, error: 'Field not found' }
    }

    // Only numeric fields can be aggregated
    const numericTypes = ['number', 'currency', 'percent', 'rating']
    if (!numericTypes.includes(field.type)) {
      return { value: null, error: 'Field must be numeric for aggregation' }
    }

    // Use RPC function for aggregation (more efficient)
    // Fallback to client-side if RPC doesn't exist
    try {
      const { data, error: rpcError } = await supabase.rpc('aggregate_table_field', {
        table_name: supabaseTable,
        field_name: fieldName,
        aggregate_type: aggregate,
        filter_json: filters ? JSON.stringify(filters) : null
      })

      if (!rpcError && data !== null) {
        return { value: parseFloat(data) || 0 }
      }
    } catch (rpcError) {
      // RPC function doesn't exist, fall back to client-side
    }

    // Fallback: Load data and aggregate client-side
    let query: any = supabase
      .from(supabaseTable)
      .select(fieldName)
      .limit(10000) // Reasonable limit

    // Apply filters
    if (filters && filters.length > 0) {
      filters.forEach(filter => {
        if (filter.operator === 'eq') {
          query = query.eq(filter.field, filter.value)
        } else if (filter.operator === 'neq') {
          query = query.neq(filter.field, filter.value)
        } else if (filter.operator === 'gt') {
          query = query.gt(filter.field, filter.value)
        } else if (filter.operator === 'gte') {
          query = query.gte(filter.field, filter.value)
        } else if (filter.operator === 'lt') {
          query = query.lt(filter.field, filter.value)
        } else if (filter.operator === 'lte') {
          query = query.lte(filter.field, filter.value)
        } else if (filter.operator === 'contains') {
          query = query.ilike(filter.field, `%${filter.value}%`)
        }
      })
    }

    const { data: rows, error } = await query

    if (error) {
      return { value: null, error: error.message }
    }

    if (!rows || rows.length === 0) {
      return { value: 0 }
    }

    // Extract numeric values
    const values = rows
      .map((r: any) => parseFloat(r[fieldName]))
      .filter((v: number) => !isNaN(v) && v !== null && v !== undefined)

    if (values.length === 0) {
      return { value: 0 }
    }

    // Perform aggregation
    let result = 0
    switch (aggregate) {
      case 'sum':
        result = values.reduce((a: number, b: number) => a + b, 0)
        break
      case 'avg':
        result = values.reduce((a: number, b: number) => a + b, 0) / values.length
        break
      case 'min':
        result = Math.min(...values)
        break
      case 'max':
        result = Math.max(...values)
        break
      default:
        return { value: null, error: 'Invalid aggregate function' }
    }

    return { value: result }
  } catch (error: any) {
    return { value: null, error: error.message || 'Aggregation failed' }
  }
}

/**
 * Compare current period with previous period
 */
export async function comparePeriods(
  tableId: string,
  aggregate: AggregateFunction,
  fieldName: string | undefined,
  dateFieldName: string,
  currentStart: Date,
  currentEnd: Date,
  previousStart: Date,
  previousEnd: Date,
  filters?: any[]
): Promise<ComparisonResult> {
  // Get current period value
  const currentFilters = [
    ...(filters || []),
    { field: dateFieldName, operator: 'gte', value: currentStart.toISOString() },
    { field: dateFieldName, operator: 'lte', value: currentEnd.toISOString() },
  ]
  const current = await aggregateTableData(tableId, aggregate, fieldName, currentFilters)

  // Get previous period value
  const previousFilters = [
    ...(filters || []),
    { field: dateFieldName, operator: 'gte', value: previousStart.toISOString() },
    { field: dateFieldName, operator: 'lte', value: previousEnd.toISOString() },
  ]
  const previous = await aggregateTableData(tableId, aggregate, fieldName, previousFilters)

  const currentValue = current.value || 0
  const previousValue = previous.value || 0

  // Calculate change
  const change = currentValue - previousValue
  const changePercent = previousValue !== 0 
    ? ((change / previousValue) * 100) 
    : (currentValue > 0 ? 100 : 0)

  // Determine trend
  let trend: 'up' | 'down' | 'neutral' = 'neutral'
  if (change > 0) trend = 'up'
  else if (change < 0) trend = 'down'

  return {
    current: currentValue,
    previous: previousValue,
    change,
    changePercent,
    trend,
  }
}

