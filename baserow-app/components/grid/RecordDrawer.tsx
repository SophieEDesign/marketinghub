"use client"

import { useEffect, useState } from "react"
import { X, Save, Trash2 } from "lucide-react"
import { supabase } from "@/lib/supabase/client"

import type { TableField } from "@/types/fields"
import FieldEditor from "@/components/fields/FieldEditor"

interface RecordDrawerProps {
  isOpen: boolean
  onClose: () => void
  tableName: string
  rowId: string | null
  fieldNames: string[]
  tableFields?: TableField[]
  onSave?: () => void
  onDelete?: () => void
}

export default function RecordDrawer({
  isOpen,
  onClose,
  tableName,
  rowId,
  fieldNames,
  tableFields = [],
  onSave,
  onDelete,
}: RecordDrawerProps) {
  const [record, setRecord] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [formData, setFormData] = useState<Record<string, any>>({})

  useEffect(() => {
    if (isOpen && rowId && tableName) {
      loadRecord()
    } else {
      setRecord(null)
      setFormData({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, rowId, tableName])

  useEffect(() => {
    if (record) {
      setFormData({ ...record })
    }
  }, [record])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [isOpen, onClose])

  async function loadRecord() {
    if (!rowId || !tableName) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .eq("id", rowId)
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

  async function handleSave() {
    if (!rowId || !tableName || saving) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from(tableName)
        .update(formData)
        .eq("id", rowId)

      if (error) {
        console.error("Error saving record:", error)
        alert("Failed to save record: " + error.message)
      } else {
        await loadRecord()
        onSave?.()
      }
    } catch (error: any) {
      console.error("Error saving record:", error)
      alert("Failed to save record: " + error.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!rowId || !tableName || deleting) return

    if (!confirm("Are you sure you want to delete this record?")) {
      return
    }

    setDeleting(true)
    try {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq("id", rowId)

      if (error) {
        console.error("Error deleting record:", error)
        alert("Failed to delete record: " + error.message)
      } else {
        onDelete?.()
        onClose()
      }
    } catch (error: any) {
      console.error("Error deleting record:", error)
      alert("Failed to delete record: " + error.message)
    } finally {
      setDeleting(false)
    }
  }

  function handleFieldChange(fieldName: string, value: any) {
    setFormData((prev) => ({
      ...prev,
      [fieldName]: value,
    }))
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 h-full w-full md:w-[40%] bg-white shadow-xl z-50 flex flex-col transition-transform duration-300 ease-out"
        style={{ transform: isOpen ? "translateX(0)" : "translateX(100%)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Record Details</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : record ? (
            <div className="space-y-4">
              {fieldNames.length > 0 ? (
                fieldNames.map((fieldName) => {
                  const value = formData[fieldName]
                  const tableField = tableFields.find(f => f.name === fieldName)

                  // If we have field metadata, use FieldEditor
                  if (tableField) {
                    return (
                      <FieldEditor
                        key={fieldName}
                        field={tableField}
                        value={value}
                        onChange={(newValue) => handleFieldChange(fieldName, newValue)}
                        required={tableField.required || false}
                        recordId={rowId || undefined}
                        tableName={tableName}
                      />
                    )
                  }

                  // Fallback for fields without metadata - show as read-only
                  return (
                    <div key={fieldName} className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        {fieldName}
                      </label>
                      <div className="px-3 py-2 bg-gray-50 rounded-md text-sm text-gray-600">
                        {value !== null && value !== undefined ? String(value) : "—"}
                      </div>
                    </div>
                  )
                })
              ) : (
                // If no field names provided, show all fields from record
                Object.keys(record).map((key) => {
                  if (key === "id" || key === "created_at" || key === "updated_at") {
                    return (
                      <div key={key} className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          {key}
                        </label>
                        <div className="px-3 py-2 bg-gray-50 rounded-md text-sm text-gray-600">
                          {String(record[key] || "")}
                        </div>
                      </div>
                    )
                  }

                  const value = formData[key]
                  const tableField = tableFields.find(f => f.name === key)

                  // If we have field metadata, use FieldEditor
                  if (tableField) {
                    return (
                      <FieldEditor
                        key={key}
                        field={tableField}
                        value={value}
                        onChange={(newValue) => handleFieldChange(key, newValue)}
                        required={tableField.required || false}
                        recordId={rowId || undefined}
                        tableName={tableName}
                      />
                    )
                  }

                  // Fallback for fields without metadata
                  return (
                    <div key={key} className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        {key}
                      </label>
                      <input
                        type="text"
                        value={value ?? ""}
                        onChange={(e) => handleFieldChange(key, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={`Enter ${key}...`}
                      />
                    </div>
                  )
                })
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">No record selected</div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex items-center justify-between gap-2">
          <button
            onClick={handleDelete}
            disabled={deleting || !rowId}
            className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? "Deleting..." : "Delete"}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !rowId}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
