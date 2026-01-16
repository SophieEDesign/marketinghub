/**
 * Filter Evaluation Engine
 * 
 * This is the single source of truth for evaluating filters.
 * All filter evaluation must go through this engine to ensure consistency.
 * 
 * This engine converts the canonical filter model into Supabase queries.
 * Field-aware: Handles different field types correctly (select, multi-select, linked, lookup, etc.)
 */

import type { FilterTree, FilterGroup, FilterCondition } from './canonical-model'
import { normalizeFilterTree } from './canonical-model'
import type { TableField } from '@/types/fields'

function resolveDateOnlyDynamicValue(value: unknown): unknown {
  if (value === '__TODAY__') {
    return toDateOnlyLocal(new Date())
  }
  return value
}

function isDateOnlyString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function getLocalDayBoundsFromDateOnly(dateOnly: string): { startIso: string; nextDayStartIso: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly)
  if (!match) return null
  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  const day = Number(match[3])
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) return null
  // Interpret date-only inputs as a *local* day and convert to ISO for timestamptz comparisons.
  const start = new Date(year, monthIndex, day, 0, 0, 0, 0)
  if (Number.isNaN(start.getTime())) return null
  const nextDayStart = new Date(year, monthIndex, day + 1, 0, 0, 0, 0)
  if (Number.isNaN(nextDayStart.getTime())) return null
  return { startIso: start.toISOString(), nextDayStartIso: nextDayStart.toISOString() }
}

function getUtcDayBoundsFromDateOnly(dateOnly: string): { startIso: string; nextDayStartIso: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly)
  if (!match) return null
  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  const day = Number(match[3])
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) return null

  const startMs = Date.UTC(year, monthIndex, day, 0, 0, 0, 0)
  const nextDayStartMs = Date.UTC(year, monthIndex, day + 1, 0, 0, 0, 0)
  if (!Number.isFinite(startMs) || !Number.isFinite(nextDayStartMs)) return null

  const start = new Date(startMs)
  const nextDayStart = new Date(nextDayStartMs)
  if (Number.isNaN(start.getTime()) || Number.isNaN(nextDayStart.getTime())) return null

  return { startIso: start.toISOString(), nextDayStartIso: nextDayStart.toISOString() }
}

function toDateOnlyLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Convert a filter condition to a Supabase filter string
 * 
 * Used for OR groups where we need to build filter strings
 */
