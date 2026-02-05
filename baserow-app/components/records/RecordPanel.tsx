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
import { useRecordEditorCore } from "@/lib/interface/record-editor-core"
import { isAbortError } from "@/lib/api/error-handling"

const MIN_WIDTH = 320
const MAX_WIDTH = 1200
const DEFAULT_WIDTH = 480

export default function RecordPanel() {
  const { state, closeRecord, setWidth, togglePin, toggleFullscreen, goBack, navigateToLinkedRecord } = useRecordPanel()
  const { toast } = useToast()
  const router = useRouter()
  const [fields, setFields] = useState<TableField[]>([])
  const [fieldsLoading, setFieldsLoading] = useState(false)
  const [fieldsLoaded, setFieldsLoaded] = useState(false)
  const [fieldGroups, setFieldGroups] = useState<Record<string, string[]>>({}) // fieldName -> groupName
  const resizeRef = useRef<HTMLDivElement>(null)
  const isResizingRef = useRef(false)
  const resizeCleanupRef = useRef<null | (() => void)>(null)

  const active = Boolean(state.isOpen && state.tableId && state.recordId)
  const core = useRecordEditorCore({
    tableId: state.tableId ?? "",
    recordId: state.recordId,
    supabaseTableName: state.tableName ?? undefined,
    modalFields: state.modalFields ?? [],
    active,
    onDeleted: () => {
      toast({
        title: "Record deleted",
        description: "The record has been removed.",
      })
      closeRecord()
    },
  })

  const { loading: recordLoading, formData, setFormData, deleteRecord } = core

  useEffect(() => {
    if (state.isOpen && state.tableId && state.recordId) {
      setFieldsLoaded(false)
      loadFields()
      loadFieldGroups()
    } else {
      setFields([])
      setFieldsLoaded(false)
    }
  }, [state.isOpen, state.tableId, state.recordId, state.modalFields])

  // When core finished loading but formData is empty (e.g. 404), treat as record not found
  useEffect(() => {
    if (active && state.recordId && !recordLoading && Object.keys(formData).length === 0) {
      toast({
        title: "Record not found",
        description: "This record may have been deleted.",
        variant: "destructive",
      })
      closeRecord()
    }
  }, [active, state.recordId, recordLoading, formData, closeRecord, toast])

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
  // Important: we attach mousemove/mouseup listeners *on mousedown*.
  // Using a ref alone won't trigger this effect, and can leave the page "stuck"
  // with cursor/userSelect styles until refresh.
  useEffect(() => {
    return () => {
      // Cleanup on unmount / route change
      resizeCleanupRef.current?.()
      resizeCleanupRef.current = null
      isResizingRef.current = false
    }
  }, [])

  const refetchRecord = useCallback(async () => {
    if (!state.recordId || !state.tableName) return
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from(state.tableName)
        .select("*")
        .eq("id", state.recordId)
        .single()
      if (!error && data) setFormData(data)
    } catch (e) {
      if (!isAbortError(e)) console.error("Error refetching record:", e)
    }
  }, [state.recordId, state.tableName, setFormData])

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
      await refetchRecord()
    }
  }, [state.recordId, state.tableName, toast, setFormData, refetchRecord])

  const handleDelete = useCallback(async () => {
    if (!state.recordId || !state.tableName) return
    try {
      await deleteRecord({
        confirmMessage: "Are you sure you want to delete this record? This action cannot be undone.",
      })
    } catch (error: any) {
      if (!isAbortError(error)) {
        console.error("Error deleting record:", error)
        toast({
          title: "Failed to delete record",
          description: error.message || "Please try again",
          variant: "destructive",
        })
      }
    }
  }, [state.recordId, state.tableName, deleteRecord, toast])

  const handleCopyLink = useCallback(() => {
    const url = `${window.location.origin}/tables/${state.tableId}/records/${state.recordId}`
    navigator.clipboard.writeText(url)
    toast({
      title: "Link copied",
      description: "Record link copied to clipboard",
    })
  }, [state.tableId, state.recordId, toast])

  const handleDuplicate = useCallback(async () => {
    if (!state.tableName || !formData || Object.keys(formData).length === 0) return

    try {
      const supabase = createClient()
      const { id, created_at, updated_at, ...recordData } = formData
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
  }, [state.tableName, formData, state.tableId, navigateToLinkedRecord, toast])

  // Handle back button - go back to the view we came from (core data, interface, etc.)
  const handleBack = useCallback(() => {
    if (state.isFullscreen) {
      // In fullscreen mode, use browser history so we return to the previous view
      router.back()
    } else {
      // In side panel mode, use record history (previous record in stack)
      goBack()
    }
  }, [state.isFullscreen, router, goBack])

  if (!state.isOpen) return null

  const headerLoading = recordLoading || !fieldsLoaded || fieldsLoading
  const hasRecord = formData && Object.keys(formData).length > 0

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
              // If a previous resize got "stuck", clean it up first.
              resizeCleanupRef.current?.()

              isResizingRef.current = true
              const prevCursor = document.body.style.cursor
              const prevUserSelect = document.body.style.userSelect
              document.body.style.cursor = "col-resize"
              document.body.style.userSelect = "none"

              const handleMouseMove = (ev: MouseEvent) => {
                if (!isResizingRef.current) return
                const raw = window.innerWidth - ev.clientX
                const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, raw))
                setWidth(clamped)
              }

              const handleMouseUp = () => {
                isResizingRef.current = false
                document.body.style.cursor = prevCursor
                document.body.style.userSelect = prevUserSelect
                document.removeEventListener("mousemove", handleMouseMove)
                document.removeEventListener("mouseup", handleMouseUp)
                resizeCleanupRef.current = null
              }

              resizeCleanupRef.current = handleMouseUp
              document.addEventListener("mousemove", handleMouseMove)
              document.addEventListener("mouseup", handleMouseUp)
            }}
          />
        )}

        {/* Header */}
        <RecordHeader
          record={hasRecord ? formData : null}
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
                title="Go back"
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
          ) : !hasRecord ? (
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
                record={formData}
                tableId={state.tableId || ""}
              />
            </div>
          )}
        </div>
      </div>
    </>
  )
}

