"use client"

import { useEffect, useState, useMemo } from "react"
import { X, Save, Trash2, ChevronDown, ChevronRight } from "lucide-react"

import type { TableField } from "@/types/fields"
import FieldEditor from "@/components/fields/FieldEditor"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { sectionAndSortFields } from "@/lib/fields/sectioning"
import { useRecordEditorCore, type RecordEditorCascadeContext } from "@/lib/interface/record-editor-core"
import { isAbortError } from "@/lib/api/error-handling"

interface RecordDrawerProps {
  tableId: string
  isOpen: boolean
  onClose: () => void
  tableName: string
  rowId: string | null
  fieldNames: string[]
  tableFields?: TableField[]
  onSave?: () => void
  onDelete?: () => void
  showFieldSections?: boolean // Optional: show fields grouped by sections (default: false)
  /** Optional: when provided, permission flags from cascade are applied (edit/delete). */
  cascadeContext?: RecordEditorCascadeContext | null
}

const getCollapsedSectionsKey = (tableName: string) => `record-drawer-collapsed-sections-${tableName}`

export default function RecordDrawer({
  tableId,
  isOpen,
  onClose,
  tableName,
  rowId,
  fieldNames,
  tableFields = [],
  onSave,
  onDelete,
  showFieldSections = false,
  cascadeContext,
}: RecordDrawerProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const core = useRecordEditorCore({
    tableId,
    recordId: rowId,
    supabaseTableName: tableName,
    tableFields: tableFields.length > 0 ? tableFields : null,
    modalFields: fieldNames,
    active: isOpen,
    cascadeContext,
    saveOnFieldChange: true,
    onSave: () => {
      onSave?.()
      onClose()
    },
    onDeleted: () => {
      onDelete?.()
      onClose()
    },
  })

  const {
    loading,
    formData,
    fields: fieldsToDisplay,
    saving,
    deleting,
    save,
    deleteRecord,
    handleFieldChange,
    canEditRecords,
    canDeleteRecords,
    saveOnFieldChange,
  } = core

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
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [isOpen, onClose])

  function handleDelete() {
    if (!rowId || !tableName || deleting) return
    setShowDeleteConfirm(true)
  }

  async function confirmDelete() {
    if (!rowId || !tableName || deleting) return
    try {
      await deleteRecord({ skipConfirm: true })
    } catch (error: any) {
      if (!isAbortError(error)) {
        console.error("Error deleting record:", error)
        alert("Failed to delete record: " + (error?.message ?? "Please try again"))
      }
    }
  }

  async function handleSave() {
    try {
      await save()
    } catch (error: any) {
      if (!isAbortError(error)) {
        console.error("Error saving record:", error)
        alert("Failed to save record: " + (error?.message ?? "Please try again"))
      }
    }
  }

  // Section fields if showFieldSections is enabled
  const sectionedFields = useMemo(() => {
    if (!showFieldSections || fieldsToDisplay.length === 0) return null
    return sectionAndSortFields(fieldsToDisplay)
  }, [fieldsToDisplay, showFieldSections])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop - exclude sidebar (left 256px) on md+ so navigation remains clickable */}
      <div
        className="fixed inset-0 md:left-64 bg-black/20 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
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
          ) : formData && Object.keys(formData).length > 0 ? (
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
                                isReadOnly={!canEditRecords}
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
                      isReadOnly={!canEditRecords}
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
            disabled={deleting || !rowId || !canDeleteRecords}
            className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            title={!canDeleteRecords ? "You don't have permission to delete this record" : undefined}
            aria-disabled={deleting || !rowId || !canDeleteRecords}
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? "Deleting..." : "Delete"}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              {saveOnFieldChange && rowId ? "Close" : "Cancel"}
            </button>
            {(!saveOnFieldChange || !rowId) && (
              <button
                onClick={handleSave}
                disabled={saving || !rowId || !canEditRecords}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                title={!canEditRecords ? "You don't have permission to edit this record" : undefined}
                aria-disabled={saving || !rowId || !canEditRecords}
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save"}
              </button>
            )}
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
