/**
 * Filter Converters
 * 
 * Convert between database format (ViewFilter, ViewFilterGroup) and canonical model
 */

import type { ViewFilter, ViewFilterGroup } from '@/types/database'
import type { FilterTree, FilterGroup, FilterCondition } from './canonical-model'
import { conditionsToFilterTree } from './canonical-model'

/**
 * Convert database filters and groups to canonical filter tree
 * 
 * This is the main conversion function used throughout the app.
 * Handles field_name as field_id (field names are used as identifiers in filters).
 */
export function dbFiltersToFilterTree(
  filters: ViewFilter[],
  groups: ViewFilterGroup[]
): FilterTree {
  if (filters.length === 0) {
    return null
  }
  
  // Organize filters by group
  const filtersByGroup = new Map<string | null, ViewFilter[]>()
  const ungroupedFilters: ViewFilter[] = []
  
  for (const filter of filters) {
    if (filter.filter_group_id) {
      if (!filtersByGroup.has(filter.filter_group_id)) {
        filtersByGroup.set(filter.filter_group_id, [])
      }
      filtersByGroup.get(filter.filter_group_id)!.push(filter)
    } else {
      ungroupedFilters.push(filter)
    }
  }
  
  // Sort groups by order_index
  const sortedGroups = [...groups].sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
  
  // Build group tree
  const groupNodes: FilterGroup[] = []
  
  for (const group of sortedGroups) {
    const groupFilters = filtersByGroup.get(group.id) || []
    if (groupFilters.length === 0) continue
    
    // Sort filters by order_index
    groupFilters.sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
    
    const conditions: FilterCondition[] = groupFilters.map(f => ({
      field_id: f.field_name, // Using field_name as field_id (field names are identifiers)
      operator: f.operator as FilterCondition['operator'],
      value: f.value || undefined,
    }))
    
    groupNodes.push({
      operator: group.condition_type,
      children: conditions,
    })
  }
  
  // Add ungrouped filters as a single AND group
  if (ungroupedFilters.length > 0) {
    ungroupedFilters.sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
    
    const conditions: FilterCondition[] = ungroupedFilters.map(f => ({
      field_id: f.field_name,
      operator: f.operator as FilterCondition['operator'],
      value: f.value || undefined,
    }))
    
    groupNodes.push({
      operator: 'AND',
      children: conditions,
    })
  }
  
  // If we have multiple groups, combine them with AND
  // If we have one group, return it directly
  if (groupNodes.length === 0) {
    return null
  } else if (groupNodes.length === 1) {
    return groupNodes[0]
  } else {
    return {
      operator: 'AND',
      children: groupNodes,
    }
  }
}

/**
 * Convert canonical filter tree to database format
 * 
 * This flattens the tree structure for storage.
 * Note: Nested groups are flattened - only top-level groups are preserved.
 */
export function filterTreeToDbFormat(
  filterTree: FilterTree,
  viewId: string
): {
  groups: Omit<ViewFilterGroup, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>[]
  filters: Omit<ViewFilter, 'id' | 'created_at'>[]
} {
  if (!filterTree || ('field_id' in filterTree && 'operator' in filterTree)) {
    // Single condition or null
    if (!filterTree || 'field_id' in filterTree === false) {
      return { groups: [], filters: [] }
    }
    
    // Single condition - treat as ungrouped
    const condition = filterTree as FilterCondition
    return {
      groups: [],
      filters: [{
        view_id: viewId,
        field_name: condition.field_id,
        operator: condition.operator,
        value: condition.value as string | undefined,
        filter_group_id: null,
        order_index: 0,
      }],
    }
  }
  
  const group = filterTree as FilterGroup
  const groups: Omit<ViewFilterGroup, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>[] = []
  const filters: Omit<ViewFilter, 'id' | 'created_at'>[] = []
  
  let groupIndex = 0
  
  // Track group indices for proper filter-to-group mapping
  // We'll use temporary indices and map them after group insertion
  const tempGroupMap = new Map<number, string | null>()
  
  function processGroup(
    node: FilterGroup,
    parentTempIndex: number | null = null
  ): number | null {
    // Determine if we need to create a group
    const hasMultipleChildren = node.children.length > 1
    const hasNestedGroups = node.children.some(child => 'operator' in child && 'children' in child)
    const needsGroup = hasMultipleChildren || hasNestedGroups || node.operator === 'OR'
    
    let currentTempIndex: number | null = null
    
    if (needsGroup) {
      // Create a group
      const groupData: Omit<ViewFilterGroup, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'> = {
        view_id: viewId,
        condition_type: node.operator,
        order_index: groupIndex,
      }
      groups.push(groupData)
      currentTempIndex = groupIndex
      tempGroupMap.set(groupIndex, null) // Will be set after insertion
      groupIndex++
    }
    
    // Process children
    let conditionIndex = 0
    for (const child of node.children) {
      if ('field_id' in child) {
        // Condition
        filters.push({
          view_id: viewId,
          field_name: child.field_id,
          operator: child.operator,
          value: child.value as string | undefined,
          filter_group_id: currentTempIndex !== null ? `temp-${currentTempIndex}` : null,
          order_index: conditionIndex++,
        })
      } else {
        // Nested group - recursively process
        processGroup(child, currentTempIndex)
      }
    }
    
    return currentTempIndex
  }
  
  processGroup(group)
  
  // Note: The filter_group_id values with "temp-" prefix will need to be replaced
  // with actual group IDs after groups are inserted. This is handled in UnifiedFilterDialog.
  
  return { groups, filters }
}

/**
 * Convert flat FilterConfig[] (used by FilterBlock) to canonical model
 */
export function filterConfigsToFilterTree(
  configs: Array<{ field: string; operator: string; value?: string }>,
  operator: 'AND' | 'OR' = 'AND'
): FilterTree {
  if (configs.length === 0) {
    return null
  }
  
  const conditions: FilterCondition[] = configs.map(c => ({
    field_id: c.field,
    operator: c.operator as FilterCondition['operator'],
    value: c.value,
  }))
  
  return conditionsToFilterTree(conditions, operator)
}
