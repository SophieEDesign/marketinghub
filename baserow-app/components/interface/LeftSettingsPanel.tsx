"use client"

/**
 * LEFT PANEL - Block Config (Airtable-style sidebar)
 * Configures the Record List / block itself. NOT the record layout.
 *
 * Controls: Data (table, view, filter, sort, group), List item/card, User controls.
 * Must NOT: field editability at schema level, record layout builder.
 */

import { useSelectionContext } from "@/contexts/SelectionContext"
import { useRightSettingsPanelData } from "@/contexts/RightSettingsPanelDataContext"
import PageDisplaySettingsPanel from "./PageDisplaySettingsPanel"
import SettingsPanel from "./SettingsPanel"

export default function LeftSettingsPanel() {
  const { selectedContext, setSelectedContext } = useSelectionContext()
  const { data } = useRightSettingsPanelData()

  const handleShowPageSettings = () => setSelectedContext({ type: "page" })

  const showBlockConfig =
    selectedContext?.type === "block" || selectedContext?.type === "recordList"
  const showPageConfig = selectedContext?.type === "page"
  const hasContent = showBlockConfig || showPageConfig

  if (!hasContent) return null

  return (
    <div className="w-full h-full flex flex-col bg-white border-r border-gray-200 overflow-hidden flex-shrink-0">
      <div className="border-b border-gray-200 px-4 py-3 flex-shrink-0">
        <h3 className="font-semibold text-gray-900">
          {showPageConfig ? "Page settings" : "Block settings"}
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {showPageConfig && data?.page ? (
          <PageDisplaySettingsPanel
            page={data.page}
            isOpen={true}
            onClose={handleShowPageSettings}
            onUpdate={data.onPageUpdate}
            embedded
          />
        ) : showPageConfig ? (
          <div className="p-4 text-sm text-muted-foreground">
            Loading page settings…
          </div>
        ) : showBlockConfig && data?.selectedBlock ? (
          <SettingsPanel
            block={data.selectedBlock}
            isOpen={true}
            onClose={handleShowPageSettings}
            onSave={data.onBlockSave}
            onMoveToTop={data.onBlockMoveToTop}
            onMoveToBottom={data.onBlockMoveToBottom}
            onLock={data.onBlockLock}
            pageTableId={data.pageTableId}
            allBlocks={data.blocks}
            embedded
          />
        ) : (
          <div className="p-4 text-sm text-muted-foreground">
            Loading block settings…
          </div>
        )}
      </div>
    </div>
  )
}
