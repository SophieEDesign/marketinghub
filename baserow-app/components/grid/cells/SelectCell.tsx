"use client"

import InlineSelectDropdown from "@/components/fields/InlineSelectDropdown"
import type { FieldOptions } from "@/types/fields"
import { getManualChoiceLabels } from "@/lib/fields/select-options"
import { ChoicePill } from "@/components/fields/ChoicePill"
import { ChevronDown } from "lucide-react"

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
  isSelected?: boolean // Whether the cell is currently selected
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
  isSelected = false,
}: SelectCellProps) {
  const containerStyle: React.CSSProperties = rowHeight ? { height: `${rowHeight}px` } : {}
  // If we don't have fieldId/tableId, fall back to basic select (for backwards compatibility)
  if (!fieldId || !tableId) {
    // Basic fallback - just show the value as a pill
    return (
      <div className="w-full px-3 py-1.5 flex items-center gap-2 text-sm" style={containerStyle}>
        {value ? (
          <ChoicePill
            label={value}
            fieldType="single_select"
            fieldOptions={fieldOptions}
            useSemanticColors={true}
          />
        ) : (
          <span className="text-gray-400 italic text-sm">{placeholder}</span>
        )}
      </div>
    )
  }

  return (
    <div className="w-full px-3 py-1.5 flex items-center gap-1.5" style={containerStyle}>
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
        canEditOptions={false} // Disable option editing in cells - only in header/settings
        onValueChange={async (newValue) => {
          try {
            await onSave(newValue as string | null)
          } catch (e: any) {
            console.error("[SelectCell] Error saving value:", e)
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
        allowOptionEditing={false} // Disable option editing UI in cells
      />
      {isSelected && editable && (
        <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
      )}
    </div>
  )
}
