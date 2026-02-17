"use client"

import { useState, useEffect } from "react"
import { useSelectionContext } from "@/contexts/SelectionContext"
import { useRightSettingsPanelData } from "@/contexts/RightSettingsPanelDataContext"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import { ChevronRight, ChevronLeft, X, MoreVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import PageDisplaySettingsPanel from "./PageDisplaySettingsPanel"
import SettingsPanel from "./SettingsPanel"
import RecordLayoutSettings from "./settings/RecordLayoutSettings"
import FieldBlockSettings from "./settings/FieldBlockSettings"
import FieldSchemaSettings from "./settings/FieldSchemaSettings"
import { getFieldDisplayName } from "@/lib/fields/display"
import type { SelectedContext } from "@/contexts/SelectionContext"

function Breadcrumb({ context, onNavigate }: { context: SelectedContext; onNavigate: (ctx: SelectedContext) => void }) {
  if (!context) return null

  const items: { label: string; ctx: SelectedContext }[] = []
  items.push({ label: "Page", ctx: { type: "page" } })

  if (context.type === "block" || context.type === "recordList" || context.type === "record" || context.type === "field") {
    if (context.type === "block") {
      items.push({ label: "Block", ctx: context })
    } else if (context.type === "recordList") {
      items.push({ label: "Record list", ctx: context })
    } else if (context.type === "record" || context.type === "field") {
      items.push({ label: "Record", ctx: { type: "record", recordId: context.type === "record" ? context.recordId : "", tableId: context.tableId } })
      if (context.type === "field") {
        items.push({ label: "Field", ctx: context })
      }
    }
  }

  return (
    <div className="flex items-center gap-1 text-sm text-gray-600 flex-wrap">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />}
          <button
            type="button"
            onClick={() => onNavigate(item.ctx)}
            className={`hover:text-gray-900 hover:underline ${i === items.length - 1 ? "font-medium text-gray-900" : ""}`}
          >
            {item.label}
          </button>
        </span>
      ))}
    </div>
  )
}

interface RightSettingsPanelProps {
  /** When "left", panel appears on left (record list settings); when "right", on right (field block settings) */
  position?: "left" | "right"
}

export default function RightSettingsPanel({ position = "right" }: RightSettingsPanelProps) {
  const { selectedContext, setSelectedContext } = useSelectionContext()
  const { data } = useRightSettingsPanelData()
  const { state: recordPanelState } = useRecordPanel()
  const [fieldViewMode, setFieldViewMode] = useState<"block" | "schema">("block")

  useEffect(() => {
    if (selectedContext?.type !== "field") setFieldViewMode("block")
  }, [selectedContext?.type, selectedContext?.type === "field" ? selectedContext.fieldId : undefined])

  // Airtable-style: show panel when on interface page (with page data) OR when user selected something OR RecordPanel is open
  const hasInterfacePageContext = data?.page != null && data?.blocks != null
  const isVisible =
    hasInterfacePageContext ||
    selectedContext ||
    (recordPanelState.isOpen && recordPanelState.recordId)

  const handleClose = () => setSelectedContext(null)

  // Stacks left or right based on position. Left = record list settings; right = field block settings.
  const borderClass = position === "left" ? "border-r border-gray-200" : "border-l border-gray-200"
  return (
    <div
      className={`flex-shrink-0 h-full flex flex-col bg-white ${borderClass} shadow-lg transition-all duration-200 overflow-hidden ${
        isVisible ? "w-[340px]" : "w-0 border-0 shadow-none pointer-events-none"
      }`}
      aria-hidden={!isVisible}
    >
      {/* Header: Back + title + ellipsis for record/field; breadcrumb + close otherwise */}
      <div className="border-b border-gray-200 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          {selectedContext?.type === "field" &&
          selectedContext.fieldId &&
          recordPanelState.isOpen ? (
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
                    : (() => {
                        const f = recordPanelState.tableFields?.find(
                          (x) => x.id === selectedContext.fieldId
                        )
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
                  onClick={() => setSelectedContext({ type: "page" })}
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
            <>
              <div className="min-w-0 flex-1">
                <Breadcrumb context={selectedContext} onNavigate={setSelectedContext} />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-8 w-8 p-0 flex-shrink-0"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {!selectedContext && !(recordPanelState.isOpen && recordPanelState.recordId) && (
          <div className="p-4 text-sm text-muted-foreground">
            {hasInterfacePageContext ? "Select an element to configure." : "No selection"}
          </div>
        )}

        {selectedContext?.type === "page" && (
          data?.page ? (
            <PageDisplaySettingsPanel
              page={data.page}
              isOpen={true}
              onClose={handleClose}
              onUpdate={data.onPageUpdate}
              embedded
            />
          ) : (
            <div className="p-4 text-sm text-muted-foreground">Loading page settings…</div>
          )
        )}

        {selectedContext?.type === "block" && (
          data?.selectedBlock ? (
            <SettingsPanel
              block={data.selectedBlock}
              isOpen={true}
              onClose={handleClose}
              onSave={data.onBlockSave}
              onMoveToTop={data.onBlockMoveToTop}
              onMoveToBottom={data.onBlockMoveToBottom}
              onLock={data.onBlockLock}
              pageTableId={data.pageTableId}
              allBlocks={data.blocks}
              embedded
            />
          ) : (
            <div className="p-4 text-sm text-muted-foreground">Loading block settings…</div>
          )
        )}

        {selectedContext?.type === "recordList" && (
          data?.selectedBlock ? (
            <SettingsPanel
              block={data.selectedBlock}
              isOpen={true}
              onClose={handleClose}
              onSave={data.onBlockSave}
              onMoveToTop={data.onBlockMoveToTop}
              onMoveToBottom={data.onBlockMoveToBottom}
              onLock={data.onBlockLock}
              pageTableId={data.pageTableId}
              allBlocks={data.blocks}
              embedded
            />
          ) : (
            <div className="p-4 text-sm text-muted-foreground">Loading block settings…</div>
          )
        )}

        {selectedContext?.type === "record" && (() => {
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
        })()}

        {selectedContext && selectedContext.type === "field" && selectedContext.fieldId && (
          fieldViewMode === "schema" ||
          !recordPanelState.isOpen ||
          !recordPanelState.onLayoutSave ? (
            <FieldSchemaSettings
              fieldId={selectedContext.fieldId}
              tableId={selectedContext.tableId ?? data?.recordTableId ?? data?.pageTableId ?? ""}
            />
          ) : (
            <FieldBlockSettings
              fieldId={selectedContext.fieldId}
              tableId={selectedContext.tableId ?? recordPanelState.tableId ?? ""}
              tableName={recordPanelState.tableName}
              fieldLayout={recordPanelState.fieldLayout ?? []}
              onLayoutSave={recordPanelState.onLayoutSave}
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
          )
        )}
      </div>
    </div>
  )
}
