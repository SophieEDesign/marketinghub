/**
 * Canonical Filter Model
 * 
 * This is the single source of truth for filter structure across the entire application.
 * All filters, regardless of where they're used, must conform to this model.
 * 
 * Structure:
 * - FilterGroup: Contains operator (AND/OR) and children (conditions or nested groups)
 * - FilterCondition: A single filter condition (field + operator + value)
 * 
 * This tree structure allows for:
 * - Nested groups
 * - Complex AND/OR logic
 * - Predictable evaluation
 */

export type FilterOperator = 
  | 'equal'
  | 'not_equal'
  | 'contains'
  | 'not_contains'
  | 'is_empty'
  | 'is_not_empty'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'date_equal'
  | 'date_before'
  | 'date_after'
  | 'date_on_or_before'
  | 'date_on_or_after'
  | 'date_range'

export type GroupOperator = 'AND' | 'OR'

/**
 * FilterCondition: A single filter condition
 * 
 * - field_id: The field to filter on (can be field name or ID)
 * - operator: The comparison operator
 * - value: The value to compare against (type depends on field type)
 */
export interface FilterCondition {
  field_id: string
  operator: FilterOperator
  value?: string | number | boolean | string[] | null
}

/**
 * FilterGroup: A group of conditions or nested groups
 * 
 * - operator: How to combine children (AND or OR)
 * - children: Array of FilterCondition or FilterGroup (nested)
 */
export interface FilterGroup {
  operator: GroupOperator
  children: Array<FilterCondition | FilterGroup>
}

/**
 * FilterTree: The root of a filter structure
 * 
 * Can be:
 * - A single FilterGroup (most common)
 * - A single FilterCondition (treated as a group with one condition)
 * - null/undefined (no filters)
 */
export type FilterTree = FilterGroup | FilterCondition | null | undefined

/**
 * Normalize a filter tree to always be a FilterGroup
 * 
 * This ensures consistent evaluation - single conditions become groups with one child
 */
export function normalizeFilterTree(tree: FilterTree): FilterGroup | null {
  if (!tree) return null
  
  // If it's already a group, return it
  if ('operator' in tree && 'children' in tree) {
    return tree
  }
  
  // If it's a single condition, wrap it in a group
  if ('field_id' in tree && 'operator' in tree) {
    return {
      operator: 'AND',
      children: [tree]
    }
  }
  
  return null
}

/**
 * Check if a filter tree is empty (no conditions)
 */
export function isEmptyFilterTree(tree: FilterTree): boolean {
  if (!tree) return true
  
  const normalized = normalizeFilterTree(tree)
  if (!normalized) return true
  
  return normalized.children.length === 0
}

/**
 * Count total conditions in a filter tree
 */
export function countFilterConditions(tree: FilterTree): number {
  if (!tree) return 0
  
  const normalized = normalizeFilterTree(tree)
  if (!normalized) return 0
  
  let count = 0
  for (const child of normalized.children) {
    if ('field_id' in child) {
      count += 1
    } else {
      count += countFilterConditions(child)
    }
  }
  
  return count
}

/**
 * Flatten a filter tree to a list of conditions
 * 
 * Useful for Filter Block which may use flat conditions
 * Note: This loses group structure, so use carefully
 */
export function flattenFilterTree(tree: FilterTree): FilterCondition[] {
  if (!tree) return []
  
  const normalized = normalizeFilterTree(tree)
  if (!normalized) return []
  
  const conditions: FilterCondition[] = []
  
  function traverse(node: FilterGroup | FilterCondition) {
    if ('field_id' in node) {
      conditions.push(node)
    } else {
      for (const child of node.children) {
        traverse(child)
      }
    }
  }
  
  traverse(normalized)
  return conditions
}

/**
 * Convert flat conditions to a filter tree
 * 
 * Used by Filter Block to convert flat conditions to canonical model
 * All conditions are combined with AND by default
 */
export function conditionsToFilterTree(
  conditions: FilterCondition[],
  operator: GroupOperator = 'AND'
): FilterGroup | null {
  if (conditions.length === 0) return null
  
  return {
    operator,
    children: conditions
  }
}
