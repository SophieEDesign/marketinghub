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
import { Copy, Trash2, X, MoreVertical, Pencil } from "lucide-react"
import { formatDateUK } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import RecordFields from "@/components/records/RecordFields"
import RecordActivity from "@/components/records/RecordActivity"
import InterfaceBuilder from "./InterfaceBuilder"
import type { TableField } from "@/types/fields"
import { createClient } from "@/lib/supabase/client"
import { useUserRole } from "@/lib/hooks/useUserRole"
import { canDeleteRecord } from "@/lib/interface/record-actions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
  const { role: userRole } = useUserRole()
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameValue, setNameValue] = useState("")
  const nameInputRef = useRef<HTMLInputElement>(null)

  const pageConfig = (page as any)?.config || (page as any)?.settings || {}
  const canDeleteThisRecord = pageEditable && canDeleteRecord(userRole, pageConfig)

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

  // Show edit mode banner when interface is in edit mode, or when page allows editing and we have fields (Airtable-style)
  const showEditModeBanner = recordId && (isEditing || (pageEditable && visibleFields.length > 0))

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
    return "Untitled"
  }, [formData, fields, titleField, recordId])

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

  // Handle name edit
  const handleNameSave = useCallback(() => {
    if (primaryNameField && nameValue !== recordTitle) {
      onFieldChange(primaryNameField.name, nameValue)
    }
    setIsEditingName(false)
  }, [primaryNameField, nameValue, recordTitle, onFieldChange])

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

    if (!canDeleteThisRecord) {
      toast({
        variant: "destructive",
        title: "Not allowed",
        description: "You don't have permission to delete records on this page.",
      })
      return
    }

    if (!confirm("Are you sure you want to delete this record? This action cannot be undone.")) {
      return
    }

    try {
      // Prefer server-side enforcement for interface pages
      const pageId = (page as any)?.id as string | undefined
      if (!pageId) {
        throw new Error('Missing page ID for delete action.')
      }

      const res = await fetch(`/api/interface-pages/${pageId}/records/${recordId}`, {
        method: 'DELETE',
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload?.error || 'Failed to delete record')
      }

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
  }, [canDeleteThisRecord, recordId, tableName, toast, onRecordDelete])

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
    <div
      className={`flex-1 border-l flex flex-col overflow-hidden bg-white ${showEditModeBanner ? "border-l-4 border-l-blue-500 border-gray-200" : "border-gray-200"}`}
    >
      {/* Edit mode banner - Airtable-style prominent indicator */}
      {showEditModeBanner && (
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-blue-50 border-b border-blue-200">
          <Pencil className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-700">Editing</span>
        </div>
      )}

      {/* Header - Record context */}
      <div className="border-b border-gray-200 bg-white flex-shrink-0">
        <div className="px-6 py-5">
          {loading ? (
            <div className="space-y-3">
              <div className="h-7 w-64 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
            </div>
          ) : isEditingName && primaryNameField ? (
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
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <h1
                  className={`text-2xl font-semibold text-gray-900 min-w-0 truncate ${
                    primaryNameField && pageEditable ? "cursor-text hover:bg-gray-50 -mx-2 px-2 py-1 rounded-md transition-colors" : ""
                  }`}
                  onClick={() => {
                    if (primaryNameField && pageEditable) setIsEditingName(true)
                  }}
                  title={primaryNameField && pageEditable ? "Click to edit" : undefined}
                >
                  {recordTitle || "Untitled"}
                </h1>

                {/* Status and Metadata Row */}
                <div className="flex items-center gap-4 mt-3">
                  {statusField && statusValue && (
                    <div
                      className={`px-3 py-1 rounded-full text-xs font-medium shadow-sm border ${
                        statusField.type === "checkbox"
                          ? statusValue
                            ? "bg-green-100 text-green-800 border-green-200"
                            : "bg-gray-100 text-gray-600 border-gray-200"
                          : "bg-blue-100 text-blue-800 border-blue-200"
                      }`}
                    >
                      {statusField.type === "checkbox"
                        ? statusValue
                          ? "Active"
                          : "Inactive"
                        : String(statusValue)}
                    </div>
                  )}
                  {createdAt && (
                    <div className="text-xs text-gray-500">
                      Created {createdAt}
                      {updatedAt && updatedAt !== createdAt && ` • Updated ${updatedAt}`}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {canDeleteThisRecord && (
                  <button
                    onClick={handleDelete}
                    className="p-2 hover:bg-red-50 rounded-md transition-colors"
                    aria-label="Delete record"
                    title="Delete"
                    disabled={loading}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                      aria-label="Record actions"
                      title="Actions"
                    >
                      <MoreVertical className="h-4 w-4 text-gray-600" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleCopyLink}>
                      Copy link
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDuplicate} disabled={loading || !pageEditable}>
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleDelete}
                      disabled={loading || !canDeleteThisRecord}
                      className="text-red-600 focus:text-red-600"
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {onClose && (
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                    aria-label="Collapse panel"
                    title="Close"
                  >
                    <X className="h-4 w-4 text-gray-600" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Record Fields + Blocks */}
      <div className={`flex-1 overflow-auto ${showEditModeBanner ? "bg-blue-50/20" : "bg-gray-50/30"}`}>
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm p-4">
            <div className="text-center">
              <p className="text-xs mb-1 font-medium">Loading record...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Structured record fields (Airtable-style) */}
            <div className="px-6 py-6">
              <RecordFields
                fields={visibleFields}
                formData={formData}
                onFieldChange={onFieldChange}
                fieldGroups={fieldGroups}
                tableId={tableId}
                recordId={recordId}
                tableName={tableName}
                isFieldEditable={(fieldName) => {
                  if (!pageEditable) return false
                  if (!editableFieldNames || editableFieldNames.length === 0) return true
                  return editableFieldNames.includes(fieldName)
                }}
              />
            </div>

            {/* Visual separator between fields and blocks */}
            {page && blocks.length > 0 && (
              <div className="border-t border-gray-200/60 mx-6"></div>
            )}

            {/* Blocks Section - optional, excludes field blocks (fields are shown above) */}
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
                    // CRITICAL: Use stable key based on page.id only - NOT recordId
                    // This ensures blocks are page-level templates that apply to all records.
                    // When record changes, blocks re-render with new recordId context but don't remount.
                    key={page.id} // CRITICAL: ONLY page.id - recordId changes don't cause remounts
                    page={page as any}
                    initialBlocks={blocks.filter((b: any) => b.type !== "record" && b.type !== "field")}
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
