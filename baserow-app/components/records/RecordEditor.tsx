"use client"

/**
 * RecordEditor — unified core component for record editing across all surfaces.
 * Renders in different modes: modal (full edit), review (read-first, lightweight).
 * Grid inline editing uses CellFactory, NOT RecordEditor.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Maximize2, ChevronDown, ChevronRight, ArrowLeft, Save, Trash2, X, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import FieldEditor from "@/components/fields/FieldEditor"
import RecordFields from "@/components/records/RecordFields"
import RecordActivity from "@/components/records/RecordActivity"
import RecordComments from "@/components/records/RecordComments"
import { useRecordEditorCore, type RecordEditorCascadeContext } from "@/lib/interface/record-editor-core"
import type { FieldLayoutItem } from "@/lib/interface/field-layout-utils"
import {
  getVisibleFieldsFromLayout,
  isFieldEditableFromLayout,
  getFieldGroupsFromLayout,
  convertModalLayoutToFieldLayout,
  convertModalFieldsToFieldLayout,
} from "@/lib/interface/field-layout-helpers"
import { getPrimaryFieldName } from "@/lib/fields/primary"
import { sectionAndSortFields } from "@/lib/fields/sectioning"
import { useSelectionContext } from "@/contexts/SelectionContext"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import { useToast } from "@/components/ui/use-toast"
import { isAbortError } from "@/lib/api/error-handling"
import { createClient } from "@/lib/supabase/client"
import type { TableField } from "@/types/fields"

export interface RecordEditorProps {
  recordId: string | null
  tableId: string
  mode: "inline" | "modal" | "review"
  fieldLayoutConfig?: FieldLayoutItem[] | null
  tableFields?: TableField[] | null
  supabaseTableName?: string | null
  cascadeContext?: RecordEditorCascadeContext | null
  initialData?: Record<string, any>
  /** Only load when true (e.g. modal/panel open) */
  active?: boolean
  onSave?: (createdRecordId?: string | null) => void
  onDeleted?: () => void | Promise<void>
  /** Modal shell: called when user clicks Back, Cancel, or Close */
  onClose?: () => void
  /** Modal-only: layout editing */
  canEditLayout?: boolean
  onLayoutSave?: (layout: FieldLayoutItem[]) => void | Promise<void>
  /** Review-only: "Open in modal" callback */
  onOpenModal?: () => void
  /** Review-only: called when user duplicates record, with new record id */
  onRecordDuplicate?: (newRecordId: string) => void
  /** Modal-only: show comments in footer */
  showComments?: boolean
  /** Modal-only: show fields grouped by sections */
  showFieldSections?: boolean
  /** Modal-only: skip RecordFields, use flat FieldEditor list */
  forceFlatLayout?: boolean
  /** Interface mode: 'edit' allows layout editing when canEditLayout */
  interfaceMode?: "view" | "edit"
  /** For modal: render header actions (close, delete, save) - set false when shell provides them */
  renderHeaderActions?: boolean
  /** @deprecated Use fieldLayoutConfig. Backward compat: custom modal layout. */
  modalLayout?: { blocks?: Array<{ fieldName?: string; y?: number; config?: any }> }
  /** @deprecated Use fieldLayoutConfig. Backward compat: field names to show. */
  modalFields?: string[]
  /** Visibility context for field_layout: 'modal' (default) or 'canvas' (RecordDetailPanelInline). */
  visibilityContext?: "modal" | "canvas"
  /** Override: when false, fields are read-only regardless of permissions. Used by RecordDetailPanelInline. */
  allowEdit?: boolean
  /** Optional content to render below comments in review mode (e.g. InterfaceBuilder blocks). */
  renderExtraContent?: React.ReactNode
}

