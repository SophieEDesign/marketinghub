"use client"

import { useEffect } from "react"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import RecordEditor from "@/components/records/RecordEditor"
import { useToast } from "@/components/ui/use-toast"
import type { TableField } from "@/types/fields"
import type { BlockConfig } from "@/lib/interface/types"
import type { FieldLayoutItem } from "@/lib/interface/field-layout-utils"
import type { RecordEditorCascadeContext } from "@/lib/interface/record-editor-core"

export interface RecordModalProps {
  open: boolean
  onClose: () => void
  tableId: string
  recordId: string | null
  tableFields?: TableField[]
  modalFields?: string[]
  initialData?: Record<string, any>
  onSave?: (createdRecordId?: string | null) => void
  onDeleted?: () => void | Promise<void>
  supabaseTableName?: string | null
  modalLayout?: BlockConfig["modal_layout"]
  fieldLayout?: FieldLayoutItem[]
  showFieldSections?: boolean
  cascadeContext?: RecordEditorCascadeContext | null
  showComments?: boolean
  interfaceMode?: "view" | "edit"
  canEditLayout?: boolean
  onLayoutSave?: (fieldLayout: FieldLayoutItem[]) => void | Promise<void>
  forceFlatLayout?: boolean
}

export default function RecordModal({
  open,
  onClose,
  tableId,
  recordId,
  tableFields = [],
  modalFields = [],
  initialData,
  onSave,
  onDeleted,
  supabaseTableName,
  modalLayout,
  fieldLayout,
  showFieldSections = false,
  cascadeContext,
  showComments = true,
  interfaceMode = "view",
  canEditLayout = false,
  onLayoutSave,
  forceFlatLayout = false,
}: RecordModalProps) {
  const { toast } = useToast()

  // #region agent log
  useEffect(() => {
    if (open) {
      fetch('http://127.0.0.1:7242/ingest/9d016980-ed95-431c-a758-912799743da1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fa3112'},body:JSON.stringify({sessionId:'fa3112',location:'RecordModal.tsx:open',message:'RecordModal opening',data:{recordId,tableId},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
    }
  }, [open, recordId, tableId])
  // #endregion

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onClose} key={`record-modal-${recordId || "new"}`}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* Single scroll container: modal content scrolls; no nested scrollbars */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <RecordEditor
          recordId={recordId}
          tableId={tableId}
          mode="modal"
          fieldLayoutConfig={fieldLayout}
          tableFields={tableFields}
          supabaseTableName={supabaseTableName}
          cascadeContext={cascadeContext}
          initialData={initialData}
          active={open}
          onSave={(createdId) => {
            onSave?.(createdId)
            onClose()
          }}
          onDeleted={async () => {
            toast({ title: "Moved to trash", description: "The record has been moved to trash." })
            await onDeleted?.()
            onClose()
          }}
          onClose={onClose}
          canEditLayout={canEditLayout}
          onLayoutSave={onLayoutSave}
          showComments={showComments}
          showFieldSections={showFieldSections}
          forceFlatLayout={forceFlatLayout}
          interfaceMode={interfaceMode}
          renderHeaderActions={true}
          modalLayout={modalLayout}
          modalFields={modalFields}
        />
        </div>
      </DialogContent>
    </Dialog>
  )
}