function conditionToSupabaseString(condition: FilterCondition): string {
  const { field_id, operator } = condition
  const value = resolveDateOnlyDynamicValue(condition.value)
  const fieldName = field_id
  const fieldValue = value ?? ''
  
  switch (operator) {
    case 'equal':
      return `${fieldName}.eq.${fieldValue}`
    case 'not_equal':
      return `${fieldName}.neq.${fieldValue}`
    case 'contains':
      return `${fieldName}.ilike.%${fieldValue}%`
    case 'not_contains':
      return `${fieldName}.not.ilike.%${fieldValue}%`
    case 'is_empty':
      return `${fieldName}.is.null`
    case 'is_not_empty':
      return `${fieldName}.not.is.null`
    case 'greater_than':
      return `${fieldName}.gt.${fieldValue}`
    case 'less_than':
      return `${fieldName}.lt.${fieldValue}`
    case 'greater_than_or_equal':
      return `${fieldName}.gte.${fieldValue}`
    case 'less_than_or_equal':
      return `${fieldName}.lte.${fieldValue}`
    case 'date_equal':
      if (isDateOnlyString(value)) {
        const bounds = getLocalDayBoundsFromDateOnly(value)
        if (bounds) return `and(${fieldName}.gte.${bounds.startIso},${fieldName}.lt.${bounds.nextDayStartIso})`
      }
      return `${fieldName}.eq.${fieldValue}`
    case 'date_before':
      if (isDateOnlyString(value)) {
        const bounds = getLocalDayBoundsFromDateOnly(value)
        if (bounds) return `${fieldName}.lt.${bounds.startIso}`
      }
      return `${fieldName}.lt.${fieldValue}`
    case 'date_after':
      if (isDateOnlyString(value)) {
        const bounds = getLocalDayBoundsFromDateOnly(value)
        if (bounds) return `${fieldName}.gte.${bounds.nextDayStartIso}`
      }
      return `${fieldName}.gt.${fieldValue}`
    case 'date_on_or_before':
      if (isDateOnlyString(value)) {
        const bounds = getLocalDayBoundsFromDateOnly(value)
        if (bounds) return `${fieldName}.lt.${bounds.nextDayStartIso}`
      }
      return `${fieldName}.lte.${fieldValue}`
    case 'date_on_or_after':
      if (isDateOnlyString(value)) {
        const bounds = getLocalDayBoundsFromDateOnly(value)
        if (bounds) return `${fieldName}.gte.${bounds.startIso}`
      }
      return `${fieldName}.gte.${fieldValue}`
    case 'date_range': {
      // Prefer object form: { start, end }
      if (typeof value === 'object' && value !== null && 'start' in value && 'end' in value) {
        const start = (value as any).start
        const end = (value as any).end
        // If end is a date-only string, treat it as inclusive and use < nextDayStart
        if (isDateOnlyString(start) && isDateOnlyString(end)) {
          const startBounds = getLocalDayBoundsFromDateOnly(start)
          const endBounds = getLocalDayBoundsFromDateOnly(end)
          if (startBounds && endBounds) {
            return `and(${fieldName}.gte.${startBounds.startIso},${fieldName}.lt.${endBounds.nextDayStartIso})`
          }
        }
        return `and(${fieldName}.gte.${String(start)},${fieldName}.lte.${String(end)})`
      }
      // Fallback to equality on a single value
      if (isDateOnlyString(value)) {
        const bounds = getLocalDayBoundsFromDateOnly(value)
        if (bounds) return `and(${fieldName}.gte.${bounds.startIso},${fieldName}.lt.${bounds.nextDayStartIso})`
      }
      return `${fieldName}.eq.${fieldValue}`
    }
    case 'date_today': {
      const today = toDateOnlyLocal(new Date())
      const bounds = getLocalDayBoundsFromDateOnly(today)
      if (!bounds) return ''
      return `and(${fieldName}.gte.${bounds.startIso},${fieldName}.lt.${bounds.nextDayStartIso})`
    }
    case 'date_next_days': {
      const n = Number(value)
      if (!Number.isFinite(n) || n < 0) return ''

      const today = new Date()
      const startDateOnly = toDateOnlyLocal(today)
      const startBounds = getLocalDayBoundsFromDateOnly(startDateOnly)
      if (!startBounds) return ''

      // Inclusive of today and the next N days => end exclusive is start of day (today + N + 1)
      const endExclusiveDateOnly = toDateOnlyLocal(
        new Date(today.getFullYear(), today.getMonth(), today.getDate() + Math.floor(n) + 1)
      )
      const endBounds = getLocalDayBoundsFromDateOnly(endExclusiveDateOnly)
      if (!endBounds) return ''

      return `and(${fieldName}.gte.${startBounds.startIso},${fieldName}.lt.${endBounds.startIso})`
    }
    default:
      return ''
  }
}

/**
 * Apply a single filter condition to a Supabase query
 * Field-aware: Handles different field types correctly
 */
