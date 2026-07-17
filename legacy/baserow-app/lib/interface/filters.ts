/**
 * Shared Filter System
 * Filters are defined once per page and passed down to blocks
 * All blocks use the same filter logic to generate SQL queries
 */

import type { BlockFilter } from './types'
import { filterConfigsToFilterTree } from '@/lib/filters/converters'
import { applyFiltersToQuery as applyFiltersToQueryUnified } from '@/lib/filters/evaluation'
import type { FilterTree } from '@/lib/filters/canonical-model'
import type { TableField } from '@/types/fields'

export interface FilterConfig {
  field: string
  operator:
    | 'equal'
    | 'not_equal'
    | 'is_any_of'
    | 'is_not_any_of'
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
    | 'has'
    | 'does_not_have'
  value: any
  // For date_range operator
  value2?: any
}

export interface PageFilters {
  filters: FilterConfig[]
  searchQuery?: string
}

/**
 * Filters coming from Filter Blocks carry source metadata (sourceBlockId/sourceBlockTitle).
 * When a canonical `FilterTree` is used (groups/OR), those block-derived filters should not be
 * applied again from a flat list (or they will be double-applied).
 */
export function stripFilterBlockFilters(filters: FilterConfig[] = []): FilterConfig[] {
  const safe = Array.isArray(filters) ? filters : []
  return safe.filter((f: any) => !f?.sourceBlockId)
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
  filters: FilterConfig[] | FilterTree,
  tableFields: Array<{ name: string; type: string; id?: string; options?: any }> = []
): any {
  if (!filters) return query
  if (Array.isArray(filters) && filters.length === 0) return query

  const filterTree: FilterTree = Array.isArray(filters) ? filterConfigsToFilterTree(filters, 'AND') : (filters as FilterTree)
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
 * - Only supports simple equality-ish operators ('equal' and 'contains' when it implies a single value)
 * - Only scalar values, or single-item arrays (single value)
 * - Skips virtual/read-only computed fields (formula/lookup) when tableFields are provided
 * - If multiple eligible filters target the same field with conflicting values, that field is skipped
 *
 * Matches the “filtered view new record defaults” expectation:
 * - single_select: set the selected value
 * - multi_select: add the filtered value (union if multiple filters apply)
 * - link_to_table: set the relationship (best-effort; depends on filter value shape)
 *
 * Explicitly does NOT apply:
 * - range filters (>, <, date_range, etc.)
 * - relative date filters (date_today, date_next_days)
 * - “is empty / is not empty”
 * - formula/lookup based fields
 */
export function deriveDefaultValuesFromFilters(
  activeFilters: FilterConfig[] = [],
  tableFields: TableField[] = []
): Record<string, any> {
  const safeFilters = Array.isArray(activeFilters) ? activeFilters : []
  const safeFields = Array.isArray(tableFields) ? tableFields : []

  const fieldByNameOrId = new Map<string, TableField>()
  for (const f of safeFields) {
    if (f?.name) fieldByNameOrId.set(f.name, f)
    if (f?.id) fieldByNameOrId.set(f.id, f)
  }

  const defaults: Record<string, any> = {}
  const conflicted = new Set<string>()

  const normalizeSingleValue = (raw: any): any | undefined => {
    let v = raw
    if (Array.isArray(v)) {
      if (v.length !== 1) return undefined
      v = v[0]
    }
    if (v === undefined || v === null) return undefined
    if (typeof v === 'string' && v.trim() === '') return undefined
    return v
  }

  const isEligibleOperator = (op: FilterConfig['operator']): boolean => {
    // "contains" here is only considered when it effectively represents a single value selection
    // (e.g. some UIs use "contains" semantics for select-like fields).
    // "has" is used for linked record fields (link_to_table) in the canonical filter model.
    return op === 'equal' || op === 'contains' || op === 'has'
  }

  for (const f of safeFilters) {
    if (!f || typeof f.field !== 'string' || f.field.trim() === '') continue
    if (!isEligibleOperator(f.operator)) continue

    const fieldName = f.field
    if (conflicted.has(fieldName)) continue

    const field = fieldByNameOrId.get(fieldName)
    if (field?.type === 'formula' || field?.type === 'lookup') continue

    const value = normalizeSingleValue(f.value)
    if (value === undefined) continue

    // Only apply defaults for field types where a filter implies an obvious default selection.
    // Avoid applying for free-text/number/date filters which often shouldn't prefill a new record.
    const fieldType = field?.type
    const isEligibleFieldType =
      fieldType === 'single_select' || fieldType === 'multi_select' || fieldType === 'link_to_table'
    if (!isEligibleFieldType) continue

    // multi_select: union values (Airtable-like "add the filtered value")
    if (fieldType === 'multi_select') {
      const nextVal = String(value)
      const existing = defaults[fieldName]
      const existingArr = Array.isArray(existing) ? existing.map(String) : []
      if (!existingArr.includes(nextVal)) {
        defaults[fieldName] = [...existingArr, nextVal]
      }
      continue
    }

    // link_to_table: best-effort assignment.
    // Values are stored as record IDs (UUID) (single: string; sometimes multi: string[]).
    if (fieldType === 'link_to_table') {
      const nextVal = String(value)
      if (Object.prototype.hasOwnProperty.call(defaults, fieldName)) {
        if (!valuesLooselyEqual(defaults[fieldName], nextVal)) {
          delete defaults[fieldName]
          conflicted.add(fieldName)
        }
        continue
      }
      defaults[fieldName] = nextVal
      continue
    }

    // single_select: direct assignment (string labels)
    const nextVal = String(value)
    if (Object.prototype.hasOwnProperty.call(defaults, fieldName)) {
      if (!valuesLooselyEqual(defaults[fieldName], nextVal)) {
        delete defaults[fieldName]
        conflicted.add(fieldName)
      }
      continue
    }

    defaults[fieldName] = nextVal
  }

  return defaults
}
