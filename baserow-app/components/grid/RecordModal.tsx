"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import RecordFields from "@/components/records/RecordFields"
import type { TableField } from "@/types/fields"
import { useToast } from "@/components/ui/use-toast"
import { useUserRole } from "@/lib/hooks/useUserRole"
import { Trash2 } from "lucide-react"
import { isAbortError } from "@/lib/api/error-handling"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import ModalCanvas from "@/components/interface/ModalCanvas"
import type { BlockConfig } from "@/lib/interface/types"
import { useMemo } from "react"

interface RecordModalProps {
  isOpen: boolean
  onClose: () => void
  onDeleted?: () => void | Promise<void>
  tableId: string
  recordId: string
  tableName: string
  modalFields?: string[] // Fields to show in modal (if empty, show all)
  modalLayout?: BlockConfig['modal_layout'] // Custom modal layout
}

export default function RecordModal({
  isOpen,
  onClose,
  onDeleted,
  tableId,
  recordId,
  tableName,
  modalFields,
  modalLayout,
}: RecordModalProps) {
  const [record, setRecord] = useState<Record<string, any> | null>(null)
  const [fields, setFields] = useState<TableField[]>([])
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const supabase = createClient()
  const { toast } = useToast()
  const { role: userRole } = useUserRole()

  function normalizeUpdateValue(fieldName: string, value: any): any {
    // Avoid sending `undefined` to PostgREST.
    const v: any = value === undefined ? null : value

    const field = fields.find((f) => f?.name === fieldName)
    if (!field) return v

    if (field.type !== "link_to_table") return v

    const toId = (x: any): string | null => {
      if (x == null || x === "") return null
      if (typeof x === "string") return x
      if (typeof x === "object" && x && "id" in x) return String((x as any).id)
      return String(x)
    }

    const relationshipType = (field.options as any)?.relationship_type as
      | "one-to-one"
      | "one-to-many"
      | "many-to-many"
      | undefined
    const maxSelections = (field.options as any)?.max_selections as number | undefined
    const isMulti =
      relationshipType === "one-to-many" ||
      relationshipType === "many-to-many" ||
      (typeof maxSelections === "number" && maxSelections > 1)

    if (isMulti) {
      if (v == null) return null
      if (Array.isArray(v)) return v.map(toId).filter(Boolean)
      const id = toId(v)
      return id ? [id] : null
    }

    // Single-link: always normalize to a single UUID (or null).
    if (Array.isArray(v)) return toId(v[0])
    return toId(v)
  }

  useEffect(() => {
    if (isOpen && recordId && tableName) {
      // Avoid flashing stale data while the next record loads.
      setRecord(null)
      setLoading(true)
      loadRecord()
      loadFields()
    } else {
      setRecord(null)
    }
  }, [isOpen, recordId, tableName])

  async function loadRecord() {
    if (!recordId || !tableName) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .eq("id", recordId)
        .single()

      if (error) {
        if (!isAbortError(error)) {
          console.error("Error loading record:", error)
        }
      } else {
        setRecord(data)
      }
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Error loading record:", error)
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadFields() {
    try {
      const response = await fetch(`/api/tables/${tableId}/fields`)
      const data = await response.json()
      if (data.fields) {
        // Filter fields if modalFields is specified
        let filteredFields = data.fields
        if (modalFields && modalFields.length > 0) {
          filteredFields = data.fields.filter((f: TableField) =>
            modalFields.includes(f.name) || modalFields.includes(f.id)
          )
        }
        setFields(filteredFields)
      }
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Error loading fields:", error)
      }
    }
  }

  async function handleFieldChange(fieldName: string, value: any) {
    if (!record || !tableName) return

    try {
      const normalizedValue = normalizeUpdateValue(fieldName, value)
      let finalSavedValue: any = normalizedValue

      const doUpdate = async (val: any) => {
        return await supabase.from(tableName).update({ [fieldName]: val }).eq("id", recordId)
      }

      let { error } = await doUpdate(finalSavedValue)

      // Compatibility rescue for uuid[] column type mismatch (code 42804):
      // Some columns are physically uuid[] but the field is configured as single-link,
      // so we normalize to a single UUID. When that happens, Postgres throws 42804.
      if (
        error?.code === '42804' &&
        !Array.isArray(finalSavedValue) &&
        String(error?.message || '').toLowerCase().includes('uuid[]') &&
        String(error?.message || '').toLowerCase().includes('uuid')
      ) {
        // Column is uuid[] but we're trying to save a single UUID - wrap it in an array
        const wrappedValue = finalSavedValue != null ? [finalSavedValue] : null
        const retry = await doUpdate(wrappedValue)
        error = retry.error
        if (!retry.error) {
          finalSavedValue = wrappedValue
          console.log(`[RecordModal] Auto-corrected: wrapped single UUID in array for uuid[] column "${fieldName}"`)
        }
      }

      // See `useGridData.updateCell` for rationale (uuid vs uuid[] mismatch for linked fields)
      if (
        error?.code === "22P02" &&
        Array.isArray(finalSavedValue) &&
        String(error?.message || "").toLowerCase().includes('invalid input syntax for type uuid')
      ) {
        if (finalSavedValue.length <= 1) {
          finalSavedValue = finalSavedValue[0] ?? null
          const retry = await doUpdate(finalSavedValue)
          error = retry.error
        }
      }

      if (error) {
        if (!isAbortError(error)) {
          console.error("Error updating field:", error)
          throw error
        }
        return
      }

      // Update local state
      setRecord((prev) => (prev ? { ...prev, [fieldName]: finalSavedValue } : null))
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Error updating field:", error)
      }
    }
  }

  async function handleDeleteRecord() {
    if (!tableName || !recordId) return
    if (userRole !== 'admin') {
      toast({
        variant: "destructive",
        title: "Not allowed",
        description: "Only admins can delete records here.",
      })
      return
    }

    setShowDeleteConfirm(true)
  }

  async function confirmDelete() {
    if (!tableName || !recordId) return

    setDeleting(true)
    try {
      const { error } = await supabase.from(tableName).delete().eq("id", recordId)
      if (error) throw error

      toast({
        title: "Record deleted",
        description: "The record has been deleted.",
      })
      await onDeleted?.()
      onClose()
    } catch (error: any) {
      if (!isAbortError(error)) {
        console.error("Error deleting record:", error)
        toast({
          variant: "destructive",
          title: "Failed to delete record",
          description: error.message || "Please try again",
        })
      }
    } finally {
      setDeleting(false)
    }
  }

  // Memoize blocks for ModalCanvas - must be at top level (before early return)
  const modalBlocks = useMemo(() => {
    if (!modalLayout?.blocks || modalLayout.blocks.length === 0) {
      return []
    }
    return modalLayout.blocks.map(block => ({
      id: block.id,
      type: block.type,
      x: block.x,
      y: block.y,
      w: block.w,
      h: block.h,
      config: {
        ...block.config,
        field_id: block.type === 'field' 
          ? fields.find(f => f.name === block.fieldName || f.id === block.fieldName)?.id
          : undefined,
        field_name: block.fieldName,
      },
    })) as any[]
  }, [modalLayout?.blocks, fields])

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle>Record Details</DialogTitle>
            <div className="flex items-center gap-2">
              {userRole === 'admin' && (
                <button
                  onClick={handleDeleteRecord}
                  disabled={deleting || loading}
                  className="p-2 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50"
                  aria-label="Delete record"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-md hover:bg-gray-100 transition-colors"
                aria-label="Close"
                title="Close"
              >
                <X className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          </div>
        </DialogHeader>
        <div className="mt-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : record ? (
            <>
              {/* Use custom layout if available, otherwise fall back to simple field list */}
              {modalLayout?.blocks && modalLayout.blocks.length > 0 ? (
                <div className="min-h-[400px]">
                  <ModalCanvas
                    blocks={modalBlocks}
                    tableId={tableId}
                    recordId={recordId}
                    tableName={tableName}
                    tableFields={fields}
                    pageEditable={userRole === 'admin'}
                    editableFieldNames={fields.map(f => f.name)}
                    onFieldChange={handleFieldChange}
                    layoutSettings={modalLayout.layoutSettings}
                  />
                </div>
              ) : (
                <RecordFields
                  fields={fields}
                  formData={record}
                  onFieldChange={handleFieldChange}
                  fieldGroups={{}}
                  tableId={tableId}
                  recordId={recordId}
                  tableName={tableName}
                  isFieldEditable={() => true}
                />
              )}

              {/* Footer actions */}
              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleDeleteRecord}
                  disabled={deleting || loading || userRole !== 'admin'}
                  className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={userRole !== 'admin' ? 'Only admins can delete records' : 'Delete this record'}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete record
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">Record not found</div>
          )}
        </div>
      </DialogContent>
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={confirmDelete}
        title="Delete Record"
        description="Are you sure you want to delete this record? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        loading={deleting}
      />
    </Dialog>
  )
}
