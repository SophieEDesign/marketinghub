"use client"

import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { X, Plus } from "lucide-react"
import type { TableField } from "@/types/database"
import type { BlockSort } from "@/lib/interface/types"
import { getFieldDisplayName } from "@/lib/fields/display"

interface SortSelectorProps {
  value: BlockSort[] | string | undefined // Array for multiple, string for single (chart)
  onChange: (value: BlockSort[] | string | undefined) => void
  fields: TableField[]
  label?: string
  description?: string
  allowMultiple?: boolean
  mode?: "array" | "string" // "array" for sorts array, "string" for sort_field
}

export default function SortSelector({
  value,
  onChange,
  fields,
  label = "Sort (optional)",
  description,
  allowMultiple = false,
  mode = "array",
}: SortSelectorProps) {
  // Normalize value to array format for internal use
  const sortsArray: BlockSort[] = (() => {
    if (mode === "string") {
      // Chart mode: convert string to array format
      if (typeof value === "string" && value) {
        return [{ field: value, direction: "asc" }]
      }
      return []
    } else {
      // Array mode: use as-is
      return Array.isArray(value) ? value : []
    }
  })()

  const handleAddSort = () => {
    if (allowMultiple || sortsArray.length === 0) {
      const newSort: BlockSort = {
        field: fields[0]?.name || "",
        direction: "asc",
      }
      const newSorts = [...sortsArray, newSort]
      if (mode === "string") {
        onChange(newSorts[0]?.field || undefined)
      } else {
        onChange(newSorts)
      }
    }
  }

  const handleRemoveSort = (index: number) => {
    const newSorts = sortsArray.filter((_, i) => i !== index)
    if (mode === "string") {
      onChange(newSorts[0]?.field || undefined)
    } else {
      onChange(newSorts.length > 0 ? newSorts : undefined)
    }
  }

  const handleFieldChange = (index: number, fieldName: string) => {
    const newSorts = [...sortsArray]
    newSorts[index] = { ...newSorts[index], field: fieldName }
    if (mode === "string") {
      onChange(newSorts[0]?.field || undefined)
    } else {
      onChange(newSorts)
    }
  }

  const handleDirectionChange = (index: number, direction: "asc" | "desc") => {
    const newSorts = [...sortsArray]
    newSorts[index] = { ...newSorts[index], direction }
    if (mode === "string") {
      onChange(newSorts[0]?.field || undefined)
    } else {
      onChange(newSorts)
    }
  }

  // For string mode (Chart), show simple dropdown
  if (mode === "string") {
    const sortField = typeof value === "string" ? value : undefined
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <Select
          value={sortField || "__none__"}
          onValueChange={(newValue) => {
            onChange(newValue === "__none__" ? undefined : newValue)
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="No sorting" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No sorting</SelectItem>
            {fields.map((field) => (
              <SelectItem key={field.id} value={field.name}>
                {getFieldDisplayName(field)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
    )
  }

  // For array mode (Grid, List, Gallery), show full sort builder
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {allowMultiple && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddSort}
            disabled={!allowMultiple && sortsArray.length > 0}
            className="h-7 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Sort
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {sortsArray.map((sort, index) => (
          <div key={index} className="flex gap-2 items-center p-2 border rounded-md">
            <Select
              value={sort.field || ""}
              onValueChange={(fieldName) => handleFieldChange(index, fieldName)}
            >
              <SelectTrigger className="h-8 flex-1">
                <SelectValue placeholder="Field" />
              </SelectTrigger>
              <SelectContent>
                {fields.map((field) => (
                  <SelectItem key={field.id} value={field.name}>
                    {getFieldDisplayName(field)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={sort.direction || "asc"}
              onValueChange={(direction) =>
                handleDirectionChange(index, direction as "asc" | "desc")
              }
            >
              <SelectTrigger className="h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Ascending</SelectItem>
                <SelectItem value="desc">Descending</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleRemoveSort(index)}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {sortsArray.length === 0 && (
          <p className="text-xs text-gray-400 italic">No sort configured</p>
        )}
      </div>
      {description ? (
        <p className="text-xs text-gray-500">{description}</p>
      ) : (
        <p className="text-xs text-gray-500">
          Sort rows by a field in ascending or descending order.
        </p>
      )}
    </div>
  )
}
