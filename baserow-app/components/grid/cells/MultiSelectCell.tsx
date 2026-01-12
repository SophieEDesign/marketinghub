"use client"

import InlineSelectDropdown from "@/components/fields/InlineSelectDropdown"
import type { FieldOptions } from "@/types/fields"

interface MultiSelectCellProps {
  value: string[] | null
  fieldName: string
  editable?: boolean
  onSave: (value: string[]) => Promise<void>
  placeholder?: string
  choices?: string[]
  choiceColors?: Record<string, string>
  fieldOptions?: FieldOptions
  fieldId?: string // Field ID for updating options
  tableId?: string // Table ID for updating options
  onFieldOptionsUpdate?: () => void // Callback when field options are updated
}

export default function MultiSelectCell({
  value,
  fieldName,
  editable = true,
  onSave,
  placeholder = '—',
  choices = [],
  choiceColors,
  fieldOptions,
  fieldId,
  tableId,
  onFieldOptionsUpdate,
}: MultiSelectCellProps) {
  // If we don't have fieldId/tableId, fall back to basic display (for backwards compatibility)
  if (!fieldId || !tableId) {
    // Basic fallback - just show the values as pills
    const displayValues = value || []
    return (
      <div className="w-full min-h-[36px] px-3 py-2 flex items-center flex-wrap gap-1.5 text-sm">
        {displayValues.length > 0 ? (
          displayValues.map((val) => (
            <span
              key={val}
              className="px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap bg-blue-100 text-blue-800"
            >
              {val}
            </span>
          ))
        ) : (
          <span className="text-gray-400 italic text-sm">{placeholder}</span>
        )}
      </div>
    )
  }

  return (
    <div className="w-full min-h-[36px] px-3 py-2 flex items-center">
      <InlineSelectDropdown
        value={value}
        choices={choices}
        choiceColors={choiceColors}
        fieldOptions={fieldOptions}
        fieldType="multi_select"
        fieldId={fieldId}
        tableId={tableId}
        editable={editable}
        canEditOptions={editable} // If they can edit the cell, they can edit options
        onValueChange={async (newValue) => {
          await onSave((newValue as string[]) || [])
        }}
        onFieldOptionsUpdate={onFieldOptionsUpdate}
        placeholder={placeholder}
      />
    </div>
  )
}
