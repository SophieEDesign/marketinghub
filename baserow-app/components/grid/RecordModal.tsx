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

interface RecordModalProps {
  isOpen: boolean
  onClose: () => void
  tableId: string
  recordId: string
  tableName: string
  modalFields?: string[] // Fields to show in modal (if empty, show all)
}

export default function RecordModal({
  isOpen,
  onClose,
  tableId,
  recordId,
  tableName,
  modalFields,
}: RecordModalProps) {
  const [record, setRecord] = useState<Record<string, any> | null>(null)
  const [fields, setFields] = useState<TableField[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (isOpen && recordId && tableName) {
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
        console.error("Error loading record:", error)
      } else {
        setRecord(data)
      }
    } catch (error) {
      console.error("Error loading record:", error)
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
      console.error("Error loading fields:", error)
    }
  }

  async function handleFieldChange(fieldName: string, value: any) {
    if (!record || !tableName) return

    try {
      const { error } = await supabase
        .from(tableName)
        .update({ [fieldName]: value })
        .eq("id", recordId)

      if (error) {
        console.error("Error updating field:", error)
        throw error
      }

      // Update local state
      setRecord((prev) => (prev ? { ...prev, [fieldName]: value } : null))
    } catch (error) {
      console.error("Error updating field:", error)
    }
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Details</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : record ? (
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
          ) : (
            <div className="text-center py-8 text-gray-500">Record not found</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
