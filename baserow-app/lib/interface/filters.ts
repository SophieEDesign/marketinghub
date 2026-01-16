/**
 * Shared Filter System
 * Filters are defined once per page and passed down to blocks
 * All blocks use the same filter logic to generate SQL queries
 */

import type { BlockFilter } from './types'
import { filterConfigsToFilterTree } from '@/lib/filters/converters'
import { applyFiltersToQuery as applyFiltersToQueryUnified } from '@/lib/filters/evaluation'
import type { TableField } from '@/types/fields'

export interface FilterConfig {
  field: string
  operator:
    | 'equal'
    | 'not_equal'
    | 'contains'
    | 'not_contains'
    | 'greater_than'
    | 'less_than'
    | 'is_empty'
    | 'is_not_empty'
    | 'greater_than_or_equal'
    | 'less_than_or_equal'
    | 'date_equal'
    | 'date_before'
    | 'date_after'
    | 'date_on_or_before'
    | 'date_on_or_after'
    | 'date_range'
    | 'date_today'
    | 'date_next_days'
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
    const asConfig = filter as FilterConfig
    // If the range comes in split across value/value2, normalize to object form.
    if (
      asConfig.value &&
      typeof asConfig.value === 'object' &&
      'start' in asConfig.value &&
      'end' in asConfig.value
    ) {
      return asConfig
    }
    if (asConfig.value2 !== undefined) {
      return {
        ...asConfig,
        value: { start: asConfig.value, end: asConfig.value2 },
      }
    }
    return asConfig
  }
  
  return {
    field: filter.field,
    operator: filter.operator as FilterConfig['operator'],
    value: filter.value,
  }
}

/**
 * Merge view defaults with user quick filters (Airtable-style).
 *
 * - View defaults are the baseline (builder-owned) and are never mutated.
 * - User quick filters are session-only and may override defaults by field.
 * - If user quick filters include a field, all default conditions for that field are replaced.
 *
 * This intentionally differs from mergeFilters() (which prevents overrides) because
 * quick filters are meant to be user-owned overrides on top of a view.
 */
export function mergeViewDefaultFiltersWithUserQuickFilters(
  viewDefaultFilters: FilterConfig[] = [],
  userQuickFilters: FilterConfig[] = []
): FilterConfig[] {
  const safeDefaults = Array.isArray(viewDefaultFilters) ? viewDefaultFilters : []
  const safeUser = Array.isArray(userQuickFilters) ? userQuickFilters : []

  const userFields = new Set(
    safeUser
      .filter((f) => !!f && typeof f.field === 'string' && f.field.trim() !== '' && typeof f.operator === 'string')
      .map((f) => f.field)
  )

  const merged: FilterConfig[] = []

  // Keep all default filters except those overridden by user quick filters.
  for (const f of safeDefaults) {
    if (!f || typeof f.field !== 'string' || f.field.trim() === '' || typeof f.operator !== 'string') continue
    if (userFields.has(f.field)) continue
    merged.push(f)
  }

  // Add user quick filters (as the effective filters for their fields).
  for (const f of safeUser) {
    if (!f || typeof f.field !== 'string' || f.field.trim() === '' || typeof f.operator !== 'string') continue
    merged.push(f)
  }

  return merged
}

/**
 * Stable serialization for comparing filter sets (order-insensitive).
 * Useful for "Filters modified" UI badges.
 */
export function serializeFiltersForComparison(filters: FilterConfig[] = []): string {
  const safe = Array.isArray(filters) ? filters : []
  const normalized = safe
    .filter((f) => !!f && typeof f.field === 'string' && typeof f.operator === 'string')
    .map((f) => ({
      field: f.field,
      operator: f.operator,
      value: f.value ?? null,
      value2: (f as any).value2 ?? null,
    }))
    .sort((a, b) => (a.field === b.field ? a.operator.localeCompare(b.operator) : a.field.localeCompare(b.field)))
  return JSON.stringify(normalized)
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
  blockBaseFilters: Array<BlockFilter | FilterConfig> = [],
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


function valuesLooselyEqual(a: any, b: any): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
    return true
  }
  return false
}

/**
 * Airtable-style: derive default field values from the *active* filters.
 *
 * Safety rules:
 * - Only supports simple equality operators (currently: 'equal')
 * - Only scalar values, or single-item arrays
 * - Skips computed fields (formula/lookup) when tableFields are provided
 * - If multiple eligible filters target the same field with conflicting values, that field is skipped
 */
export function deriveDefaultValuesFromFilters(
  activeFilters: FilterConfig[] = [],
  tableFields: TableField[] = []
): Record<string, any> {
  const safeFilters = Array.isArray(activeFilters) ? activeFilters : []
  const safeFields = Array.isArray(tableFields) ? tableFields : []

  const fieldByName = new Map<string, TableField>()
  for (const f of safeFields) {
    if (f?.name) fieldByName.set(f.name, f)
  }

  const defaults: Record<string, any> = {}
  const conflicted = new Set<string>()

  for (const f of safeFilters) {
    if (!f || typeof f.field !== 'string' || f.field.trim() === '') continue
    if (f.operator !== 'equal') continue

    const fieldName = f.field
    if (conflicted.has(fieldName)) continue

    const field = fieldByName.get(fieldName)
    if (field?.type === 'formula' || field?.type === 'lookup') continue

    let value: any = f.value
    if (Array.isArray(value)) {
      if (value.length !== 1) continue
      value = value[0]
    }

    if (value === undefined) continue
    if (typeof value === 'string' && value.trim() === '') continue

    // Minimal type-aware shaping for fields that store arrays.
    if (field?.type === 'multi_select') {
      value = [String(value)]
    }

    // Checkbox: accept 'true'/'false' strings (common from UI/query)
    if (field?.type === 'checkbox' && typeof value === 'string') {
      if (value === 'true') value = true
      if (value === 'false') value = false
    }

    // Numeric-ish fields: accept number-like strings.
    if (
      (field?.type === 'number' || field?.type === 'percent' || field?.type === 'currency') &&
      typeof value === 'string'
    ) {
      const n = Number(value)
      if (Number.isFinite(n)) value = n
    }

    if (Object.prototype.hasOwnProperty.call(defaults, fieldName)) {
      if (!valuesLooselyEqual(defaults[fieldName], value)) {
        delete defaults[fieldName]
        conflicted.add(fieldName)
      }
      continue
    }

    defaults[fieldName] = value
  }

  return defaults
}
