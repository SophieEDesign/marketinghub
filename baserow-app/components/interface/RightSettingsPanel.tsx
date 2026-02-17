"use client"

/**
 * RIGHT PANEL - Field Layout Editor (drag & drop)
 * Edits field_layout only. NOT block config.
 *
 * Shows: all fields, drag & drop ordering, sections, columns, hide/show.
 * Must NOT: dataset, sort, filter, group, permissions.
 */

import { useState, useEffect } from "react"
import { useSelectionContext } from "@/contexts/SelectionContext"
import { useRightSettingsPanelData } from "@/contexts/RightSettingsPanelDataContext"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import { ChevronLeft, MoreVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import RecordLayoutSettings from "./settings/RecordLayoutSettings"
import FieldBlockSettings from "./settings/FieldBlockSettings"
import FieldSchemaSettings from "./settings/FieldSchemaSettings"
import { getFieldDisplayName } from "@/lib/fields/display"

export default function RightSettingsPanel() {
  const { selectedContext, setSelectedContext } = useSelectionContext()
  const { data } = useRightSettingsPanelData()
  const { state: recordPanelState } = useRecordPanel()
  const [fieldViewMode, setFieldViewMode] = useState<"block" | "schema">("block")

  useEffect(() => {
    if (selectedContext?.type !== "field") setFieldViewMode("block")
  }, [selectedContext?.type, selectedContext?.type === "field" ? selectedContext.fieldId : undefined])

  const hasRecordOrFieldContext =
    selectedContext?.type === "record" ||
    (selectedContext?.type === "field" && selectedContext.fieldId)
  const handleBackToPage = () => setSelectedContext({ type: "page" })

  return (
    <div className="w-full h-full flex flex-col bg-white border-l border-gray-200 overflow-hidden">
      {/* Header: Back + title for record/field */}
      <div className="border-b border-gray-200 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          {selectedContext?.type === "field" &&
          selectedContext.fieldId &&
          (recordPanelState.isOpen || (data?.recordId && data?.recordTableId && data?.onLayoutSave)) ? (
            <>
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    fieldViewMode === "schema"
                      ? setFieldViewMode("block")
                      : setSelectedContext({
                          type: "record",
                          recordId: recordPanelState.recordId ?? data?.recordId ?? "",
                          tableId: recordPanelState.tableId ?? data?.recordTableId ?? "",
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
                    : (() => {
                        const fields = recordPanelState.tableFields ?? data?.tableFields ?? []
                        const f = fields.find((x) => x.id === selectedContext.fieldId)
                        return f ? `${getFieldDisplayName(f)} Field` : "Field"
                      })()}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 flex-shrink-0"
                aria-label="More options"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </>
          ) : selectedContext?.type === "record" &&
            (recordPanelState.isOpen && recordPanelState.recordId || data?.recordId) ? (
            <>
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToPage}
                  className="h-8 w-8 p-0 flex-shrink-0"
                  aria-label="Back"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-semibold text-gray-900 truncate">
                  Record layout
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 flex-shrink-0"
                aria-label="More options"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <div className="p-4 text-sm text-muted-foreground">
              Select a record or field to edit layout.
            </div>
          )}
        </div>
      </div>

      {/* Content: Record layout + Field block settings only */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {!hasRecordOrFieldContext ? (
          <div className="p-4 text-sm text-muted-foreground">
            Select a record to edit field layout.
          </div>
        ) : selectedContext?.type === "record" ? (() => {
          const fromRecordPanel = recordPanelState.isOpen && recordPanelState.recordId && recordPanelState.tableId && recordPanelState.onLayoutSave
          const fromPageData = data?.recordId && data?.recordTableId
          if (fromRecordPanel) {
            return (
              <RecordLayoutSettings
                tableId={recordPanelState.tableId ?? ""}
                recordId={recordPanelState.recordId ?? ""}
                fieldLayout={recordPanelState.fieldLayout ?? []}
                onLayoutSave={recordPanelState.onLayoutSave ?? null}
                fields={recordPanelState.tableFields ?? []}
              />
            )
          }
          if (fromPageData) {
            return (
              <RecordLayoutSettings
                tableId={data.recordTableId ?? ""}
                recordId={data.recordId ?? ""}
                fieldLayout={data.fieldLayout ?? []}
                onLayoutSave={data.onLayoutSave ?? null}
                fields={data.tableFields ?? []}
              />
            )
          }
          return (
            <div className="p-4 text-sm text-muted-foreground">
              Record layout settings require a record with layout configuration.
            </div>
          )
        })() : selectedContext?.type === "field" && selectedContext.fieldId ? (() => {
          const fromRecordPanel = recordPanelState.isOpen && recordPanelState.onLayoutSave
          const fromPageData = data?.recordId && data?.recordTableId && data?.onLayoutSave && data?.fieldLayout
          const canShowFieldBlockSettings = fromRecordPanel || fromPageData
          if (fieldViewMode === "schema" || !canShowFieldBlockSettings) {
            return (
              <FieldSchemaSettings
                fieldId={selectedContext.fieldId}
                tableId={selectedContext.tableId ?? data?.recordTableId ?? data?.pageTableId ?? ""}
              />
            )
          }
          const tableIdForField = selectedContext.tableId ?? recordPanelState.tableId ?? data?.recordTableId ?? ""
          return (
            <FieldBlockSettings
              fieldId={selectedContext.fieldId}
              tableId={tableIdForField}
              tableName={recordPanelState.tableName}
              fieldLayout={recordPanelState.fieldLayout ?? data?.fieldLayout ?? []}
              onLayoutSave={recordPanelState.onLayoutSave ?? data?.onLayoutSave ?? null}
              fields={recordPanelState.tableFields ?? data?.tableFields ?? []}
              onEditField={() => setFieldViewMode("schema")}
              onFieldChange={(newFieldId) =>
                setSelectedContext({
                  type: "field",
                  fieldId: newFieldId,
                  tableId: selectedContext.tableId ?? recordPanelState.tableId ?? data?.recordTableId ?? "",
                })
              }
            />
          )
        })() : null}
      </div>
    </div>
  )
}
