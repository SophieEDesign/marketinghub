"use client"

import { useState } from "react"
import { Plus, X, Trash2, Filter } from "lucide-react"
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
import type { BlockFilter } from "@/lib/interface/types"
import type { TableField } from "@/types/database"
import {
  resolveChoiceColor,
  normalizeHexColor,
} from "@/lib/field-colors"

interface BlockFilterEditorProps {
  filters: BlockFilter[]
  tableFields: TableField[]
  onChange: (filters: BlockFilter[]) => void
}

function getOperatorsForFieldType(fieldType: string) {
  switch (fieldType) {
    case "text":
    case "long_text":
      return [
        { value: "contains", label: "Contains" },
        { value: "equal", label: "Equals" },
        { value: "not_equal", label: "Does not equal" },
        { value: "is_empty", label: "Is empty" },
        { value: "is_not_empty", label: "Is not empty" },
      ]
    case "number":
    case "currency":
    case "percent":
    case "rating":
      return [
        { value: "equal", label: "Equals" },
        { value: "not_equal", label: "Does not equal" },
        { value: "greater_than", label: "Greater than" },
        { value: "less_than", label: "Less than" },
        { value: "is_empty", label: "Is empty" },
        { value: "is_not_empty", label: "Is not empty" },
      ]
    case "date":
    case "datetime":
      return [
        { value: "equal", label: "Equals" },
        { value: "not_equal", label: "Does not equal" },
        { value: "greater_than", label: "After" },
        { value: "less_than", label: "Before" },
        { value: "is_empty", label: "Is empty" },
        { value: "is_not_empty", label: "Is not empty" },
      ]
    case "single_select":
    case "multi_select":
      return [
        { value: "equal", label: "Equals" },
        { value: "not_equal", label: "Does not equal" },
        { value: "is_empty", label: "Is empty" },
        { value: "is_not_empty", label: "Is not empty" },
      ]
    case "boolean":
      return [
        { value: "equal", label: "Equals" },
        { value: "not_equal", label: "Does not equal" },
      ]
    default:
      return [
        { value: "equal", label: "Equals" },
        { value: "not_equal", label: "Does not equal" },
        { value: "contains", label: "Contains" },
        { value: "is_empty", label: "Is empty" },
        { value: "is_not_empty", label: "Is not empty" },
      ]
  }
}

export default function BlockFilterEditor({
  filters = [],
  tableFields,
  onChange,
}: BlockFilterEditorProps) {
  const [localFilters, setLocalFilters] = useState<BlockFilter[]>(filters)

  function addFilter() {
    const newFilter: BlockFilter = {
      field: tableFields[0]?.name || "",
      operator: "equal",
      value: "",
    }
    const updated = [...localFilters, newFilter]
    setLocalFilters(updated)
    onChange(updated)
  }

  function removeFilter(index: number) {
    const updated = localFilters.filter((_, i) => i !== index)
    setLocalFilters(updated)
    onChange(updated)
  }

  function updateFilter(index: number, updates: Partial<BlockFilter>) {
    const updated = localFilters.map((filter, i) =>
      i === index ? { ...filter, ...updates } : filter
    )
    setLocalFilters(updated)
    onChange(updated)
  }

  const filterCount = localFilters.length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <Label className="text-sm font-medium">Filters (optional)</Label>
          {filterCount > 0 && (
            <span className="text-xs text-gray-500">
              {filterCount} filter{filterCount !== 1 ? "s" : ""} applied
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addFilter}
          className="h-8"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Filter
        </Button>
      </div>

      {localFilters.length > 0 && (
        <div className="space-y-2 border rounded-lg p-3 bg-gray-50">
          {localFilters.map((filter, index) => {
            const field = tableFields.find((f) => f.name === filter.field)
            const operators = field
              ? getOperatorsForFieldType(field.type)
              : []

            const needsValue =
              filter.operator !== "is_empty" &&
              filter.operator !== "is_not_empty"

            const isSelectField =
              field &&
              (field.type === "single_select" ||
                field.type === "multi_select") &&
              field.options?.choices &&
              field.options.choices.length > 0

            return (
              <div
                key={index}
                className="p-3 bg-white rounded border border-gray-200"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-600">
                    Filter {index + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFilter(index)}
                    className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs text-gray-600">Field</Label>
                    <Select
                      value={filter.field || ""}
                      onValueChange={(value) => {
                        updateFilter(index, {
                          field: value,
                          operator: "equal",
                          value: "",
                        })
                      }}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent>
                        {tableFields.map((f) => (
                          <SelectItem key={f.id} value={f.name}>
                            {f.name}
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
                        updateFilter(index, {
                          operator: value as BlockFilter["operator"],
                          value: needsValue ? filter.value : undefined,
                        })
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
                    {needsValue ? (
                      <>
                        {isSelectField ? (
                          <Select
                            value={String(filter.value || "")}
                            onValueChange={(value) =>
                              updateFilter(index, { value })
                            }
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Select value" />
                            </SelectTrigger>
                            <SelectContent>
                              {field.options.choices.map((choice: string) => {
                                const hexColor = resolveChoiceColor(
                                  choice,
                                  field.type as
                                    | "single_select"
                                    | "multi_select",
                                  field.options,
                                  field.type === "single_select"
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
                                : field?.type === "date" ||
                                  field?.type === "datetime"
                                ? "date"
                                : "text"
                            }
                            value={String(filter.value || "")}
                            onChange={(e) =>
                              updateFilter(index, { value: e.target.value })
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
              </div>
            )
          })}
        </div>
      )}

      {localFilters.length === 0 && (
        <p className="text-xs text-gray-500">
          No filters applied. Add filters to narrow the data used for this KPI.
        </p>
      )}
    </div>
  )
}
