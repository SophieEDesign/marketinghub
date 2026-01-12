"use client"

import { useEffect, useState } from "react"
import { X, Save, Trash2 } from "lucide-react"
import { supabase } from "@/lib/supabase/client"

import type { TableField } from "@/types/fields"
import { Calculator } from "lucide-react"
import RichTextEditor from "@/components/fields/RichTextEditor"

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

  function getInputType(fieldName: string, value: any): string {
    // Infer type from value or field name
    if (typeof value === "number") return "number"
    if (typeof value === "boolean") return "checkbox"
    if (value instanceof Date || (typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}/))) {
      return "date"
    }
    if (fieldName.toLowerCase().includes("email")) return "email"
    if (fieldName.toLowerCase().includes("url")) return "url"
    if (fieldName.toLowerCase().includes("phone")) return "tel"
    return "text"
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
                  const isFormula = tableField?.type === 'formula'
                  const isVirtual = isFormula || tableField?.type === 'lookup'
                  const isSelect = tableField?.type === 'single_select' || tableField?.type === 'multi_select'
                  const inputType = getInputType(fieldName, value)
                  const isLongText = fieldName.toLowerCase().includes("description") ||
                                    fieldName.toLowerCase().includes("notes") ||
                                    fieldName.toLowerCase().includes("comment")
                  const isError = typeof value === 'string' && value.startsWith('#')

                  // Helper for select field pill rendering
                  const getSelectPillColor = (choiceValue: string) => {
                    const choiceColor = tableField?.options?.choiceColors?.[choiceValue]
                    if (!choiceColor) return { bg: 'bg-blue-100', text: 'text-blue-800', style: undefined }
                    const r = parseInt(choiceColor.slice(1, 3), 16)
                    const g = parseInt(choiceColor.slice(3, 5), 16)
                    const b = parseInt(choiceColor.slice(5, 7), 16)
                    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
                    return {
                      bg: '',
                      text: luminance > 0.5 ? 'text-gray-900' : 'text-white',
                      style: { backgroundColor: choiceColor }
                    }
                  }

                  return (
                    <div key={fieldName} className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                        {fieldName}
                        {isFormula && (
                          <span title={`Formula: ${tableField?.options?.formula || ''}`}>
                            <Calculator className="h-3 w-3 text-gray-400" />
                          </span>
                        )}
                      </label>
                      {isVirtual ? (
                        <div className={`px-3 py-2 border border-gray-200 rounded-md bg-gray-50 ${
                          isError ? 'text-red-600' : 'text-gray-700'
                        } italic`}>
                          {value !== null && value !== undefined ? String(value) : "—"}
                          {isFormula && tableField?.options?.formula && (
                            <div className="text-xs text-gray-500 mt-1 font-mono">
                              = {tableField.options.formula}
                            </div>
                          )}
                        </div>
                      ) : isSelect ? (
                        <div className="px-3 py-2 border border-gray-300 rounded-md bg-white min-h-[38px] flex items-center flex-wrap gap-2">
                          {(() => {
                            const choices = tableField?.options?.choices || []
                            const isMulti = tableField?.type === 'multi_select'
                            const selectedValues = isMulti
                              ? (Array.isArray(value) ? value : value ? [value] : [])
                              : value ? [value] : []
                            
                            if (selectedValues.length === 0) {
                              return <span className="text-sm text-gray-400">Select...</span>
                            }
                            
                            return selectedValues.map((val: string) => {
                              const colorInfo = getSelectPillColor(val)
                              return (
                                <span
                                  key={val}
                                  className={`px-2 py-1 rounded text-xs font-medium ${colorInfo.text}`}
                                  style={colorInfo.style}
                                >
                                  {val}
                                </span>
                              )
                            })
                          })()}
                        </div>
                      ) : inputType === "checkbox" ? (
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={!!value}
                            onChange={(e) => handleFieldChange(fieldName, e.target.checked)}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </div>
                      ) : isLongText ? (
                        <RichTextEditor
                          value={value ?? ""}
                          onChange={(val) => handleFieldChange(fieldName, val)}
                          editable={true}
                          showToolbar={true}
                          minHeight="150px"
                        />
                      ) : (
                        <input
                          type={inputType}
                          value={value ?? ""}
                          onChange={(e) => {
                            const newValue = inputType === "number"
                              ? (e.target.value === "" ? null : Number(e.target.value))
                              : e.target.value
                            handleFieldChange(fieldName, newValue)
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder={`Enter ${fieldName}...`}
                        />
                      )}
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
                  const inputType = getInputType(key, value)

                  return (
                    <div key={key} className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        {key}
                      </label>
                      {inputType === "checkbox" ? (
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={!!value}
                            onChange={(e) => handleFieldChange(key, e.target.checked)}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </div>
                      ) : (
                        <input
                          type={inputType}
                          value={value ?? ""}
                          onChange={(e) => {
                            const newValue = inputType === "number"
                              ? (e.target.value === "" ? null : Number(e.target.value))
                              : e.target.value
                            handleFieldChange(key, newValue)
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder={`Enter ${key}...`}
                        />
                      )}
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
