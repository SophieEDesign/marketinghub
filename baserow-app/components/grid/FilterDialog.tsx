"use client"

import { useState, useEffect } from "react"
import { Plus, X, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase/client"
import type { TableField } from "@/types/fields"
import { FIELD_TYPES } from "@/types/fields"
import type { ViewFilterGroup, ViewFilter, FilterConditionType, FilterType } from "@/types/database"
import {
  resolveChoiceColor,
  normalizeHexColor,
} from "@/lib/field-colors"
import { normalizeUuid } from "@/lib/utils/ids"

interface FilterDialogProps {
  isOpen: boolean
  onClose: () => void
  viewId: string
  tableFields: TableField[]
  filters: Array<{
    id: string
    field_name: string
    operator: FilterType
    value?: string
    filter_group_id?: string | null
    order_index?: number
  }>
  onFiltersChange?: (filters: Array<{ id?: string; field_name: string; operator: FilterType; value?: string }>) => void
}

interface LocalFilter extends Omit<ViewFilter, 'id' | 'view_id' | 'created_at'> {
  id?: string
  tempId?: string
}

interface LocalFilterGroup extends Omit<ViewFilterGroup, 'id' | 'view_id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'> {
  id?: string
  tempId?: string
  filters: LocalFilter[]
}

export default function FilterDialog({
  isOpen,
  onClose,
  viewId,
  tableFields,
  filters,
  onFiltersChange,
}: FilterDialogProps) {
  const viewUuid = normalizeUuid(viewId)
  const [filterGroups, setFilterGroups] = useState<LocalFilterGroup[]>([])
  const [ungroupedFilters, setUngroupedFilters] = useState<LocalFilter[]>([])

  // Load filter groups and filters when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadFilterGroups()
    }
  }, [isOpen, viewId])

  async function loadFilterGroups() {
    try {
      if (!viewUuid) {
        throw new Error("Invalid viewId (expected UUID).")
      }
      // Load filter groups (optional: table may not exist or RLS may return 500)
      let groups: { id: string; view_id: string; condition_type: string; order_index: number }[] = []
      let { data: groupsData, error: groupsError } = await supabase
        .from("view_filter_groups")
        .select("*")
        .eq("view_id", viewUuid)
        .order("order_index", { ascending: true })

      if (groupsError && ((groupsError as { code?: string; status?: number })?.code === "42703" || (groupsError as { status?: number })?.status === 500)) {
        // order_index missing or table/RLS issue: retry without order
        const retry = await supabase
          .from("view_filter_groups")
          .select("*")
          .eq("view_id", viewUuid)
        if (!retry.error && retry.data) {
          groupsData = retry.data.sort((a: { order_index?: number }, b: { order_index?: number }) => (a.order_index ?? 0) - (b.order_index ?? 0))
          groupsError = null
        }
      }
      if (!groupsError && groupsData) {
        groups = Array.isArray(groupsData) ? groupsData : []
      }
      // If view_filter_groups fails, continue with empty groups

      // Load all filters (fallback without order_index if column missing)
      let allFilters: unknown[] | null = null
      let filtersError: unknown = null
      let res = await supabase
        .from("view_filters")
        .select("*")
        .eq("view_id", viewUuid)
        .order("order_index", { ascending: true })
      allFilters = res.data
      filtersError = res.error
      if (filtersError && ((filtersError as { code?: string; status?: number })?.code === "42703" || (filtersError as { status?: number })?.status === 500)) {
        res = await supabase.from("view_filters").select("*").eq("view_id", viewUuid)
        if (!res.error && res.data) {
          allFilters = Array.isArray(res.data) ? res.data.sort((a: { order_index?: number }, b: { order_index?: number }) => (a.order_index ?? 0) - (b.order_index ?? 0)) : []
          filtersError = null
        }
      }
      if (filtersError) throw filtersError

      // Organize filters into groups
      const groupsMap = new Map<string, LocalFilterGroup>()
      const ungrouped: LocalFilter[] = []

      // Initialize groups
      if (groups) {
        groups.forEach((group) => {
          const conditionType: FilterConditionType = group.condition_type === 'OR' ? 'OR' : 'AND'
          groupsMap.set(group.id, {
            ...group,
            condition_type: conditionType,
            filters: [],
          })
        })
      }

      // Assign filters to groups
      if (allFilters) {
        allFilters.forEach((filter) => {
          const localFilter: LocalFilter = {
            ...filter,
            tempId: filter.id,
          }
          if (filter.filter_group_id && groupsMap.has(filter.filter_group_id)) {
            groupsMap.get(filter.filter_group_id)!.filters.push(localFilter)
          } else {
            ungrouped.push(localFilter)
          }
        })
      }

      setFilterGroups(Array.from(groupsMap.values()))
      setUngroupedFilters(ungrouped)
    } catch (error) {
      console.error("Error loading filter groups:", error)
      // Fallback to old structure
      const localFilters: LocalFilter[] = filters.map((f) => ({
        ...f,
        tempId: f.id,
      }))
      setUngroupedFilters(localFilters)
      setFilterGroups([])
    }
  }

  function getOperatorsForFieldType(fieldType: string) {
    switch (fieldType) {
      case "text":
      case "long_text":
        return [
          { value: "contains", label: "Contains" },
          { value: "not_contains", label: "Does not contain" },
          { value: "equal", label: "Equals" },
          { value: "not_equal", label: "Does not equal" },
          { value: "is_empty", label: "Is empty" },
          { value: "is_not_empty", label: "Is not empty" },
        ]
      case "number":
      case "currency":
      case "percent":
        return [
          { value: "equal", label: "Equals" },
          { value: "not_equal", label: "Does not equal" },
          { value: "greater_than", label: "Greater than" },
          { value: "greater_than_or_equal", label: "Greater than or equal" },
          { value: "less_than", label: "Less than" },
          { value: "less_than_or_equal", label: "Less than or equal" },
          { value: "is_empty", label: "Is empty" },
          { value: "is_not_empty", label: "Is not empty" },
        ]
      case "date":
        return [
          { value: "date_equal", label: "Is" },
          { value: "date_before", label: "Before" },
          { value: "date_after", label: "After" },
          { value: "date_on_or_before", label: "On or before" },
          { value: "date_on_or_after", label: "On or after" },
          { value: "is_empty", label: "Is empty" },
          { value: "is_not_empty", label: "Is not empty" },
        ]
      case "single_select":
      case "multi_select":
        return [
          { value: "equal", label: "Is" },
          { value: "not_equal", label: "Is not" },
          { value: "is_empty", label: "Is empty" },
          { value: "is_not_empty", label: "Is not empty" },
        ]
      case "checkbox":
        return [
          { value: "equal", label: "Is checked" },
          { value: "not_equal", label: "Is unchecked" },
        ]
      default:
        return [
          { value: "equal", label: "Equals" },
          { value: "not_equal", label: "Does not equal" },
          { value: "is_empty", label: "Is empty" },
          { value: "is_not_empty", label: "Is not empty" },
        ]
    }
  }

  function addFilterGroup() {
    const newGroup: LocalFilterGroup = {
      tempId: `temp-group-${Date.now()}`,
      condition_type: "AND",
      order_index: filterGroups.length,
      filters: [
        {
          tempId: `temp-${Date.now()}`,
          field_name: tableFields[0]?.name || "",
          operator: "equal",
          value: "",
          order_index: 0,
        },
      ],
    }
    setFilterGroups([...filterGroups, newGroup])
  }

  function removeFilterGroup(groupIndex: number) {
    setFilterGroups(filterGroups.filter((_, i) => i !== groupIndex))
  }

  function updateFilterGroup(groupIndex: number, updates: Partial<LocalFilterGroup>) {
    const newGroups = [...filterGroups]
    newGroups[groupIndex] = { ...newGroups[groupIndex], ...updates }
    setFilterGroups(newGroups)
  }

  function addFilterToGroup(groupIndex: number) {
    const newGroups = [...filterGroups]
    const group = newGroups[groupIndex]
    const newFilter: LocalFilter = {
      tempId: `temp-${Date.now()}`,
      field_name: tableFields[0]?.name || "",
      operator: "equal",
      value: "",
      filter_group_id: group.id || group.tempId,
      order_index: group.filters.length,
    }
    group.filters.push(newFilter)
    setFilterGroups(newGroups)
  }

  function removeFilterFromGroup(groupIndex: number, filterIndex: number) {
    const newGroups = [...filterGroups]
    newGroups[groupIndex].filters = newGroups[groupIndex].filters.filter((_, i) => i !== filterIndex)
    setFilterGroups(newGroups)
  }

  function updateFilterInGroup(groupIndex: number, filterIndex: number, updates: Partial<LocalFilter>) {
    const newGroups = [...filterGroups]
    newGroups[groupIndex].filters[filterIndex] = {
      ...newGroups[groupIndex].filters[filterIndex],
      ...updates,
    }
    setFilterGroups(newGroups)
  }

  function addUngroupedFilter() {
    const newFilter: LocalFilter = {
      tempId: `temp-${Date.now()}`,
      field_name: tableFields[0]?.name || "",
      operator: "equal",
      value: "",
      order_index: ungroupedFilters.length,
    }
    setUngroupedFilters([...ungroupedFilters, newFilter])
  }

  function removeUngroupedFilter(index: number) {
    setUngroupedFilters(ungroupedFilters.filter((_, i) => i !== index))
  }

  function updateUngroupedFilter(index: number, updates: Partial<LocalFilter>) {
    const newFilters = [...ungroupedFilters]
    newFilters[index] = { ...newFilters[index], ...updates }
    setUngroupedFilters(newFilters)
  }

  async function handleSave() {
    try {
      if (!viewUuid) {
        alert("This view is not linked to a valid view ID, so filters can't be saved.")
        return
      }
      // Delete existing filter groups and filters
      await supabase.from("view_filters").delete().eq("view_id", viewUuid)
      await supabase.from("view_filter_groups").delete().eq("view_id", viewUuid)

      // Insert filter groups first
      const groupsToInsert = filterGroups
        .filter((group) => group.filters.length > 0)
        .map((group, index) => ({
          view_id: viewUuid,
          condition_type: group.condition_type,
          order_index: index,
        }))

      let insertedGroupIds: string[] = []
      if (groupsToInsert.length > 0) {
        const { data: insertedGroups, error: groupsError } = await supabase
          .from("view_filter_groups")
          .insert(groupsToInsert)
          .select("id")

        if (groupsError) throw groupsError
        insertedGroupIds = insertedGroups?.map((g) => g.id) || []
      }

      // Collect all filters to insert
      const filtersToInsert: any[] = []

      // Add filters from groups
      filterGroups.forEach((group, groupIndex) => {
        if (group.filters.length > 0 && insertedGroupIds[groupIndex]) {
          group.filters.forEach((filter, filterIndex) => {
            if (filter.field_name && filter.operator) {
              filtersToInsert.push({
                view_id: viewUuid,
                field_name: filter.field_name,
                operator: filter.operator,
                value: filter.value || null,
                filter_group_id: insertedGroupIds[groupIndex],
                order_index: filterIndex,
              })
            }
          })
        }
      })

      // Add ungrouped filters
      ungroupedFilters.forEach((filter, index) => {
        if (filter.field_name && filter.operator) {
          filtersToInsert.push({
            view_id: viewUuid,
            field_name: filter.field_name,
            operator: filter.operator,
            value: filter.value || null,
            filter_group_id: null,
            order_index: index,
          })
        }
      })

      // Insert all filters
      if (filtersToInsert.length > 0) {
        const { data: insertedFilters, error: insertFiltersError } = await supabase
          .from("view_filters")
          .insert(filtersToInsert)
          .select("id, field_name, operator, value")

        if (insertFiltersError) throw insertFiltersError

        // Notify parent component (flattened for backward compatibility)
        const flattenedFilters = (insertedFilters || []).map((f) => ({
          id: f.id,
          field_name: f.field_name,
          operator: f.operator,
          value: f.value,
        }))
        onFiltersChange?.(flattenedFilters)
      } else {
        onFiltersChange?.([])
      }

      onClose()
    } catch (error) {
      console.error("Error saving filters:", error)
      alert("Failed to save filters")
    }
  }

  const totalFilters = filterGroups.reduce((sum, group) => sum + group.filters.length, 0) + ungroupedFilters.length

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Filter Records</DialogTitle>
          <DialogDescription>
            Add filter groups with AND/OR logic to narrow down the records displayed in this view.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {totalFilters === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No filters applied</p>
              <p className="text-xs mt-1">Add a filter group or filter to narrow down your records</p>
            </div>
          ) : (
            <>
              {/* Filter Groups */}
              {filterGroups.map((group, groupIndex) => {
                if (group.filters.length === 0) return null

                return (
                  <div key={group.id || group.tempId} className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-blue-900">Group {groupIndex + 1}</span>
                        <Select
                          value={group.condition_type}
                          onValueChange={(value: FilterConditionType) =>
                            updateFilterGroup(groupIndex, { condition_type: value })
                          }
                        >
                          <SelectTrigger className="h-7 w-20 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="AND">AND</SelectItem>
                            <SelectItem value="OR">OR</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-xs text-gray-600">
                          ({group.filters.length} condition{group.filters.length !== 1 ? "s" : ""})
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFilterGroup(groupIndex)}
                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {group.filters.map((filter, filterIndex) => {
                      const field = tableFields.find((f) => f.name === filter.field_name)
                      const operators = field ? getOperatorsForFieldType(field.type) : []

                      return (
                        <div key={filter.id || filter.tempId} className="pl-4 border-l-2 border-blue-300 space-y-2">
                          {filterIndex > 0 && (
                            <div className="text-xs font-medium text-blue-700 -mt-1 -mb-1">
                              {group.condition_type}
                            </div>
                          )}
                          <div className="p-3 bg-white rounded border border-gray-200">
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <Label className="text-xs text-gray-600">Field</Label>
                                <Select
                                  value={filter.field_name}
                                  onValueChange={(value) => {
                                    updateFilterInGroup(groupIndex, filterIndex, {
                                      field_name: value,
                                      operator: "equal",
                                      value: "",
                                    })
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {tableFields.map((field) => (
                                      <SelectItem key={field.id} value={field.name}>
                                        {field.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label className="text-xs text-gray-600">Operator</Label>
                                <Select
                                  value={filter.operator}
                                  onValueChange={(value) =>
                                    updateFilterInGroup(groupIndex, filterIndex, { operator: value as FilterType })
                                  }
                                >
                                  <SelectTrigger className="h-8 text-sm">
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

                              <div>
                                <Label className="text-xs text-gray-600">Value</Label>
                                {filter.operator !== "is_empty" && filter.operator !== "is_not_empty" ? (
                                  <>
                                    {(field?.type === "single_select" || field?.type === "multi_select") &&
                                    field?.options?.choices ? (
                                      <Select
                                        value={filter.value || ""}
                                        onValueChange={(value) =>
                                          updateFilterInGroup(groupIndex, filterIndex, { value })
                                        }
                                      >
                                        <SelectTrigger className="h-8 text-sm">
                                          <SelectValue placeholder="Select value">
                                            {filter.value && field ? (
                                              <div className="flex items-center gap-2">
                                                <span
                                                  className="inline-block w-3 h-3 rounded-full"
                                                  style={{
                                                    backgroundColor: normalizeHexColor(
                                                      resolveChoiceColor(
                                                        filter.value,
                                                        field.type,
                                                        field.options,
                                                        field.type === 'single_select'
                                                      )
                                                    ),
                                                  }}
                                                />
                                                {filter.value}
                                              </div>
                                            ) : (
                                              "Select value"
                                            )}
                                          </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                          {field.options.choices.map((choice: string) => {
                                            const hexColor = resolveChoiceColor(
                                              choice,
                                              field.type as 'single_select' | 'multi_select',
                                              field.options,
                                              field.type === 'single_select'
                                            )
                                            const bgColor = normalizeHexColor(hexColor)
                                            return (
                                              <SelectItem key={choice} value={choice}>
                                                <div className="flex items-center gap-2">
                                                  <span
                                                    className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: bgColor }}
                                                  />
                                                  <span>{choice}</span>
                                                </div>
                                              </SelectItem>
                                            )
                                          })}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <Input
                                        type={
                                          field?.type === "number"
                                            ? "number"
                                            : field?.type === "date"
                                            ? "date"
                                            : "text"
                                        }
                                        value={filter.value || ""}
                                        onChange={(e) =>
                                          updateFilterInGroup(groupIndex, filterIndex, {
                                            value: e.target.value,
                                          })
                                        }
                                        className="h-8 text-sm"
                                        placeholder="Enter value"
                                      />
                                    )}
                                  </>
                                ) : (
                                  <div className="h-8 flex items-center text-xs text-gray-500">
                                    No value needed
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex justify-end mt-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFilterFromGroup(groupIndex, filterIndex)}
                                className="h-6 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <X className="h-3 w-3 mr-1" />
                                Remove
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addFilterToGroup(groupIndex)}
                      className="w-full border-blue-300 text-blue-700 hover:bg-blue-100"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Condition to Group
                    </Button>
                  </div>
                )
              })}

              {/* Ungrouped Filters */}
              {ungroupedFilters.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">
                      Ungrouped Filters ({ungroupedFilters.length})
                    </span>
                  </div>
                  {ungroupedFilters.map((filter, index) => {
                    const field = tableFields.find((f) => f.name === filter.field_name)
                    const operators = field ? getOperatorsForFieldType(field.type) : []

                    return (
                      <div key={filter.id || filter.tempId} className="p-3 bg-white rounded border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-600">Filter {index + 1}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeUngroupedFilter(index)}
                            className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs text-gray-600">Field</Label>
                            <Select
                              value={filter.field_name}
                              onValueChange={(value) => {
                                updateUngroupedFilter(index, {
                                  field_name: value,
                                  operator: "equal",
                                  value: "",
                                })
                              }}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {tableFields.map((field) => (
                                  <SelectItem key={field.id} value={field.name}>
                                    {field.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-xs text-gray-600">Operator</Label>
                            <Select
                              value={filter.operator}
                              onValueChange={(value) => updateUngroupedFilter(index, { operator: value as FilterType })}
                            >
                              <SelectTrigger className="h-8 text-sm">
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

                          <div>
                            <Label className="text-xs text-gray-600">Value</Label>
                            {filter.operator !== "is_empty" && filter.operator !== "is_not_empty" ? (
                              <>
                                {(field?.type === "single_select" || field?.type === "multi_select") &&
                                field?.options?.choices ? (
                                  <Select
                                    value={filter.value || ""}
                                    onValueChange={(value) => updateUngroupedFilter(index, { value })}
                                  >
                                    <SelectTrigger className="h-8 text-sm">
                                      <SelectValue placeholder="Select value" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {field.options.choices.map((choice: string) => (
                                        <SelectItem key={choice} value={choice}>
                                          {choice}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Input
                                    type={
                                      field?.type === "number"
                                        ? "number"
                                        : field?.type === "date"
                                        ? "date"
                                        : "text"
                                    }
                                    value={filter.value || ""}
                                    onChange={(e) => updateUngroupedFilter(index, { value: e.target.value })}
                                    className="h-8 text-sm"
                                    placeholder="Enter value"
                                  />
                                )}
                              </>
                            ) : (
                              <div className="h-8 flex items-center text-xs text-gray-500">
                                No value needed
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={addFilterGroup}
              className="flex-1"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Filter Group
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={addUngroupedFilter}
              className="flex-1"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Filter
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Apply Filters
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
