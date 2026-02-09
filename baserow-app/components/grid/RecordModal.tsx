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
import RecordFieldEditorPanel from "@/components/interface/RecordFieldEditorPanel"
import { useToast } from "@/components/ui/use-toast"
import { Trash2 } from "lucide-react"
import { isAbortError } from "@/lib/api/error-handling"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import type { BlockConfig } from "@/lib/interface/types"
import { useRecordEditorCore, type RecordEditorCascadeContext } from "@/lib/interface/record-editor-core"
import { useUserRole } from "@/lib/hooks/useUserRole"
import type { FieldLayoutItem } from "@/lib/interface/field-layout-utils"
import {
  getVisibleFieldsFromLayout,
  isFieldEditableFromLayout,
  getFieldGroupsFromLayout,
  convertModalLayoutToFieldLayout,
  convertModalFieldsToFieldLayout,
  createInitialFieldLayout,
} from "@/lib/interface/field-layout-helpers"
import { resolveRecordEditMode } from "@/lib/interface/resolve-record-edit-mode"

interface RecordModalProps {
  isOpen: boolean
  onClose: () => void
  onDeleted?: () => void | Promise<void>
  tableId: string
  recordId: string
  tableName: string
  modalFields?: string[] // Fields to show in modal (deprecated: use field_layout)
  modalLayout?: BlockConfig['modal_layout'] // Custom modal layout (deprecated: use field_layout)
  fieldLayout?: FieldLayoutItem[] // Unified field layout (preferred)
  /** Optional: when provided, permission flags from cascade are applied (edit/delete). */
  cascadeContext?: RecordEditorCascadeContext | null
  /** When true, show "Edit layout" in header; requires onLayoutSave. */
  canEditLayout?: boolean
  /** Called when user saves layout in edit mode (Done). Pass the new field_layout; parent persists (e.g. via block config). */
  onLayoutSave?: (fieldLayout: FieldLayoutItem[]) => void
  /** When true, modal opens directly in layout edit mode */
  initialEditMode?: boolean
  /** Interface mode: 'view' | 'edit'. When 'edit', modal opens in layout edit mode (Airtable-style). */
  interfaceMode?: 'view' | 'edit'
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
  fieldLayout: propFieldLayout,
  cascadeContext,
  canEditLayout = false,
  onLayoutSave,
  initialEditMode = false,
  interfaceMode = 'view',
}: RecordModalProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isModalEditing, setIsModalEditing] = useState(false)
  
  // P1 FIX: interfaceMode === 'edit' is ABSOLUTE - no manual overrides allowed
  // When interfaceMode === 'edit', editing is forced (derived value, cannot be disabled)
  // When interfaceMode === 'view', allow manual toggle via state
  const forcedEditMode = resolveRecordEditMode({ interfaceMode, initialEditMode })
  const [manualEditMode, setManualEditMode] = useState(false)
  
  // P1 FIX: When forcedEditMode is true, ignore manualEditMode (no hybrid states)
  // Combined edit mode: forced OR manual (but forced takes absolute precedence)
  const isEditingLayout = forcedEditMode || (!forcedEditMode && manualEditMode)
  
  // Track draft layout for editing
  const [draftFieldLayout, setDraftFieldLayout] = useState<FieldLayoutItem[] | null>(null)
  const supabase = createClient()
  const { toast } = useToast()
  const { role } = useUserRole()

  // P1 FIX: Reset edit state when modal closes OR when interfaceMode changes to 'edit'
  // When interfaceMode === 'edit', manual edit modes must be disabled (forced edit takes precedence)
  useEffect(() => {
    if (!isOpen) {
      setIsModalEditing(false)
      setManualEditMode(false)
      setDraftFieldLayout(null)
    } else if (forcedEditMode) {
      // When forced edit mode is active, enable editing and disable manual toggles
      setIsModalEditing(true)
      setManualEditMode(false)
    }
  }, [isOpen, forcedEditMode])

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
  // P1 FIX: When interfaceMode === 'edit', ALWAYS allow editing (absolute authority, bypasses all checks)
  // When interfaceMode === 'view', require manual toggle via isModalEditing AND permission checks
  // NO EXCEPTIONS: If forcedEditMode is true, editing is always allowed
  const effectiveEditable = forcedEditMode ? true : (canShowEditButton && isModalEditing)

  // Convert modalLayout/modalFields to field_layout format (backward compatibility)
  const resolvedFieldLayout = useMemo(() => {
    if (propFieldLayout && propFieldLayout.length > 0) {
      return propFieldLayout
    }
    
    // Convert from modalLayout (backward compatibility)
    if (modalLayout?.blocks && modalLayout.blocks.length > 0) {
      return convertModalLayoutToFieldLayout(modalLayout, fields)
    }
    
    // Convert from modalFields (backward compatibility)
    if (modalFields && modalFields.length > 0) {
      return convertModalFieldsToFieldLayout(modalFields, fields)
    }
    
    // No layout configured - return empty array (will show all fields)
    return []
  }, [propFieldLayout, modalLayout, modalFields, fields])

  // Get visible fields from field_layout
  const visibleFields = useMemo(() => {
    return getVisibleFieldsFromLayout(
      draftFieldLayout ?? resolvedFieldLayout,
      fields
    )
  }, [draftFieldLayout, resolvedFieldLayout, fields])

  // Get field groups from field_layout
  const fieldGroups = useMemo(() => {
    return getFieldGroupsFromLayout(
      draftFieldLayout ?? resolvedFieldLayout,
      fields
    )
  }, [draftFieldLayout, resolvedFieldLayout, fields])

  // Determine if field is editable
  const isFieldEditable = useCallback((fieldName: string) => {
    if (!effectiveEditable) return false
    return isFieldEditableFromLayout(
      fieldName,
      draftFieldLayout ?? resolvedFieldLayout,
      effectiveEditable
    )
  }, [effectiveEditable, draftFieldLayout, resolvedFieldLayout])

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

  // Show "Edit layout" button only when NOT in interface edit mode (Airtable-style)
  // When interfaceMode === 'edit', modal is already in edit mode, so hide the button
  const showEditLayoutButton = interfaceMode !== 'edit' && Boolean(onLayoutSave) && !isEditingLayout && canEditLayout

  // CRITICAL: Initialize draftFieldLayout when entering edit mode.
  // Only initialise after table fields are available (never with empty field list due to loading).
  useEffect(() => {
    if (!isOpen) return
    
    if (isEditingLayout && draftFieldLayout === null) {
      if (resolvedFieldLayout.length > 0) {
        setDraftFieldLayout([...resolvedFieldLayout])
      } else if (fields.length > 0) {
        // Table fields loaded; create initial layout from full field list
        setDraftFieldLayout(createInitialFieldLayout(fields, 'modal', true))
      }
      // When fields.length === 0 (still loading), do not set draft; effect will re-run when fields load
    } else if (!isEditingLayout && draftFieldLayout !== null) {
      setDraftFieldLayout(null)
    }
  }, [isOpen, isEditingLayout, resolvedFieldLayout, draftFieldLayout, fields])

  // Log edit mode state on modal open for debugging
  useEffect(() => {
    if (isOpen && process.env.NODE_ENV === 'development') {
      console.log('[RecordModal] Modal opened:', {
        interfaceMode,
        initialEditMode,
        isEditingLayout,
        recordId,
      })
    }
  }, [isOpen, interfaceMode, initialEditMode, isEditingLayout, recordId])

  const handleStartEditLayout = useCallback(() => {
    setManualEditMode(true)
    // If there's no existing layout, initialize with all fields visible
    if (resolvedFieldLayout.length === 0) {
      setDraftFieldLayout(createInitialFieldLayout(fields, 'modal', effectiveEditable))
    } else {
      setDraftFieldLayout([...resolvedFieldLayout])
    }
  }, [resolvedFieldLayout, fields, effectiveEditable])

  const handleDoneEditLayout = useCallback(() => {
    if (!onLayoutSave || draftFieldLayout === null || !canEditLayout) return
    onLayoutSave(draftFieldLayout)
    // Only exit edit mode if not forced by interfaceMode
    if (!forcedEditMode) {
      setManualEditMode(false)
    }
    setDraftFieldLayout(null)
  }, [onLayoutSave, canEditLayout, draftFieldLayout, forcedEditMode])

  const handleCancelEditLayout = useCallback(() => {
    // Only allow canceling if not forced by interfaceMode
    if (!forcedEditMode) {
      setManualEditMode(false)
      setDraftFieldLayout(null)
    }
  }, [forcedEditMode])

  const handleFieldLayoutChange = useCallback((newLayout: FieldLayoutItem[]) => {
    setDraftFieldLayout(newLayout)
  }, [])

  // CRITICAL: Unmount on close to prevent stale state (remount safety)
  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose} key={`record-modal-${recordId}-${interfaceMode}`}>
      <DialogContent className={isEditingLayout ? "max-w-7xl max-h-[90vh] flex flex-col p-0" : "max-w-4xl max-h-[90vh] overflow-y-auto"}>
        <DialogHeader className={isEditingLayout ? "px-6 pt-6 pb-4 border-b" : ""}>
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
                  {/* P1 FIX: Show Edit button ONLY when NOT in interface edit mode (Airtable-style) */}
                  {/* When interfaceMode === 'edit', modal is already editable, so hide the button */}
                  {canShowEditButton && !forcedEditMode && (
                    <button
                      type="button"
                      onClick={() => {
                        // P1 FIX: Prevent toggling if forcedEditMode becomes true during click
                        if (!forcedEditMode) {
                          setIsModalEditing((v) => !v)
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        isModalEditing
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "bg-muted hover:bg-muted/80 text-muted-foreground"
                      }`}
                      aria-label={isModalEditing ? "Done editing" : "Edit record"}
                      title={isModalEditing ? "Done editing" : "Edit record"}
                      disabled={forcedEditMode}
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
        <div className={isEditingLayout ? "flex-1 flex overflow-hidden" : "mt-4"}>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : record && Object.keys(record).length > 0 ? (
            <>
              {isEditingLayout ? (
                // Split view for layout editing
                <>
                  <div className="flex-1 overflow-y-auto px-6 py-4">
                    <RecordFields
                      fields={visibleFields}
                      formData={record || {}}
                      onFieldChange={handleFieldChange}
                      fieldGroups={fieldGroups}
                      tableId={tableId}
                      recordId={recordId}
                      tableName={tableNameFromCore || tableName}
                      isFieldEditable={isFieldEditable}
                    />
                  </div>
                  <div className="w-80 border-l overflow-y-auto bg-gray-50">
                    <RecordFieldEditorPanel
                      tableId={tableId}
                      recordId={recordId}
                      allFields={fields}
                      fieldLayout={draftFieldLayout ?? resolvedFieldLayout}
                      onFieldLayoutChange={handleFieldLayoutChange}
                      onFieldChange={handleFieldChange}
                      pageEditable={effectiveEditable}
                      mode="modal"
                      interfaceMode={interfaceMode}
                    />
                  </div>
                </>
              ) : (
                // Normal view
                <>
                  <RecordFields
                    fields={visibleFields}
                    formData={record || {}}
                    onFieldChange={handleFieldChange}
                    fieldGroups={fieldGroups}
                    tableId={tableId}
                    recordId={recordId}
                    tableName={tableNameFromCore || tableName}
                    isFieldEditable={isFieldEditable}
                  />

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
              )}
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
