"use client"

import { useState } from "react"
import { X, ChevronDown } from "lucide-react"

interface GroupPickerProps {
  fields: Array<{ field_name: string }>
  currentGroupBy?: string
  onSelect: (fieldName: string | null) => void
  onCancel: () => void
}

export default function GroupPicker({
  fields,
  currentGroupBy,
  onSelect,
  onCancel,
}: GroupPickerProps) {
  const [selectedField, setSelectedField] = useState<string>(currentGroupBy || "")

  function handleSave() {
    onSelect(selectedField || null)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-[240px]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Group By</h3>
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
            value={selectedField}
            onChange={(e) => setSelectedField(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">None</option>
            {fields.map((field) => (
              <option key={field.field_name} value={field.field_name}>
                {field.field_name}
              </option>
            ))}
          </select>
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
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
