"use client"

import { useState } from "react"
import { X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import RecordFields from "@/components/records/RecordFields"
import { useToast } from "@/components/ui/use-toast"
import { Trash2 } from "lucide-react"
import { isAbortError } from "@/lib/api/error-handling"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import ModalCanvas from "@/components/interface/ModalCanvas"
import type { BlockConfig } from "@/lib/interface/types"
import { useMemo } from "react"
import { useRecordEditorCore, type RecordEditorCascadeContext } from "@/lib/interface/record-editor-core"

interface RecordModalProps {
  isOpen: boolean
  onClose: () => void
  onDeleted?: () => void | Promise<void>
  tableId: string
  recordId: string
  tableName: string
  modalFields?: string[] // Fields to show in modal (if empty, show all)
  modalLayout?: BlockConfig['modal_layout'] // Custom modal layout
  /** Optional: when provided, permission flags from cascade are applied (edit/delete). */
  cascadeContext?: RecordEditorCascadeContext | null
}

export default function RecordModal({
  isOpen,
  onClose,
  onDeleted,
  tableId,
  recordId,
  tableName,
  modalFields,
  modalLayout,
  cascadeContext,
}: RecordModalProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const supabase = createClient()
  const { toast } = useToast()

  const core = useRecordEditorCore({
    tableId,
    recordId,
    supabaseTableName: tableName,
    modalFields: modalFields ?? [],
    active: isOpen,
    cascadeContext,
    onDeleted: async () => {
      toast({ title: "Record deleted", description: "The record has been deleted." })
      await onDeleted?.()
      onClose()
    },
  })

  const {
    loading,
    formData: record,
    setFormData,
    fields,
    effectiveTableName: tableNameFromCore,
    deleting,
    normalizeUpdateValue,
    deleteRecord,
    canEditRecords,
    canDeleteRecords,
  } = core

  async function handleFieldChange(fieldName: string, value: any) {
    if (!record || !tableNameFromCore || !canEditRecords) return

    try {
      const normalizedValue = normalizeUpdateValue(fieldName, value)
      let finalSavedValue: any = normalizedValue

      const doUpdate = async (val: any) => {
        return await supabase.from(tableNameFromCore).update({ [fieldName]: val }).eq("id", recordId)
      }

      let { error } = await doUpdate(finalSavedValue)

      // Compatibility rescue for uuid[] column type mismatch (code 42804)
      if (
        error?.code === '42804' &&
        !Array.isArray(finalSavedValue) &&
        String(error?.message || '').toLowerCase().includes('uuid[]') &&
        String(error?.message || '').toLowerCase().includes('uuid')
      ) {
        const wrappedValue = finalSavedValue != null ? [finalSavedValue] : null
        const retry = await doUpdate(wrappedValue)
        error = retry.error
        if (!retry.error) finalSavedValue = wrappedValue
      }

      if (
        error?.code === "22P02" &&
        Array.isArray(finalSavedValue) &&
        String(error?.message || "").toLowerCase().includes('invalid input syntax for type uuid')
      ) {
        if (finalSavedValue.length <= 1) {
          finalSavedValue = finalSavedValue[0] ?? null
          const retry = await doUpdate(finalSavedValue)
          error = retry.error
        }
      }

      if (error) {
        if (!isAbortError(error)) throw error
        return
      }
      setFormData((prev) => (prev ? { ...prev, [fieldName]: finalSavedValue } : prev))
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Error updating field:", error)
      }
    }
  }

  async function handleDeleteRecord() {
    if (!tableNameFromCore || !recordId) return
    if (!canDeleteRecords) {
      toast({
        variant: "destructive",
        title: "Not allowed",
        description: "You don't have permission to delete this record.",
      })
      return
    }
    setShowDeleteConfirm(true)
  }

  async function confirmDelete() {
    try {
      await deleteRecord({
        confirmMessage: "Are you sure you want to delete this record? This action cannot be undone.",
      })
    } catch (error: any) {
      if (!isAbortError(error)) {
        toast({
          variant: "destructive",
          title: "Failed to delete record",
          description: error.message || "Please try again",
        })
      }
    }
  }

  // Memoize blocks for ModalCanvas - must be at top level (before early return)
  const modalBlocks = useMemo(() => {
    if (!modalLayout?.blocks || modalLayout.blocks.length === 0) {
      return []
    }
    return modalLayout.blocks.map(block => ({
      id: block.id,
      type: block.type,
      x: block.x,
      y: block.y,
      w: block.w,
      h: block.h,
      config: {
        ...block.config,
        field_id: block.type === 'field' 
          ? fields.find(f => f.name === block.fieldName || f.id === block.fieldName)?.id
          : undefined,
        field_name: block.fieldName,
      },
    })) as any[]
  }, [modalLayout?.blocks, fields])

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle>Record Details</DialogTitle>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDeleteRecord}
                disabled={deleting || loading || !canDeleteRecords}
                className="p-2 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50"
                aria-label="Delete record"
                aria-disabled={!canDeleteRecords || deleting || loading}
                title={!canDeleteRecords ? "You don't have permission to delete this record" : "Delete"}
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-md hover:bg-gray-100 transition-colors"
                aria-label="Close"
                title="Close"
              >
                <X className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          </div>
        </DialogHeader>
        <div className="mt-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : record && Object.keys(record).length > 0 ? (
            <>
              {/* Use custom layout if available, otherwise fall back to simple field list */}
              {modalLayout?.blocks && modalLayout.blocks.length > 0 ? (
                <div className="min-h-[400px]">
                  <ModalCanvas
                    blocks={modalBlocks}
                    tableId={tableId}
                    recordId={recordId}
                    tableName={tableNameFromCore || tableName}
                    tableFields={fields}
                    pageEditable={canEditRecords}
                    editableFieldNames={fields.map(f => f.name)}
                    onFieldChange={handleFieldChange}
                    layoutSettings={modalLayout.layoutSettings}
                  />
                </div>
              ) : (
                <RecordFields
                  fields={fields}
                  formData={record || {}}
                  onFieldChange={handleFieldChange}
                  fieldGroups={{}}
                  tableId={tableId}
                  recordId={recordId}
                  tableName={tableNameFromCore || tableName}
                  isFieldEditable={() => canEditRecords}
                />
              )}

              {/* Footer actions */}
              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleDeleteRecord}
                  disabled={deleting || loading || !canDeleteRecords}
                  className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={!canDeleteRecords ? "You don't have permission to delete this record" : "Delete this record"}
                  aria-disabled={!canDeleteRecords || deleting || loading}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete record
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">Record not found</div>
          )}
        </div>
      </DialogContent>
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={confirmDelete}
        title="Delete Record"
        description="Are you sure you want to delete this record? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        loading={deleting}
      />
    </Dialog>
  )
}
