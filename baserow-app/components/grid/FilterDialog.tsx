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

interface FilterDialogProps {
  isOpen: boolean
  onClose: () => void
  viewId: string
  tableFields: TableField[]
  filters: Array<{
    id: string
    field_name: string
    operator: string
    value?: string
  }>
  onFiltersChange?: (filters: Array<{ id?: string; field_name: string; operator: string; value?: string }>) => void
}

export default function FilterDialog({
  isOpen,
  onClose,
  viewId,
  tableFields,
  filters,
  onFiltersChange,
}: FilterDialogProps) {
  const [localFilters, setLocalFilters] = useState(filters)

  useEffect(() => {
    setLocalFilters(filters)
  }, [filters, isOpen])

  function getOperatorsForFieldType(fieldType: string) {
    const fieldTypeInfo = FIELD_TYPES.find(t => t.type === fieldType)
    
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

  function addFilter() {
    setLocalFilters([
      ...localFilters,
      {
        id: `temp-${Date.now()}`,
        field_name: tableFields[0]?.name || "",
        operator: "equal",
        value: "",
      },
    ])
  }

  function removeFilter(index: number) {
    setLocalFilters(localFilters.filter((_, i) => i !== index))
  }

  function updateFilter(index: number, updates: Partial<typeof localFilters[0]>) {
    const newFilters = [...localFilters]
    newFilters[index] = { ...newFilters[index], ...updates }
    setLocalFilters(newFilters)
  }

  async function handleSave() {
    try {
      // Delete existing filters
      await supabase.from("view_filters").delete().eq("view_id", viewId)

      // Insert new filters
      if (localFilters.length > 0) {
        const filtersToInsert = localFilters
          .filter(f => f.field_name && f.operator)
          .map(f => ({
            view_id: viewId,
            field_name: f.field_name,
            operator: f.operator,
            value: f.value || null,
          }))

        if (filtersToInsert.length > 0) {
          await supabase.from("view_filters").insert(filtersToInsert)
        }
      }

      onFiltersChange?.(localFilters)
      onClose()
    } catch (error) {
      console.error("Error saving filters:", error)
      alert("Failed to save filters")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Filter Records</DialogTitle>
          <DialogDescription>
            Add filters to narrow down the records displayed in this view.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {localFilters.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No filters applied</p>
              <p className="text-xs mt-1">Add a filter to narrow down your records</p>
            </div>
          ) : (
            localFilters.map((filter, index) => {
              const field = tableFields.find((f) => f.name === filter.field_name)
              const operators = field ? getOperatorsForFieldType(field.type) : []

              return (
                <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Filter {index + 1}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFilter(index)}
                      className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs text-gray-600">Field</Label>
                      <Select
                        value={filter.field_name}
                        onValueChange={(value) => {
                          updateFilter(index, { field_name: value, operator: "equal", value: "" })
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
                        onValueChange={(value) => updateFilter(index, { operator: value })}
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
                      {filter.operator !== "is_empty" && filter.operator !== "is_not_empty" && (
                        <>
                          {/* Show dropdown for single_select and multi_select fields */}
                          {(field?.type === "single_select" || field?.type === "multi_select") && field?.options?.choices ? (
                            <Select
                              value={filter.value || ""}
                              onValueChange={(value) => updateFilter(index, { value })}
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
                              type={field?.type === "number" ? "number" : field?.type === "date" ? "date" : "text"}
                              value={filter.value || ""}
                              onChange={(e) => updateFilter(index, { value: e.target.value })}
                              className="h-8 text-sm"
                              placeholder="Enter value"
                            />
                          )}
                        </>
                      )}
                      {(filter.operator === "is_empty" || filter.operator === "is_not_empty") && (
                        <div className="h-8 flex items-center text-xs text-gray-500">
                          No value needed
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={addFilter}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Filter
          </Button>
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
