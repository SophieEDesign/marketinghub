"use client"

import InlineSelectDropdown from "@/components/fields/InlineSelectDropdown"
import {
  getTextColorForBackground,
  normalizeHexColor,
  resolveChoiceColor,
} from "@/lib/field-colors"
import type { FieldOptions } from "@/types/fields"

interface MultiSelectCellProps {
  value: string[] | null
  fieldName: string
  editable?: boolean
  rowHeight?: number
  onSave: (value: string[]) => Promise<void>
  placeholder?: string
  choices?: string[]
  choiceColors?: Record<string, string>
  fieldOptions?: FieldOptions
  fieldId?: string // Field ID for updating options
  tableId?: string // Table ID for updating options
  canEditOptions?: boolean
  onFieldOptionsUpdate?: () => void // Callback when field options are updated
}

export default function MultiSelectCell({
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
}: MultiSelectCellProps) {
  // If we don't have fieldId/tableId, fall back to basic display (for backwards compatibility)
  const rowHeightStyle = rowHeight
    ? {
        height: `${rowHeight}px`,
        minHeight: `${rowHeight}px`,
        maxHeight: `${rowHeight}px`,
      }
    : { minHeight: '36px' }

  if (!fieldId || !tableId) {
    // Basic fallback - just show the values as pills
    const displayValues = value || []
    return (
      <div className="w-full h-full px-3 py-2 flex items-center flex-wrap gap-1.5 text-sm box-border" style={rowHeightStyle}>
        {displayValues.length > 0 ? (
          displayValues.map((val) => {
            const hexColor = fieldOptions
              ? resolveChoiceColor(val, "multi_select", fieldOptions, false)
              : "#DBEAFE"
            const textColorClass = getTextColorForBackground(hexColor)
            const bgColor = normalizeHexColor(hexColor)
            return (
              <span
                key={val}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap ${textColorClass}`}
                style={{ backgroundColor: bgColor }}
              >
                {val}
              </span>
            )
          })
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
        fieldType="multi_select"
        fieldId={fieldId}
        tableId={tableId}
        editable={editable}
        canEditOptions={editable && canEditOptions} // Gate schema edits separately
        onValueChange={async (newValue) => {
          await onSave((newValue as string[]) || [])
        }}
        onFieldOptionsUpdate={onFieldOptionsUpdate}
        placeholder={placeholder}
      />
    </div>
  )
}
