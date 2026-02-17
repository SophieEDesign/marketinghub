"use client"

/**
 * Record Review Page Component
 *
 * Layout Structure:
 * ┌──────────────────────────┬──────────────────────────────────────┐
 * │ FIXED LEFT COLUMN         │ RIGHT PANEL                           │
 * │ (RecordReviewLeftColumn)  │ - record_view: RecordDetailPanelInline│
 * │                           │   (canvas layout editor, field_layout)│
 * │ - Record list (cards)     │ - record_review: InterfaceBuilder     │
 * │ - Search/filter           │   (blocks canvas)                     │
 * │ - Card fields from        │                                      │
 * │   field_layout.visible_   │                                      │
 * │   in_card                 │                                      │
 * └──────────────────────────┴──────────────────────────────────────┘
 *
 * Key Rules:
 * - Left column is structural (not a block, not draggable)
 * - record_view: Right panel uses RecordDetailPanelInline (same layout editor as RecordModal)
 * - record_review: Right side is normal canvas (blocks only)
 * - recordId is ephemeral UI state (never saved to blocks)
 * - field_layout is single source of truth for cards + detail panel
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useBlockEditMode } from "@/contexts/EditModeContext"
import { useUIMode } from "@/contexts/UIModeContext"
import RecordReviewLeftColumn from "./RecordReviewLeftColumn"
import InterfaceBuilder from "./InterfaceBuilder"
import RecordDetailPanelInline from "./RecordDetailPanelInline"
import type { Page, PageBlock } from "@/lib/interface/types"
import type { PageConfig } from "@/lib/interface/page-config"
import type { FieldLayoutItem } from "@/lib/interface/field-layout-utils"
import { useToast } from "@/components/ui/use-toast"
import { useUserRole } from "@/lib/hooks/useUserRole"
import { canDeleteRecord } from "@/lib/interface/record-actions"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useSelectionContext } from "@/contexts/SelectionContext"
import { useRightSettingsPanelData } from "@/contexts/RightSettingsPanelDataContext"

interface RecordReviewPageProps {
  page: Page
  initialBlocks: PageBlock[]
  isViewer?: boolean
  onSave?: () => void
  onEditModeChange?: (isEditing: boolean) => void
  onLayoutSave?: (fieldLayout: FieldLayoutItem[]) => Promise<void>
  hideHeader?: boolean
}

export default function RecordReviewPage({
  page,
  initialBlocks,
  isViewer = false,
  onSave,
  onEditModeChange,
  onLayoutSave,
  hideHeader = false,
}: RecordReviewPageProps) {
  // CRITICAL: recordId is ephemeral UI state - never saved to blocks or page config
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [lastDeletedRecordId, setLastDeletedRecordId] = useState<string | null>(null)
  // Airtable-style: default to view mode; user clicks Edit to enter edit mode
  const [recordInterfaceMode, setRecordInterfaceMode] = useState<"view" | "edit">("view")
  const [deleting, setDeleting] = useState(false)
  const [tableFields, setTableFields] = useState<any[]>([])
  const [tableName, setTableName] = useState<string | null>(null)
  const { toast } = useToast()
  const { role: userRole } = useUserRole()
  const { setSelectedContext } = useSelectionContext()
  const { setData: setRightPanelData } = useRightSettingsPanelData()
  const { enterRecordLayoutEdit, exitRecordLayoutEdit, uiMode } = useUIMode()

  const pageType = (page as any).page_type || (page as any).type || "record_review"
  const isRecordView = pageType === "record_view"

  // Load table fields for record_view right panel
  const pageConfig: PageConfig | any = (page as any).config || page.settings || {}
  const pageTableId =
    pageConfig.tableId ||
    pageConfig.primary_table_id ||
    page.settings?.tableId ||
    page.settings?.primary_table_id ||
    null

  useEffect(() => {
    if (!pageTableId) return
    let cancelled = false
    const supabase = createClient()
    supabase
      .from("tables")
      .select("supabase_table")
      .eq("id", pageTableId)
      .single()
      .then(({ data: table }) => {
        if (cancelled || !table) return
        setTableName((table as any).supabase_table || null)
      })
    supabase
      .from("table_fields")
      .select("*")
      .eq("table_id", pageTableId)
      .order("order_index", { ascending: true })
      .then(({ data: fields }) => {
        if (cancelled) return
        setTableFields((fields || []) as any[])
      })
    return () => {
      cancelled = true
    }
  }, [pageTableId])

  // Check both left_panel (snake_case) and leftPanel (camelCase) for backward compatibility
  const leftPanelSettings =
    pageConfig.left_panel || pageConfig.leftPanel || page.settings?.left_panel || page.settings?.leftPanel

  // Field layout - single source of truth for record_view (cards + detail panel)
  const fieldLayout = useMemo(() => {
    const layout = pageConfig.field_layout
    if (layout && Array.isArray(layout) && layout.length > 0) {
      return layout as FieldLayoutItem[]
    }
    return []
  }, [pageConfig.field_layout])

  // Page-level default for "Add record" (used across the interface; blocks can override)
  const pageShowAddRecord =
    pageConfig.show_add_record === true ||
    pageConfig.showAddRecord === true ||
    (page.settings as any)?.show_add_record === true ||
    (page.settings as any)?.showAddRecord === true

  // Sync selected record to SelectionContext and RightSettingsPanel (for Record Layout Settings)
  useEffect(() => {
    if (selectedRecordId && pageTableId) {
      setSelectedContext({ type: "record", recordId: selectedRecordId, tableId: pageTableId })
      setRightPanelData({
        recordId: selectedRecordId,
        recordTableId: pageTableId,
        fieldLayout,
        onLayoutSave: onLayoutSave ?? null,
        tableFields,
        isEditing: recordInterfaceMode === "edit",
      })
    } else {
      setSelectedContext(null)
      setRightPanelData({ recordId: null, recordTableId: null, fieldLayout: [], onLayoutSave: null, tableFields: [], isEditing: false })
    }
  }, [selectedRecordId, pageTableId, fieldLayout, onLayoutSave, tableFields, recordInterfaceMode, setSelectedContext, setRightPanelData])

  // Sync UIMode with record layout edit so RightSettingsPanel shows when editing record layout (record_view)
  useEffect(() => {
    if (isRecordView && selectedRecordId && recordInterfaceMode === "edit") {
      if (uiMode === "view") {
        enterRecordLayoutEdit()
      }
    } else if (uiMode === "recordLayoutEdit") {
      exitRecordLayoutEdit()
    }
  }, [isRecordView, selectedRecordId, recordInterfaceMode, uiMode, enterRecordLayoutEdit, exitRecordLayoutEdit])

  // Auto-open Right Settings Panel with Record Layout when entering Edit Mode; clear selection when exiting
  const prevRecordInterfaceModeRef = useRef(recordInterfaceMode)
  useEffect(() => {
    if (prevRecordInterfaceModeRef.current === "edit" && recordInterfaceMode === "view") {
      setSelectedContext(null)
    } else if (prevRecordInterfaceModeRef.current !== "edit" && recordInterfaceMode === "edit") {
      if (selectedRecordId && pageTableId) {
        setSelectedContext({ type: "record", recordId: selectedRecordId, tableId: pageTableId })
      }
    }
    prevRecordInterfaceModeRef.current = recordInterfaceMode
  }, [recordInterfaceMode, selectedRecordId, pageTableId, setSelectedContext])

  // Handle record selection - reset to view mode when switching records (Airtable-style)
  const handleRecordSelect = useCallback((recordId: string) => {
    setSelectedRecordId(recordId)
    setRecordInterfaceMode("view")
  }, [])

  const pageEditable = pageConfig?.allow_editing !== false
  const canDeleteSelectedRecord =
    !!selectedRecordId && pageEditable && canDeleteRecord(userRole, pageConfig)

  const handleDeleteSelectedRecord = useCallback(async () => {
    if (!selectedRecordId) return
    if (!canDeleteRecord(userRole, pageConfig) || pageConfig?.allow_editing === false) {
      toast({
        variant: "destructive",
        title: "Not allowed",
        description: "You don't have permission to delete records on this page.",
      })
      return
    }

    if (!confirm("Are you sure you want to delete this record? This action cannot be undone.")) {
      return
    }

    try {
      setDeleting(true)
      const res = await fetch(`/api/interface-pages/${page.id}/records/${selectedRecordId}`, {
        method: "DELETE",
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to delete record")
      }

      toast({
        title: "Record deleted",
        description: "The record has been deleted.",
      })

      // Remove from left list immediately + clear selection so left column can auto-select next record.
      setLastDeletedRecordId(selectedRecordId)
      setSelectedRecordId(null)
    } catch (error: any) {
      console.error("Error deleting record:", error)
      toast({
        variant: "destructive",
        title: "Failed to delete record",
        description: error.message || "Please try again",
      })
    } finally {
      setDeleting(false)
    }
  }, [page.id, pageConfig, selectedRecordId, toast, userRole])

  // Edit mode: use EditModeContext so sidebar Edit/View toggle stays in sync
  const { isEditing: isBlockEditing } = useBlockEditMode(page.id)

  return (
    <div className="flex h-full w-full">
      {/* Fixed Left Column - Always Present */}
      {/* CRITICAL: Left column reads from page.settings.leftPanel - not from blocks or props */}
      <RecordReviewLeftColumn
        pageId={page.id}
        tableId={pageTableId}
        selectedRecordId={selectedRecordId}
        onRecordSelect={handleRecordSelect}
        deletedRecordId={lastDeletedRecordId}
        leftPanelSettings={leftPanelSettings}
        pageType={pageType as "record_view" | "record_review"}
        showAddRecord={pageShowAddRecord}
        pageConfig={pageConfig}
        fieldLayout={fieldLayout}
      />

      {/* Right Panel - record_view: RecordDetailPanelInline | record_review: InterfaceBuilder */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 w-full">
        {/* Record actions (block-based record pages) */}
        {canDeleteSelectedRecord && (
          <div className="flex items-center justify-end gap-2 px-3 py-2 border-b border-gray-200 bg-white">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelectedRecord}
              disabled={deleting}
              title="Delete selected record"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete record
            </Button>
          </div>
        )}
        {isRecordView ? (
          <RecordDetailPanelInline
            pageId={page.id}
            tableId={pageTableId}
            recordId={selectedRecordId}
            tableName={tableName}
            fields={tableFields}
            fieldLayout={fieldLayout}
            pageEditable={pageEditable}
            interfaceMode={isViewer ? "view" : recordInterfaceMode}
            onInterfaceModeChange={isViewer ? undefined : setRecordInterfaceMode}
            onLayoutSave={onLayoutSave}
            titleField={pageConfig.title_field || pageConfig.left_panel?.title_field}
          />
        ) : (
          <InterfaceBuilder
            key={page.id}
            page={page}
            initialBlocks={initialBlocks}
            isViewer={isViewer}
            onSave={onSave}
            onEditModeChange={onEditModeChange}
            hideHeader={hideHeader}
            pageTableId={pageTableId}
            recordId={selectedRecordId}
            mode={isBlockEditing ? "edit" : "view"}
          />
        )}
      </div>
    </div>
  )
}
