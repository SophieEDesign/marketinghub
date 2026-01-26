"use client"

import { useEffect, useState, useMemo } from "react"
import { X, Save, Trash2, ChevronDown, ChevronRight } from "lucide-react"
import { supabase } from "@/lib/supabase/client"

import type { TableField } from "@/types/fields"
import FieldEditor from "@/components/fields/FieldEditor"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { sectionAndSortFields } from "@/lib/fields/sectioning"

interface RecordDrawerProps {
  isOpen: boolean
  onClose: () => void
  tableName: string
  rowId: string | null
  fieldNames: string[]
  tableFields?: TableField[]
  onSave?: () => void
  onDelete?: () => void
  showFieldSections?: boolean // Optional: show fields grouped by sections (default: false)
}

const getCollapsedSectionsKey = (tableName: string) => `record-drawer-collapsed-sections-${tableName}`

export default function RecordDrawer({
  isOpen,
  onClose,
  tableName,
  rowId,
  fieldNames,
  tableFields = [],
  onSave,
  onDelete,
  showFieldSections = false,
}: RecordDrawerProps) {
  const [record, setRecord] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Load collapsed sections state from localStorage
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set()
    try {
      const stored = localStorage.getItem(getCollapsedSectionsKey(tableName))
      if (stored) {
        return new Set(JSON.parse(stored))
      }
    } catch (error) {
      console.warn("Failed to load collapsed sections from localStorage:", error)
    }
    return new Set()
  })

  // Persist collapsed sections state to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      localStorage.setItem(
        getCollapsedSectionsKey(tableName),
        JSON.stringify(Array.from(collapsedSections))
      )
    } catch (error) {
      console.warn("Failed to save collapsed sections to localStorage:", error)
    }
  }, [collapsedSections, tableName])

  const toggleSection = (sectionName: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(sectionName)) {
        next.delete(sectionName)
      } else {
        next.add(sectionName)
      }
      return next
    })
  }

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
    setShowDeleteConfirm(true)
  }

  async function confirmDelete() {
    if (!rowId || !tableName || deleting) return

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

  // Get fields to display
  const fieldsToDisplay = useMemo(() => {
    if (fieldNames.length > 0) {
      // Use provided field names
      return fieldNames
        .map((name) => tableFields.find((f) => f.name === name))
        .filter((f): f is TableField => f !== undefined)
    } else if (record) {
      // Show all fields from record (excluding system fields)
      return tableFields.filter(
        (f) =>
          f.name !== "id" &&
          f.name !== "created_at" &&
          f.name !== "updated_at" &&
          record.hasOwnProperty(f.name)
      )
    }
    return []
  }, [fieldNames, tableFields, record])

  // Section fields if showFieldSections is enabled
  const sectionedFields = useMemo(() => {
    if (!showFieldSections || fieldsToDisplay.length === 0) return null
    return sectionAndSortFields(fieldsToDisplay)
  }, [fieldsToDisplay, showFieldSections])

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
              {showFieldSections && sectionedFields ? (
                // Render with sections
                sectionedFields.map(([sectionName, sectionFields]) => {
                  const isCollapsed = collapsedSections.has(sectionName)
                  return (
                    <div key={sectionName} className="space-y-2">
                      <button
                        type="button"
                        onClick={() => toggleSection(sectionName)}
                        className="w-full flex items-center justify-between text-left py-1 -mx-1 px-1 rounded-md hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                        aria-expanded={!isCollapsed}
                        aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${sectionName} section`}
                      >
                        <span className="text-sm font-semibold text-gray-900">{sectionName}</span>
                        <span className="text-gray-400">
                          {isCollapsed ? (
                            <ChevronRight className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </span>
                      </button>
                      {!isCollapsed && (
                        <div className="space-y-4 pl-4">
                          {sectionFields.map((field) => {
                            const value = formData[field.name]
                            return (
                              <FieldEditor
                                key={field.id}
                                field={field}
                                value={value}
                                onChange={(newValue) => handleFieldChange(field.name, newValue)}
                                required={field.required || false}
                                recordId={rowId || undefined}
                                tableName={tableName}
                              />
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })
              ) : (
                // Render flat list (default behavior)
                fieldsToDisplay.map((field) => {
                  const value = formData[field.name]
                  return (
                    <FieldEditor
                      key={field.id}
                      field={field}
                      value={value}
                      onChange={(newValue) => handleFieldChange(field.name, newValue)}
                      required={field.required || false}
                      recordId={rowId || undefined}
                      tableName={tableName}
                    />
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
    </>
  )
}
