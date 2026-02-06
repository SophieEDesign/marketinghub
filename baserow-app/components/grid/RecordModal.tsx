"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { X, Pencil, Check, LayoutGrid } from "lucide-react"
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
import type { PageBlock } from "@/lib/interface/types"
import { useRecordEditorCore, type RecordEditorCascadeContext } from "@/lib/interface/record-editor-core"
import { useUserRole } from "@/lib/hooks/useUserRole"

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
  /** When true, show "Edit layout" in header; requires onLayoutSave when using custom modal layout. */
  canEditLayout?: boolean
  /** Called when user saves layout in edit mode (Done). Pass the new modal_layout; parent persists (e.g. via block config). */
  onLayoutSave?: (modalLayout: BlockConfig['modal_layout']) => void
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
  canEditLayout = false,
  onLayoutSave,
}: RecordModalProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isModalEditing, setIsModalEditing] = useState(false)
  const [isEditingLayout, setIsEditingLayout] = useState(false)
  const [draftBlocks, setDraftBlocks] = useState<PageBlock[] | null>(null)
  const supabase = createClient()
  const { toast } = useToast()
  const { role } = useUserRole()

  useEffect(() => {
    if (!isOpen) {
      setIsModalEditing(false)
      setIsEditingLayout(false)
      setDraftBlocks(null)
    }
  }, [isOpen])

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

  const canShowEditButton = role === "admin" || canEditRecords
  const effectiveEditable = canShowEditButton && isModalEditing

  async function handleFieldChange(fieldName: string, value: any) {
    if (!record || !tableNameFromCore || !effectiveEditable) return

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
    })) as PageBlock[]
  }, [modalLayout?.blocks, fields])

  const hasCustomLayout = Boolean(modalLayout?.blocks && modalLayout.blocks.length > 0)
  const showEditLayoutButton = canEditLayout && hasCustomLayout && onLayoutSave && !isEditingLayout
  const blocksForCanvas = isEditingLayout && draftBlocks !== null ? draftBlocks : modalBlocks

  const handleStartEditLayout = useCallback(() => {
    setIsEditingLayout(true)
    setDraftBlocks([...modalBlocks])
  }, [modalBlocks])

  const handleDoneEditLayout = useCallback(() => {
    if (!onLayoutSave || draftBlocks === null) return
    const newModalLayout: BlockConfig['modal_layout'] = {
      blocks: draftBlocks.map((b, index) => ({
        id: b.id,
        type: (b.type === 'field' || b.type === 'text' || b.type === 'divider' || b.type === 'image') ? b.type : 'field',
        fieldName: b.config?.field_name ?? (b as any).fieldName,
        x: 0,
        y: index,
        w: modalLayout?.layoutSettings ? (typeof modalLayout.layoutSettings.cols === 'number' ? modalLayout.layoutSettings.cols : 8) : 8,
        h: b.h ?? 4,
        config: b.config,
      })),
      layoutSettings: modalLayout?.layoutSettings,
    }
    onLayoutSave(newModalLayout)
    setIsEditingLayout(false)
    setDraftBlocks(null)
  }, [onLayoutSave, draftBlocks, modalLayout?.layoutSettings])

  const handleCancelEditLayout = useCallback(() => {
    setIsEditingLayout(false)
    setDraftBlocks(null)
  }, [])

  const handleLayoutChange = useCallback((newBlocks: PageBlock[]) => {
    setDraftBlocks(newBlocks)
  }, [])

  const handleRemoveBlock = useCallback((blockId: string) => {
    setDraftBlocks((prev) => (prev ?? []).filter((b) => b.id !== blockId))
  }, [])

  const handleAddField = useCallback((insertAfterBlockId: string | null) => {
    const current = draftBlocks ?? modalBlocks
    const usedNames = new Set(
      current.filter((b) => b.type === 'field').map((b) => (b.config as any)?.field_name).filter(Boolean)
    )
    const available = fields.find((f) => f.name !== 'id' && !usedNames.has(f.name))
    if (!available) return
    const newBlock: PageBlock = {
      id: `field-${available.id}-${Date.now()}`,
      type: 'field',
      x: 0,
      y: current.length,
      w: 8,
      h: 4,
      config: { field_id: available.id, field_name: available.name },
    } as PageBlock
    if (insertAfterBlockId === null) {
      setDraftBlocks([...current, newBlock])
    } else {
      const idx = current.findIndex((b) => b.id === insertAfterBlockId)
      const insertAt = idx < 0 ? current.length : idx + 1
      const next = [...current]
      next.splice(insertAt, 0, newBlock)
      setDraftBlocks(next.map((b, i) => ({ ...b, y: i } as PageBlock)))
    }
  }, [draftBlocks, modalBlocks, fields])

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle>Record Details</DialogTitle>
            <div className="flex items-center gap-2">
              {isEditingLayout ? (
                <>
                  <button
                    type="button"
                    onClick={handleDoneEditLayout}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                    aria-label="Save layout"
                    title="Save layout"
                  >
                    <Check className="h-4 w-4" />
                    Done
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEditLayout}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50"
                    aria-label="Cancel layout edit"
                    title="Cancel"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  {showEditLayoutButton && (
                    <button
                      type="button"
                      onClick={handleStartEditLayout}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium bg-muted hover:bg-muted/80 text-muted-foreground"
                      aria-label="Edit layout"
                      title="Edit layout"
                    >
                      <LayoutGrid className="h-4 w-4" />
                      Edit layout
                    </button>
                  )}
                  {canShowEditButton && (
                    <button
                      type="button"
                      onClick={() => setIsModalEditing((v) => !v)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        isModalEditing
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "bg-muted hover:bg-muted/80 text-muted-foreground"
                      }`}
                      aria-label={isModalEditing ? "Done editing" : "Edit record"}
                      title={isModalEditing ? "Done editing" : "Edit record"}
                    >
                      {isModalEditing ? (
                        <>
                          <Check className="h-4 w-4" />
                          Done
                        </>
                      ) : (
                        <>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </>
                      )}
                    </button>
                  )}
                </>
              )}
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
              {hasCustomLayout ? (
                <div className="min-h-[400px]">
                  <ModalCanvas
                    mode={isEditingLayout ? "edit" : "view"}
                    blocks={blocksForCanvas}
                    tableId={tableId}
                    recordId={recordId}
                    tableName={tableNameFromCore || tableName}
                    tableFields={fields}
                    pageEditable={effectiveEditable}
                    editableFieldNames={fields.map(f => f.name)}
                    onFieldChange={handleFieldChange}
                    layoutSettings={modalLayout?.layoutSettings}
                    onLayoutChange={isEditingLayout ? handleLayoutChange : undefined}
                    onRemoveBlock={isEditingLayout ? handleRemoveBlock : undefined}
                    onAddField={isEditingLayout ? handleAddField : undefined}
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
                  isFieldEditable={() => effectiveEditable}
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
