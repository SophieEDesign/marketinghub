"use client"

import { useSelectionContext } from "@/contexts/SelectionContext"
import { useRightSettingsPanelData } from "@/contexts/RightSettingsPanelDataContext"
import { useRecordModal } from "@/contexts/RecordModalContext"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import { ChevronRight, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import PageDisplaySettingsPanel from "./PageDisplaySettingsPanel"
import SettingsPanel from "./SettingsPanel"
import RecordLayoutSettings from "./settings/RecordLayoutSettings"
import FieldSchemaSettings from "./settings/FieldSchemaSettings"
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
        <span key={`${item.label}-${item.ctx.type}-${i}`} className="flex items-center gap-1">
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

export default function RightSettingsPanel() {
  const { selectedContext, setSelectedContext } = useSelectionContext()
  const { data } = useRightSettingsPanelData()
  const { isRecordModalOpen } = useRecordModal()
  const { state: recordPanelState } = useRecordPanel()

  // Step 4: Do NOT show PageDisplaySettingsPanel (or any page/record settings sidebar) when RecordModal or RecordPanel is open
  if (isRecordModalOpen || recordPanelState.isOpen) return null
  if (!selectedContext) return null

  const handleClose = () => setSelectedContext(null)

  return (
    <div
      className="fixed right-0 top-0 h-full w-[400px] bg-white border-l border-gray-200 shadow-xl z-40 flex flex-col"
      style={{ height: "100vh" }}
    >
      {/* Header with breadcrumb and close */}
      <div className="border-b border-gray-200 px-4 py-3 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
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
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {selectedContext.type === "page" && data?.page && (
          <PageDisplaySettingsPanel
            page={data.page}
            isOpen={true}
            onClose={handleClose}
            onUpdate={data.onPageUpdate}
            embedded
          />
        )}

        {selectedContext.type === "block" && data?.selectedBlock && (
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
        )}

        {selectedContext.type === "recordList" && data?.selectedBlock && (
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
        )}

        {selectedContext.type === "record" && data?.recordId && data?.recordTableId && (
          <RecordLayoutSettings
            tableId={data.recordTableId}
            recordId={data.recordId}
            fieldLayout={data.fieldLayout}
            onLayoutSave={data.onLayoutSave}
            fields={data.tableFields}
          />
        )}

        {selectedContext.type === "field" && selectedContext.fieldId && (
          <FieldSchemaSettings
            fieldId={selectedContext.fieldId}
            tableId={selectedContext.tableId ?? data?.recordTableId ?? data?.pageTableId ?? ""}
          />
        )}
      </div>
    </div>
  )
}
