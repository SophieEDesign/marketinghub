"use client"

/**
 * Record Details Panel Component
 * 
 * Persistent right panel for Record View pages showing record details.
 * This replaces the slide-out modal and provides a single source of truth
 * for viewing/editing record fields.
 * 
 * Layout:
 * - Header: Record title, created date, actions (duplicate/delete)
 * - Record Fields: Structured field list (page-level configuration)
 * - Optional sections: Activity, Comments (future)
 */

import { useMemo, useCallback } from "react"
import { Copy, Trash2, X } from "lucide-react"
import { formatDateUK } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import RecordFields from "@/components/records/RecordFields"
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
  // Blocks to render below fields
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

  // Get record title from titleField or fallback to first text field
  const recordTitle = useMemo(() => {
    if (titleField && formData[titleField]) {
      return String(formData[titleField])
    }
    // Fallback to first text field
    const firstTextField = fields.find((f) => f.type === "text")
    if (firstTextField && formData[firstTextField.name]) {
      return String(formData[firstTextField.name])
    }
    return recordId?.substring(0, 8) || "Untitled"
  }, [formData, fields, titleField, recordId])

  // Get created date
  const createdAt = record?.created_at ? formatDateUK(record.created_at) : null

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
      <div className="w-96 border-l flex flex-col overflow-hidden bg-white">
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
    <div className="w-96 border-l flex flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="border-b bg-white p-4 flex-shrink-0">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 truncate">{recordTitle}</h2>
            {createdAt && (
              <p className="text-xs text-gray-500 mt-1">Created {createdAt}</p>
            )}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="ml-2 p-1 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
              aria-label="Collapse panel"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDuplicate}
            disabled={loading || !pageEditable}
            className="h-8 text-xs"
          >
            <Copy className="h-3 w-3 mr-1.5" />
            Duplicate
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={loading || !pageEditable}
            className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-3 w-3 mr-1.5" />
            Delete
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyLink}
            className="h-8 text-xs"
          >
            Copy link
          </Button>
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
            {/* Record Fields Section */}
            {visibleFields.length > 0 && (
              <div className="p-4 border-b">
                {/* Helper text if page is view-only but some fields are editable */}
                {!pageEditable && editableFieldNames.length > 0 && (
                  <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-xs text-yellow-800">
                      Some fields are configured as editable, but the page is view-only. All fields are displayed as view-only.
                    </p>
                  </div>
                )}

                {/* Helper text about field permissions */}
                {pageEditable && editableFieldNames.length > 0 && editableFieldNames.length < visibleFields.length && (
                  <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs text-blue-800">
                      Some fields are view-only because their permissions have been independently updated.
                    </p>
                  </div>
                )}

                <RecordFields
                  fields={visibleFields}
                  formData={formData}
                  onFieldChange={pageEditable ? onFieldChange : () => {}}
                  fieldGroups={fieldGroups}
                  tableId={tableId}
                  recordId={recordId}
                />
              </div>
            )}

            {/* Blocks Section */}
            {page && (
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
                      <p className="text-xs text-gray-400">Add blocks to customize this view.</p>
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
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
