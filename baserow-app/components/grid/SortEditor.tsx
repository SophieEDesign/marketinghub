"use client"

import { useState } from "react"
import { X, ArrowUp, ArrowDown } from "lucide-react"

interface Sort {
  id?: string
  field_name: string
  direction: string
}

interface SortEditorProps {
  sort: Sort | null
  fields: Array<{ field_name: string }>
  onSave: (sort: Sort) => void
  onCancel: () => void
}

export default function SortEditor({
  sort,
  fields,
  onSave,
  onCancel,
}: SortEditorProps) {
  const [fieldName, setFieldName] = useState(sort?.field_name || fields[0]?.field_name || "")
  const [direction, setDirection] = useState(sort?.direction || "asc")

  function handleSave() {
    if (!fieldName) return

    onSave({
      ...(sort?.id && { id: sort.id }),
      field_name: fieldName,
      direction,
    })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-[280px]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">
          {sort ? "Edit Sort" : "Add Sort"}
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
            Direction
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setDirection("asc")}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${
                direction === "asc"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <ArrowUp className="h-4 w-4" />
              Ascending
            </button>
            <button
              onClick={() => setDirection("desc")}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${
                direction === "desc"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <ArrowDown className="h-4 w-4" />
              Descending
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!fieldName}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
