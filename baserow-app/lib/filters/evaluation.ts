/**
 * Filter Evaluation Engine
 * 
 * This is the single source of truth for evaluating filters.
 * All filter evaluation must go through this engine to ensure consistency.
 * 
 * This engine converts the canonical filter model into Supabase queries.
 */

import type { FilterTree, FilterGroup, FilterCondition } from './canonical-model'
import { normalizeFilterTree } from './canonical-model'

/**
 * Convert a filter condition to a Supabase filter string
 * 
 * Used for OR groups where we need to build filter strings
 */
function conditionToSupabaseString(condition: FilterCondition): string {
  const { field_id, operator, value } = condition
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
      return `${fieldName}.eq.${fieldValue}`
    case 'date_before':
      return `${fieldName}.lt.${fieldValue}`
    case 'date_after':
      return `${fieldName}.gt.${fieldValue}`
    case 'date_on_or_before':
      return `${fieldName}.lte.${fieldValue}`
    case 'date_on_or_after':
      return `${fieldName}.gte.${fieldValue}`
    default:
      return ''
  }
}

/**
 * Apply a single filter condition to a Supabase query
 */
function applyCondition(
  query: any,
  condition: FilterCondition
): any {
  const { field_id, operator, value } = condition
  const fieldName = field_id
  
  switch (operator) {
    case 'equal':
      return query.eq(fieldName, value)
    case 'not_equal':
      return query.neq(fieldName, value)
    case 'contains':
      return query.ilike(fieldName, `%${value}%`)
    case 'not_contains':
      return query.not(fieldName, 'ilike', `%${value}%`)
    case 'is_empty':
      return query.or(`${fieldName}.is.null,${fieldName}.eq.`)
    case 'is_not_empty':
      return query.not(fieldName, 'is', null)
    case 'greater_than':
      return query.gt(fieldName, value)
    case 'less_than':
      return query.lt(fieldName, value)
    case 'greater_than_or_equal':
      return query.gte(fieldName, value)
    case 'less_than_or_equal':
      return query.lte(fieldName, value)
    case 'date_equal':
      return query.eq(fieldName, value)
    case 'date_before':
      return query.lt(fieldName, value)
    case 'date_after':
      return query.gt(fieldName, value)
    case 'date_on_or_before':
      return query.lte(fieldName, value)
    case 'date_on_or_after':
      return query.gte(fieldName, value)
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
  group: FilterGroup
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
        query = applyGroup(query, child)
      }
    }
  } else {
    // AND group - chain conditions normally
    for (const child of children) {
      if ('field_id' in child) {
        // Condition
        query = applyCondition(query, child)
      } else {
        // Nested group
        query = applyGroup(query, child)
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
 * @returns The modified query
 */
export function applyFiltersToQuery(
  query: any,
  filterTree: FilterTree
): any {
  if (!filterTree) {
    return query
  }
  
  const normalized = normalizeFilterTree(filterTree)
  if (!normalized) {
    return query
  }
  
  return applyGroup(query, normalized)
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
    const { field_id, operator, value } = condition
    const fieldValue = getFieldValue 
      ? getFieldValue(row, field_id)
      : row[field_id]
    
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
        return String(fieldValue) === String(value)
      case 'date_before':
        return new Date(fieldValue) < new Date(value as string)
      case 'date_after':
        return new Date(fieldValue) > new Date(value as string)
      case 'date_on_or_before':
        return new Date(fieldValue) <= new Date(value as string)
      case 'date_on_or_after':
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
