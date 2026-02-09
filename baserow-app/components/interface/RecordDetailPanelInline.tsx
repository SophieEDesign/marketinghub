"use client"

/**
 * Record Detail Panel Inline (Right Panel)
 *
 * Airtable-style inline record detail panel for Record View pages.
 * Uses the SAME layout editor as RecordModal (RecordFields + RecordFieldEditorPanel).
 *
 * - Left: Record fields (visible_in_canvas from field_layout)
 * - Right (when editing layout): RecordFieldEditorPanel for drag/drop, groups, text blocks
 * - Single source of truth: field_layout
 */

import { useState, useEffect, useMemo, useCallback } from "react"
import { Pencil, Check, X, LayoutGrid } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import RecordFields from "@/components/records/RecordFields"
import RecordFieldEditorPanel from "./RecordFieldEditorPanel"
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
  const [isEditingLayout, setIsEditingLayout] = useState(interfaceMode === "edit")
  const [draftFieldLayout, setDraftFieldLayout] = useState<FieldLayoutItem[] | null>(null)

  const canEditLayout = pageEditable && (role === "admin" || role === "member") && Boolean(onLayoutSave)

  const resolvedFieldLayout = useMemo(() => {
    if (draftFieldLayout !== null) return draftFieldLayout
    return fieldLayout && fieldLayout.length > 0 ? fieldLayout : []
  }, [draftFieldLayout, fieldLayout])

  const visibleFields = useMemo(() => {
    return getVisibleFieldsFromLayout(resolvedFieldLayout, fields, "canvas")
  }, [resolvedFieldLayout, fields])

  const fieldGroups = useMemo(() => {
    return getFieldGroupsFromLayout(resolvedFieldLayout, fields, "canvas")
  }, [resolvedFieldLayout, fields])

  const isFieldEditable = useCallback(
    (fieldName: string) => {
      if (!pageEditable) return false
      return isFieldEditableFromLayout(fieldName, resolvedFieldLayout, pageEditable)
    },
    [pageEditable, resolvedFieldLayout]
  )

  useEffect(() => {
    if (interfaceMode === "edit") {
      setIsEditingLayout(true)
      if (resolvedFieldLayout.length === 0 && fields.length > 0) {
        setDraftFieldLayout(createInitialFieldLayout(fields, "record_review", pageEditable))
      } else if (resolvedFieldLayout.length > 0) {
        setDraftFieldLayout([...resolvedFieldLayout])
      }
    } else {
      setIsEditingLayout(false)
      setDraftFieldLayout(null)
    }
  }, [interfaceMode])

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
    setDraftFieldLayout(newLayout)
  }, [])

  const handleDoneEditLayout = useCallback(async () => {
    if (!onLayoutSave || draftFieldLayout === null) return

    setSaving(true)
    try {
      await onLayoutSave(draftFieldLayout)
      setDraftFieldLayout(null)
      setIsEditingLayout(false)
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
  }, [onLayoutSave, draftFieldLayout, toast])

  const handleCancelEditLayout = useCallback(() => {
    setDraftFieldLayout(null)
    setIsEditingLayout(false)
  }, [])

  const handleStartEditLayout = useCallback(() => {
    setIsEditingLayout(true)
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
      {canEditLayout && (
        <div className="flex-shrink-0 flex items-center justify-between gap-2 px-4 py-2 border-b border-gray-200 bg-white">
          <h3 className="text-sm font-medium text-gray-900 truncate">
            {titleField && record[titleField] ? String(record[titleField]) : "Record details"}
          </h3>
          <div className="flex items-center gap-2">
            {isEditingLayout ? (
              <>
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
              showEditLayoutButton && (
                <button
                  type="button"
                  onClick={handleStartEditLayout}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium bg-muted hover:bg-muted/80 text-muted-foreground"
                  title="Edit detail panel layout"
                >
                  <LayoutGrid className="h-4 w-4" />
                  Edit interface
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {isEditingLayout ? (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <RecordFields
                fields={visibleFields}
                formData={record}
                onFieldChange={handleFieldChange}
                fieldGroups={fieldGroups}
                tableId={tableId}
                recordId={recordId}
                tableName={tableName || ""}
                isFieldEditable={isFieldEditable}
              />
            </div>
            <div className="w-80 flex-shrink-0 border-l overflow-y-auto bg-gray-50">
              <RecordFieldEditorPanel
                tableId={tableId}
                recordId={recordId}
                allFields={fields}
                fieldLayout={draftFieldLayout ?? resolvedFieldLayout}
                onFieldLayoutChange={handleFieldLayoutChange}
                onFieldChange={handleFieldChange}
                pageEditable={pageEditable}
                mode="record_review"
              />
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <RecordFields
              fields={visibleFields}
              formData={record}
              onFieldChange={handleFieldChange}
              fieldGroups={fieldGroups}
              tableId={tableId}
              recordId={recordId}
              tableName={tableName || ""}
              isFieldEditable={isFieldEditable}
            />
          </div>
        )}
      </div>
    </div>
  )
}
