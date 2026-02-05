"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"
import HorizontalGroupedView from "@/components/views/HorizontalGroupedView"
import FieldAppearanceSettings from "@/components/interface/settings/FieldAppearanceSettings"
import type { PageBlock } from "@/lib/interface/types"
import type { FilterConfig } from "@/lib/interface/filters"
import type { FilterTree } from "@/lib/filters/canonical-model"
import type { TableField } from "@/types/fields"
import type { GroupRule } from "@/lib/grouping/types"

interface HorizontalGroupedCanvasModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  block: PageBlock
  tableId: string
  tableName: string
  tableFields: TableField[]
  filters?: FilterConfig[]
  filterTree?: FilterTree
  groupBy?: string
  groupByRules?: GroupRule[]
  recordFields?: Array<{ field: string; editable?: boolean; order?: number }>
  storedLayout?: PageBlock[] | null
  highlightRules?: any[]
  onSave: (blocks: PageBlock[]) => void | Promise<void>
}

/**
 * Modal for editing the canvas layout of a horizontal grouped block
 * Opens when "Edit layout" is clicked in block settings
 */
export default function HorizontalGroupedCanvasModal({
  open,
  onOpenChange,
  block,
  tableId,
  tableName,
  tableFields,
  filters = [],
  filterTree = null,
  groupBy,
  groupByRules,
  recordFields = [],
  storedLayout = null,
  highlightRules = [],
  onSave,
}: HorizontalGroupedCanvasModalProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [currentLayout, setCurrentLayout] = useState<PageBlock[]>(storedLayout || [])
  const [settingsBlockId, setSettingsBlockId] = useState<string | null>(null)

  // Update current layout when storedLayout changes
  useEffect(() => {
    if (storedLayout) {
      setCurrentLayout(storedLayout)
    }
  }, [storedLayout])

  // Handle layout updates from HorizontalGroupedView
  const handleLayoutUpdate = useCallback(async (blocks: PageBlock[]) => {
    // Update local state immediately
    setCurrentLayout(blocks)
    // Auto-save to parent
    await onSave(blocks)
  }, [onSave])

  const handleBlockSettingsClick = useCallback((blockId: string) => {
    setSettingsBlockId(blockId)
  }, [])

  const handleFieldAppearanceUpdate = useCallback(
    (updates: Partial<PageBlock["config"]>) => {
      if (!settingsBlockId) return
      setCurrentLayout((prev) => {
        const next = prev.map((b) =>
          b.id === settingsBlockId ? { ...b, config: { ...b.config, ...updates } } : b
        )
        onSave(next)
        return next
      })
    },
    [settingsBlockId, onSave]
  )

  // Handle close - just close, layout is already saved
  const handleClose = useCallback((open: boolean) => {
    if (!open) {
      onOpenChange(false)
    }
  }, [onOpenChange])

  const handleDoneClick = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <DialogTitle>Edit record card layout</DialogTitle>
          <DialogDescription>
            Drag blocks to rearrange; use the corner handle to resize. Changes save automatically.
          </DialogDescription>
        </DialogHeader>
        
        {/* Scrollable content - same behavior as record view right panel, modal does not interfere with interface */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <HorizontalGroupedView
            tableId={tableId}
            viewId={block.id}
            supabaseTableName={tableName}
            tableFields={tableFields}
            filters={filters}
            filterTree={filterTree}
            sorts={[]}
            groupBy={groupBy}
            groupByRules={groupByRules}
            recordFields={recordFields}
            isEditing={true}
            onBlockUpdate={handleLayoutUpdate}
            onBlockSettingsClick={handleBlockSettingsClick}
            storedLayout={currentLayout}
            highlightRules={highlightRules}
          />
        </div>

        {settingsBlockId && (() => {
          const settingsBlock = currentLayout.find((b) => b.id === settingsBlockId)
          if (!settingsBlock?.config) return null
          return (
            <Dialog open={!!settingsBlockId} onOpenChange={(open) => !open && setSettingsBlockId(null)}>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Field block settings</DialogTitle>
                  <DialogDescription>
                    Configure how this field appears on the card (label, linked records display, etc.).
                  </DialogDescription>
                </DialogHeader>
                <FieldAppearanceSettings
                  config={settingsBlock.config}
                  onUpdate={handleFieldAppearanceUpdate}
                />
                <div className="flex justify-end pt-2">
                  <Button variant="outline" onClick={() => setSettingsBlockId(null)}>
                    Close
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )
        })()}

        <div className="flex-shrink-0 px-6 py-4 border-t flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDoneClick}
            disabled={isSaving}
          >
            <Check className="h-4 w-4 mr-2" />
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
