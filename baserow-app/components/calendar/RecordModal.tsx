"use client"

import { useState, useEffect, useMemo, useCallback } from 'react'
import { ArrowLeft, Save, Trash2, ChevronDown, ChevronRight, Check, LayoutGrid } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { TableField } from '@/types/fields'
import FieldEditor from '@/components/fields/FieldEditor'
import RecordFields from '@/components/records/RecordFields'
import { useToast } from '@/components/ui/use-toast'
import { isAbortError } from '@/lib/api/error-handling'
import type { BlockConfig } from '@/lib/interface/types'
import { sectionAndSortFields } from '@/lib/fields/sectioning'
import { useRecordEditorCore, type RecordEditorCascadeContext } from '@/lib/interface/record-editor-core'
import type { FieldLayoutItem } from '@/lib/interface/field-layout-utils'
import {
  getVisibleFieldsFromLayout,
  isFieldEditableFromLayout,
  getFieldGroupsFromLayout,
  convertModalLayoutToFieldLayout,
  convertModalFieldsToFieldLayout,
  createInitialFieldLayout,
} from '@/lib/interface/field-layout-helpers'
import { resolveRecordEditMode } from '@/lib/interface/resolve-record-edit-mode'

export interface RecordModalProps {
  open: boolean
  onClose: () => void
  tableId: string
  recordId: string | null
  /** When omitted, the record editor core will fetch fields from the API */
  tableFields?: TableField[]
  modalFields?: string[] // Fields to show in modal (deprecated: use field_layout)
  initialData?: Record<string, any> // Initial data for creating new records
  onSave?: (createdRecordId?: string | null) => void // Callback with created record ID for new records
  onDeleted?: () => void | Promise<void>
  supabaseTableName?: string | null // Optional: if provided, skips table info fetch for faster loading
  modalLayout?: BlockConfig['modal_layout'] // Custom modal layout (deprecated: use field_layout)
  fieldLayout?: FieldLayoutItem[] // Unified field layout (preferred)
  showFieldSections?: boolean // Optional: show fields grouped by sections (default: false)
  /** Optional: when provided, permission flags from cascade are applied (edit/create/delete). */
  cascadeContext?: RecordEditorCascadeContext | null
  /** When true, show "Edit layout" in header; requires onLayoutSave. */
  canEditLayout?: boolean
  /** Called when user saves layout in edit mode (Done). Pass the new field_layout. */
  onLayoutSave?: (fieldLayout: FieldLayoutItem[]) => void
  /** When true, modal opens directly in layout edit mode */
  initialEditMode?: boolean
  /** Interface mode: 'view' | 'edit'. When 'edit', modal opens in layout edit mode (Airtable-style). */
  interfaceMode?: 'view' | 'edit'
}

const DEFAULT_SECTION_NAME = "General"

