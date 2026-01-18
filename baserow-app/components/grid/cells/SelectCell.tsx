"use client"

import InlineSelectDropdown from "@/components/fields/InlineSelectDropdown"
import {
  getTextColorForBackground,
  normalizeHexColor,
  resolveChoiceColor,
} from "@/lib/field-colors"
import type { FieldOptions } from "@/types/fields"

interface SelectCellProps {
  value: string | null
  fieldName: string
  editable?: boolean
  rowHeight?: number
  onSave: (value: string | null) => Promise<void>
  placeholder?: string
  choices?: string[]
  choiceColors?: Record<string, string>
  fieldOptions?: FieldOptions
  fieldId?: string // Field ID for updating options
  tableId?: string // Table ID for updating options
  canEditOptions?: boolean
  onFieldOptionsUpdate?: () => void // Callback when field options are updated
}

export default function SelectCell({
  value,
  fieldName,
  editable = true,
  rowHeight,
  onSave,
  placeholder = '—',
  choices = [],
  choiceColors,
  fieldOptions,
  fieldId,
  tableId,
  canEditOptions = true,
  onFieldOptionsUpdate,
}: SelectCellProps) {
  // If we don't have fieldId/tableId, fall back to basic select (for backwards compatibility)
  const rowHeightStyle = rowHeight
    ? {
        height: `${rowHeight}px`,
        minHeight: `${rowHeight}px`,
        maxHeight: `${rowHeight}px`,
      }
    : { minHeight: '36px' }

  if (!fieldId || !tableId) {
    // Basic fallback - just show the value as a pill
    return (
      <div className="w-full h-full px-3 py-2 flex items-center gap-2 text-sm box-border" style={rowHeightStyle}>
        {value ? (
          (() => {
            const hexColor = fieldOptions
              ? resolveChoiceColor(value, "single_select", fieldOptions, true)
              : "#BFDBFE"
            const textColorClass = getTextColorForBackground(hexColor)
            const bgColor = normalizeHexColor(hexColor)
            return (
              <span
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap ${textColorClass}`}
                style={{ backgroundColor: bgColor }}
              >
                {value}
              </span>
            )
          })()
        ) : (
          <span className="text-gray-400 italic text-sm">{placeholder}</span>
        )}
      </div>
    )
  }

  return (
    <div className="w-full h-full px-3 py-2 flex items-center box-border" style={rowHeightStyle}>
      <InlineSelectDropdown
        value={value}
        choices={choices}
        choiceColors={choiceColors}
        fieldOptions={fieldOptions}
        fieldType="single_select"
        fieldId={fieldId}
        tableId={tableId}
        editable={editable}
        canEditOptions={editable && canEditOptions} // Gate schema edits separately
        onValueChange={async (newValue) => {
          await onSave(newValue as string | null)
        }}
        onFieldOptionsUpdate={onFieldOptionsUpdate}
        placeholder={placeholder}
      />
    </div>
  )
}
