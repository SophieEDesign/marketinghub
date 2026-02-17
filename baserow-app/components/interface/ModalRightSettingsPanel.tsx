"use client"

import { useState } from "react"
import { useSelectionContext } from "@/contexts/SelectionContext"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import RecordLayoutSettings from "./settings/RecordLayoutSettings"
import FieldBlockSettings from "./settings/FieldBlockSettings"
import { getFieldDisplayName } from "@/lib/fields/display"

/**
 * ModalRightSettingsPanel — record/field settings rendered INSIDE RecordPanel.
 * When RecordPanel is open in edit mode, this panel shows RecordLayoutSettings
 * or FieldBlockSettings. Must never close the modal; only changes selection.
 */
export default function ModalRightSettingsPanel() {
  const { selectedContext, setSelectedContext } = useSelectionContext()
  const { state: recordPanelState } = useRecordPanel()
  const [fieldViewMode, setFieldViewMode] = useState<"block" | "schema">("block")

  const showRecordLayout =
    (selectedContext?.type === "record" || selectedContext?.type === "page") &&
    recordPanelState.isOpen &&
    recordPanelState.recordId &&
    recordPanelState.tableId &&
    recordPanelState.onLayoutSave

  const showFieldSettings =
    selectedContext?.type === "field" &&
    selectedContext.fieldId &&
    recordPanelState.isOpen &&
    recordPanelState.onLayoutSave

  const selectedField = recordPanelState.tableFields?.find(
    (f) => f.id === (selectedContext?.type === "field" ? selectedContext.fieldId : null)
  )

  return (
    <div className="flex-shrink-0 w-[340px] border-l border-gray-200 flex flex-col bg-white min-h-0">
      {/* Header: Back + title */}
      <div className="border-b border-gray-200 px-4 py-3 flex-shrink-0 flex items-center gap-2">
        {selectedContext?.type === "field" && selectedContext.fieldId ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                fieldViewMode === "schema"
                  ? setFieldViewMode("block")
                  : setSelectedContext({
                      type: "record",
                      recordId: recordPanelState.recordId ?? "",
                      tableId: recordPanelState.tableId ?? "",
                    })
              }
              className="h-8 w-8 p-0 flex-shrink-0"
              aria-label="Back"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-gray-900 truncate">
              {fieldViewMode === "schema"
                ? "Field settings"
                : selectedField
                  ? `${getFieldDisplayName(selectedField)} Field`
                  : "Field"}
            </span>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedContext({ type: "page" })}
              className="h-8 w-8 p-0 flex-shrink-0"
              aria-label="Back"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-gray-900 truncate">
              Record layout
            </span>
          </>
        )}
      </div>

      {/* Content: single scroll container */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {showRecordLayout && (
          <RecordLayoutSettings
            tableId={recordPanelState.tableId ?? ""}
            recordId={recordPanelState.recordId ?? ""}
            fieldLayout={recordPanelState.fieldLayout ?? []}
            onLayoutSave={recordPanelState.onLayoutSave ?? null}
            fields={recordPanelState.tableFields ?? []}
          />
        )}
        {showFieldSettings && fieldViewMode === "block" && (
          <FieldBlockSettings
            fieldId={selectedContext.fieldId}
            tableId={selectedContext.tableId ?? recordPanelState.tableId ?? ""}
            tableName={recordPanelState.tableName}
            fieldLayout={recordPanelState.fieldLayout ?? []}
            onLayoutSave={recordPanelState.onLayoutSave ?? null}
            fields={recordPanelState.tableFields ?? []}
            onEditField={() => setFieldViewMode("schema")}
            onFieldChange={(newFieldId) =>
              setSelectedContext({
                type: "field",
                fieldId: newFieldId,
                tableId: selectedContext.tableId ?? recordPanelState.tableId ?? "",
              })
            }
          />
        )}
        {showFieldSettings && fieldViewMode === "schema" && (
          <div className="p-4 text-sm text-muted-foreground">
            Field schema editing is available in the main settings panel.
          </div>
        )}
      </div>
    </div>
  )
}