export default function RecordEditor({
  recordId,
  tableId,
  mode,
  fieldLayoutConfig,
  tableFields,
  supabaseTableName,
  cascadeContext,
  initialData,
  active = true,
  onSave,
  onDeleted,
  onClose,
  canEditLayout = false,
  onLayoutSave,
  onOpenModal,
  onRecordDuplicate,
  showComments = true,
  showFieldSections = false,
  forceFlatLayout = false,
  interfaceMode = "view",
  renderHeaderActions = true,
  modalLayout,
  modalFields = [],
  visibilityContext = "modal",
  allowEdit = true,
  renderExtraContent,
}: RecordEditorProps) {
  const { selectedContext, setSelectedContext } = useSelectionContext()
  const { toast } = useToast()
  const { setFieldLayout: setLiveFieldLayout } = useRecordPanel()

  const core = useRecordEditorCore({
    tableId,
    recordId,
    supabaseTableName,
    tableFields: tableFields ?? undefined,
    fieldLayout: fieldLayoutConfig ?? undefined,
    modalLayout: fieldLayoutConfig?.length ? undefined : modalLayout,
    modalFields: fieldLayoutConfig?.length ? undefined : modalFields,
    visibilityContext,
    initialData,
    active,
    cascadeContext,
    onSave,
    onDeleted,
    saveOnFieldChange: true,
  })

  const {
    loading,
    formData,
    fields: filteredFields,
    allFields,
    effectiveTableName,
    saving,
    deleting,
    save,
    deleteRecord,
    handleFieldChange,
    canEditRecords,
    canCreateRecords,
    canDeleteRecords,
    saveOnFieldChange,
    isDirty,
    hasDraftToRestore,
    restoreDraft,
    clearDraft,
  } = core

  const canSave = recordId ? canEditRecords : canCreateRecords
  // Allow field editing when permissions allow, in both view and edit mode (Airtable-style).
  const effectiveEditable =
    !allowEdit
      ? false
      : canSave
  const [contentReady, setContentReady] = useState(false)
  const contentReadyRef = useRef(false)

  useEffect(() => {
    if (!isDirty) return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = "You have unsaved changes. Leave anyway?"
      return "You have unsaved changes. Leave anyway?"
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [isDirty])

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
    if (!active || loading) {
      contentReadyRef.current = false
      setContentReady(false)
    }
  }, [active, loading, recordId, formData, filteredFields.length])

  const permissions = (cascadeContext?.blockConfig as any)?.permissions ?? (cascadeContext?.pageConfig as any)?.permissions ?? {}
  const isViewOnly = permissions.mode === "view"

  const recordTitle = useMemo(() => {
    if (!recordId || !formData) return null
    const primaryName = getPrimaryFieldName(filteredFields)
    if (primaryName && formData[primaryName] != null && formData[primaryName] !== "") {
      return String(formData[primaryName])
    }
    return null
  }, [recordId, formData, filteredFields])

  const resolvedFieldLayout = useMemo(() => {
    if (fieldLayoutConfig && fieldLayoutConfig.length > 0) return fieldLayoutConfig
    if (modalLayout?.blocks && modalLayout.blocks.length > 0 && allFields.length > 0) {
      return convertModalLayoutToFieldLayout(modalLayout, allFields)
    }
    if (modalFields && modalFields.length > 0 && allFields.length > 0) {
      return convertModalFieldsToFieldLayout(modalFields, allFields)
    }
    return []
  }, [fieldLayoutConfig, modalLayout, modalFields, allFields])

  const visibleFields = useMemo(() => {
    if (!recordId || resolvedFieldLayout.length === 0) return filteredFields
    return getVisibleFieldsFromLayout(resolvedFieldLayout, filteredFields, visibilityContext)
  }, [recordId, resolvedFieldLayout, filteredFields, visibilityContext])

  const fieldGroups = useMemo(() => {
    if (!recordId || resolvedFieldLayout.length === 0) return {}
    return getFieldGroupsFromLayout(resolvedFieldLayout, filteredFields, visibilityContext)
  }, [recordId, resolvedFieldLayout, filteredFields, visibilityContext])

  const [localFieldLayout, setLocalFieldLayout] = useState<FieldLayoutItem[]>([])
  const resolvedLayoutSignatureRef = useRef<string>("")
  useEffect(() => {
    const visKey = visibilityContext === "canvas" ? "visible_in_canvas" : "visible_in_modal"
    const sig = JSON.stringify(resolvedFieldLayout.map((i) => [i.field_name, i.order, (i as any)[visKey]]))
    if (resolvedLayoutSignatureRef.current === sig) return
    resolvedLayoutSignatureRef.current = sig
    setLocalFieldLayout(resolvedFieldLayout)
  }, [resolvedFieldLayout, visibilityContext])

  const isEditingLayout =
    interfaceMode === "edit" &&
    canEditLayout &&
    !isViewOnly &&
    Boolean(onLayoutSave) &&
    !!recordId
  // #region agent log
  if (mode === "review" && recordId) {
    fetch('http://127.0.0.1:7242/ingest/7e9b68cb-9457-4ad2-a6ab-af4806759e7a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RecordEditor.tsx:isEditingLayout',message:'Layout mode check',data:{interfaceMode,canEditLayout,isViewOnly,hasOnLayoutSave:Boolean(onLayoutSave),resolvedFieldLayoutLen:resolvedFieldLayout.length,hasRecordId:!!recordId,isEditingLayout},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
  }
  // #endregion
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

  const isFieldEditable = useCallback(
    (fieldName: string) => {
      if (!effectiveEditable) return false
      if (!recordId || resolvedFieldLayout.length === 0) return effectiveEditable
      return isFieldEditableFromLayout(fieldName, resolvedFieldLayout, effectiveEditable)
    },
    [effectiveEditable, recordId, resolvedFieldLayout]
  )

  const handleFieldLabelClick = useCallback(
    (fieldId: string) => {
      if (isEditingLayout) return
      setSelectedContext({ type: "field", fieldId, tableId })
    },
    [setSelectedContext, tableId, isEditingLayout]
  )


  const handleFieldLayoutChange = useCallback(
    (newLayout: FieldLayoutItem[]) => {
      setLocalFieldLayout(newLayout)
      setLiveFieldLayout(newLayout)
      onLayoutSave?.(newLayout)
    },
    [onLayoutSave, setLiveFieldLayout]
  )

  const handleFieldVisibilityToggle = useCallback(
    (fieldName: string, visible: boolean) => {
      const key = visibilityContext === "canvas" ? "visible_in_canvas" : "visible_in_modal"
      const updated = localFieldLayout.map((item) =>
        item.field_name === fieldName ? { ...item, [key]: visible } : item
      )
      setLocalFieldLayout(updated)
      setLiveFieldLayout(updated)
      onLayoutSave?.(updated)
    },
    [localFieldLayout, onLayoutSave, visibilityContext, setLiveFieldLayout]
  )

  const handleFieldSelect = useCallback(
    (fieldId: string) => {
      setSelectedContext({ type: "field", fieldId, tableId })
    },
    [setSelectedContext, tableId]
  )

  const handleFieldSpanToggle = useCallback(
    (fieldName: string) => {
      const updated = localFieldLayout.map((item) => {
        if (item.field_name !== fieldName) return item
        const newSpan = (item.modal_column_span === 2 ? 1 : 2) as 1 | 2
        return {
          ...item,
          modal_column_span: newSpan,
          // When shrinking to single column, assign to col-1 if currently full-width
          ...(newSpan === 1 && item.modal_column_span === 2
            ? { modal_column_id: item.modal_column_id || "col-1" }
            : {}),
        }
      })
      setLocalFieldLayout(updated)
      setLiveFieldLayout(updated)
      onLayoutSave?.(updated)
    },
    [localFieldLayout, onLayoutSave, setLiveFieldLayout]
  )

  const prevInterfaceModeRef = useRef(interfaceMode)
  useEffect(() => {
    if (prevInterfaceModeRef.current === "edit" && interfaceMode !== "edit") {
      onLayoutSave?.(localFieldLayout)
    }
    prevInterfaceModeRef.current = interfaceMode
  }, [interfaceMode, localFieldLayout, onLayoutSave])

  const sectionedFields = useMemo(() => {
    if (!showFieldSections) return null
    return sectionAndSortFields(filteredFields)
  }, [filteredFields, showFieldSections])

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => new Set())

  const handleSave = useCallback(async () => {
    try {
      await save()
    } catch (e: any) {
      if (!isAbortError(e)) {
        const message = e?.message || "Unknown error"
        const code = e?.code ? ` (code: ${e.code})` : ""
        toast({
          variant: "destructive",
          title: "Failed to save record",
          description: `${message}${code}`,
        })
      }
    }
  }, [save, toast])

  const handleDuplicate = useCallback(async () => {
    if (!recordId || !effectiveTableName || !formData || Object.keys(formData).length === 0) return
    try {
      const supabase = createClient()
      const { id, created_at, updated_at, ...recordData } = formData
      const { data, error } = await supabase
        .from(effectiveTableName)
        .insert([recordData])
        .select()
        .single()
      if (error) throw error
      toast({ title: "Record duplicated", description: "A copy has been created.", variant: "success" })
      onRecordDuplicate?.(data?.id)
    } catch (e: any) {
      if (!isAbortError(e)) {
        toast({ variant: "destructive", title: "Failed to duplicate", description: e?.message || "Please try again" })
      }
    }
  }, [recordId, effectiveTableName, formData, toast, onRecordDuplicate])

  const handleDelete = useCallback(async () => {
    if (!canDeleteRecords) {
      toast({
        variant: "destructive",
        title: "Not allowed",
        description: "You don't have permission to delete this record.",
      })
      return
    }
    try {
      await deleteRecord({
        confirmMessage: "Are you sure you want to delete this record? This action cannot be undone.",
      })
    } catch (e: any) {
      if (!isAbortError(e)) {
        toast({
          variant: "destructive",
          title: "Failed to delete record",
          description: e?.message || "Please try again",
        })
      }
    }
  }, [deleteRecord, canDeleteRecords, toast])

  if (mode === "inline") {
    return null
  }

  const renderFieldsContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-500">Loading...</div>
        </div>
      )
    }
    if (recordId && (!formData || Object.keys(formData).length === 0) && !hasDraftToRestore) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-500">Record not found</div>
        </div>
      )
    }
    if (filteredFields.length === 0 || !contentReady) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-500">Preparing fields…</div>
        </div>
      )
    }

    if (mode === "review") {
      const hasVisibleFields = (isEditingLayout ? layoutModeFields : visibleFields).length > 0
      if (!hasVisibleFields && !isEditingLayout) {
        return (
          <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500">
            <p className="text-sm font-medium">No fields in layout</p>
            <p className="text-xs mt-1">
              {canEditLayout
                ? "Use the right panel to add and arrange fields."
                : "Ask an admin to configure the detail panel layout in Settings."}
            </p>
          </div>
        )
      }
      // Record view (canvas): stacked layout only - fields resizable by drag/reorder, no fixed columns.
      // Modal: allow grid layout when field_layout has column metadata for drag/resize between columns.
      const hasColumnMetadata = resolvedFieldLayout.some(
        (i) => i.modal_column_id != null || i.modal_column_span != null || i.modal_row_order != null
      )
      const useGridLayout =
        visibilityContext !== "canvas" &&
        resolvedFieldLayout.length > 0 &&
        (hasColumnMetadata || isEditingLayout)
      return (
        <div className="space-y-4 py-4">
          <RecordFields
            fields={isEditingLayout ? layoutModeFields : visibleFields}
            formData={formData}
            onFieldChange={handleFieldChange}
            fieldGroups={fieldGroups}
            tableId={tableId}
            recordId={recordId || ""}
            tableName={effectiveTableName || ""}
            isFieldEditable={isFieldEditable}
            fieldLayout={localFieldLayout.length > 0 ? localFieldLayout : resolvedFieldLayout}
            allFields={filteredFields}
            pageEditable={effectiveEditable}
            onFieldLabelClick={handleFieldLabelClick}
            layoutMode={isEditingLayout}
            onFieldLayoutChange={isEditingLayout ? handleFieldLayoutChange : undefined}
            onFieldSelect={isEditingLayout ? handleFieldSelect : undefined}
            onFieldSpanToggle={isEditingLayout ? handleFieldSpanToggle : undefined}
            visibilityContext={visibilityContext}
            selectedFieldId={selectedContext?.type === "field" ? selectedContext.fieldId : null}
            forceStackedLayout={!useGridLayout}
          />
        </div>
      )
    }

    if (!forceFlatLayout && resolvedFieldLayout.length > 0 && recordId) {
      return (
        <div className="space-y-4 py-4">
          <RecordFields
            fields={visibleFields}
            formData={formData}
            onFieldChange={handleFieldChange}
            fieldGroups={fieldGroups}
            tableId={tableId}
            recordId={recordId}
            tableName={effectiveTableName || ""}
            isFieldEditable={isFieldEditable}
            fieldLayout={resolvedFieldLayout}
            allFields={filteredFields}
            pageEditable={effectiveEditable}
            onFieldLabelClick={handleFieldLabelClick}
            layoutMode={false}
            visibilityContext={visibilityContext}
            selectedFieldId={selectedContext?.type === "field" ? selectedContext.fieldId : null}
            forceStackedLayout={true}
          />
        </div>
      )
    }

    if (!forceFlatLayout && showFieldSections && sectionedFields) {
      return (
        <div className="space-y-4 py-4">
          {sectionedFields.map(([sectionName, sectionFields]) => {
            const isCollapsed = collapsedSections.has(sectionName)
            return (
              <div key={sectionName} className="space-y-2">
                <button
                  type="button"
                  onClick={() =>
                    setCollapsedSections((prev) => {
                      const next = new Set(prev)
                      if (next.has(sectionName)) next.delete(sectionName)
                      else next.add(sectionName)
                      return next
                    })
                  }
                  className="w-full flex items-center justify-between text-left py-1 -mx-1 px-1 rounded-md hover:bg-gray-50"
                >
                  <span className="text-sm font-semibold text-gray-900">{sectionName}</span>
                  {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {!isCollapsed &&
                  sectionFields.map((field) => (
                    <FieldEditor
                      key={field.id}
                      field={field}
                      value={formData[field.name]}
                      onChange={(v) => handleFieldChange(field.name, v)}
                      required={field.required || false}
                      recordId={recordId || undefined}
                      tableName={effectiveTableName || undefined}
                      isReadOnly={!effectiveEditable}
                    />
                  ))}
              </div>
            )
          })}
        </div>
      )
    }

    return (
      <div className="space-y-4 py-4">
        {filteredFields.map((field) => (
          <FieldEditor
            key={field.id}
            field={field}
            value={formData[field.name]}
            onChange={(v) => handleFieldChange(field.name, v)}
            required={field.required || false}
            recordId={recordId || undefined}
            tableName={effectiveTableName || undefined}
            isReadOnly={!effectiveEditable}
          />
        ))}
      </div>
    )
  }

  const showHeader = mode === "modal" && renderHeaderActions
  const showReviewHeader = mode === "review"

  return (
    <div className="flex flex-col min-h-full w-full">
      {showHeader && (
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-white">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 flex-shrink-0" aria-label="Back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="min-w-0 flex-1 truncate text-lg font-semibold">
              {recordId ? (recordTitle || "Record Details") : "Create New Record"}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {recordId && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting || saving || loading || !canDeleteRecords}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            )}
            {onClose && (
              <Button variant="outline" onClick={onClose} disabled={deleting || saving}>
                {saveOnFieldChange && recordId ? "Close" : "Cancel"}
              </Button>
            )}
            {(!saveOnFieldChange || !recordId) && (
              <Button onClick={handleSave} disabled={saving || loading || !canSave}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save"}
              </Button>
            )}
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0" aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {showReviewHeader && (
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-gray-50">
          <div className="min-w-0 flex-1 truncate font-medium">
            {recordTitle || "Record Details"}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {interfaceMode === "edit" && canSave && (!saveOnFieldChange || !recordId) && (
              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
                disabled={saving || loading}
                className="gap-1.5"
              >
                <Save className="h-4 w-4" />
                Save
              </Button>
            )}
            {onRecordDuplicate && recordId && canEditRecords && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDuplicate}
                className="gap-1.5"
                title="Duplicate record"
              >
                <Copy className="h-4 w-4" />
                Duplicate
              </Button>
            )}
            {onOpenModal && (
              <Button variant="outline" size="sm" onClick={onOpenModal} className="gap-1.5">
                <Maximize2 className="h-4 w-4" />
                Open in modal
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Content stacks naturally so section headers + fields push comments down; parent scrolls */}
      <div className="flex-shrink-0 flex flex-col overflow-visible px-6">
        {hasDraftToRestore && (
          <div className="mb-4 flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <span>You have an unsaved draft. Restore it?</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={restoreDraft}>
                Restore draft
              </Button>
              <Button variant="ghost" size="sm" onClick={clearDraft}>
                Discard
              </Button>
            </div>
          </div>
        )}
        {renderFieldsContent()}
      </div>

      {mode === "modal" && showComments && recordId && !loading && formData && Object.keys(formData).length > 0 && (
        <div className="border-t border-dashed border-gray-200 px-6 py-4 flex-shrink-0">
          <RecordComments tableId={tableId} recordId={recordId} canAddComment={effectiveEditable} />
        </div>
      )}

      {mode === "review" && recordId && (
        <>
          {renderExtraContent && (
            <div className="border-t flex-shrink-0 overflow-visible">
              {renderExtraContent}
            </div>
          )}
          <div className="border-t border-dashed border-gray-200 px-6 py-4 flex-shrink-0">
            <RecordActivity record={formData} tableId={tableId} />
          </div>
          <div className="border-t border-dashed border-gray-200 px-6 py-4 flex-shrink-0">
            <RecordComments tableId={tableId} recordId={recordId} canAddComment={effectiveEditable} />
          </div>
        </>
      )}

    </div>
  )
}
