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
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Edit record card layout</DialogTitle>
          <DialogDescription>
            Drag blocks to rearrange; use the corner handle to resize. Changes save automatically.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden min-h-0">
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
            storedLayout={currentLayout}
            highlightRules={highlightRules}
          />
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-2">
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