function applyCondition(
  query: any,
  condition: FilterCondition,
  tableFields?: TableField[]
): any {
  const { field_id, operator } = condition
  const value = resolveDateOnlyDynamicValue(condition.value)
  const fieldName = field_id
  
  // Find field definition for field-aware filtering
  const field = tableFields?.find(f => f.name === field_id || f.id === field_id)
  const fieldType = field?.type

  switch (operator) {
    case 'equal':
      if (fieldType === 'multi_select') {
        // Multi-select: check if array contains the value
        return query.filter(fieldName, 'cs', `{${String(value)}}`)
      }
      if (fieldType === 'checkbox') {
        // Checkbox: convert boolean to string for Supabase
        return query.eq(fieldName, value === true || value === 'true')
      }
      return query.eq(fieldName, value)
      
    case 'not_equal':
      if (fieldType === 'multi_select') {
        // Multi-select: check if array does NOT contain the value
        return query.not(fieldName, 'cs', `{${String(value)}}`)
      }
      if (fieldType === 'checkbox') {
        return query.neq(fieldName, value === true || value === 'true')
      }
      return query.neq(fieldName, value)
      
    case 'contains':
      if (fieldType === 'multi_select') {
        // Multi-select: check if array contains the value
        return query.filter(fieldName, 'cs', `{${String(value)}}`)
      }
      // Text fields: case-insensitive like
      return query.ilike(fieldName, `%${value}%`)
      
    case 'not_contains':
      if (fieldType === 'multi_select') {
        // Multi-select: check if array does NOT contain the value
        return query.not(fieldName, 'cs', `{${String(value)}}`)
      }
      return query.not(fieldName, 'ilike', `%${value}%`)
      
    case 'is_empty':
      if (fieldType === 'multi_select') {
        // Multi-select: check if null or empty array
        return query.or(`${fieldName}.is.null,${fieldName}.eq.{}`)
      }
      // Text/number/date: check if null or empty string
      return query.or(`${fieldName}.is.null,${fieldName}.eq.`)
      
    case 'is_not_empty':
      if (fieldType === 'multi_select') {
        // Multi-select: check if not null and not empty array
        return query.not(fieldName, 'is', null).neq(fieldName, '{}')
      }
      return query.not(fieldName, 'is', null)
      
    case 'greater_than':
      return query.gt(fieldName, value)
      
    case 'less_than':
      return query.lt(fieldName, value)
      
    case 'greater_than_or_equal':
      return query.gte(fieldName, value)
      
    case 'less_than_or_equal':
      return query.lte(fieldName, value)
      
    case 'date_today': {
      const today = toDateOnlyLocal(new Date())
      const bounds = getLocalDayBoundsFromDateOnly(today)
      if (bounds) return query.gte(fieldName, bounds.startIso).lt(fieldName, bounds.nextDayStartIso)
      return query
    }

    case 'date_next_days': {
      const n = Number(value)
      if (!Number.isFinite(n) || n < 0) return query

      const today = new Date()
      const startDateOnly = toDateOnlyLocal(today)
      const startBounds = getLocalDayBoundsFromDateOnly(startDateOnly)
      if (!startBounds) return query

      const endExclusiveDateOnly = toDateOnlyLocal(
        new Date(today.getFullYear(), today.getMonth(), today.getDate() + Math.floor(n) + 1)
      )
      const endBounds = getLocalDayBoundsFromDateOnly(endExclusiveDateOnly)
      if (!endBounds) return query

      return query.gte(fieldName, startBounds.startIso).lt(fieldName, endBounds.startIso)
    }

    case 'date_equal':
      if (isDateOnlyString(value)) {
        const bounds = getLocalDayBoundsFromDateOnly(value)
        if (bounds) return query.gte(fieldName, bounds.startIso).lt(fieldName, bounds.nextDayStartIso)
      }
      return query.eq(fieldName, value)
      
    case 'date_before':
      if (isDateOnlyString(value)) {
        const bounds = getLocalDayBoundsFromDateOnly(value)
        if (bounds) return query.lt(fieldName, bounds.startIso)
      }
      return query.lt(fieldName, value)
      
    case 'date_after':
      if (isDateOnlyString(value)) {
        const bounds = getLocalDayBoundsFromDateOnly(value)
        if (bounds) return query.gte(fieldName, bounds.nextDayStartIso)
      }
      return query.gt(fieldName, value)
      
    case 'date_on_or_before':
      if (isDateOnlyString(value)) {
        const bounds = getLocalDayBoundsFromDateOnly(value)
        if (bounds) return query.lt(fieldName, bounds.nextDayStartIso)
      }
      return query.lte(fieldName, value)
      
    case 'date_on_or_after':
      if (isDateOnlyString(value)) {
        const bounds = getLocalDayBoundsFromDateOnly(value)
        if (bounds) return query.gte(fieldName, bounds.startIso)
      }
      return query.gte(fieldName, value)
      
    case 'date_range':
      // Date range: value should be { start, end } or two separate values
      if (typeof value === 'object' && value !== null && 'start' in value && 'end' in value) {
        const start = (value as any).start
        const end = (value as any).end
        if (isDateOnlyString(start) && isDateOnlyString(end)) {
          const startBounds = getLocalDayBoundsFromDateOnly(start)
          const endBounds = getLocalDayBoundsFromDateOnly(end)
          if (startBounds && endBounds) {
            return query.gte(fieldName, startBounds.startIso).lt(fieldName, endBounds.nextDayStartIso)
          }
        }
        // If the end is a date-only string, treat it as inclusive day and use < nextDayStart
        if (typeof start === 'string' && typeof end === 'string' && isDateOnlyString(end)) {
          const endBounds = getUtcDayBoundsFromDateOnly(end)
          if (endBounds) return query.gte(fieldName, start).lt(fieldName, endBounds.nextDayStartIso)
        }
        return query.gte(fieldName, start).lte(fieldName, end)
      }
      // Fallback: treat as single date
      if (isDateOnlyString(value)) {
        const bounds = getLocalDayBoundsFromDateOnly(value)
        if (bounds) return query.gte(fieldName, bounds.startIso).lt(fieldName, bounds.nextDayStartIso)
      }
      return query.eq(fieldName, value)
      
    case 'has':
      // Linked field: has record matching condition
      // This requires a subquery to the linked table
      // For now, we'll use a placeholder - full implementation requires table relationship info
      if (fieldType === 'link_to_table') {
        // TODO: Implement linked record filtering with drill-down
        // This would require: linked_table_id, linked_field_name, and the filter condition
        return query // Placeholder
      }
      return query
      
    case 'does_not_have':
      // Linked field: does not have record matching condition
      if (fieldType === 'link_to_table') {
        // TODO: Implement linked record filtering with drill-down
        return query // Placeholder
      }
      return query
      
    default:
      return query
  }
}

