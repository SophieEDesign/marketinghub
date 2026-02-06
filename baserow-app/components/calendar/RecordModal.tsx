"use client"

import { useState, useEffect, useMemo, useCallback } from 'react'
import { ArrowLeft, Save, Trash2, ChevronDown, ChevronRight, Pencil, Check, LayoutGrid } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { TableField } from '@/types/fields'
import FieldEditor from '@/components/fields/FieldEditor'
import { useToast } from '@/components/ui/use-toast'
import { isAbortError } from '@/lib/api/error-handling'
import ModalCanvas from '@/components/interface/ModalCanvas'
import type { BlockConfig, PageBlock } from '@/lib/interface/types'
import { sectionAndSortFields } from '@/lib/fields/sectioning'
import { useRecordEditorCore, type RecordEditorCascadeContext } from '@/lib/interface/record-editor-core'
import { useUserRole } from '@/lib/hooks/useUserRole'

export interface RecordModalProps {
  open: boolean
  onClose: () => void
  tableId: string
  recordId: string | null
  /** When omitted, the record editor core will fetch fields from the API */
  tableFields?: TableField[]
  modalFields?: string[] // Fields to show in modal (if empty, show all)
  initialData?: Record<string, any> // Initial data for creating new records
  onSave?: (createdRecordId?: string | null) => void // Callback with created record ID for new records
  onDeleted?: () => void | Promise<void>
  supabaseTableName?: string | null // Optional: if provided, skips table info fetch for faster loading
  modalLayout?: BlockConfig['modal_layout'] // Custom modal layout
  showFieldSections?: boolean // Optional: show fields grouped by sections (default: false)
  /** Optional: when provided, permission flags from cascade are applied (edit/create/delete). */
  cascadeContext?: RecordEditorCascadeContext | null
  /** When true, show "Edit layout" in header; requires onLayoutSave when using custom modal layout. */
  canEditLayout?: boolean
  /** Called when user saves layout in edit mode (Done). */
  onLayoutSave?: (modalLayout: BlockConfig['modal_layout']) => void
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
  showFieldSections = false,
  cascadeContext,
  canEditLayout = false,
  onLayoutSave,
}: RecordModalProps) {
  const { toast } = useToast()
  const { role } = useUserRole()
  const [isModalEditing, setIsModalEditing] = useState(false)
  const [isEditingLayout, setIsEditingLayout] = useState(false)
  const [draftBlocks, setDraftBlocks] = useState<PageBlock[] | null>(null)

  useEffect(() => {
    if (!open) {
      setIsModalEditing(false)
      setIsEditingLayout(false)
      setDraftBlocks(null)
    }
  }, [open])

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

  // View mode: show Edit button and gate editing on isModalEditing. Create mode: always editable when canCreateRecords.
  const isViewMode = recordId != null
  const canShowEditButton = isViewMode && (role === 'admin' || canEditRecords)
  const effectiveEditable = isViewMode
    ? canShowEditButton && isModalEditing
    : canCreateRecords

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

  // Memoize blocks for ModalCanvas - must be at top level (before early return)
  const modalBlocks = useMemo(() => {
    if (!modalLayout?.blocks || modalLayout.blocks.length === 0) {
      return []
    }
    return modalLayout.blocks.map((block, index) => ({
      id: block.id,
      page_id: '',
      type: block.type,
      x: block.x,
      y: block.y,
      w: block.w,
      h: block.h,
      config: {
        ...block.config,
        field_id: block.type === 'field' 
          ? tableFields.find(f => f.name === block.fieldName || f.id === block.fieldName)?.id
          : undefined,
        field_name: block.fieldName,
      },
      order_index: index,
      created_at: '',
    })) as PageBlock[]
  }, [modalLayout?.blocks, tableFields])

  const hasCustomLayout = Boolean(modalLayout?.blocks && modalLayout.blocks.length > 0)
  // Show "Edit layout" when we have a custom layout and a save callback; canEditLayout gates actual persistence on Done
  const showEditLayoutButton = hasCustomLayout && Boolean(onLayoutSave) && !isEditingLayout
  const blocksForCanvas = isEditingLayout && draftBlocks !== null ? draftBlocks : modalBlocks

  const handleStartEditLayout = useCallback(() => {
    setIsEditingLayout(true)
    setDraftBlocks([...modalBlocks])
  }, [modalBlocks])

  const handleDoneEditLayout = useCallback(() => {
    if (!onLayoutSave || draftBlocks === null || !canEditLayout) return
    const cols = modalLayout?.layoutSettings?.cols ?? 8
    const newModalLayout: BlockConfig['modal_layout'] = {
      blocks: draftBlocks.map((b, index) => ({
        id: b.id,
        type: (b.type === 'field' || b.type === 'text' || b.type === 'divider' || b.type === 'image') ? b.type : 'field',
        fieldName: (b.config as any)?.field_name ?? (b as any).fieldName,
        x: 0,
        y: index,
        w: typeof cols === 'number' ? cols : 8,
        h: b.h ?? 4,
        config: b.config,
      })),
      layoutSettings: modalLayout?.layoutSettings,
    }
    onLayoutSave(newModalLayout)
    setIsEditingLayout(false)
    setDraftBlocks(null)
  }, [onLayoutSave, canEditLayout, draftBlocks, modalLayout?.layoutSettings])

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
    const available = tableFields.find((f) => f.name !== 'id' && !usedNames.has(f.name))
    if (!available) return
    const newBlock: PageBlock = {
      id: `field-${available.id}-${Date.now()}`,
      page_id: '',
      type: 'field',
      x: 0,
      y: current.length,
      w: 8,
      h: 4,
      config: { field_id: available.id, field_name: available.name },
      order_index: current.length,
      created_at: '',
    }
    if (insertAfterBlockId === null) {
      setDraftBlocks([...current, newBlock])
    } else {
      const idx = current.findIndex((b) => b.id === insertAfterBlockId)
      const insertAt = idx < 0 ? current.length : idx + 1
      const next = [...current]
      next.splice(insertAt, 0, newBlock)
      setDraftBlocks(next.map((b, i) => ({ ...b, y: i, order_index: i })))
    }
  }, [draftBlocks, modalBlocks, tableFields])

  // Section fields if showFieldSections is enabled (filteredFields from core)
  const sectionedFields = useMemo(() => {
    if (!showFieldSections) return null
    return sectionAndSortFields(filteredFields)
  }, [filteredFields, showFieldSections])

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
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
                  Done
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
                {canShowEditButton && (
                  <Button
                    type="button"
                    variant={isModalEditing ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setIsModalEditing((v) => !v)}
                    className="inline-flex items-center gap-1.5"
                    aria-label={isModalEditing ? 'Done editing' : 'Edit record'}
                    title={isModalEditing ? 'Done editing' : 'Edit record'}
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
                  </Button>
                )}
              </>
            )}
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!recordId || deleting || saving || loading || !canDeleteRecords}
              title={!canDeleteRecords ? "You don't have permission to delete this record" : "Delete this record"}
              aria-disabled={!recordId || !canDeleteRecords || deleting || saving || loading}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
            <Button variant="outline" onClick={onClose} disabled={deleting || saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || loading || !(recordId ? (canSave && effectiveEditable) : canSave)}
              title={!canSave ? (recordId ? "You don't have permission to edit this record" : "You don't have permission to create records") : recordId && !effectiveEditable ? "Click Edit to make changes" : undefined}
              aria-disabled={saving || loading || !canSave}
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto px-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500">Loading...</div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {/* Use custom layout if available, otherwise fall back to simple field list */}
              {hasCustomLayout ? (
                <div className="min-h-[400px]">
                  <ModalCanvas
                    mode={isEditingLayout ? 'edit' : 'view'}
                    blocks={blocksForCanvas}
                    tableId={tableId}
                    recordId={recordId}
                    tableName={effectiveTableName || ''}
                    tableFields={tableFields}
                    pageEditable={effectiveEditable}
                    editableFieldNames={tableFields.map(f => f.name)}
                    onFieldChange={handleFieldChange}
                    layoutSettings={modalLayout?.layoutSettings}
                    onLayoutChange={isEditingLayout ? handleLayoutChange : undefined}
                    onRemoveBlock={isEditingLayout ? handleRemoveBlock : undefined}
                    onAddField={isEditingLayout ? handleAddField : undefined}
                  />
                </div>
              ) : showFieldSections && sectionedFields ? (
                // Render with sections
                sectionedFields.map(([sectionName, sectionFields]) => {
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
                })
              ) : (
                // Render flat list (default behavior)
                filteredFields.map((field) => {
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
                })
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

