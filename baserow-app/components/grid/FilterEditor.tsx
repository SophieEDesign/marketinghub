"use client"

import { useState, useMemo } from "react"
import { X } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { TableField } from "@/types/fields"

interface Filter {
  id?: string
  field_name: string
  operator: string
  value?: string
}

interface FilterEditorProps {
  filter: Filter | null
  fields: Array<{ field_name: string }>
  tableFields?: TableField[] // Optional: full field definitions for dropdown support
  onSave: (filter: Filter) => void
  onCancel: () => void
}

const OPERATORS = [
  { value: "equal", label: "=" },
  { value: "not_equal", label: "≠" },
  { value: "contains", label: "Contains" },
  { value: "not_contains", label: "Does not contain" },
  { value: "is_empty", label: "Is empty" },
  { value: "is_not_empty", label: "Is not empty" },
  { value: "greater_than", label: ">" },
  { value: "less_than", label: "<" },
  { value: "greater_than_or_equal", label: "≥" },
  { value: "less_than_or_equal", label: "≤" },
]

export default function FilterEditor({
  filter,
  fields,
  tableFields,
  onSave,
  onCancel,
}: FilterEditorProps) {
  const [fieldName, setFieldName] = useState(filter?.field_name || fields[0]?.field_name || "")
  const [operator, setOperator] = useState(filter?.operator || "equal")
  const [value, setValue] = useState(filter?.value || "")

  const needsValue = !["is_empty", "is_not_empty"].includes(operator)

  // Find the selected field's full definition
  const selectedField = useMemo(() => {
    return tableFields?.find(f => f.name === fieldName)
  }, [tableFields, fieldName])

  // Check if selected field is a select field with choices
  const isSelectField = selectedField && 
    (selectedField.type === "single_select" || selectedField.type === "multi_select") &&
    selectedField.options?.choices &&
    selectedField.options.choices.length > 0

  function handleSave() {
    if (!fieldName || !operator) return

    onSave({
      ...(filter?.id && { id: filter.id }),
      field_name: fieldName,
      operator,
      value: needsValue ? value : undefined,
    })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-[320px]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">
          {filter ? "Edit Filter" : "Add Filter"}
        </h3>
        <button
          onClick={onCancel}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Field
          </label>
          <select
            value={fieldName}
            onChange={(e) => setFieldName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {fields.map((field) => (
              <option key={field.field_name} value={field.field_name}>
                {field.field_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Operator
          </label>
          <select
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {OPERATORS.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
        </div>

        {needsValue && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Value
            </label>
            {isSelectField ? (
              <Select value={value} onValueChange={setValue}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="Select value..." />
                </SelectTrigger>
                <SelectContent>
                  {selectedField.options?.choices?.map((choice: string) => (
                    <SelectItem key={choice} value={choice}>
                      {choice}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <input
                type={selectedField?.type === "number" ? "number" : selectedField?.type === "date" ? "date" : "text"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter value..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSave()
                  } else if (e.key === "Escape") {
                    onCancel()
                  }
                }}
              />
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!fieldName || !operator || (needsValue && !value)}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
