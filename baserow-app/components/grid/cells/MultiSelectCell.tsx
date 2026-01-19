"use client"

import InlineSelectDropdown from "@/components/fields/InlineSelectDropdown"
import {
  getTextColorForBackground,
  normalizeHexColor,
  resolveChoiceColor,
} from "@/lib/field-colors"
import type { FieldOptions } from "@/types/fields"
import { sortLabelsByManualOrder } from "@/lib/fields/select-options"

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
  onFieldOptionsUpdate,
}: MultiSelectCellProps) {
  const containerStyle: React.CSSProperties = rowHeight ? { height: `${rowHeight}px` } : {}
  // If we don't have fieldId/tableId, fall back to basic display (for backwards compatibility)
  if (!fieldId || !tableId) {
    // Basic fallback - just show the values as pills
    const displayValues = sortLabelsByManualOrder(value || [], "multi_select", fieldOptions)
    return (
      <div className="w-full h-full px-3 flex items-center flex-wrap gap-1.5 text-sm overflow-hidden" style={containerStyle}>
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
    <div className="w-full h-full px-3 flex items-center overflow-hidden" style={containerStyle}>
      <InlineSelectDropdown
        value={value}
        // Ensure the picker dropdown uses canonical manual order by default.
        // Alphabetise (if enabled) is a per-picker visual transform only.
        choices={sortLabelsByManualOrder(choices, "multi_select", fieldOptions)}
        choiceColors={choiceColors}
        fieldOptions={fieldOptions}
        fieldType="multi_select"
        fieldId={fieldId}
        tableId={tableId}
        editable={editable}
        canEditOptions={editable} // If they can edit the cell, they can edit options
        onValueChange={async (newValue) => {
          try {
            await onSave((newValue as string[]) || [])
          } catch (e: any) {
            console.error("[MultiSelectCell] Error saving value:", e)
            alert(e?.message || "Failed to save. Please check your permissions and try again.")
          }
        }}
        onFieldOptionsUpdate={onFieldOptionsUpdate}
        placeholder={placeholder}
      />
    </div>
  )
}
