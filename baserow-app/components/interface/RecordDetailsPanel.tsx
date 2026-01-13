"use client"

/**
 * Record Details Panel Component
 * 
 * Persistent right panel for Record View pages showing record details.
 * This replaces the slide-out modal and provides a single source of truth
 * for viewing/editing record fields.
 * 
 * Layout:
 * - Header: Record title (editable), status, created date, actions (save/duplicate/delete/copy link)
 * - Toolbar: Unsaved changes indicator
 * - Record Fields: Structured field list (page-level configuration)
 * - Activity: Record activity timeline
 * - Blocks: Optional blocks section
 */

import { useMemo, useCallback, useState, useEffect, useRef } from "react"
import { Copy, Trash2, X, Save, Edit2, Check } from "lucide-react"
import { formatDateUK } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import RecordFields from "@/components/records/RecordFields"
import RecordActivity from "@/components/records/RecordActivity"
import InterfaceBuilder from "./InterfaceBuilder"
import type { TableField } from "@/types/fields"
import { createClient } from "@/lib/supabase/client"

interface RecordDetailsPanelProps {
  record: Record<string, any> | null
  tableId: string
  recordId: string | null
  tableName: string
  fields: TableField[]
  formData: Record<string, any>
  fieldGroups: Record<string, string[]>
  visibleFields: TableField[]
  pageEditable: boolean
  editableFieldNames: string[]
  titleField?: string
  onFieldChange: (fieldName: string, value: any) => void
  onClose?: () => void // Only collapses panel, does not open modal
  onRecordDelete?: (recordId: string) => void
  onRecordDuplicate?: (recordId: string) => void
  loading?: boolean
  // Blocks to render (all fields are blocks now - field blocks + other blocks)
  blocks?: any[] // PageBlock[]
  page?: any // InterfacePage
  pageTableId?: string | null
  isEditing?: boolean
  onRecordClick?: (recordId: string) => void
  blocksLoading?: boolean
}

