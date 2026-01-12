"use client"

import InlineSelectDropdown from "@/components/fields/InlineSelectDropdown"
import type { FieldOptions } from "@/types/fields"

interface SelectCellProps {
  value: string | null
  fieldName: string
  editable?: boolean
  onSave: (value: string | null) => Promise<void>
  placeholder?: string
  choices?: string[]
  choiceColors?: Record<string, string>
  fieldOptions?: FieldOptions
  fieldId?: string // Field ID for updating options
  tableId?: string // Table ID for updating options
  onFieldOptionsUpdate?: () => void // Callback when field options are updated
}

export default function SelectCell({
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
}: SelectCellProps) {
  // If we don't have fieldId/tableId, fall back to basic select (for backwards compatibility)
  if (!fieldId || !tableId) {
    // Basic fallback - just show the value as a pill
    return (
      <div className="w-full min-h-[36px] px-3 py-2 flex items-center gap-2 text-sm">
        {value ? (
          <span className="px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap bg-blue-100 text-blue-800">
            {value}
          </span>
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
        fieldType="single_select"
        fieldId={fieldId}
        tableId={tableId}
        editable={editable}
        canEditOptions={editable} // If they can edit the cell, they can edit options
        onValueChange={async (newValue) => {
          await onSave(newValue as string | null)
        }}
        onFieldOptionsUpdate={onFieldOptionsUpdate}
        placeholder={placeholder}
      />
    </div>
  )
}
