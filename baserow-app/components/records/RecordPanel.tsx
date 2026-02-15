"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { X, Pin, PinOff, Maximize2, Minimize2, Copy, Trash2, Copy as CopyIcon, ChevronLeft, Pencil, Check } from "lucide-react"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import { useSelectionContext } from "@/contexts/SelectionContext"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import RecordHeader from "./RecordHeader"
import RecordFields from "./RecordFields"
import RecordActivity from "./RecordActivity"
import RecordComments from "./RecordComments"
import FieldSettingsDrawer from "@/components/layout/FieldSettingsDrawer"
import { getTableSections } from "@/lib/core-data/section-settings"
import type { TableField } from "@/types/fields"
import { useRecordEditorCore } from "@/lib/interface/record-editor-core"
import { isAbortError } from "@/lib/api/error-handling"
import { useUserRole } from "@/lib/hooks/useUserRole"
import { resolveRecordEditMode } from "@/lib/interface/resolve-record-edit-mode"
import { useIsMobile } from "@/hooks/useResponsive"

const MIN_WIDTH = 320
const MAX_WIDTH = 1200
const DEFAULT_WIDTH = 480

export default function RecordPanel() {
  const { state, closeRecord, setWidth, togglePin, toggleFullscreen, goBack, navigateToLinkedRecord } = useRecordPanel()
  const { selectedContext, setSelectedContext } = useSelectionContext()
  const onRecordDeleted = state.onRecordDeleted
  const { toast } = useToast()
  const router = useRouter()
  const { role } = useUserRole()
  const isMobile = useIsMobile()
  const [fields, setFields] = useState<TableField[]>([])
  const [fieldsLoading, setFieldsLoading] = useState(false)
  const [fieldsLoaded, setFieldsLoaded] = useState(false)
  const [fieldGroups, setFieldGroups] = useState<Record<string, string[]>>({}) // fieldName -> groupName
  const modalFieldsKey = useMemo(
    () => (state.modalFields ?? []).join("|"),
    [state.modalFields]
  )
  
  // P1 FIX: interfaceMode === 'edit' is ABSOLUTE - no manual overrides allowed
  // When interfaceMode === 'edit', editing is forced (derived value, cannot be disabled)
  // When interfaceMode === 'view', allow manual toggle via state
  const interfaceMode = state.interfaceMode ?? 'view'
  const forcedEditMode = resolveRecordEditMode({ interfaceMode, initialEditMode: false })
  const [manualEditMode, setManualEditMode] = useState(false)
  
  // P1 FIX: When forcedEditMode is true, ignore manualEditMode (no hybrid states)
  // Combined edit mode: forced OR manual (but forced takes absolute precedence)
  const isPanelEditing = forcedEditMode || (!forcedEditMode && manualEditMode)
  
  const resizeRef = useRef<HTMLDivElement>(null)
  const isResizingRef = useRef(false)
  const resizeCleanupRef = useRef<null | (() => void)>(null)

  const active = Boolean(state.isOpen && state.tableId && state.recordId)
  const cascadeContext = state.cascadeContext
  const core = useRecordEditorCore({
    tableId: state.tableId ?? "",
    recordId: state.recordId,
    supabaseTableName: state.tableName ?? undefined,
    modalFields: state.modalFields ?? [],
    active,
    cascadeContext,
    onDeleted: () => {
      toast({
        title: "Record deleted",
        description: "The record has been removed.",
      })
      onRecordDeleted?.()
      closeRecord()
    },
  })

  const { loading: recordLoading, formData, setFormData, deleteRecord, canEditRecords, canDeleteRecords } = core
  // Only enforce permission flags when cascadeContext was provided (preserve current behaviour when opened from core data)
  const allowEdit = cascadeContext != null ? canEditRecords : true
  const allowDelete = cascadeContext != null ? canDeleteRecords : true

  // P1 FIX: Reset manual edit state when panel closes OR when interfaceMode changes to 'edit'
  // When interfaceMode === 'edit', manualEditMode must be disabled (forced edit takes precedence)
  useEffect(() => {
    if (!state.isOpen) {
      setManualEditMode(false)
    } else if (forcedEditMode) {
      // When forced edit mode is active, disable manual edit mode (no override allowed)
      setManualEditMode(false)
    }
  }, [state.isOpen, forcedEditMode])

  // Log edit mode state on panel open for debugging
  useEffect(() => {
    if (state.isOpen && process.env.NODE_ENV === 'development') {
      console.log('[RecordPanel] Panel opened:', {
        interfaceMode,
        isPanelEditing,
        forcedEditMode,
        recordId: state.recordId,
      })
    }
  }, [state.isOpen, interfaceMode, isPanelEditing, forcedEditMode, state.recordId])

  const canShowEditButton = role === "admin" || allowEdit
  // P1 FIX: When interfaceMode === 'edit', ALWAYS allow editing (absolute authority, bypasses all checks)
  // When interfaceMode === 'view', require manual toggle via isPanelEditing AND permission checks
  // NO EXCEPTIONS: If forcedEditMode is true, editing is always allowed
  const effectiveAllowEdit = forcedEditMode ? true : (canShowEditButton && isPanelEditing && allowEdit)

  // Dev-only guardrail: warn when RecordPanel opens without cascadeContext (surfaces call sites that may want to pass context later)
  const warnedOpenWithoutContextRef = useRef<string | null>(null)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    if (!active || cascadeContext != null) {
      warnedOpenWithoutContextRef.current = null
      return
    }
    const key = `${state.tableId ?? ''}:${state.recordId ?? ''}`
    if (warnedOpenWithoutContextRef.current === key) return
    warnedOpenWithoutContextRef.current = key
    console.warn(
      '[RecordPanel] Opened without cascadeContext — permissions are permissive (allowEdit/allowDelete true). ' +
      'Pass cascadeContext from the caller (e.g. block config) to enforce canEditRecords/canDeleteRecords. ' +
      'See docs/audits/PERMISSION_ENFORCEMENT_FINAL.md.'
    )
  }, [active, cascadeContext, state.tableId, state.recordId])

  // CRITICAL: Use stable modalFieldsKey to prevent effect churn.
  // Do NOT clear fields on close - keeps RecordFields subtree stable between quick opens.
  useEffect(() => {
    if (state.isOpen && state.tableId && state.recordId) {
      setFieldsLoaded(false)
      loadFields()
      loadFieldGroups()
    } else {
      setFieldsLoaded(false)
      // Do NOT clear fields - preserves hook-using subtree stability (React #185)
    }
  }, [state.isOpen, state.tableId, state.recordId, modalFieldsKey])

  // Track whether we've seen the core attempt a load (loading=true). Only treat as "record not found"
  // when a load actually completed with empty data — not during initial render when loading starts false.
  const hasAttemptedLoadRef = useRef(false)
  useEffect(() => {
    if (active && recordLoading) hasAttemptedLoadRef.current = true
    if (!active) hasAttemptedLoadRef.current = false
  }, [active, recordLoading])

  // When core finished loading but formData is empty (e.g. 404), treat as record not found.
  // Must have attempted a load first — avoids false positive on first click (loading starts false).
  useEffect(() => {
    if (
      active &&
      state.recordId &&
      hasAttemptedLoadRef.current &&
      !recordLoading &&
      Object.keys(formData).length === 0
    ) {
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

  const isViewOnly = (cascadeContext?.blockConfig as any)?.permissions?.mode === 'view' || (cascadeContext?.pageConfig as any)?.permissions?.mode === 'view'
  const handleFieldLabelClick = useCallback((fieldId: string) => {
    if (!state.tableId) return
    setSelectedContext({ type: "field", fieldId, tableId: state.tableId })
  }, [state.tableId, setSelectedContext])

  // FieldSettingsDrawer overlay: when RightSettingsPanel is hidden (panel open), show overlay on field label click
  const selectedFieldForDrawer = useMemo(() => {
    if (selectedContext?.type !== "field" || selectedContext.tableId !== state.tableId) return null
    return fields.find((f) => f.id === selectedContext.fieldId) ?? null
  }, [selectedContext, state.tableId, fields])

  const [sections, setSections] = useState<Array<{ name: string; display_name?: string }>>([])
  useEffect(() => {
    if (state.isOpen && state.tableId) {
      getTableSections(state.tableId).then(setSections).catch(() => setSections([]))
    }
  }, [state.isOpen, state.tableId])

  const showFieldSettingsDrawer = Boolean(state.isOpen && selectedFieldForDrawer)

  const handleFieldChange = useCallback(async (fieldName: string, value: any) => {
    if (!state.recordId || !state.tableName || !effectiveAllowEdit) return

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
  }, [state.recordId, state.tableName, toast, setFormData, refetchRecord, effectiveAllowEdit])

  const handleDelete = useCallback(async () => {
    if (!state.recordId || !state.tableName) return
    if (!allowDelete) {
      toast({
        variant: "destructive",
        title: "Not allowed",
        description: "You don't have permission to delete this record.",
      })
      return
    }
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
  }, [state.recordId, state.tableName, deleteRecord, toast, allowDelete])

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
      // P1 FIX: Open the new record, preserving interfaceMode (linked records inherit edit mode)
      if (data?.id && state.tableId && state.tableName) {
        navigateToLinkedRecord(state.tableId, data.id, state.tableName, interfaceMode)
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

  // Context-driven: RecordPanel always overlays (never pushes layout)
  const useOverlayLayout = true

  const headerLoading = recordLoading || !fieldsLoaded || fieldsLoading
  // Safe hasRecord: only true when load completed with data. Avoids transient formData emptiness
  // causing hook-using subtrees (RecordFields) to mount/unmount (React #185).
  const hasRecord =
    !recordLoading &&
    hasAttemptedLoadRef.current &&
    !!formData &&
    Object.keys(formData).length > 0

  const panelWidth = state.isFullscreen ? "100%" : `${state.width}px`
  // Show back button if in fullscreen (to go to core data) or if there's history
  const canGoBack = state.isFullscreen || state.history.length > 1

  // P2 FIX: On mobile/fullscreen, return null when closed (overlay behavior)
  // On desktop inline mode, always render but with width 0 when closed
  if (!state.isOpen && useOverlayLayout) return null

  return (
    <>
      {/* P2 FIX: Backdrop - only show on mobile or when fullscreen (overlay mode) */}
      {useOverlayLayout && !state.isPinned && state.isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 transition-opacity"
          onClick={closeRecord}
        />
      )}

      {/* P2 FIX: Panel - inline flex layout on desktop, fixed overlay on mobile/fullscreen */}
      {/* CRITICAL: Remount key includes interfaceMode to force remount when edit context changes */}
      <div
        key={`record-panel-${state.recordId}-${interfaceMode}`}
        className={`${
          useOverlayLayout
            ? "fixed right-0 top-0 h-full z-50"
            : "flex-shrink-0 border-l border-gray-200"
        } bg-white shadow-xl flex flex-col transition-all duration-300 ease-out`}
        style={{
          width: state.isOpen ? panelWidth : "0px",
          transform: useOverlayLayout && !state.isOpen ? "translateX(100%)" : "none",
          minWidth: !useOverlayLayout && state.isOpen ? `${state.width}px` : undefined,
          maxWidth: !useOverlayLayout && state.isOpen ? `${state.width}px` : undefined,
          overflow: state.isOpen ? undefined : "hidden",
        }}
      >
        {/* P2 FIX: Resize Handle - only show in inline mode (not fullscreen, not mobile) */}
        {!state.isFullscreen && !isMobile && state.isOpen && (
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
                // P2 FIX: Calculate width from right edge of viewport
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
          canEdit={effectiveAllowEdit}
          canDelete={allowDelete}
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
            {/* P1 FIX: Show Edit button ONLY when NOT in interface edit mode (Airtable-style) */}
            {/* When interfaceMode === 'edit', panel is already editable, so hide the button */}
            {/* Edit button is hidden when forcedEditMode is true - no manual override allowed */}
            {canShowEditButton && !forcedEditMode && (
              <button
                type="button"
                onClick={() => {
                  // P1 FIX: Prevent toggling if forcedEditMode becomes true during click
                  if (!forcedEditMode) {
                    setManualEditMode((v) => !v)
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-sm font-medium transition-colors ${
                  isPanelEditing
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-white border border-gray-200 hover:bg-gray-100 text-gray-700"
                }`}
                aria-label={isPanelEditing ? "Done editing" : "Edit record"}
                title={isPanelEditing ? "Done editing" : "Edit record"}
                disabled={forcedEditMode}
              >
                {isPanelEditing ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Done
                  </>
                ) : (
                  <>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </>
                )}
              </button>
            )}
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
                isFieldEditable={() => effectiveAllowEdit}
                onFieldLabelClick={handleFieldLabelClick}
              />

              {/* Activity Section */}
              <RecordActivity
                record={formData}
                tableId={state.tableId || ""}
              />

              {/* Comments Section */}
              <RecordComments
                tableId={state.tableId || ""}
                recordId={state.recordId || ""}
                canAddComment={effectiveAllowEdit}
              />
            </div>
          )}
        </div>
      </div>

      {/* FieldSettingsDrawer overlay: when field label clicked, RightSettingsPanel is hidden so we render overlay */}
      {showFieldSettingsDrawer && selectedFieldForDrawer && (
        <>
          <div
            className="fixed inset-0 z-[59] bg-black/20"
            onClick={() => setSelectedContext(null)}
            aria-hidden="true"
          />
          <div className="fixed right-0 top-0 h-full w-[400px] z-[60] bg-white border-l border-gray-200 shadow-xl overflow-y-auto">
            <FieldSettingsDrawer
              field={selectedFieldForDrawer}
              open={true}
              onOpenChange={(open) => !open && setSelectedContext(null)}
              tableId={state.tableId || ""}
              tableFields={fields}
              sections={sections}
              onSave={() => setSelectedContext(null)}
              embedded
              permissionsReadOnly={isViewOnly}
            />
          </div>
        </>
      )}
    </>
  )
}

