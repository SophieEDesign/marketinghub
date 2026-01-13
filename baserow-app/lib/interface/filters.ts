/**
 * Shared Filter System
 * Filters are defined once per page and passed down to blocks
 * All blocks use the same filter logic to generate SQL queries
 */

import type { BlockFilter } from './types'
import { filterConfigsToFilterTree } from '@/lib/filters/converters'
import { applyFiltersToQuery as applyFiltersToQueryUnified } from '@/lib/filters/evaluation'

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
 * 
 * @deprecated This function is kept for backward compatibility.
 * New code should use the unified filter system from @/lib/filters/evaluation
 * which uses the canonical FilterTree model.
 */
export function applyFiltersToQuery(
  query: any,
  filters: FilterConfig[],
  tableFields: Array<{ name: string; type: string; id?: string; options?: any }> = []
): any {
  if (!filters || filters.length === 0) return query

  // Convert FilterConfig[] to FilterTree and use unified evaluation
  const filterTree = filterConfigsToFilterTree(filters, 'AND')
  return applyFiltersToQueryUnified(query, filterTree, tableFields as any)
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
 * 
 * Preserves source information (sourceBlockId, sourceBlockTitle) from filter blocks
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
  // Preserve source information (sourceBlockId, sourceBlockTitle) if present
  for (const filterBlockFilter of filterBlockFilters) {
    // Filter blocks can add filters but cannot override base filters
    // If same field exists in base filters, skip (base filters take precedence)
    const baseFilterExists = merged.some(f => f.field === filterBlockFilter.field)
    if (!baseFilterExists) {
      // Preserve any source information from filter blocks
      merged.push({
        ...filterBlockFilter,
        // Preserve sourceBlockId and sourceBlockTitle if they exist
        ...(('sourceBlockId' in filterBlockFilter) && { sourceBlockId: (filterBlockFilter as any).sourceBlockId }),
        ...(('sourceBlockTitle' in filterBlockFilter) && { sourceBlockTitle: (filterBlockFilter as any).sourceBlockTitle }),
      })
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