export default function RecordDetailsPanel({
  record,
  tableId,
  recordId,
  tableName,
  fields,
  formData,
  fieldGroups,
  visibleFields,
  pageEditable,
  editableFieldNames,
  titleField,
  onFieldChange,
  onClose,
  onRecordDelete,
  onRecordDuplicate,
  loading = false,
  blocks = [],
  page,
  pageTableId,
  isEditing = false,
  onRecordClick,
  blocksLoading = false,
}: RecordDetailsPanelProps) {
  const { toast } = useToast()
  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameValue, setNameValue] = useState("")
  const nameInputRef = useRef<HTMLInputElement>(null)
  const previousFormDataRef = useRef<Record<string, any>>({})

  // Find primary name field (for editable title)
  // Priority: titleField config > field named "name" > "title" > "subject" > first text field (excluding "id")
  const primaryNameField = useMemo(() => {
    if (titleField) {
      return fields.find((f) => f.name === titleField) || fields.find((f) => f.type === "text" && f.name.toLowerCase() !== "id")
    }
    // First, try to find a field literally named "name" (case-insensitive)
    const nameField = fields.find(
      (f) => f.type === "text" && f.name.toLowerCase() === "name"
    )
    if (nameField) return nameField
    
    // Then try "title" or "subject"
    const titleOrSubjectField = fields.find(
      (f) =>
        f.type === "text" &&
        (f.name.toLowerCase() === "title" ||
          f.name.toLowerCase() === "subject")
    )
    if (titleOrSubjectField) return titleOrSubjectField
    
    // Finally, fallback to first text field that's not "id"
    return fields.find((f) => f.type === "text" && f.name.toLowerCase() !== "id") || fields.find((f) => f.type === "text")
  }, [fields, titleField])

  // Get record title from titleField or fallback to first text field (excluding "id")
  const recordTitle = useMemo(() => {
    if (titleField && formData[titleField]) {
      return String(formData[titleField])
    }
    // Try "name" field first
    const nameField = fields.find((f) => f.type === "text" && f.name.toLowerCase() === "name")
    if (nameField && formData[nameField.name]) {
      return String(formData[nameField.name])
    }
    // Fallback to first text field that's not "id"
    const firstTextField = fields.find((f) => f.type === "text" && f.name.toLowerCase() !== "id")
    if (firstTextField && formData[firstTextField.name]) {
      return String(formData[firstTextField.name])
    }
    return recordId?.substring(0, 8) || "Untitled"
  }, [formData, fields, titleField, recordId])

  // Track form data changes
  useEffect(() => {
    const hasFormChanges = JSON.stringify(formData) !== JSON.stringify(previousFormDataRef.current)
    setHasChanges(hasFormChanges)
    previousFormDataRef.current = { ...formData }
  }, [formData])

  // Update name value when record title changes
  useEffect(() => {
    setNameValue(String(recordTitle || ""))
  }, [recordTitle])

  // Focus name input when editing
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [isEditingName])

  // Find status field
  const statusField = useMemo(() => {
    return fields.find(
      (f) =>
        (f.type === "single_select" || f.type === "checkbox") &&
        (f.name.toLowerCase() === "status" ||
          f.name.toLowerCase() === "state" ||
          f.name.toLowerCase() === "stage")
    )
  }, [fields])

  const statusValue = statusField ? formData[statusField.name] : null

  // Get created/updated dates
  const createdAt = record?.created_at ? formatDateUK(record.created_at) : null
  const updatedAt = record?.updated_at ? formatDateUK(record.updated_at) : null

  // Handle save
  const handleSave = useCallback(async () => {
    if (!recordId || !tableName || !hasChanges) return

    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from(tableName)
        .update(formData)
        .eq("id", recordId)

      if (error) throw error

      toast({
        title: "Record saved",
        description: "Changes have been saved successfully.",
      })

      setHasChanges(false)
      previousFormDataRef.current = { ...formData }
    } catch (error: any) {
      console.error("Error saving record:", error)
      toast({
        variant: "destructive",
        title: "Failed to save record",
        description: error.message || "Please try again",
      })
    } finally {
      setSaving(false)
    }
  }, [recordId, tableName, formData, hasChanges, toast])

  // Handle name edit
  const handleNameSave = useCallback(() => {
    if (primaryNameField && nameValue !== recordTitle) {
      onFieldChange(primaryNameField.name, nameValue)
      setIsEditingName(false)
      // Auto-save if there are changes
      if (hasChanges) {
        handleSave()
      }
    } else {
      setIsEditingName(false)
    }
  }, [primaryNameField, nameValue, recordTitle, onFieldChange, hasChanges, handleSave])

  const handleNameCancel = useCallback(() => {
    setNameValue(String(recordTitle || ""))
    setIsEditingName(false)
  }, [recordTitle])

  const handleDuplicate = useCallback(async () => {
    if (!recordId || !record || !tableName) return

    try {
      const supabase = createClient()
      const { id, created_at, updated_at, ...recordData } = record
      const { data, error } = await supabase
        .from(tableName)
        .insert([recordData])
        .select()
        .single()

      if (error) throw error

      toast({
        title: "Record duplicated",
        description: "A copy of this record has been created.",
      })

      if (onRecordDuplicate && data?.id) {
        onRecordDuplicate(data.id)
      }
    } catch (error: any) {
      console.error("Error duplicating record:", error)
      toast({
        variant: "destructive",
        title: "Failed to duplicate record",
        description: error.message || "Please try again",
      })
    }
  }, [recordId, record, tableName, toast, onRecordDuplicate])

  const handleDelete = useCallback(async () => {
    if (!recordId || !tableName) return

    if (!confirm("Are you sure you want to delete this record? This action cannot be undone.")) {
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase.from(tableName).delete().eq("id", recordId)

      if (error) throw error

      toast({
        title: "Record deleted",
        description: "The record has been deleted.",
      })

      if (onRecordDelete) {
        onRecordDelete(recordId)
      }
    } catch (error: any) {
      console.error("Error deleting record:", error)
      toast({
        variant: "destructive",
        title: "Failed to delete record",
        description: error.message || "Please try again",
      })
    }
  }, [recordId, tableName, toast, onRecordDelete])

  const handleCopyLink = useCallback(() => {
    if (!recordId) return
    const url = `${window.location.origin}/tables/${tableId}/records/${recordId}`
    navigator.clipboard.writeText(url)
    toast({
      title: "Link copied",
      description: "Record link copied to clipboard",
    })
  }, [recordId, tableId, toast])

  if (!recordId) {
    return (
      <div className="flex-1 border-l flex flex-col overflow-hidden bg-white">
        <div className="flex items-center justify-center h-full text-gray-400 text-sm p-4">
          <div className="text-center">
            <p className="mb-2 font-medium">Select a record</p>
            <p className="text-xs text-gray-400">Choose a record from the list to view its details.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 border-l border-gray-200 flex flex-col overflow-hidden bg-white">
      {/* Header - Enhanced with editable title and status */}
      <div className="border-b border-gray-200 bg-white flex-shrink-0">
        {/* Primary Name - Editable */}
        <div className="px-6 py-4">
          {isEditingName && primaryNameField ? (
            <div className="flex items-center gap-2">
              <input
                ref={nameInputRef}
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleNameSave()
                  } else if (e.key === "Escape") {
                    handleNameCancel()
                  }
                }}
                onBlur={handleNameSave}
                className="flex-1 text-2xl font-semibold text-gray-900 border-none outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                placeholder="Record name"
              />
              <button
                onClick={handleNameSave}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <Check className="h-4 w-4 text-green-600" />
              </button>
              <button
                onClick={handleNameCancel}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 group">
              <h1 className="text-2xl font-semibold text-gray-900 flex-1 min-w-0">
                {recordTitle || "Untitled"}
              </h1>
              {primaryNameField && pageEditable && (
                <button
                  onClick={() => setIsEditingName(true)}
                  className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-100 rounded transition-all"
                  title="Edit name"
                >
                  <Edit2 className="h-4 w-4 text-gray-600" />
                </button>
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                  aria-label="Collapse panel"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              )}
            </div>
          )}

          {/* Status and Metadata Row */}
          <div className="flex items-center gap-4 mt-3">
            {/* Status Pill */}
            {statusField && statusValue && (
              <div
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  statusField.type === "checkbox"
                    ? statusValue
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-600"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {statusField.type === "checkbox"
                  ? statusValue
                    ? "Active"
                    : "Inactive"
                  : String(statusValue)}
              </div>
            )}

            {/* Metadata */}
            <div className="flex items-center gap-4 text-xs text-gray-500">
              {createdAt && (
                <span>
                  Created {createdAt}
                  {updatedAt && updatedAt !== createdAt && ` • Updated ${updatedAt}`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions Toolbar */}
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            {hasChanges && (
              <button
                onClick={handleSave}
                disabled={saving || !pageEditable}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save"}
              </button>
            )}
            {hasChanges && !saving && (
              <span className="text-xs text-blue-600 flex items-center gap-1">
                <span className="w-2 h-2 bg-blue-600 rounded-full" />
                Unsaved changes
              </span>
            )}
            {saving && (
              <span className="text-xs text-gray-500">Saving...</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleDuplicate}
              disabled={loading || !pageEditable}
              className="p-2 hover:bg-gray-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Duplicate record"
            >
              <Copy className="h-4 w-4 text-gray-600" />
            </button>
            <button
              onClick={handleCopyLink}
              className="p-2 hover:bg-gray-200 rounded transition-colors"
              title="Copy link"
            >
              <Copy className="h-4 w-4 text-gray-600" />
            </button>
            <button
              onClick={handleDelete}
              disabled={loading || !pageEditable}
              className="p-2 hover:bg-red-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Delete record"
            >
              <Trash2 className="h-4 w-4 text-red-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Record Fields + Blocks */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm p-4">
            <div className="text-center">
              <p className="text-xs mb-1 font-medium">Loading record...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Blocks Section - All fields are blocks (field blocks + other blocks) */}
            {page ? (
              <div className="flex-1">
                {blocksLoading ? (
                  <div className="flex items-center justify-center py-8 text-gray-400 text-sm p-4">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Loading blocks...</p>
                    </div>
                  </div>
                ) : blocks.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-gray-400 text-sm p-4">
                    <div className="text-center">
                      <p className="text-xs mb-1 font-medium">No blocks configured</p>
                      <p className="text-xs text-gray-400">Select fields in page settings to automatically create field blocks.</p>
                    </div>
                  </div>
                ) : (
                  <InterfaceBuilder
                    key={`record-${recordId}`}
                    page={page as any}
                    initialBlocks={blocks}
                    hideHeader={true}
                    pageTableId={pageTableId || undefined}
                    recordId={recordId || undefined}
                    onRecordClick={onRecordClick}
                    pageEditable={pageEditable}
                    editableFieldNames={editableFieldNames}
                  />
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center py-8 text-gray-400 text-sm p-4">
                <div className="text-center">
                  <p className="text-xs mb-1 font-medium">No blocks configured</p>
                  <p className="text-xs text-gray-400">Select fields in page settings to automatically create field blocks.</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
