"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { X, Pin, PinOff, Maximize2, Minimize2, Copy, Trash2, Copy as CopyIcon, ChevronLeft, Save } from "lucide-react"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import RecordHeader from "./RecordHeader"
import RecordFields from "./RecordFields"
import RecordActivity from "./RecordActivity"
import type { TableField } from "@/types/fields"

const MIN_WIDTH = 320
const MAX_WIDTH = 1200
const DEFAULT_WIDTH = 480

export default function RecordPanel() {
  const { state, closeRecord, setWidth, togglePin, toggleFullscreen, goBack, navigateToLinkedRecord } = useRecordPanel()
  const { toast } = useToast()
  const [record, setRecord] = useState<Record<string, any> | null>(null)
  const [fields, setFields] = useState<TableField[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [fieldGroups, setFieldGroups] = useState<Record<string, string[]>>({}) // fieldName -> groupName
  const resizeRef = useRef<HTMLDivElement>(null)
  const isResizingRef = useRef(false)

  useEffect(() => {
    if (state.isOpen && state.tableId && state.recordId) {
      loadRecord()
      loadFields()
      loadFieldGroups()
    } else {
      setRecord(null)
      setFormData({})
      setHasChanges(false)
    }
  }, [state.isOpen, state.tableId, state.recordId])

  useEffect(() => {
    if (record) {
      setFormData({ ...record })
      setHasChanges(false)
    }
  }, [record])

  // Keyboard shortcuts
  useEffect(() => {
    if (!state.isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Close on Escape (unless pinned)
      if (e.key === "Escape" && !state.isPinned) {
        closeRecord()
      }
      // Save on Cmd/Ctrl + S
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault()
        if (hasChanges) {
          handleSave()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [state.isOpen, state.isPinned, hasChanges, closeRecord])

  // Resize handler
  useEffect(() => {
    if (!state.isOpen || state.isFullscreen) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current || !resizeRef.current) return
      const newWidth = window.innerWidth - e.clientX
      setWidth(newWidth)
    }

    const handleMouseUp = () => {
      isResizingRef.current = false
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }

    if (isResizingRef.current) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [state.isOpen, state.isFullscreen, setWidth])

  async function loadRecord() {
    if (!state.tableId || !state.recordId || !state.tableName) return

    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from(state.tableName)
        .select("*")
        .eq("id", state.recordId)
        .single()

      if (error) {
        if (error.code === "PGRST116") {
          // Record not found
        toast({
          title: "Record not found",
          description: "This record may have been deleted.",
          variant: "destructive",
        })
          closeRecord()
        } else {
          throw error
        }
      } else {
        setRecord(data)
      }
    } catch (error: any) {
      console.error("Error loading record:", error)
      toast({
        title: "Failed to load record",
        description: error.message || "Please try again",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  async function loadFields() {
    if (!state.tableId) return

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", state.tableId)
        .order("position", { ascending: true })

      if (!error && data) {
        setFields(data as TableField[])
      }
    } catch (error) {
      console.error("Error loading fields:", error)
    }
  }

  async function loadFieldGroups() {
    if (!state.tableId) return

    try {
      const supabase = createClient()
      // Load field groups from table_fields (if group_name exists)
      const { data, error } = await supabase
        .from("table_fields")
        .select("name, group_name")
        .eq("table_id", state.tableId)
        .not("group_name", "is", null)

      if (!error && data) {
        const groups: Record<string, string[]> = {}
        data.forEach((field: any) => {
          if (field.group_name) {
            if (!groups[field.group_name]) {
              groups[field.group_name] = []
            }
            groups[field.group_name].push(field.name)
          }
        })
        setFieldGroups(groups)
      }
    } catch (error) {
      // Field groups may not exist yet - this is fine
      console.warn("Field groups not available:", error)
    }
  }

  const handleSave = useCallback(async () => {
    if (!state.recordId || !state.tableName || saving || !hasChanges) return

    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from(state.tableName)
        .update(formData)
        .eq("id", state.recordId)

      if (error) {
        throw error
      }

      await loadRecord()
      setHasChanges(false)
      toast({
        variant: "success",
        title: "Record saved",
        description: "Changes have been saved successfully.",
      })
    } catch (error: any) {
      console.error("Error saving record:", error)
      toast({
        title: "Failed to save record",
        description: error.message || "Please try again",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }, [state.recordId, state.tableName, formData, saving, hasChanges, toast])

  const handleFieldChange = useCallback((fieldName: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [fieldName]: value,
    }))
    setHasChanges(true)
  }, [])

  const handleDelete = useCallback(async () => {
    if (!state.recordId || !state.tableName) return

    const confirmed = window.confirm(
      "Are you sure you want to delete this record? This action cannot be undone."
    )
    if (!confirmed) return

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from(state.tableName)
        .delete()
        .eq("id", state.recordId)

      if (error) {
        throw error
      }

      toast({
        title: "Record deleted",
        description: "The record has been removed.",
      })
      closeRecord()
    } catch (error: any) {
      console.error("Error deleting record:", error)
      toast({
        title: "Failed to delete record",
        description: error.message || "Please try again",
        variant: "destructive",
      })
    }
  }, [state.recordId, state.tableName, closeRecord, toast])

  const handleCopyLink = useCallback(() => {
    const url = `${window.location.origin}/tables/${state.tableId}/records/${state.recordId}`
    navigator.clipboard.writeText(url)
    toast({
      title: "Link copied",
      description: "Record link copied to clipboard",
    })
  }, [state.tableId, state.recordId, toast])

  const handleDuplicate = useCallback(async () => {
    if (!state.tableName || !record) return

    try {
      const supabase = createClient()
      const { id, created_at, updated_at, ...recordData } = record
      const { data, error } = await supabase
        .from(state.tableName)
        .insert([recordData])
        .select()
        .single()

      if (error) {
        throw error
      }

      toast({
        title: "Record duplicated",
        description: "A copy of this record has been created.",
        variant: "success",
      })
      // Open the new record
      if (data?.id && state.tableId && state.tableName) {
        navigateToLinkedRecord(state.tableId, data.id, state.tableName)
      }
    } catch (error: any) {
      console.error("Error duplicating record:", error)
      toast({
        title: "Failed to duplicate record",
        description: error.message || "Please try again",
        variant: "destructive",
      })
    }
  }, [state.tableName, record, state.tableId])

  if (!state.isOpen) return null

  const panelWidth = state.isFullscreen ? "100%" : `${state.width}px`
  const canGoBack = state.history.length > 1

  return (
    <>
      {/* Backdrop - only show if not pinned and not fullscreen */}
      {!state.isPinned && !state.isFullscreen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 transition-opacity"
          onClick={closeRecord}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 h-full bg-white shadow-xl z-50 flex flex-col transition-all duration-300 ease-out ${
          state.isFullscreen ? "" : ""
        }`}
        style={{
          width: panelWidth,
          transform: state.isOpen ? "translateX(0)" : "translateX(100%)",
        }}
      >
        {/* Resize Handle */}
        {!state.isFullscreen && (
          <div
            ref={resizeRef}
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 transition-colors z-10"
            onMouseDown={(e) => {
              e.preventDefault()
              isResizingRef.current = true
              document.body.style.cursor = "col-resize"
              document.body.style.userSelect = "none"
            }}
          />
        )}

        {/* Header */}
        <RecordHeader
          record={record}
          tableName={state.tableName || ""}
          fields={fields}
          formData={formData}
          onFieldChange={handleFieldChange}
          onSave={handleSave}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onCopyLink={handleCopyLink}
          saving={saving}
          hasChanges={hasChanges}
          loading={loading}
        />

        {/* Toolbar */}
        <div className="h-10 border-b border-gray-200 flex items-center justify-between px-4 bg-gray-50">
          <div className="flex items-center gap-2">
            {canGoBack && (
              <button
                onClick={goBack}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                title="Go back"
              >
                <ChevronLeft className="h-4 w-4 text-gray-600" />
              </button>
            )}
            {hasChanges && (
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
              onClick={handleCopyLink}
              className="p-1.5 hover:bg-gray-200 rounded transition-colors"
              title="Copy link"
            >
              <CopyIcon className="h-4 w-4 text-gray-600" />
            </button>
            <button
              onClick={togglePin}
              className={`p-1.5 hover:bg-gray-200 rounded transition-colors ${
                state.isPinned ? "bg-blue-100 text-blue-600" : ""
              }`}
              title={state.isPinned ? "Unpin panel" : "Pin panel"}
            >
              {state.isPinned ? (
                <Pin className="h-4 w-4" />
              ) : (
                <PinOff className="h-4 w-4 text-gray-600" />
              )}
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 hover:bg-gray-200 rounded transition-colors"
              title={state.isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {state.isFullscreen ? (
                <Minimize2 className="h-4 w-4 text-gray-600" />
              ) : (
                <Maximize2 className="h-4 w-4 text-gray-600" />
              )}
            </button>
            {!state.isPinned && (
              <button
                onClick={closeRecord}
                className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                title="Close"
              >
                <X className="h-4 w-4 text-gray-600" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Loading record...</p>
              </div>
            </div>
          ) : !record ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">Record not found</p>
                <p className="text-xs text-gray-400">This record may have been deleted.</p>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Fields Section */}
              <RecordFields
                fields={fields}
                formData={formData}
                onFieldChange={handleFieldChange}
                fieldGroups={fieldGroups}
                tableId={state.tableId || ""}
                recordId={state.recordId || ""}
              />

              {/* Activity Section */}
              <RecordActivity
                record={record}
                tableId={state.tableId || ""}
              />
            </div>
          )}
        </div>
      </div>
    </>
  )
}

