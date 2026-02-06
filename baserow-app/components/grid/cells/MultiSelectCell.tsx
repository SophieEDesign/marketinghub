"use client"

import InlineSelectDropdown from "@/components/fields/InlineSelectDropdown"
import type { FieldOptions } from "@/types/fields"
import { sortLabelsByManualOrder } from "@/lib/fields/select-options"
import { ChoicePillList } from "@/components/fields/ChoicePill"
import { ChevronDown } from "lucide-react"

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
  isSelected?: boolean // Whether the cell is currently selected
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
  isSelected = false,
}: MultiSelectCellProps) {
  const containerStyle: React.CSSProperties = rowHeight ? { height: `${rowHeight}px` } : {}
  // If we don't have fieldId/tableId, fall back to basic display (for backwards compatibility)
  // Field invariant: no internal scroll; content grows, container (column/list/modal) scrolls.
  if (!fieldId || !tableId) {
    const displayValues = sortLabelsByManualOrder(value || [], "multi_select", fieldOptions)
    return (
      <div className="w-full px-3 py-1.5 flex items-start flex-wrap gap-1.5 text-sm overflow-visible" style={containerStyle}>
        {displayValues.length > 0 ? (
          <ChoicePillList
            labels={displayValues}
            fieldType="multi_select"
            fieldOptions={fieldOptions}
            className="gap-1.5"
          />
        ) : (
          <span className="text-gray-400 italic text-sm">{placeholder}</span>
        )}
      </div>
    )
  }

  return (
    <div className="w-full px-3 py-1.5 flex items-start gap-1.5" style={containerStyle}>
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
        canEditOptions={true} // Allow option editing in cells
        onValueChange={async (newValue) => {
          try {
            await onSave((newValue as string[]) || [])
          } catch (e: any) {
            console.error("[MultiSelectCell] Error saving value:", e)
            // Don't show alert for deleted field errors - they're handled by updateCell
            const errorMsg = e?.message || ""
            if (errorMsg.includes("deleted") || errorMsg.includes("does not exist")) {
              // Field was deleted - error is already logged, just return
              return
            }
            alert(errorMsg || "Failed to save. Please check your permissions and try again.")
          }
        }}
        onFieldOptionsUpdate={onFieldOptionsUpdate}
        placeholder={placeholder}
        isCellSelected={isSelected}
        allowOptionEditing={true} // Allow option editing UI in cells
      />
      {isSelected && editable && (
        <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
      )}
    </div>
  )
}