// Get localStorage key for collapsed sections state
const getCollapsedSectionsKey = (tableId: string) => `record-modal-collapsed-sections-${tableId}`

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
  supabaseTableName: supabaseTableNameProp,
  modalLayout,
  fieldLayout: propFieldLayout,
  showFieldSections = false,
  cascadeContext,
  canEditLayout = false,
  onLayoutSave,
  initialEditMode = false,
  interfaceMode = 'view',
}: RecordModalProps) {
  const { toast } = useToast()
  
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

  // P1 FIX: Reset edit state when modal closes OR when interfaceMode changes to 'edit'
  // When interfaceMode === 'edit', manual edit modes must be disabled (forced edit takes precedence)
  useEffect(() => {
    if (!open) {
      setManualEditMode(false)
      setDraftFieldLayout(null)
    } else if (forcedEditMode) {
      // When forced edit mode is active, disable manual edit mode (no override allowed)
      setManualEditMode(false)
    }
  }, [open, forcedEditMode])

  const core = useRecordEditorCore({
    tableId,
    recordId,
    supabaseTableName: supabaseTableNameProp,
    tableFields,
    modalFields,
    initialData,
    active: open,
    cascadeContext,
    onSave: (createdId) => {
      onSave?.(createdId)
      onClose()
    },
    onDeleted: async () => {
      toast({ title: 'Record deleted', description: 'The record has been deleted.' })
      await onDeleted?.()
      onClose()
    },
  })

  const {
    loading,
    formData,
    fields: filteredFields,
    effectiveTableName,
    saving,
    deleting,
    save,
    deleteRecord,
    handleFieldChange,
    canEditRecords,
    canCreateRecords,
    canDeleteRecords,
  } = core

  const canSave = recordId ? canEditRecords : canCreateRecords
  // P1 FIX: When interfaceMode === 'edit', ALWAYS allow editing (absolute authority, bypasses all checks)
  // When interfaceMode === 'view', require permission checks
  // NO EXCEPTIONS: If forcedEditMode is true, editing is always allowed
  const effectiveEditable = forcedEditMode ? true : canSave

  // Convert modalLayout/modalFields to field_layout format (backward compatibility)
  const resolvedFieldLayout = useMemo(() => {
    if (propFieldLayout && propFieldLayout.length > 0) {
      return propFieldLayout
    }
    
    // Convert from modalLayout (backward compatibility)
    if (modalLayout?.blocks && modalLayout.blocks.length > 0) {
      return convertModalLayoutToFieldLayout(modalLayout, filteredFields)
    }
    
    // Convert from modalFields (backward compatibility)
    if (modalFields && modalFields.length > 0) {
      return convertModalFieldsToFieldLayout(modalFields, filteredFields)
    }
    
    // No layout configured - return empty array (will show all fields)
    return []
  }, [propFieldLayout, modalLayout, modalFields, filteredFields])

  // Get visible fields from field_layout (only when viewing existing record, not creating)
  const visibleFields = useMemo(() => {
    if (!recordId || resolvedFieldLayout.length === 0) {
      return filteredFields // For new records or no layout, use all filtered fields
    }
    return getVisibleFieldsFromLayout(
      draftFieldLayout ?? resolvedFieldLayout,
      filteredFields
    )
  }, [recordId, draftFieldLayout, resolvedFieldLayout, filteredFields])

  // Get field groups from field_layout
  const fieldGroups = useMemo(() => {
    if (!recordId || resolvedFieldLayout.length === 0) {
      return {} // For new records or no layout, no grouping
    }
    return getFieldGroupsFromLayout(
      draftFieldLayout ?? resolvedFieldLayout,
      filteredFields
    )
  }, [recordId, draftFieldLayout, resolvedFieldLayout, filteredFields])

  // Determine if field is editable
  const isFieldEditable = useCallback((fieldName: string) => {
    // In layout mode, fields are locked (not editable)
    if (isEditingLayout) return false
    if (!effectiveEditable) return false
    if (!recordId || resolvedFieldLayout.length === 0) {
      return effectiveEditable // For new records or no layout, all fields editable
    }
    return isFieldEditableFromLayout(
      fieldName,
      draftFieldLayout ?? resolvedFieldLayout,
      effectiveEditable
    )
  }, [isEditingLayout, effectiveEditable, recordId, draftFieldLayout, resolvedFieldLayout])

  // Load collapsed sections state from localStorage
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set()
    try {
      const stored = localStorage.getItem(getCollapsedSectionsKey(tableId))
      if (stored) {
        return new Set(JSON.parse(stored))
      }
    } catch (error) {
      console.warn("Failed to load collapsed sections from localStorage:", error)
    }
    return new Set()
  })

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      localStorage.setItem(
        getCollapsedSectionsKey(tableId),
        JSON.stringify(Array.from(collapsedSections))
      )
    } catch (error) {
      console.warn("Failed to save collapsed sections to localStorage:", error)
    }
  }, [collapsedSections, tableId])

  const toggleSection = (sectionName: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(sectionName)) {
        next.delete(sectionName)
      } else {
        next.add(sectionName)
      }
      return next
    })
  }

  async function handleSave() {
    try {
      await save()
      if (recordId) onClose()
    } catch (e: any) {
      if (!isAbortError(e)) {
        const message = e?.message || 'Unknown error'
        const code = e?.code ? ` (code: ${e.code})` : ''
        alert(`Failed to save record${code}: ${message}`)
      }
    }
  }

  async function handleDelete() {
    if (!canDeleteRecords) {
      toast({
        variant: 'destructive',
        title: 'Not allowed',
        description: "You don't have permission to delete this record.",
      })
      return
    }
    try {
      await deleteRecord({
        confirmMessage: 'Are you sure you want to delete this record? This action cannot be undone.',
      })
    } catch (e: any) {
      if (!isAbortError(e)) {
        toast({
          variant: 'destructive',
          title: 'Failed to delete record',
          description: e?.message || 'Please try again',
        })
      }
    }
  }

  // Show "Edit layout" button only when NOT in interface edit mode (Airtable-style)
  // When interfaceMode === 'edit', modal is already in edit mode, so hide the button
  const showEditLayoutButton = interfaceMode !== 'edit' && canEditLayout && Boolean(onLayoutSave) && Boolean(recordId) && !isEditingLayout

  // CRITICAL: Initialize draftFieldLayout when entering edit mode.
  // Only initialise after table fields are available (never with empty field list due to loading).
  useEffect(() => {
    if (!open) return
    
    if (isEditingLayout && draftFieldLayout === null) {
      if (resolvedFieldLayout.length > 0) {
        setDraftFieldLayout([...resolvedFieldLayout])
      } else if (filteredFields.length > 0) {
        // Table fields loaded; create initial layout from full field list
        setDraftFieldLayout(createInitialFieldLayout(filteredFields, 'modal', true))
      }
      // When filteredFields.length === 0 (still loading), do not set draft; effect will re-run when fields load
    } else if (!isEditingLayout && draftFieldLayout !== null) {
      setDraftFieldLayout(null)
    }
  }, [open, isEditingLayout, resolvedFieldLayout, draftFieldLayout, filteredFields])

  // Log edit mode state on modal open for debugging
  useEffect(() => {
    if (open && process.env.NODE_ENV === 'development') {
      console.log('[RecordModal] Modal opened:', {
        interfaceMode,
        initialEditMode,
        isEditingLayout,
        recordId,
      })
    }
  }, [open, interfaceMode, initialEditMode, isEditingLayout, recordId])

  const handleStartEditLayout = useCallback(() => {
    setManualEditMode(true)
    // If there's no existing layout, initialize with all fields visible
    if (resolvedFieldLayout.length === 0) {
      setDraftFieldLayout(createInitialFieldLayout(filteredFields, 'modal', effectiveEditable))
    } else {
      setDraftFieldLayout([...resolvedFieldLayout])
    }
  }, [resolvedFieldLayout, filteredFields, effectiveEditable])

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
    if (isEditingLayout) {
      setDraftFieldLayout(newLayout)
    }
  }, [isEditingLayout])

  const handleFieldReorder = useCallback((fieldName: string, newIndex: number) => {
    if (draftFieldLayout === null) return

    const currentIndex = draftFieldLayout.findIndex((item) => item.field_name === fieldName)
    if (currentIndex === -1) return

    const newLayout = [...draftFieldLayout]
    const [moved] = newLayout.splice(currentIndex, 1)
    newLayout.splice(newIndex, 0, moved)

    const updatedLayout = newLayout.map((item, index) => ({
      ...item,
      order: index,
    }))

    setDraftFieldLayout(updatedLayout)
  }, [draftFieldLayout])

  const handleFieldVisibilityToggle = useCallback((fieldName: string, visible: boolean) => {
    if (draftFieldLayout === null) return

    const updated = draftFieldLayout.map((item) =>
      item.field_name === fieldName
        ? { ...item, visible_in_modal: visible }
        : item
    )

    if (!updated.some((item) => item.field_name === fieldName)) {
      const field = filteredFields.find((f) => f.name === fieldName)
      if (field) {
        const newItem: FieldLayoutItem = {
          field_id: field.id,
          field_name: field.name,
          order: Math.max(...updated.map((i) => i.order), -1) + 1,
          editable: effectiveEditable,
          visible_in_modal: visible,
        }
        updated.push(newItem)
      }
    }

    setDraftFieldLayout(updated)
  }, [draftFieldLayout, filteredFields, effectiveEditable])

  // Section fields if showFieldSections is enabled (filteredFields from core)
  const sectionedFields = useMemo(() => {
    if (!showFieldSections) return null
    return sectionAndSortFields(filteredFields)
  }, [filteredFields, showFieldSections])

  // CRITICAL: Unmount on close to prevent stale state (remount safety)
  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onClose} key={`record-modal-${recordId || 'new'}-${interfaceMode}`}>
      <DialogContent className={isEditingLayout ? "max-w-7xl max-h-[90vh] flex flex-col p-0" : "max-w-2xl max-h-[90vh] flex flex-col p-0"}>
        {/* Sticky top bar with save button */}
        <div className="sticky top-0 z-10 bg-white border-b px-6 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <DialogTitle className="text-lg font-semibold">
              {recordId ? 'Record Details' : 'Create New Record'}
            </DialogTitle>
          </div>
          <div className="flex items-center gap-2">
            {isEditingLayout ? (
              <>
                <Button type="button" variant="default" size="sm" onClick={handleDoneEditLayout} className="inline-flex items-center gap-1.5" aria-label="Save layout" title="Save layout">
                  <Check className="h-4 w-4" />
                  Save layout
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleCancelEditLayout} aria-label="Cancel layout edit" title="Cancel">
                  Cancel
                </Button>
              </>
            ) : (
              <>
                {showEditLayoutButton && (
                  <Button type="button" variant="outline" size="sm" onClick={handleStartEditLayout} className="inline-flex items-center gap-1.5" aria-label="Edit layout" title="Edit layout">
                    <LayoutGrid className="h-4 w-4" />
                    Edit layout
                  </Button>
                )}
              </>
            )}
            {recordId && !isEditingLayout && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting || saving || loading || !canDeleteRecords}
                title={!canDeleteRecords ? "You don't have permission to delete this record" : "Delete this record"}
                aria-disabled={!canDeleteRecords || deleting || saving || loading}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            )}
            <Button variant="outline" onClick={onClose} disabled={deleting || saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || loading || !canSave}
              title={!canSave ? (recordId ? "You don't have permission to edit this record" : "You don't have permission to create records") : undefined}
              aria-disabled={saving || loading || !canSave}
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        {/* Scrollable content area */}
        <div className={isEditingLayout ? "flex-1 flex overflow-hidden" : "flex-1 overflow-y-auto px-6"}>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500">Loading...</div>
            </div>
          ) : (
            <>
              {isEditingLayout && recordId ? (
                // Layout mode: record itself is the canvas with drag handles (existing records only)
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <RecordFields
                    fields={visibleFields}
                    formData={formData}
                    onFieldChange={handleFieldChange}
                    fieldGroups={fieldGroups}
                    tableId={tableId}
                    recordId={recordId}
                    tableName={effectiveTableName || ''}
                    isFieldEditable={isFieldEditable}
                    layoutMode={true}
                    fieldLayout={draftFieldLayout ?? resolvedFieldLayout}
                    allFields={filteredFields}
                    onFieldReorder={handleFieldReorder}
                    onFieldVisibilityToggle={handleFieldVisibilityToggle}
                    onFieldLayoutChange={handleFieldLayoutChange}
                    pageEditable={effectiveEditable}
                  />
                </div>
              ) : resolvedFieldLayout.length > 0 && recordId ? (
                // Use RecordFields for existing records with layout
                <div className="space-y-4 py-4">
                  <RecordFields
                    fields={visibleFields}
                    formData={formData}
                    onFieldChange={handleFieldChange}
                    fieldGroups={fieldGroups}
                    tableId={tableId}
                    recordId={recordId}
                    tableName={effectiveTableName || ''}
                    isFieldEditable={isFieldEditable}
                  />
                </div>
              ) : showFieldSections && sectionedFields ? (
                // Render with sections (for new records or when sections enabled)
                <div className="space-y-4 py-4">
                  {sectionedFields.map(([sectionName, sectionFields]) => {
                    const isCollapsed = collapsedSections.has(sectionName)
                    return (
                      <div key={sectionName} className="space-y-2">
                        <button
                          type="button"
                          onClick={() => toggleSection(sectionName)}
                          className="w-full flex items-center justify-between text-left py-1 -mx-1 px-1 rounded-md hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                          aria-expanded={!isCollapsed}
                          aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${sectionName} section`}
                        >
                          <span className="text-sm font-semibold text-gray-900">{sectionName}</span>
                          <span className="text-gray-400">
                            {isCollapsed ? (
                              <ChevronRight className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </span>
                        </button>
                        {!isCollapsed && (
                          <div className="space-y-4 pl-4">
                            {sectionFields.map((field) => {
                              const value = formData[field.name]
                              return (
                                <FieldEditor
                                  key={field.id}
                                  field={field}
                                  value={value}
                                  onChange={(newValue) => handleFieldChange(field.name, newValue)}
                                  required={field.required || false}
                                  recordId={recordId || undefined}
                                  tableName={effectiveTableName || undefined}
                                  isReadOnly={!effectiveEditable}
                                />
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                // Render flat list (default behavior for new records)
                <div className="space-y-4 py-4">
                  {filteredFields.map((field) => {
                    const value = formData[field.name]
                    return (
                      <FieldEditor
                        key={field.id}
                        field={field}
                        value={value}
                        onChange={(newValue) => handleFieldChange(field.name, newValue)}
                        required={field.required || false}
                        recordId={recordId || undefined}
                        tableName={effectiveTableName || undefined}
                        isReadOnly={!effectiveEditable}
                      />
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

