/**
 * Shared Filter System
 * Filters are defined once per page and passed down to blocks
 * All blocks use the same filter logic to generate SQL queries
 */

import type { BlockFilter } from './types'

export interface FilterConfig {
  field: string
  operator: 'equal' | 'not_equal' | 'contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty' | 'greater_than_or_equal' | 'less_than_or_equal' | 'date_range'
  value: any
  // For date_range operator
  value2?: any
}

export interface PageFilters {
  filters: FilterConfig[]
  searchQuery?: string
}

/**
 * Converts BlockFilter format to FilterConfig format
 */
export function normalizeFilter(filter: BlockFilter | FilterConfig): FilterConfig {
  if ('operator' in filter && filter.operator === 'date_range') {
    return filter as FilterConfig
  }
  
  return {
    field: filter.field,
    operator: filter.operator as FilterConfig['operator'],
    value: filter.value,
  }
}

/**
 * Applies filters to a Supabase query builder
 * This is the shared filter logic used by all blocks
 */
export function applyFiltersToQuery(
  query: any,
  filters: FilterConfig[],
  tableFields: Array<{ name: string; type: string }> = []
): any {
  if (!filters || filters.length === 0) return query

  for (const filter of filters) {
    if (!filter.field || filter.operator === undefined) continue

    // Validate field exists in table schema
    const field = tableFields.find(f => f.name === filter.field || f.id === filter.field)
    if (!field && tableFields.length > 0) {
      // Field doesn't exist - skip this filter
      console.warn(`Filter field "${filter.field}" not found in table schema`)
      continue
    }

    const fieldName = field?.name || filter.field
    const fieldValue = filter.value

    switch (filter.operator) {
      case 'equal':
        query = query.eq(fieldName, fieldValue)
        break
      case 'not_equal':
        query = query.neq(fieldName, fieldValue)
        break
      case 'contains':
        query = query.ilike(fieldName, `%${fieldValue}%`)
        break
      case 'greater_than':
        query = query.gt(fieldName, fieldValue)
        break
      case 'less_than':
        query = query.lt(fieldName, fieldValue)
        break
      case 'greater_than_or_equal':
        query = query.gte(fieldName, fieldValue)
        break
      case 'less_than_or_equal':
        query = query.lte(fieldName, fieldValue)
        break
      case 'is_empty':
        query = query.or(`${fieldName}.is.null,${fieldName}.eq.`)
        break
      case 'is_not_empty':
        query = query.not(fieldName, 'is', null)
        break
      case 'date_range':
        if (filter.value && filter.value2) {
          query = query.gte(fieldName, filter.value).lte(fieldName, filter.value2)
        } else if (filter.value) {
          query = query.gte(fieldName, filter.value)
        }
        break
      default:
        console.warn(`Unknown filter operator: ${filter.operator}`)
    }
  }

  return query
}

/**
 * Applies search query to filters
 * Converts search query into contains filters for text fields
 */
export function applySearchToFilters(
  searchQuery: string,
  textFields: string[],
  existingFilters: FilterConfig[] = []
): FilterConfig[] {
  if (!searchQuery || !textFields.length) return existingFilters

  // Create contains filters for each text field
  const searchFilters: FilterConfig[] = textFields.map(field => ({
    field,
    operator: 'contains',
    value: searchQuery,
  }))

  // Combine with existing filters
  return [...existingFilters, ...searchFilters]
}

/**
 * Merges page-level filters with block-level filters
 * Block filters override page filters for the same field
 */
export function mergeFilters(
  pageFilters: FilterConfig[] = [],
  blockFilters: BlockFilter[] = []
): FilterConfig[] {
  const merged: FilterConfig[] = [...pageFilters]
  
  // Add block filters, overriding page filters for same field
  for (const blockFilter of blockFilters) {
    const normalized = normalizeFilter(blockFilter)
    const existingIndex = merged.findIndex(f => f.field === normalized.field)
    
    if (existingIndex >= 0) {
      merged[existingIndex] = normalized
    } else {
      merged.push(normalized)
    }
  }
  
  return merged
}

