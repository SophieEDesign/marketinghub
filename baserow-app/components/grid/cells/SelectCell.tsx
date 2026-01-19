"use client"

import InlineSelectDropdown from "@/components/fields/InlineSelectDropdown"
import {
  getTextColorForBackground,
  normalizeHexColor,
  resolveChoiceColor,
} from "@/lib/field-colors"
import type { FieldOptions } from "@/types/fields"
import { getManualChoiceLabels } from "@/lib/fields/select-options"

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
  onFieldOptionsUpdate,
}: SelectCellProps) {
  const containerStyle: React.CSSProperties = rowHeight ? { height: `${rowHeight}px` } : {}
  // If we don't have fieldId/tableId, fall back to basic select (for backwards compatibility)
  if (!fieldId || !tableId) {
    // Basic fallback - just show the value as a pill
    return (
      <div className="w-full h-full px-3 flex items-center gap-2 text-sm overflow-hidden" style={containerStyle}>
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
    <div className="w-full h-full px-3 flex items-center overflow-hidden" style={containerStyle}>
      <InlineSelectDropdown
        value={value}
        // Ensure the picker dropdown uses canonical manual order by default.
        // Alphabetise (if enabled) is a per-picker visual transform only.
        choices={getManualChoiceLabels("single_select", fieldOptions) || choices}
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
