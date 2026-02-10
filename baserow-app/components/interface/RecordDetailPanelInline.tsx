"use client"

/**
 * Record Detail Panel Inline (Right Panel)
 *
 * Airtable-style inline record detail panel for Record View pages.
 * Single source of truth: field_layout drives everything.
 *
 * Modes:
 * - VIEW MODE: Fields are editable (if permissions allow), no drag handles
 * - LAYOUT MODE: Fields gain drag handles, can be reordered/hidden, record values visible but locked
 *
 * No split editor model - the record itself becomes the canvas.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Check, X, LayoutGrid } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import RecordFields from "@/components/records/RecordFields"
import { useToast } from "@/components/ui/use-toast"
import { useUserRole } from "@/lib/hooks/useUserRole"
import type { TableField } from "@/types/fields"
import type { FieldLayoutItem } from "@/lib/interface/field-layout-utils"
import {
  getVisibleFieldsFromLayout,
  getFieldGroupsFromLayout,
  isFieldEditableFromLayout,
  createInitialFieldLayout,
} from "@/lib/interface/field-layout-helpers"
import { isAbortError } from "@/lib/api/error-handling"
import { resolveRecordEditMode } from "@/lib/interface/resolve-record-edit-mode"

interface RecordDetailPanelInlineProps {
  pageId: string
  tableId: string | null
  recordId: string | null
  tableName: string | null
  fields: TableField[]
  fieldLayout: FieldLayoutItem[]
  pageEditable?: boolean
  interfaceMode?: "view" | "edit"
  onLayoutSave?: (fieldLayout: FieldLayoutItem[]) => Promise<void>
  titleField?: string
}

export default function RecordDetailPanelInline({
  pageId,
  tableId,
  recordId,
  tableName,
  fields,
  fieldLayout,
  pageEditable = true,
  interfaceMode = "view",
  onLayoutSave,
  titleField,
}: RecordDetailPanelInlineProps) {
  const { toast } = useToast()
  const { role } = useUserRole()
  const [record, setRecord] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Calculate canEditLayout before using it
  const canEditLayout = pageEditable && (role === "admin" || role === "member") && Boolean(onLayoutSave)
  
  // P1 FIX: interfaceMode === 'edit' is ABSOLUTE - no manual overrides allowed
  // When interfaceMode === 'edit', editing is forced (derived value, cannot be disabled)
  // When interfaceMode === 'view', allow manual toggle via state
  const forcedEditMode = resolveRecordEditMode({ interfaceMode, initialEditMode: false })
  const [manualEditMode, setManualEditMode] = useState(false)
  
  // P1 FIX: When forcedEditMode is true, ignore manualEditMode (no hybrid states)
  // Combined edit mode: forced OR manual (but forced takes absolute precedence)
  const isEditingLayout = forcedEditMode || (!forcedEditMode && manualEditMode)
  
  const [draftFieldLayout, setDraftFieldLayout] = useState<FieldLayoutItem[] | null>(null)
  const renderCountRef = useRef(0)
  renderCountRef.current += 1
  // #region agent log
  if (process.env.NODE_ENV === 'development') {
    console.count('[RecordDetailPanelInline] RENDER')
    if (renderCountRef.current <= 10 || renderCountRef.current % 10 === 0) {
      fetch('http://127.0.0.1:7242/ingest/7e9b68cb-9457-4ad2-a6ab-af4806759e7a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RecordDetailPanelInline.tsx:63',message:'RENDER',data:{renderCount:renderCountRef.current,recordId,interfaceMode,isEditingLayout,draftFieldLayoutLength:draftFieldLayout?.length,fieldLayoutLength:fieldLayout.length},timestamp:Date.now(),hypothesisId:'ALL'})}).catch(()=>{});
    }
  }
  // #endregion

  const resolvedFieldLayout = useMemo(() => {
    if (draftFieldLayout !== null) return draftFieldLayout
    return fieldLayout && fieldLayout.length > 0 ? fieldLayout : []
  }, [draftFieldLayout, fieldLayout])

  const visibleFields = useMemo(() => {
    return getVisibleFieldsFromLayout(resolvedFieldLayout, fields, "canvas")
  }, [resolvedFieldLayout, fields])

  const hasVisibleFields = visibleFields.length > 0

  const fieldGroups = useMemo(() => {
    return getFieldGroupsFromLayout(resolvedFieldLayout, fields, "canvas")
  }, [resolvedFieldLayout, fields])

  const isFieldEditable = useCallback(
    (fieldName: string) => {
      // In layout mode, fields are locked (not editable)
      if (isEditingLayout) return false
      // P1 FIX: When interfaceMode === 'edit', ALWAYS allow editing (absolute authority)
      // When interfaceMode === 'view', require pageEditable AND layout permissions
      if (forcedEditMode) return true
      if (!pageEditable) return false
      return isFieldEditableFromLayout(fieldName, resolvedFieldLayout, pageEditable)
    },
    [isEditingLayout, forcedEditMode, pageEditable, resolvedFieldLayout]
  )

  // P1 FIX: Reset manual edit mode when forcedEditMode becomes true
  useEffect(() => {
    if (forcedEditMode) {
      // When forced edit mode is active, disable manual edit mode (no override allowed)
      setManualEditMode(false)
    }
  }, [forcedEditMode])

  // CRITICAL: Initialize draftFieldLayout when entering edit mode
  // When interfaceMode === 'edit', ALWAYS initialize layout (even if empty)
  useEffect(() => {
    if (isEditingLayout && draftFieldLayout === null) {
      // If there's an existing layout, use it; otherwise create initial layout
      if (resolvedFieldLayout.length > 0) {
        setDraftFieldLayout([...resolvedFieldLayout])
      } else if (fields.length > 0) {
        // CRITICAL: When interfaceMode === 'edit', initialize layout even if empty
        // This allows editing layout from scratch
        setDraftFieldLayout(createInitialFieldLayout(fields, "record_review", pageEditable))
      }
    } else if (!isEditingLayout && draftFieldLayout !== null) {
      // Clear draft when exiting edit mode
      setDraftFieldLayout(null)
    }
  }, [isEditingLayout, resolvedFieldLayout, draftFieldLayout, fields, pageEditable])

  useEffect(() => {
    if (!tableId || !recordId || !tableName) {
      setRecord(null)
      return
    }

    let cancelled = false
    setLoading(true)

    async function loadRecord() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from(tableName!)
          .select("*")
          .eq("id", recordId)
          .single()

        if (cancelled) return
        if (error && !isAbortError(error)) throw error
        setRecord(data || null)
      } catch (err: any) {
        if (!cancelled && !isAbortError(err)) {
          console.error("Error loading record:", err)
          setRecord(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadRecord()
    return () => {
      cancelled = true
    }
  }, [tableId, recordId, tableName])

  const handleFieldChange = useCallback(
    async (fieldName: string, value: any) => {
      if (!recordId || !tableName) return

      try {
        const supabase = createClient()
        const { error } = await supabase
          .from(tableName)
          .update({ [fieldName]: value })
          .eq("id", recordId)

        if (error) throw error
        setRecord((prev) => (prev ? { ...prev, [fieldName]: value } : prev))
      } catch (err: any) {
        if (!isAbortError(err)) {
          toast({
            variant: "destructive",
            title: "Failed to save",
            description: err.message || "Please try again",
          })
        }
      }
    },
    [recordId, tableName, toast]
  )

  const handleFieldLayoutChange = useCallback((newLayout: FieldLayoutItem[]) => {
    if (isEditingLayout) {
      setDraftFieldLayout(newLayout)
    }
  }, [isEditingLayout])

  const handleFieldReorder = useCallback((fieldName: string, newIndex: number) => {
    if (draftFieldLayout === null) return
    
    const currentIndex = draftFieldLayout.findIndex(item => item.field_name === fieldName)
    if (currentIndex === -1) return

    const newLayout = [...draftFieldLayout]
    const [moved] = newLayout.splice(currentIndex, 1)
    newLayout.splice(newIndex, 0, moved)
    
    // Update order values
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
        ? { ...item, visible_in_canvas: visible }
        : item
    )

    // If field not in layout, add it
    if (!updated.some((item) => item.field_name === fieldName)) {
      const field = fields.find((f) => f.name === fieldName)
      if (field) {
        const newItem: FieldLayoutItem = {
          field_id: field.id,
          field_name: field.name,
          order: Math.max(...updated.map((i) => i.order), -1) + 1,
          editable: pageEditable,
          visible_in_canvas: visible,
        }
        updated.push(newItem)
      }
    }

    setDraftFieldLayout(updated)
  }, [draftFieldLayout, fields, pageEditable])

  const handleDoneEditLayout = useCallback(async () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7e9b68cb-9457-4ad2-a6ab-af4806759e7a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RecordDetailPanelInline.tsx:170',message:'handleDoneEditLayout CALLED',data:{hasOnLayoutSave:!!onLayoutSave,draftFieldLayoutLength:draftFieldLayout?.length},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    if (!onLayoutSave || draftFieldLayout === null) return

    setSaving(true)
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/7e9b68cb-9457-4ad2-a6ab-af4806759e7a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RecordDetailPanelInline.tsx:175',message:'Calling onLayoutSave',data:{draftFieldLayoutLength:draftFieldLayout.length},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      await onLayoutSave(draftFieldLayout)
      setDraftFieldLayout(null)
      // Only exit edit mode if not forced by interfaceMode
      if (!forcedEditMode) {
        setManualEditMode(false)
      }
      toast({ title: "Layout saved", description: "Detail panel layout has been updated." })
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Failed to save layout",
        description: err.message || "Please try again",
      })
    } finally {
      setSaving(false)
    }
  }, [onLayoutSave, draftFieldLayout, toast, forcedEditMode])

  const handleCancelEditLayout = useCallback(() => {
    // Only allow canceling if not forced by interfaceMode
    if (!forcedEditMode) {
      setManualEditMode(false)
      setDraftFieldLayout(null)
    }
  }, [forcedEditMode])

  const handleStartEditLayout = useCallback(() => {
    setManualEditMode(true)
    if (resolvedFieldLayout.length === 0 && fields.length > 0) {
      setDraftFieldLayout(createInitialFieldLayout(fields, "record_review", pageEditable))
    } else {
      setDraftFieldLayout([...resolvedFieldLayout])
    }
  }, [resolvedFieldLayout, fields, pageEditable])

  if (!tableId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 p-8">
        <p className="text-sm">No table selected. Configure the page in Settings.</p>
      </div>
    )
  }

  if (!recordId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 p-8">
        <p className="text-sm">Select a record from the list</p>
        <p className="text-xs text-gray-400 mt-1">Click a record to view its details</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p className="text-sm">Loading...</p>
      </div>
    )
  }

  if (!record || Object.keys(record).length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 p-8">
        <p className="text-sm">Record not found</p>
      </div>
    )
  }

  const showEditLayoutButton =
    interfaceMode !== "edit" && canEditLayout && !isEditingLayout && Boolean(onLayoutSave)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header with Edit Layout controls */}
      <div className="flex-shrink-0 flex items-center justify-between gap-2 px-4 py-2 border-b border-gray-200 bg-white">
        <h3 className="text-sm font-medium text-gray-900 truncate">
          {titleField && record[titleField] ? String(record[titleField]) : "Record details"}
        </h3>
        <div className="flex items-center gap-2">
          {isEditingLayout ? (
            <>
              {/* Layout mode: Show Done/Cancel only */}
              <button
                type="button"
                onClick={handleDoneEditLayout}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                Done
              </button>
              <button
                type="button"
                onClick={handleCancelEditLayout}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            </>
          ) : (
            <>
              {/* View mode: Show Edit layout button if allowed */}
              {showEditLayoutButton && (
                <button
                  type="button"
                  onClick={handleStartEditLayout}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium bg-muted hover:bg-muted/80 text-muted-foreground"
                  title="Edit layout"
                >
                  <LayoutGrid className="h-4 w-4" />
                  Edit layout
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Content - Single canvas, no split */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {hasVisibleFields ? (
          <RecordFields
            fields={visibleFields}
            formData={record}
            onFieldChange={handleFieldChange}
            fieldGroups={fieldGroups}
            tableId={tableId}
            recordId={recordId}
            tableName={tableName || ""}
            isFieldEditable={isFieldEditable}
            // Layout mode props
            layoutMode={isEditingLayout}
            fieldLayout={draftFieldLayout ?? resolvedFieldLayout}
            allFields={fields}
            onFieldReorder={handleFieldReorder}
            onFieldVisibilityToggle={handleFieldVisibilityToggle}
            onFieldLayoutChange={handleFieldLayoutChange}
            pageEditable={pageEditable}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500">
            <p className="text-sm font-medium">No fields in layout</p>
            <p className="text-xs mt-1">
              {canEditLayout
                ? "Click Edit layout to add and arrange fields in the detail panel."
                : "Ask an admin to configure the detail panel layout in Settings."}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