/**
 * Apply a filter group to a Supabase query
 * 
 * This handles AND/OR logic correctly:
 * - AND groups: Chain conditions normally (Supabase defaults to AND)
 * - OR groups: Use .or() with filter strings
 */
function applyGroup(
  query: any,
  group: FilterGroup,
  tableFields?: TableField[]
): any {
  const { operator, children } = group
  
  if (children.length === 0) {
    return query
  }
  
  if (operator === 'OR') {
    // For OR groups, we need to use .or() with filter strings
    const orConditions = children
      .filter((child): child is FilterCondition => 'field_id' in child)
      .map(conditionToSupabaseString)
      .filter(s => s.length > 0)
    
    if (orConditions.length > 0) {
      query = query.or(orConditions.join(','))
    }
    
    // Handle nested groups in OR (this is complex - Supabase doesn't support nested OR easily)
    // For now, we'll apply nested groups as separate OR conditions
    // This is a limitation - true nested OR requires more complex query building
    for (const child of children) {
      if ('operator' in child && 'children' in child) {
        // Nested group - recursively apply
        query = applyGroup(query, child, tableFields)
      }
    }
  } else {
    // AND group - chain conditions normally
    for (const child of children) {
      if ('field_id' in child) {
        // Condition
        query = applyCondition(query, child, tableFields)
      } else {
        // Nested group
        query = applyGroup(query, child, tableFields)
      }
    }
  }
  
  return query
}

/**
 * Apply a filter tree to a Supabase query
 * 
 * This is the main entry point for filter evaluation.
 * All filter evaluation should go through this function.
 * 
 * @param query - The Supabase query builder
 * @param filterTree - The filter tree to apply
 * @param tableFields - Optional: Table field definitions for field-aware filtering
 * @returns The modified query
 */
export function applyFiltersToQuery(
  query: any,
  filterTree: FilterTree,
  tableFields?: TableField[]
): any {
  if (!filterTree) {
    return query
  }
  
  const normalized = normalizeFilterTree(filterTree)
  if (!normalized) {
    return query
  }
  
  return applyGroup(query, normalized, tableFields)
}

