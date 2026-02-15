"use client"

/**
 * Record Detail Panel Inline (Right Panel)
 *
 * Airtable-style inline record detail panel for Record View pages.
 * Single source of truth: field_layout drives everything.
 *
 * Layout editing moved to RightSettingsPanel (RecordLayoutSettings).
 * Field label click opens FieldSchemaSettings in RightSettingsPanel.
 */

import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import RecordFields from "@/components/records/RecordFields"
import RecordComments from "@/components/records/RecordComments"
import { useToast } from "@/components/ui/use-toast"
import { useUserRole } from "@/lib/hooks/useUserRole"
import type { TableField } from "@/types/fields"
import type { FieldLayoutItem } from "@/lib/interface/field-layout-utils"
import {
  getVisibleFieldsFromLayout,
  getFieldGroupsFromLayout,
  isFieldEditableFromLayout,
} from "@/lib/interface/field-layout-helpers"
import { isAbortError } from "@/lib/api/error-handling"
import { resolveRecordEditMode } from "@/lib/interface/resolve-record-edit-mode"
import { useSelectionContext } from "@/contexts/SelectionContext"

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
  const { setSelectedContext } = useSelectionContext()
  const [record, setRecord] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(false)
  
  // P1 FIX: interfaceMode === 'edit' is ABSOLUTE - no manual overrides allowed
  const forcedEditMode = resolveRecordEditMode({ interfaceMode, initialEditMode: false })

  const resolvedFieldLayout = useMemo(() => {
    return fieldLayout && fieldLayout.length > 0 ? fieldLayout : []
  }, [fieldLayout])

  const visibleFields = useMemo(() => {
    return getVisibleFieldsFromLayout(resolvedFieldLayout, fields, "canvas")
  }, [resolvedFieldLayout, fields])

  const hasVisibleFields = visibleFields.length > 0

  const fieldGroups = useMemo(() => {
    return getFieldGroupsFromLayout(resolvedFieldLayout, fields, "canvas")
  }, [resolvedFieldLayout, fields])

  const isFieldEditable = useCallback(
    (fieldName: string) => {
      if (forcedEditMode) return true
      if (!pageEditable) return false
      return isFieldEditableFromLayout(fieldName, resolvedFieldLayout, pageEditable)
    },
    [forcedEditMode, pageEditable, resolvedFieldLayout]
  )

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

  const handleFieldLabelClick = useCallback(
    (fieldId: string) => {
      if (!tableId) return
      setSelectedContext({ type: "field", fieldId, tableId })
    },
    [tableId, setSelectedContext]
  )

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

  const canEditLayout = pageEditable && (role === "admin" || role === "member") && Boolean(onLayoutSave)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between gap-2 px-4 py-2 border-b border-gray-200 bg-white">
        <h3 className="text-sm font-medium text-gray-900 truncate">
          {titleField && record[titleField] ? String(record[titleField]) : "Record details"}
        </h3>
      </div>

      {/* Content */}
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
            onFieldLabelClick={handleFieldLabelClick}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500">
            <p className="text-sm font-medium">No fields in layout</p>
            <p className="text-xs mt-1">
              {canEditLayout
                ? "Use the right panel to add and arrange fields."
                : "Ask an admin to configure the detail panel layout in Settings."}
            </p>
          </div>
        )}

        {/* Comments - show whenever we have a record */}
        <div className="mt-6">
          <RecordComments
            tableId={tableId}
            recordId={recordId}
            canAddComment={pageEditable}
          />
        </div>
      </div>
    </div>
  )
}
