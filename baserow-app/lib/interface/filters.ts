/**
 * Shared Filter System
 * Filters are defined once per page and passed down to blocks
 * All blocks use the same filter logic to generate SQL queries
 */

import type { BlockFilter } from './types'

export interface FilterConfig {
  field: string
  operator: 'equal' | 'not_equal' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty' | 'greater_than_or_equal' | 'less_than_or_equal' | 'date_range'
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
 * Field-type aware: handles multi-select arrays, dates, and other field types appropriately
 */
export function applyFiltersToQuery(
  query: any,
  filters: FilterConfig[],
  tableFields: Array<{ name: string; type: string; id?: string; options?: any }> = []
): any {
  if (!filters || filters.length === 0) return query

  for (const filter of filters) {
    if (!filter.field || filter.operator === undefined) continue

    // Validate field exists in table schema
    const field = tableFields.find(f => f.name === filter.field || (f.id && f.id === filter.field))
    if (!field && tableFields.length > 0) {
      // Field doesn't exist - skip this filter
      console.warn(`Filter field "${filter.field}" not found in table schema`)
      continue
    }

    const fieldName = field?.name || filter.field
    const fieldType = field?.type
    const fieldValue = filter.value

    // Apply field-type aware filtering
    switch (filter.operator) {
      case 'equal':
        if (fieldType === 'multi_select') {
          // For multi-select arrays (text[]), check if array contains the value
          // Use filter with 'cs' operator for array contains
          query = query.filter(fieldName, 'cs', `{${String(fieldValue)}}`)
        } else {
          query = query.eq(fieldName, fieldValue)
        }
        break
      case 'not_equal':
        if (fieldType === 'multi_select') {
          // For multi-select, check if array does NOT contain the value
          query = query.not(fieldName, 'cs', `{${String(fieldValue)}}`)
        } else {
          query = query.neq(fieldName, fieldValue)
        }
        break
      case 'contains':
        if (fieldType === 'multi_select') {
          // For multi-select arrays, check if array contains the value
          query = query.filter(fieldName, 'cs', `{${String(fieldValue)}}`)
        } else {
          // For text fields, use case-insensitive like
          query = query.ilike(fieldName, `%${fieldValue}%`)
        }
        break
      case 'not_contains':
        if (fieldType === 'multi_select') {
          // For multi-select, check if array does NOT contain the value
          query = query.not(fieldName, 'cs', `{${String(fieldValue)}}`)
        } else {
          query = query.not(fieldName, 'ilike', `%${fieldValue}%`)
        }
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
        if (fieldType === 'multi_select') {
          // For multi-select arrays, check if array is null or empty array
          // Use OR to check for null OR empty array
          query = query.or(`${fieldName}.is.null,${fieldName}.eq.{}`)
        } else {
          query = query.or(`${fieldName}.is.null,${fieldName}.eq.`)
        }
        break
      case 'is_not_empty':
        if (fieldType === 'multi_select') {
          // For multi-select arrays, check if array is not null and not empty
          query = query.not(fieldName, 'is', null).neq(fieldName, '{}')
        } else {
          query = query.not(fieldName, 'is', null)
        }
        break
      case 'date_range':
        if (filter.value && filter.value2) {
          // For date ranges, ensure we're comparing dates properly
          // If values are date strings (YYYY-MM-DD), add time to make range inclusive
          const startDate = filter.value instanceof Date 
            ? filter.value.toISOString().split('T')[0] 
            : filter.value
          const endDate = filter.value2 instanceof Date 
            ? filter.value2.toISOString().split('T')[0] 
            : filter.value2
          query = query.gte(fieldName, startDate).lte(fieldName, endDate)
        } else if (filter.value) {
          const startDate = filter.value instanceof Date 
            ? filter.value.toISOString().split('T')[0] 
            : filter.value
          query = query.gte(fieldName, startDate)
        } else if (filter.value2) {
          const endDate = filter.value2 instanceof Date 
            ? filter.value2.toISOString().split('T')[0] 
            : filter.value2
          query = query.lte(fieldName, endDate)
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
 * Merges filters with proper precedence:
 * 1. Block base filters (always applied, cannot be overridden)
 * 2. Filter block state (narrows results, additive)
 * 3. Temporary UI filters (if any)
 * 
 * All filters are combined with AND logic - they narrow results together
 */
export function mergeFilters(
  blockBaseFilters: BlockFilter[] = [],
  filterBlockFilters: FilterConfig[] = [],
  temporaryFilters: FilterConfig[] = []
): FilterConfig[] {
  const merged: FilterConfig[] = []
  
  // 1. Block base filters (always applied first)
  for (const blockFilter of blockBaseFilters) {
    const normalized = normalizeFilter(blockFilter)
    merged.push(normalized)
  }
  
  // 2. Filter block filters (additive, narrows results)
  for (const filterBlockFilter of filterBlockFilters) {
    // Filter blocks can add filters but cannot override base filters
    // If same field exists in base filters, skip (base filters take precedence)
    const baseFilterExists = merged.some(f => f.field === filterBlockFilter.field)
    if (!baseFilterExists) {
      merged.push(filterBlockFilter)
    }
  }
  
  // 3. Temporary UI filters (additive, narrows results further)
  for (const tempFilter of temporaryFilters) {
    const baseFilterExists = merged.some(f => f.field === tempFilter.field)
    if (!baseFilterExists) {
      merged.push(tempFilter)
    }
  }
  
  return merged
}

/**
 * Legacy function for backward compatibility
 * Merges page-level filters with block-level filters
 * @deprecated Use mergeFilters with proper precedence instead
 */
export function mergePageAndBlockFilters(
  pageFilters: FilterConfig[] = [],
  blockFilters: BlockFilter[] = []
): FilterConfig[] {
  return mergeFilters(blockFilters, pageFilters, [])
}

