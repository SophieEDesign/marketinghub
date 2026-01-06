/**
 * Shared Query Builder Utility
 * Standardizes query building across all blocks to prevent duplication
 * 
 * This utility provides a consistent way to build Supabase queries with:
 * - Filters (with proper precedence)
 * - Sorts
 * - Field visibility
 * - Pagination
 * 
 * Blocks should use this utility instead of building queries independently
 */

import type { FilterConfig } from './filters'
import { applyFiltersToQuery } from './filters'

export interface QueryBuilderOptions {
  tableId: string
  supabaseTableName: string
  filters?: FilterConfig[]
  sorts?: Array<{ field: string; direction: 'asc' | 'desc' }>
  fields?: string[] // Field names to select (if empty, selects all)
  limit?: number
  offset?: number
  tableFields?: Array<{ name: string; type: string; id?: string }>
}

/**
 * Builds a standardized Supabase query with filters, sorts, and field selection
 * 
 * @param query - Supabase query builder instance
 * @param options - Query options
 * @returns Configured query builder
 */
export function buildQuery(
  query: any,
  options: QueryBuilderOptions
): any {
  const {
    supabaseTableName,
    filters = [],
    sorts = [],
    fields = [],
    limit,
    offset,
    tableFields = [],
  } = options

  // Select fields (if specified, otherwise select all)
  if (fields.length > 0) {
    // Map field names to actual column names
    const columns = fields
      .map(fieldName => {
        const field = tableFields.find(f => f.name === fieldName || f.id === fieldName)
        return field?.name || fieldName
      })
      .filter(Boolean)
      .join(', ')
    
    query = query.select(columns)
  } else {
    query = query.select('*')
  }

  // Apply filters with proper precedence
  query = applyFiltersToQuery(query, filters, tableFields)

  // Apply sorts
  for (const sort of sorts) {
    const field = tableFields.find(f => f.name === sort.field || f.id === sort.field)
    const fieldName = field?.name || sort.field
    
    if (sort.direction === 'asc') {
      query = query.order(fieldName, { ascending: true })
    } else {
      query = query.order(fieldName, { ascending: false })
    }
  }

  // Apply pagination
  if (limit !== undefined) {
    query = query.limit(limit)
  }
  if (offset !== undefined) {
    query = query.range(offset, offset + (limit || 100) - 1)
  }

  return query
}

/**
 * Builds a count query (for pagination/totals)
 */
export function buildCountQuery(
  query: any,
  options: Omit<QueryBuilderOptions, 'fields' | 'limit' | 'offset'>
): any {
  const { filters = [], tableFields = [] } = options

  query = query.select('*', { count: 'exact', head: true })

  // Apply filters
  query = applyFiltersToQuery(query, filters, tableFields)

  return query
}

/**
 * Executes a query and returns data + count
 */
export async function executeQuery(
  query: any,
  options: QueryBuilderOptions
): Promise<{ data: any[]; count: number | null }> {
  const countQuery = buildCountQuery(query, options)
  const dataQuery = buildQuery(query, options)

  const [countResult, dataResult] = await Promise.all([
    countQuery,
    dataQuery,
  ])

  return {
    data: dataResult.data || [],
    count: countResult.count,
  }
}