/**
 * Evaluate a filter tree against a single row
 * 
 * This is useful for client-side filtering or testing.
 * Returns true if the row matches the filter, false otherwise.
 */
export function evaluateFilterTree(
  row: Record<string, any>,
  filterTree: FilterTree,
  getFieldValue?: (row: Record<string, any>, fieldId: string) => any
): boolean {
  if (!filterTree) {
    return true // No filters = all rows match
  }
  
  const normalized = normalizeFilterTree(filterTree)
  if (!normalized) {
    return true
  }
  
  function evaluateCondition(condition: FilterCondition): boolean {
    const { field_id, operator } = condition
    const value = resolveDateOnlyDynamicValue(condition.value)
    const fieldValue = getFieldValue 
      ? getFieldValue(row, field_id)
      : row[field_id]
    
    const asDate = (v: any): Date | null => {
      if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v
      const d = new Date(String(v))
      return Number.isNaN(d.getTime()) ? null : d
    }

    switch (operator) {
      case 'equal':
        return String(fieldValue) === String(value)
      case 'not_equal':
        return String(fieldValue) !== String(value)
      case 'contains':
        return String(fieldValue || '').toLowerCase().includes(String(value || '').toLowerCase())
      case 'not_contains':
        return !String(fieldValue || '').toLowerCase().includes(String(value || '').toLowerCase())
      case 'is_empty':
        return fieldValue === null || fieldValue === undefined || fieldValue === ''
      case 'is_not_empty':
        return fieldValue !== null && fieldValue !== undefined && fieldValue !== ''
      case 'greater_than':
        return Number(fieldValue) > Number(value)
      case 'less_than':
        return Number(fieldValue) < Number(value)
      case 'greater_than_or_equal':
        return Number(fieldValue) >= Number(value)
      case 'less_than_or_equal':
        return Number(fieldValue) <= Number(value)
      case 'date_equal':
        if (isDateOnlyString(value)) {
          const bounds = getLocalDayBoundsFromDateOnly(value)
          const d = asDate(fieldValue)
          if (bounds && d) {
            const start = new Date(bounds.startIso)
            const end = new Date(bounds.nextDayStartIso)
            return d >= start && d < end
          }
        }
        return String(fieldValue) === String(value)
      case 'date_before':
        if (isDateOnlyString(value)) {
          const bounds = getLocalDayBoundsFromDateOnly(value)
          const d = asDate(fieldValue)
          if (bounds && d) return d < new Date(bounds.startIso)
        }
        return new Date(fieldValue) < new Date(value as string)
      case 'date_after':
        if (isDateOnlyString(value)) {
          const bounds = getLocalDayBoundsFromDateOnly(value)
          const d = asDate(fieldValue)
          if (bounds && d) return d >= new Date(bounds.nextDayStartIso)
        }
        return new Date(fieldValue) > new Date(value as string)
      case 'date_on_or_before':
        if (isDateOnlyString(value)) {
          const bounds = getLocalDayBoundsFromDateOnly(value)
          const d = asDate(fieldValue)
          if (bounds && d) return d < new Date(bounds.nextDayStartIso)
        }
        return new Date(fieldValue) <= new Date(value as string)
      case 'date_on_or_after':
        if (isDateOnlyString(value)) {
          const bounds = getLocalDayBoundsFromDateOnly(value)
          const d = asDate(fieldValue)
          if (bounds && d) return d >= new Date(bounds.startIso)
        }
        return new Date(fieldValue) >= new Date(value as string)
      default:
        return true
    }
  }
  
  function evaluateGroup(group: FilterGroup): boolean {
    if (group.children.length === 0) {
      return true
    }
    
    const results = group.children.map(child => {
      if ('field_id' in child) {
        return evaluateCondition(child)
      } else {
        return evaluateGroup(child)
      }
    })
    
    if (group.operator === 'AND') {
      return results.every(r => r === true)
    } else {
      return results.some(r => r === true)
    }
  }
  
  return evaluateGroup(normalized)
}
