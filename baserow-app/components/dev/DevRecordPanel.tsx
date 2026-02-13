"use client"

/**
 * Dev-only record panel with Airtable-style layered editing.
 * - View mode: inline editing only, no layout controls
 * - "Customize Layout" sets uiMode to recordLayoutEdit
 * - recordLayoutEdit: field reorder, hide/show, section controls
 * Does NOT modify production RecordPanel.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  X,
  Pin,
  PinOff,
  Maximize2,
  Minimize2,
  Copy as CopyIcon,
  ChevronLeft,
  Pencil,
  Check,
  LayoutGrid,
  Settings2,
} from "lucide-react"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import { useUIState } from "@/contexts/UIStateContext"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import RecordHeader from "@/components/records/RecordHeader"
import RecordFields from "@/components/records/RecordFields"
import RecordActivity from "@/components/records/RecordActivity"
import type { TableField } from "@/types/fields"
import type { FieldLayoutItem } from "@/lib/interface/field-layout-utils"
import { useRecordEditorCore } from "@/lib/interface/record-editor-core"
import { isAbortError } from "@/lib/api/error-handling"
import { useUserRole } from "@/lib/hooks/useUserRole"
import { useIsMobile } from "@/hooks/useResponsive"
import FieldSchemaDrawer from "./FieldSchemaDrawer"

const MIN_WIDTH = 320
const MAX_WIDTH = 1200
const DEFAULT_WIDTH = 480

export default function DevRecordPanel() {
  const { state, closeRecord, setWidth, togglePin, toggleFullscreen, goBack, navigateToLinkedRecord } =
    useRecordPanel()
  const { uiMode, setUIMode } = useUIState()
  const onRecordDeleted = state.onRecordDeleted
  const { toast } = useToast()
  const router = useRouter()
  const { role } = useUserRole()
  const isMobile = useIsMobile()
  const [fields, setFields] = useState<TableField[]>([])
  const [fieldsLoading, setFieldsLoading] = useState(false)
  const [fieldsLoaded, setFieldsLoaded] = useState(false)
  const [fieldGroups, setFieldGroups] = useState<Record<string, string[]>>({})
  const [manualEditMode, setManualEditMode] = useState(false)
  const [draftFieldLayout, setDraftFieldLayout] = useState<FieldLayoutItem[] | null>(null)
  const [schemaDrawerOpen, setSchemaDrawerOpen] = useState(false)
  const [selectedFieldForSchema, setSelectedFieldForSchema] = useState<TableField | null>(null)

  const interfaceMode = state.interfaceMode ?? "view"
  const isPanelEditing = interfaceMode === "edit" || manualEditMode
  const isRecordLayoutEdit = uiMode === "recordLayoutEdit"

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
      toast({ title: "Record deleted", description: "The record has been removed." })
      onRecordDeleted?.()
      closeRecord()
      setUIMode("view")
    },
  })

  const { loading: recordLoading, formData, setFormData, deleteRecord, canEditRecords, canDeleteRecords } = core
  const allowEdit = cascadeContext != null ? canEditRecords : true
  const allowDelete = cascadeContext != null ? canDeleteRecords : true

  useEffect(() => {
    if (!state.isOpen) {
      setManualEditMode(false)
      setDraftFieldLayout(null)
      setUIMode("view")
    }
  }, [state.isOpen, setUIMode])

  const canShowEditButton = role === "admin" || allowEdit
  const effectiveAllowEdit =
    interfaceMode === "edit" ? true : (canShowEditButton && isPanelEditing && allowEdit)

  useEffect(() => {
    if (state.isOpen && state.tableId && state.recordId) {
      setFieldsLoaded(false)
      loadFields()
    }
  }, [state.isOpen, state.tableId, state.recordId])

  async function loadFields() {
    if (!state.tableId) return
    setFieldsLoading(true)
    setFieldsLoaded(false)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", state.tableId)
        .order("order_index", { ascending: true, nullsFirst: false })
        .order("position", { ascending: true })

      if (!error && data) {
        let allFields = (data as TableField[]).filter((f) => !f.options?.system)
        if (state.modalFields && state.modalFields.length > 0) {
          allFields = allFields.filter(
            (f) => state.modalFields!.includes(f.name) || state.modalFields!.includes(f.id)
          )
          allFields.sort((a, b) => {
            const ia = state.modalFields!.indexOf(a.name)
            const ib = state.modalFields!.indexOf(b.name)
            if (ia === -1 && ib === -1) return 0
            if (ia === -1) return 1
            if (ib === -1) return -1
            return ia - ib
          })
        }
        setFields(allFields)
        const groups: Record<string, string[]> = {}
        allFields.forEach((f: any) => {
          if (f.group_name) {
            groups[f.group_name] = groups[f.group_name] || []
            groups[f.group_name].push(f.name)
          }
        })
        setFieldGroups(groups)
      }
    } catch (e) {
      console.error("Error loading fields:", e)
    } finally {
      setFieldsLoading(false)
      setFieldsLoaded(true)
    }
  }

  const handleFieldChange = useCallback(
    async (fieldName: string, value: any) => {
      if (!state.recordId || !state.tableName || !effectiveAllowEdit) return
      setFormData((prev) => ({ ...prev, [fieldName]: value }))
      try {
        const supabase = createClient()
        const { error } = await supabase
          .from(state.tableName)
          .update({ [fieldName]: value })
          .eq("id", state.recordId)
        if (error) throw error
      } catch (e: any) {
        toast({ title: "Failed to update field", description: e.message, variant: "destructive" })
      }
    },
    [state.recordId, state.tableName, setFormData, effectiveAllowEdit, toast]
  )

  const handleDelete = useCallback(async () => {
    if (!state.recordId || !allowDelete) return
    try {
      await deleteRecord({ confirmMessage: "Are you sure you want to delete this record?" })
    } catch (e) {
      if (!isAbortError(e)) {
        toast({ title: "Failed to delete record", variant: "destructive" })
      }
    }
  }, [state.recordId, deleteRecord, allowDelete, toast])

  const handleDuplicate = useCallback(async () => {
    if (!state.tableName || !formData) return
    try {
      const supabase = createClient()
      const { id, created_at, updated_at, ...rest } = formData
      const { data, error } = await supabase.from(state.tableName!).insert([rest]).select().single()
      if (error) throw error
      toast({ title: "Record duplicated" })
      if (data?.id && state.tableId && state.tableName) {
        navigateToLinkedRecord(state.tableId, data.id, state.tableName, interfaceMode)
      }
    } catch (e: any) {
      toast({ title: "Failed to duplicate", description: e.message, variant: "destructive" })
    }
  }, [state.tableName, state.tableId, formData, navigateToLinkedRecord, interfaceMode, toast])

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(
      `${window.location.origin}/tables/${state.tableId}/records/${state.recordId}`
    )
    toast({ title: "Link copied" })
  }, [state.tableId, state.recordId, toast])

  const handleBack = useCallback(() => {
    if (state.isFullscreen) router.back()
    else goBack()
  }, [state.isFullscreen, router, goBack])

  const handleCustomizeLayout = () => {
    setUIMode("recordLayoutEdit")
    if (!draftFieldLayout && fields.length > 0) {
      setDraftFieldLayout(
        fields.map((f, i) => ({
          field_id: f.id,
          field_name: f.name,
          order: i,
          visible_in_modal: true,
          editable: true,
        }))
      )
    }
  }

  const handleLayoutDone = () => {
    setUIMode("view")
  }

  const handleFieldVisibilityToggle = useCallback((fieldName: string, visible: boolean) => {
    setDraftFieldLayout((prev) => {
      if (!prev) return prev
      return prev.map((item) =>
        item.field_name === fieldName ? { ...item, visible_in_modal: visible } : item
      )
    })
  }, [])

  const handleFieldLayoutChange = useCallback((layout: FieldLayoutItem[]) => {
    setDraftFieldLayout(layout)
  }, [])

  const resolvedFieldLayout = useMemo(() => {
    if (isRecordLayoutEdit && draftFieldLayout && draftFieldLayout.length > 0) {
      return draftFieldLayout
    }
    return fields.map((f, i) => ({
      field_id: f.id,
      field_name: f.name,
      order: i,
      visible_in_modal: true,
      editable: true,
    }))
  }, [isRecordLayoutEdit, draftFieldLayout, fields])

  const visibleFields = useMemo(() => {
    if (!isRecordLayoutEdit) return fields
    return resolvedFieldLayout
      .filter((item) => item.visible_in_modal !== false)
      .sort((a, b) => a.order - b.order)
      .map((item) => fields.find((f) => f.name === item.field_name || f.id === item.field_id))
      .filter(Boolean) as TableField[]
  }, [fields, resolvedFieldLayout, isRecordLayoutEdit])

  const useOverlayLayout = isMobile || state.isFullscreen
  const headerLoading = recordLoading || !fieldsLoaded || fieldsLoading
  const hasRecord = !recordLoading && !!formData && Object.keys(formData).length > 0
  const panelWidth = state.isFullscreen ? "100%" : `${state.width}px`
  const canGoBack = state.isFullscreen || state.history.length > 1

  if (!state.isOpen && useOverlayLayout) return null

  return (
    <>
      {useOverlayLayout && !state.isPinned && state.isOpen && (
        <div className="fixed inset-0 bg-black/20 z-40" onClick={closeRecord} />
      )}
      <div
        key={`dev-record-panel-${state.recordId}`}
        className={`${
          useOverlayLayout ? "fixed right-0 top-0 h-full z-50" : "flex-shrink-0 border-l border-gray-200"
        } bg-white shadow-xl flex flex-col transition-all duration-300`}
        style={{
          width: state.isOpen ? panelWidth : "0px",
          transform: useOverlayLayout && !state.isOpen ? "translateX(100%)" : "none",
          minWidth: !useOverlayLayout && state.isOpen ? `${state.width}px` : undefined,
          maxWidth: !useOverlayLayout && state.isOpen ? `${state.width}px` : undefined,
          overflow: state.isOpen ? undefined : "hidden",
        }}
      >
        {!state.isFullscreen && !isMobile && state.isOpen && (
          <div
            ref={resizeRef}
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-10"
            onMouseDown={(e) => {
              e.preventDefault()
              isResizingRef.current = true
              const prevCursor = document.body.style.cursor
              document.body.style.cursor = "col-resize"
              const onMove = (ev: MouseEvent) => {
                if (!isResizingRef.current) return
                const w = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, window.innerWidth - ev.clientX))
                setWidth(w)
              }
              const onUp = () => {
                isResizingRef.current = false
                document.body.style.cursor = prevCursor
                document.removeEventListener("mousemove", onMove)
                document.removeEventListener("mouseup", onUp)
              }
              document.addEventListener("mousemove", onMove)
              document.addEventListener("mouseup", onUp)
            }}
          />
        )}

        <RecordHeader
          record={hasRecord ? formData : null}
          tableName={state.tableName || ""}
          fields={visibleFields}
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

        <div className="h-10 border-b border-gray-200 flex items-center justify-between px-4 bg-gray-50">
          <div className="flex items-center gap-2">
            {canGoBack && (
              <button onClick={handleBack} className="p-1 hover:bg-gray-200 rounded" title="Go back">
                <ChevronLeft className="h-4 w-4 text-gray-600" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            {canShowEditButton && interfaceMode !== "edit" && (
              <button
                type="button"
                onClick={() => setManualEditMode((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-sm font-medium ${
                  isPanelEditing ? "bg-primary text-primary-foreground" : "bg-white border hover:bg-gray-100"
                }`}
              >
                {isPanelEditing ? <><Check className="h-3.5 w-3.5" /> Done</> : <><Pencil className="h-3.5 w-3.5" /> Edit</>}
              </button>
            )}
            {state.recordId && !isRecordLayoutEdit && (
              <button
                type="button"
                onClick={handleCustomizeLayout}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-sm bg-white border hover:bg-gray-100"
                title="Customize Layout"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Customize Layout
              </button>
            )}
            {isRecordLayoutEdit && (
              <button
                type="button"
                onClick={handleLayoutDone}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-sm bg-primary text-primary-foreground"
              >
                <Check className="h-3.5 w-3.5" />
                Done
              </button>
            )}
            {state.recordId && !isRecordLayoutEdit && (
              <button
                type="button"
                onClick={() => {
                  setSelectedFieldForSchema(null)
                  setUIMode("fieldSchemaEdit")
                  setSchemaDrawerOpen(true)
                }}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-sm bg-white border hover:bg-gray-100"
                title="Edit field schema"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Edit schema
              </button>
            )}
            <button onClick={handleCopyLink} className="p-1.5 hover:bg-gray-200 rounded" title="Copy link">
              <CopyIcon className="h-4 w-4 text-gray-600" />
            </button>
            <button
              onClick={togglePin}
              className={`p-1.5 hover:bg-gray-200 rounded ${state.isPinned ? "bg-blue-100 text-blue-600" : ""}`}
              title={state.isPinned ? "Unpin" : "Pin"}
            >
              {state.isPinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4 text-gray-600" />}
            </button>
            <button onClick={toggleFullscreen} className="p-1.5 hover:bg-gray-200 rounded" title="Fullscreen">
              <Minimize2 className="h-4 w-4 text-gray-600" />
            </button>
            {!state.isPinned && (
              <button onClick={closeRecord} className="p-1.5 hover:bg-gray-200 rounded" title="Close">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {headerLoading ? (
            <div className="p-6 space-y-3">
              <div className="h-4 w-1/3 bg-gray-200 rounded animate-pulse" />
              <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
              <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
            </div>
          ) : !hasRecord ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-gray-500">Record not found</p>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              <RecordFields
                fields={visibleFields}
                formData={formData}
                onFieldChange={handleFieldChange}
                fieldGroups={fieldGroups}
                tableId={state.tableId || ""}
                recordId={state.recordId || ""}
                tableName={state.tableName}
                isFieldEditable={() => effectiveAllowEdit}
                layoutMode={isRecordLayoutEdit}
                fieldLayout={resolvedFieldLayout}
                allFields={fields}
                onFieldVisibilityToggle={handleFieldVisibilityToggle}
                onFieldLayoutChange={handleFieldLayoutChange}
                pageEditable={true}
              />
              <RecordActivity record={formData} tableId={state.tableId || ""} />
            </div>
          )}
        </div>
      </div>

      <FieldSchemaDrawer
        open={schemaDrawerOpen}
        onOpenChange={(open) => {
          setSchemaDrawerOpen(open)
          if (!open) setSelectedFieldForSchema(null)
        }}
        tableId={state.tableId || ""}
        field={selectedFieldForSchema}
        allFields={fields}
        onFieldUpdated={loadFields}
      />
    </>
  )
}
