"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { X, Pin, PinOff, Maximize2, Minimize2, Copy, Trash2, Copy as CopyIcon, ChevronLeft } from "lucide-react"
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
  const router = useRouter()
  const [record, setRecord] = useState<Record<string, any> | null>(null)
  const [fields, setFields] = useState<TableField[]>([])
  const [recordLoading, setRecordLoading] = useState(false)
  const [fieldsLoading, setFieldsLoading] = useState(false)
  const [recordLoaded, setRecordLoaded] = useState(false)
  const [fieldsLoaded, setFieldsLoaded] = useState(false)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [fieldGroups, setFieldGroups] = useState<Record<string, string[]>>({}) // fieldName -> groupName
  const resizeRef = useRef<HTMLDivElement>(null)
  const isResizingRef = useRef(false)

  useEffect(() => {
    if (state.isOpen && state.tableId && state.recordId) {
      setRecordLoaded(false)
      setFieldsLoaded(false)
      loadRecord()
      loadFields()
      loadFieldGroups()
    } else {
      setRecord(null)
      setFormData({})
      setFields([])
      setRecordLoaded(false)
      setFieldsLoaded(false)
    }
  }, [state.isOpen, state.tableId, state.recordId, state.modalFields])

  useEffect(() => {
    if (record) {
      setFormData({ ...record })
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
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [state.isOpen, state.isPinned, closeRecord])

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

    setRecordLoading(true)
    setRecordLoaded(false)
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
      setRecordLoading(false)
      setRecordLoaded(true)
    }
  }

  async function loadFields() {
    if (!state.tableId) return

    setFieldsLoading(true)
    setFieldsLoaded(false)
    try {
      const supabase = createClient()
      // Load ALL fields, ordered by order_index (fallback to position)
      const { data, error } = await supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", state.tableId)
        .order("order_index", { ascending: true, nullsFirst: false })
        .order("position", { ascending: true })

      if (!error && data) {
        let allFields = data as TableField[]
        
        // Filter fields based on modal_fields if provided
        if (state.modalFields && state.modalFields.length > 0) {
          allFields = allFields.filter((field) => 
            state.modalFields!.includes(field.name) || state.modalFields!.includes(field.id)
          )
          // Sort by modal_fields order
          allFields.sort((a, b) => {
            const indexA = state.modalFields!.indexOf(a.name)
            const indexB = state.modalFields!.indexOf(b.name)
            if (indexA === -1 && indexB === -1) return 0
            if (indexA === -1) return 1
            if (indexB === -1) return -1
            return indexA - indexB
          })
        }
        
        setFields(allFields)
        // Build field groups from field metadata (for legacy support)
        // RecordFields will use field.group_name directly, but we keep this for backward compatibility
        const groups: Record<string, string[]> = {}
        allFields.forEach((field: any) => {
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
      console.error("Error loading fields:", error)
    } finally {
      setFieldsLoading(false)
      setFieldsLoaded(true)
    }
  }

  async function loadFieldGroups() {
    // Field groups are now loaded as part of loadFields()
    // This function is kept for backward compatibility but does nothing
    // RecordFields component uses field.group_name directly from the fields array
  }

  const handleFieldChange = useCallback(async (fieldName: string, value: any) => {
    if (!state.recordId || !state.tableName) return

    // Optimistic local update
    setFormData((prev) => ({ ...prev, [fieldName]: value }))
    setRecord((prev) => (prev ? { ...prev, [fieldName]: value } : prev))

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from(state.tableName)
        .update({ [fieldName]: value })
        .eq("id", state.recordId)

      if (error) throw error
    } catch (error: any) {
      console.error("Error updating field:", error)
      toast({
        title: "Failed to update field",
        description: error.message || "Please try again",
        variant: "destructive",
      })
      // Revert by reloading record from server
      loadRecord()
    }
  }, [state.recordId, state.tableName, toast])

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

  // Handle back button - navigate to core data table view if in fullscreen, otherwise use history
  const handleBack = useCallback(() => {
    if (state.isFullscreen && state.tableId) {
      // In fullscreen mode, navigate to the core data table view
      router.push(`/tables/${state.tableId}`)
    } else {
      // In side panel mode, use history-based navigation
      goBack()
    }
  }, [state.isFullscreen, state.tableId, router, goBack])

  if (!state.isOpen) return null

  const headerLoading = !recordLoaded || !fieldsLoaded || recordLoading || fieldsLoading

  const panelWidth = state.isFullscreen ? "100%" : `${state.width}px`
  // Show back button if in fullscreen (to go to core data) or if there's history
  const canGoBack = state.isFullscreen || state.history.length > 1

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
          onSave={() => {}}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onCopyLink={handleCopyLink}
          saving={false}
          hasChanges={false}
          loading={headerLoading}
        />

        {/* Toolbar */}
        <div className="h-10 border-b border-gray-200 flex items-center justify-between px-4 bg-gray-50">
          <div className="flex items-center gap-2">
            {canGoBack && (
              <button
                onClick={handleBack}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                title={state.isFullscreen ? "Back to Core Data" : "Go back"}
              >
                <ChevronLeft className="h-4 w-4 text-gray-600" />
              </button>
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
          {headerLoading ? (
            <div className="p-6 space-y-6">
              <div className="space-y-3">
                <div className="h-4 w-1/3 bg-gray-200 rounded animate-pulse" />
                <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-1/4 bg-gray-200 rounded animate-pulse" />
                <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-1/3 bg-gray-200 rounded animate-pulse" />
                <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
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
                tableName={state.tableName || undefined}
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

