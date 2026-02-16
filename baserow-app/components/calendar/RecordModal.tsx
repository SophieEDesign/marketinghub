"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { ArrowLeft, Save, Trash2, ChevronDown, ChevronRight, X, Check, LayoutGrid } from 'lucide-react'
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
import RecordComments from '@/components/records/RecordComments'
import FieldSettingsDrawer from '@/components/layout/FieldSettingsDrawer'
import { getTableSections } from '@/lib/core-data/section-settings'
import type { SectionSettings } from '@/lib/core-data/types'
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
} from '@/lib/interface/field-layout-helpers'
import { getPrimaryFieldName } from '@/lib/fields/primary'
import { useSelectionContext } from '@/contexts/SelectionContext'

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
  /** When true, show comments area in footer. Default: true for existing records. */
  showComments?: boolean
  /** Interface mode: 'edit' allows layout editing when canEditLayout is true. */
  interfaceMode?: 'view' | 'edit'
  /** When true and interfaceMode === 'edit', show "Customize layout" button. */
  canEditLayout?: boolean
  /** Callback to save field layout when user finishes layout edit. */
  onLayoutSave?: (fieldLayout: FieldLayoutItem[]) => void | Promise<void>
  /** When true, skip RecordFields/sectioned and always use flat FieldEditor list (avoids React #185 in calendar). */
  forceFlatLayout?: boolean
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
  showComments = true,
  interfaceMode = 'view',
  canEditLayout = false,
  onLayoutSave,
  forceFlatLayout = false,
}: RecordModalProps) {
  const { toast } = useToast()
  const { selectedContext, setSelectedContext } = useSelectionContext()

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
  const effectiveEditable = canSave

  // Layout edit mode: user-triggered only via "Customize layout" (no forcedEditMode from interfaceMode)
  const [manualEditMode, setManualEditMode] = useState(false)

  // Defer content mount until data is ready to avoid React #185 (hook order when RecordFields goes from 0→N fields).
  const [contentReady, setContentReady] = useState(false)
  const contentReadyRef = useRef(false)
  useEffect(() => {
    const ready =
      !loading &&
      (filteredFields.length === 0
        ? false
        : recordId
          ? formData != null && Object.keys(formData).length > 0
          : true)
    if (ready && !contentReadyRef.current) {
      contentReadyRef.current = true
      setContentReady(true)
    }
    if (!open || loading) {
      contentReadyRef.current = false
      setContentReady(false)
    }
  }, [open, loading, recordId, formData, filteredFields.length])

  const permissions = (cascadeContext?.blockConfig as any)?.permissions ?? (cascadeContext?.pageConfig as any)?.permissions ?? {}
  const isViewOnly = permissions.mode === 'view'

  // Record title for header (primary field value or fallback)
  const recordTitle = useMemo(() => {
    if (!recordId || !formData) return null
    const primaryName = getPrimaryFieldName(filteredFields)
    if (primaryName && formData[primaryName] != null && formData[primaryName] !== '') {
      return String(formData[primaryName])
    }
    return null
  }, [recordId, formData, filteredFields])

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
    return getVisibleFieldsFromLayout(resolvedFieldLayout, filteredFields)
  }, [recordId, resolvedFieldLayout, filteredFields])

  // Get field groups from field_layout
  const fieldGroups = useMemo(() => {
    if (!recordId || resolvedFieldLayout.length === 0) {
      return {} // For new records or no layout, no grouping
    }
    return getFieldGroupsFromLayout(resolvedFieldLayout, filteredFields)
  }, [recordId, resolvedFieldLayout, filteredFields])

  // Layout editing state - must be declared before layoutFieldsSource which uses it
  const [localFieldLayout, setLocalFieldLayout] = useState<FieldLayoutItem[]>([])
  // CRITICAL: Only update when layout CONTENT changes, not reference. resolvedFieldLayout is a new
  // array each time useMemo runs (convertModalLayoutToFieldLayout returns new array). Without this
  // guard, effect → setState → re-render → useMemo runs → new ref → effect → setState → React #185.
  const resolvedLayoutSignatureRef = useRef<string>('')
  useEffect(() => {
    const sig = JSON.stringify(resolvedFieldLayout.map((i) => [i.field_name, i.order, i.visible_in_modal]))
    if (resolvedLayoutSignatureRef.current === sig) return
    resolvedLayoutSignatureRef.current = sig
    setLocalFieldLayout(resolvedFieldLayout)
  }, [resolvedFieldLayout])

  // Layout editing: only when user clicked "Customize layout" and we have layout + save callback
  const isEditingLayout = manualEditMode && Boolean(onLayoutSave) && resolvedFieldLayout.length > 0

  // For layout mode: include ALL fields from layout (including hidden) so user can toggle visibility
  const layoutFieldsSource = localFieldLayout.length > 0 ? localFieldLayout : resolvedFieldLayout
  const layoutModeFields = useMemo(() => {
    if (!isEditingLayout || layoutFieldsSource.length === 0) return visibleFields
    const fieldMap = new Map<string, TableField>()
    filteredFields.forEach((f) => {
      fieldMap.set(f.name, f)
      fieldMap.set(f.id, f)
    })
    const ordered = [...layoutFieldsSource].sort((a, b) => a.order - b.order)
    const result: TableField[] = []
    const seen = new Set<string>()
    ordered.forEach((item) => {
      const field = fieldMap.get(item.field_name) || fieldMap.get(item.field_id)
      if (field && !seen.has(field.id)) {
        result.push(field)
        seen.add(field.id)
      }
    })
    return result.length > 0 ? result : visibleFields
  }, [isEditingLayout, layoutFieldsSource, filteredFields, visibleFields])

  // Determine if field is editable
  const isFieldEditable = useCallback((fieldName: string) => {
    if (!effectiveEditable) return false
    if (!recordId || resolvedFieldLayout.length === 0) {
      return effectiveEditable // For new records or no layout, all fields editable
    }
    return isFieldEditableFromLayout(
      fieldName,
      resolvedFieldLayout,
      effectiveEditable
    )
  }, [effectiveEditable, recordId, resolvedFieldLayout])

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


  const handleFieldLabelClick = useCallback((fieldId: string) => {
    // Step 5: Disable field label click when in layout mode to avoid mode confusion
    if (isEditingLayout) return
    setSelectedContext({ type: "field", fieldId, tableId })
  }, [setSelectedContext, tableId, isEditingLayout])

  // Reset layout edit mode when modal closes
  useEffect(() => {
    if (!open) setManualEditMode(false)
  }, [open])

  // Layout change handlers for RecordFields in layout mode
  const handleFieldLayoutChange = useCallback((newLayout: FieldLayoutItem[]) => {
    setLocalFieldLayout(newLayout)
    onLayoutSave?.(newLayout)
  }, [onLayoutSave])

  const handleFieldVisibilityToggle = useCallback((fieldName: string, visible: boolean) => {
    const updated = localFieldLayout.map((item) =>
      item.field_name === fieldName ? { ...item, visible_in_modal: visible } : item
    )
    setLocalFieldLayout(updated)
    onLayoutSave?.(updated)
  }, [localFieldLayout, onLayoutSave])

  const handleDoneEditLayout = useCallback(async () => {
    await onLayoutSave?.(localFieldLayout)
    setManualEditMode(false)
  }, [onLayoutSave, localFieldLayout])

  // FieldSettingsDrawer: show when field label clicked (SelectionContext) and modal is open
  const selectedFieldForDrawer = useMemo(() => {
    if (selectedContext?.type !== 'field' || selectedContext.tableId !== tableId) return null
    return filteredFields.find((f) => f.id === selectedContext.fieldId) ?? null
  }, [selectedContext, tableId, filteredFields])

  const [sections, setSections] = useState<SectionSettings[]>([])
  useEffect(() => {
    if (open && tableId) {
      getTableSections(tableId).then(setSections).catch(() => setSections([]))
    }
  }, [open, tableId])

  const showFieldSettingsDrawer = Boolean(open && selectedFieldForDrawer && !isEditingLayout)
  const handleFieldSettingsDrawerOpenChange = useCallback((drawerOpen: boolean) => {
    if (!drawerOpen) setSelectedContext(null)
  }, [setSelectedContext])

  // Show "Customize layout" when interfaceMode==='edit' && canEditLayout && !isViewOnly
  const showCustomizeLayoutButton = interfaceMode === 'edit' && canEditLayout && !isViewOnly && Boolean(onLayoutSave) && resolvedFieldLayout.length > 0 && !!recordId

  // Section fields if showFieldSections is enabled (filteredFields from core)
  const sectionedFields = useMemo(() => {
    if (!showFieldSections) return null
    return sectionAndSortFields(filteredFields)
  }, [filteredFields, showFieldSections])

  // CRITICAL: Unmount on close to prevent stale state (remount safety)
  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onClose} key={`record-modal-${recordId || 'new'}`}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        {/* Header: Back, Title, Close */}
        <div className="sticky top-0 z-10 bg-white border-b px-6 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 flex-shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <DialogTitle className="text-lg font-semibold truncate">
              {recordId ? (recordTitle || 'Record Details') : 'Create New Record'}
            </DialogTitle>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {showCustomizeLayoutButton && (
              isEditingLayout ? (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleDoneEditLayout}
                  className="gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  Done
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setManualEditMode(true)}
                  className="gap-1.5"
                  title="Customize which fields appear and their order"
                >
                  <LayoutGrid className="h-4 w-4" />
                  Customize layout
                </Button>
              )
            )}
            {recordId && (
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
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Scrollable content area. Key by record identity only - do NOT include loading state. */}
        <div
          key={`modal-body-${recordId ?? 'new'}`}
          className={isEditingLayout ? "flex-1 flex overflow-hidden" : "flex-1 overflow-y-auto px-6"}
        >
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500">Loading...</div>
            </div>
          ) : recordId && (!formData || Object.keys(formData).length === 0) ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500">Record not found</div>
            </div>
          ) : filteredFields.length === 0 || !contentReady ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500">Preparing fields…</div>
            </div>
          ) : (
            <>
              {!forceFlatLayout && resolvedFieldLayout.length > 0 && recordId ? (
                // Use RecordFields for existing records with layout (multi-column, drag handles when layout editing)
                <div className="space-y-4 py-4">
                  <RecordFields
                    fields={isEditingLayout ? layoutModeFields : visibleFields}
                    formData={formData}
                    onFieldChange={handleFieldChange}
                    fieldGroups={fieldGroups}
                    tableId={tableId}
                    recordId={recordId}
                    tableName={effectiveTableName || ''}
                    isFieldEditable={isFieldEditable}
                    fieldLayout={isEditingLayout ? localFieldLayout : resolvedFieldLayout}
                    allFields={filteredFields}
                    pageEditable={effectiveEditable}
                    onFieldLabelClick={handleFieldLabelClick}
                    layoutMode={isEditingLayout && !isViewOnly}
                    onFieldLayoutChange={isEditingLayout ? handleFieldLayoutChange : undefined}
                    onFieldVisibilityToggle={isEditingLayout ? handleFieldVisibilityToggle : undefined}
                  />
                </div>
              ) : !forceFlatLayout && showFieldSections && sectionedFields ? (
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
                // When forceFlatLayout, skip LookupFieldPicker for link/lookup to avoid React #185 in map (chunks 8357/8362).
                <div className="space-y-4 py-4">
                  {filteredFields.map((field) => {
                    const value = formData[field.name]
                    if (forceFlatLayout && (field.type === 'link_to_table' || field.type === 'lookup')) {
                      const display = value == null || value === '' ? '—' : Array.isArray(value) ? value.join(', ') : String(value)
                      return (
                        <div key={field.id} className="space-y-1.5">
                          <label className="text-sm font-medium text-gray-700">
                            {field.name}
                            {field.required && <span className="text-red-500 ml-0.5">*</span>}
                          </label>
                          <div className="px-3 py-2 rounded-md border border-gray-200 bg-gray-50/50 text-sm text-gray-700">
                            {display}
                          </div>
                        </div>
                      )
                    }
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

        {/* Footer: Comments area (if enabled) */}
        {showComments && recordId && !loading && formData && Object.keys(formData).length > 0 && (
          <div className="border-t px-6 py-4 flex-shrink-0">
            <RecordComments
              tableId={tableId}
              recordId={recordId}
              canAddComment={effectiveEditable}
            />
          </div>
        )}
      </DialogContent>

      {/* FieldSettingsDrawer overlay: when field label clicked, overlay modal (z-index above) */}
      {showFieldSettingsDrawer && selectedFieldForDrawer && (
        <>
          <div
            className="fixed inset-0 z-[59] bg-black/20"
            onClick={() => setSelectedContext(null)}
            aria-hidden="true"
          />
          <div className="fixed right-0 top-0 h-full w-[400px] z-[60] bg-white border-l border-gray-200 shadow-xl overflow-y-auto">
            <FieldSettingsDrawer
            field={selectedFieldForDrawer}
            open={true}
            onOpenChange={handleFieldSettingsDrawerOpenChange}
            tableId={tableId}
            tableFields={filteredFields}
            sections={sections}
            onSave={() => setSelectedContext(null)}
            embedded
            permissionsReadOnly={isViewOnly}
          />
          </div>
        </>
      )}
    </Dialog>
  )
}

