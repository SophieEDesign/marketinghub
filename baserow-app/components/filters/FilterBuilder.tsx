"use client"

import { useState, useCallback, useMemo } from "react"
import { Plus, X, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import type { TableField } from "@/types/fields"
import type { FilterTree, FilterGroup, FilterCondition, GroupOperator } from "@/lib/filters/canonical-model"
import {
  normalizeFilterTree,
  isEmptyFilterTree,
  flattenFilterTree,
  conditionsToFilterTree,
} from "@/lib/filters/canonical-model"
import { getOperatorsForFieldType, getDefaultOperatorForFieldType } from "@/lib/filters/field-operators"
import FilterValueInput from "./FilterValueInput"

interface FilterBuilderProps {
  filterTree: FilterTree
  tableFields: TableField[]
  onChange: (filterTree: FilterTree) => void
  className?: string
  variant?: "default" | "airtable"
  /**
   * When false, the UI will not allow creating nested groups (all conditions are ANDed).
   * Any incoming grouped tree will be flattened to conditions combined with AND.
   */
  allowGroups?: boolean
  /**
   * When false, the UI will not allow selecting OR as a group operator.
   * Any incoming OR operators will be coerced to AND.
   */
  allowOr?: boolean
}

/**
 * Unified Filter Builder Component
 * 
 * This is the single source of truth for filter UI across the entire application.
 * Features:
 * - Nested filter groups with AND/OR logic
 * - Field-aware operators and value inputs
 * - Drag & drop reordering (visual only for now)
 * - Clear visual hierarchy
 * - Consistent behavior everywhere
 */
export default function FilterBuilder({
  filterTree,
  tableFields,
  onChange,
  className = "",
  variant = "default",
  allowGroups = true,
  allowOr = true,
}: FilterBuilderProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [draggedItem, setDraggedItem] = useState<{ type: 'condition' | 'group'; path: number[] } | null>(null)

  // Normalize filter tree to always be a group, then apply capability constraints.
  const normalizedTree = useMemo<FilterGroup>(() => {
    const base = normalizeFilterTree(filterTree) || {
      operator: "AND" as GroupOperator,
      children: [],
    }

    // Simple mode: no groups; flatten everything into a single AND group.
    if (!allowGroups) {
      const conditions = flattenFilterTree(base)
      return (conditionsToFilterTree(conditions, "AND") || {
        operator: "AND" as GroupOperator,
        children: [],
      }) as FilterGroup
    }

    // AND-only mode: keep grouping, but disallow OR operators.
    if (!allowOr) {
      const coerceToAnd = (g: FilterGroup): FilterGroup => ({
        operator: "AND",
        children: g.children.map((child) =>
          "field_id" in child ? child : coerceToAnd(child)
        ),
      })
      return coerceToAnd(base)
    }

    return base
  }, [filterTree, allowGroups, allowOr])

  const toggleGroupCollapse = useCallback((path: number[]) => {
    const key = path.join(',')
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  const isGroupCollapsed = useCallback((path: number[]): boolean => {
    const key = path.join(',')
    return collapsedGroups.has(key)
  }, [collapsedGroups])

  // Add a new condition to a group
  const addCondition = useCallback((path: number[]) => {
    const newCondition: FilterCondition = {
      field_id: tableFields[0]?.name || '',
      operator: tableFields[0] ? getDefaultOperatorForFieldType(tableFields[0].type) : 'equal',
      value: undefined,
    }

    const newTree = addConditionToPath(normalizedTree, path, newCondition)
    onChange(newTree)
  }, [normalizedTree, tableFields, onChange])

  // Add a new group
  const addGroup = useCallback((path: number[], operator: GroupOperator = 'AND') => {
    if (!allowGroups) return
    const newGroup: FilterGroup = {
      operator: allowOr ? operator : 'AND',
      children: [],
    }

    const newTree = addGroupToPath(normalizedTree, path, newGroup)
    onChange(newTree)
  }, [allowGroups, allowOr, normalizedTree, onChange])

  // Remove an item (condition or group)
  const removeItem = useCallback((path: number[]) => {
    const newTree = removeItemFromPath(normalizedTree, path)
    onChange(newTree)
  }, [normalizedTree, onChange])

  // Update a condition
  const updateCondition = useCallback((path: number[], updates: Partial<FilterCondition>) => {
    const newTree = updateConditionInPath(normalizedTree, path, updates)
    onChange(newTree)
  }, [normalizedTree, onChange])

  // Update a group's operator
  const updateGroupOperator = useCallback((path: number[], operator: GroupOperator) => {
    const nextOperator = allowOr ? operator : 'AND'
    const newTree = updateGroupOperatorInPath(normalizedTree, path, nextOperator)
    onChange(newTree)
  }, [allowOr, normalizedTree, onChange])

  // Duplicate a condition or group
  const duplicateItem = useCallback((path: number[]) => {
    const newTree = duplicateItemInPath(normalizedTree, path)
    onChange(newTree)
  }, [normalizedTree, onChange])

  // Render a condition
  const renderCondition = useCallback((
    condition: FilterCondition,
    path: number[],
    isFirst: boolean,
    groupOperator: GroupOperator
  ) => {
    const field = tableFields.find(f => f.name === condition.field_id || f.id === condition.field_id)
    const operators = field ? getOperatorsForFieldType(field.type) : []
    const pathKey = path.join(',')

    if (variant === "airtable") {
      const joinLabel = isFirst ? "Where" : groupOperator.toLowerCase()
      return (
        <div key={pathKey} className="flex items-center gap-2">
          <div className="w-14 text-[11px] font-medium text-gray-600">{joinLabel}</div>

          <Select
            value={condition.field_id}
            onValueChange={(value) => {
              const newField = tableFields.find((f) => f.name === value || f.id === value)
              updateCondition(path, {
                field_id: value,
                operator: newField ? getDefaultOperatorForFieldType(newField.type) : "equal",
                value: undefined,
              })
            }}
          >
            <SelectTrigger className="h-8 text-xs min-w-36">
              <SelectValue placeholder="Field" />
            </SelectTrigger>
            <SelectContent>
              {tableFields.map((f) => (
                <SelectItem key={f.id || f.name} value={f.name}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={condition.operator}
            onValueChange={(value) => updateCondition(path, { operator: value as FilterCondition["operator"] })}
          >
            <SelectTrigger className="h-8 text-xs min-w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {operators.map((op) => (
                <SelectItem key={op.value} value={op.value}>
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex-1 min-w-44">
            <FilterValueInput
              field={field || null}
              operator={condition.operator}
              value={condition.value}
              onChange={(value) => updateCondition(path, { value })}
              size="sm"
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => duplicateItem(path)}
            className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700"
            title="Duplicate"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeItem(path)}
            className="h-8 w-8 p-0 text-gray-400 hover:text-red-700 hover:bg-red-50"
            title="Remove"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )
    }

    return (
      <div key={pathKey} className="relative">
        {!isFirst && (
          <div className="flex items-center mb-2">
            <div className="flex-1 h-px bg-gray-300"></div>
            <span className="px-3 text-xs font-medium text-gray-600 bg-white">
              {groupOperator}
            </span>
            <div className="flex-1 h-px bg-gray-300"></div>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-12 gap-2 items-end">
            {/* Field selector */}
            <div className="col-span-4">
              <Label className="text-xs text-gray-600 mb-1 block">Field</Label>
              <Select
                value={condition.field_id}
                onValueChange={(value) => {
                  const newField = tableFields.find(f => f.name === value || f.id === value)
                  updateCondition(path, {
                    field_id: value,
                    operator: newField ? getDefaultOperatorForFieldType(newField.type) : 'equal',
                    value: undefined,
                  })
                }}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  {tableFields.map((f) => (
                    <SelectItem key={f.id || f.name} value={f.name}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Operator selector */}
            <div className="col-span-3">
              <Label className="text-xs text-gray-600 mb-1 block">Operator</Label>
              <Select
                value={condition.operator}
                onValueChange={(value) => {
                  updateCondition(path, { operator: value as FilterCondition['operator'] })
                }}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {operators.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Value input */}
            <div className="col-span-4">
              <Label className="text-xs text-gray-600 mb-1 block">Value</Label>
              <FilterValueInput
                field={field || null}
                operator={condition.operator}
                value={condition.value}
                onChange={(value) => updateCondition(path, { value })}
              />
            </div>

            {/* Actions */}
            <div className="col-span-1 flex items-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => duplicateItem(path)}
                className="h-9 w-9 p-0"
                title="Duplicate"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeItem(path)}
                className="h-9 w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                title="Remove"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }, [tableFields, updateCondition, removeItem, duplicateItem, variant])

  // Render a group
  const renderGroup = useCallback(function renderGroupImpl(
    group: FilterGroup,
    path: number[],
    isFirst: boolean = true,
    parentOperator?: GroupOperator
  ) {
    const pathKey = path.join(',')
    const isCollapsed = isGroupCollapsed(path)
    const isEmpty = group.children.length === 0

    if (variant === "airtable" && path.length === 0) {
      return (
        <div key={pathKey} className="space-y-2">
          {group.children.length === 0 ? (
            <div className="text-sm text-gray-500 border border-dashed border-gray-300 rounded-md p-4">
              No filters applied
            </div>
          ) : (
            group.children.map((child, index) => {
              const childPath = [...path, index]
              if ("field_id" in child) {
                return renderCondition(child, childPath, index === 0, group.operator)
              }
              return renderGroupImpl(child, childPath, index === 0, group.operator)
            })
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => addCondition(path)}
              className="h-8 px-2 text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add condition
            </Button>
            {allowGroups && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => addGroup(path, "AND")}
                className="h-8 px-2 text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add group
              </Button>
            )}
          </div>
        </div>
      )
    }

    return (
      <div key={pathKey} className="relative">
        {!isFirst && parentOperator && (
          <div className="flex items-center mb-3">
            <div className="flex-1 h-px bg-gray-300"></div>
            <span className="px-3 text-xs font-semibold text-gray-700 bg-white">
              {parentOperator}
            </span>
            <div className="flex-1 h-px bg-gray-300"></div>
          </div>
        )}

        <div className={`border-2 rounded-lg ${isEmpty ? 'border-dashed border-gray-300 bg-gray-50' : (variant === "airtable" ? 'border-gray-200 bg-white' : 'border-blue-200 bg-blue-50')}`}>
          {/* Group header */}
          <div className={`flex items-center justify-between p-3 ${variant === "airtable" ? "border-b border-gray-200" : "border-b border-blue-200"}`}>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleGroupCollapse(path)}
                className={`p-1 rounded ${variant === "airtable" ? "hover:bg-gray-100" : "hover:bg-blue-100"}`}
              >
                {isCollapsed ? (
                  <ChevronRight className={`h-4 w-4 ${variant === "airtable" ? "text-gray-600" : "text-blue-700"}`} />
                ) : (
                  <ChevronDown className={`h-4 w-4 ${variant === "airtable" ? "text-gray-600" : "text-blue-700"}`} />
                )}
              </button>
              <span className={`text-sm font-semibold ${variant === "airtable" ? "text-gray-900" : "text-blue-900"}`}>
                {isEmpty ? 'Empty Group' : `Group (${group.children.length} condition${group.children.length !== 1 ? 's' : ''})`}
              </span>
              {allowOr ? (
                <Select
                  value={group.operator}
                  onValueChange={(value) => updateGroupOperator(path, value as GroupOperator)}
                >
                  <SelectTrigger className={`h-7 w-20 text-xs ${variant === "airtable" ? "border-gray-300" : "border-blue-300"}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AND">AND</SelectItem>
                    <SelectItem value="OR">OR</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <span className={`text-xs font-semibold px-2 py-1 rounded border ${variant === "airtable" ? "border-gray-300 text-gray-700 bg-white" : "border-blue-300 text-blue-800 bg-white"}`}>
                  AND
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => duplicateItem(path)}
                className="h-7 text-xs"
              >
                Duplicate
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeItem(path)}
                className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                Remove
              </Button>
            </div>
          </div>

          {/* Group content */}
          {!isCollapsed && (
            <div className={`p-3 ${variant === "airtable" ? "space-y-2" : "space-y-2"}`}>
              {isEmpty ? (
                <div className="text-center py-6 text-sm text-gray-500">
                  <p>This group is empty</p>
                  <p className="text-xs mt-1">Add a condition or group to get started</p>
                </div>
              ) : (
                group.children.map((child, index) => {
                  const childPath = [...path, index]
                  if ('field_id' in child) {
                    // Condition
                    return renderCondition(child, childPath, index === 0, group.operator)
                  } else {
                    // Nested group
                    return renderGroupImpl(child, childPath, index === 0, group.operator)
                  }
                })
              )}

              {/* Add buttons */}
              <div className={`flex gap-2 pt-2 ${variant === "airtable" ? "border-t border-gray-200" : "border-t border-blue-200"}`}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addCondition(path)}
                  className={`flex-1 ${variant === "airtable" ? "border-gray-300 text-gray-700 hover:bg-gray-50" : "border-blue-300 text-blue-700 hover:bg-blue-100"}`}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Condition
                </Button>
                {allowGroups && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addGroup(path, 'AND')}
                    className={`flex-1 ${variant === "airtable" ? "border-gray-300 text-gray-700 hover:bg-gray-50" : "border-blue-300 text-blue-700 hover:bg-blue-100"}`}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Group
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }, [isGroupCollapsed, toggleGroupCollapse, updateGroupOperator, removeItem, duplicateItem, addCondition, addGroup, renderCondition, variant, allowGroups, allowOr])

  // Helper functions to manipulate filter tree
  function addConditionToPath(tree: FilterGroup, path: number[], condition: FilterCondition): FilterGroup {
    if (path.length === 0) {
      return { ...tree, children: [...tree.children, condition] }
    }
    const [index, ...rest] = path
    const child = tree.children[index]
    if ('field_id' in child) {
      // Can't add to a condition
      return tree
    }
    const updatedChild = addConditionToPath(child, rest, condition)
    return {
      ...tree,
      children: tree.children.map((c, i) => i === index ? updatedChild : c),
    }
  }

  function addGroupToPath(tree: FilterGroup, path: number[], group: FilterGroup): FilterGroup {
    if (path.length === 0) {
      return { ...tree, children: [...tree.children, group] }
    }
    const [index, ...rest] = path
    const child = tree.children[index]
    if ('field_id' in child) {
      // Can't add to a condition
      return tree
    }
    const updatedChild = addGroupToPath(child, rest, group)
    return {
      ...tree,
      children: tree.children.map((c, i) => i === index ? updatedChild : c),
    }
  }

  function removeItemFromPath(tree: FilterGroup, path: number[]): FilterGroup | null {
    if (path.length === 0) {
      return null
    }
    if (path.length === 1) {
      const [index] = path
      const newChildren = tree.children.filter((_, i) => i !== index)
      if (newChildren.length === 0) {
        return null
      }
      return { ...tree, children: newChildren }
    }
    const [index, ...rest] = path
    const child = tree.children[index]
    if ('field_id' in child) {
      return tree
    }
    const updatedChild = removeItemFromPath(child, rest)
    if (!updatedChild) {
      // Remove the group if it became empty
      return removeItemFromPath(tree, [index])
    }
    return {
      ...tree,
      children: tree.children.map((c, i) => i === index ? updatedChild : c),
    }
  }

  function updateConditionInPath(tree: FilterGroup, path: number[], updates: Partial<FilterCondition>): FilterGroup {
    if (path.length === 0) {
      return tree
    }
    if (path.length === 1) {
      const [index] = path
      const child = tree.children[index]
      if ('field_id' in child) {
        return {
          ...tree,
          children: tree.children.map((c, i) => {
            if (i === index && 'field_id' in c) {
              return { ...c, ...updates } as FilterCondition
            }
            return c
          }),
        }
      }
      return tree
    }
    const [index, ...rest] = path
    const child = tree.children[index]
    if ('field_id' in child) {
      return tree
    }
    const updatedChild = updateConditionInPath(child, rest, updates)
    return {
      ...tree,
      children: tree.children.map((c, i) => i === index ? updatedChild : c),
    }
  }

  function updateGroupOperatorInPath(tree: FilterGroup, path: number[], operator: GroupOperator): FilterGroup {
    if (path.length === 0) {
      return { ...tree, operator }
    }
    const [index, ...rest] = path
    const child = tree.children[index]
    if ('field_id' in child) {
      return tree
    }
    const updatedChild = updateGroupOperatorInPath(child, rest, operator)
    return {
      ...tree,
      children: tree.children.map((c, i) => i === index ? updatedChild : c),
    }
  }

  function duplicateItemInPath(tree: FilterGroup, path: number[]): FilterGroup {
    if (path.length === 0) {
      return tree
    }
    if (path.length === 1) {
      const [index] = path
      const child = tree.children[index]
      const duplicated = 'field_id' in child
        ? { ...child }
        : { ...child, children: child.children.map(c => 'field_id' in c ? { ...c } : { ...c, children: c.children.map(cc => 'field_id' in cc ? { ...cc } : { ...cc } as any) }) }
      return {
        ...tree,
        children: [...tree.children, duplicated],
      }
    }
    const [index, ...rest] = path
    const child = tree.children[index]
    if ('field_id' in child) {
      return tree
    }
    const updatedChild = duplicateItemInPath(child, rest)
    return {
      ...tree,
      children: tree.children.map((c, i) => i === index ? updatedChild : c),
    }
  }

  const isEmpty = isEmptyFilterTree(normalizedTree)

  return (
    <div className={`${variant === "airtable" ? "space-y-2" : "space-y-4"} ${className}`}>
      {isEmpty ? (
        <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
          <p className="text-sm mb-1">No filters applied</p>
          <p className="text-xs">
            {allowGroups ? "Add a condition or group to filter records" : "Add a condition to filter records"}
          </p>
        </div>
      ) : (
        renderGroup(normalizedTree, [], true)
      )}

      {isEmpty && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => addCondition([])}
            className="flex-1"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Condition
          </Button>
          {allowGroups && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => addGroup([], 'AND')}
              className="flex-1"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Group
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
