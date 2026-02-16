"use client"

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

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onClose} key={`record-modal-${recordId || "new"}`}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
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
            toast({ title: "Record deleted", description: "The record has been deleted." })
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
      </DialogContent>
    </Dialog>
  )
}
