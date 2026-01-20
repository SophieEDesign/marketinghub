"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import ViewBuilderToolbar from "./ViewBuilderToolbar"
import AirtableGridView, { type AirtableGridActions } from "./AirtableGridView"
import AirtableKanbanView from "./AirtableKanbanView"
import FieldBuilderModal from "./FieldBuilderModal"
import DesignSidebar from "@/components/layout/DesignSidebar"
import { supabase } from "@/lib/supabase/client"
import type { TableField } from "@/types/fields"
import type { ViewType, FilterType } from "@/types/database"
import { normalizeUuid } from "@/lib/utils/ids"

interface AirtableViewPageProps {
  tableId: string
  viewId: string
  table: {
    id: string
    name: string
    supabase_table: string
  }
  view: {
    id: string
    name: string
    type: string
    config?: any
  }
  initialViewFields: Array<{
    field_name: string
    visible: boolean
    position: number
  }>
  initialViewFilters: Array<{
    id: string
    field_name: string
    operator: FilterType
    value?: string
  }>
  initialViewSorts: Array<{
    id: string
    field_name: string
    direction: string
  }>
  initialTableFields: any[]
  initialGroupBy?: string | null
  initialGridSettings?: {
    group_by_field: string | null
    column_widths?: Record<string, number>
    column_order?: string[]
    column_wrap_text?: Record<string, boolean>
    row_height?: 'short' | 'medium' | 'tall'
  } | null
}

export default function AirtableViewPage({
  tableId,
  viewId,
  table,
  view,
  initialViewFields,
  initialViewFilters,
  initialViewSorts,
  initialTableFields,
  initialGroupBy,
  initialGridSettings,
}: AirtableViewPageProps) {
  const router = useRouter()
  const gridActionsRef = useRef<AirtableGridActions | null>(null)
  const handleGridActionsReady = useCallback((actions: AirtableGridActions) => {
    gridActionsRef.current = actions
  }, [])

  const viewUuid = useMemo(() => normalizeUuid(viewId), [viewId])

  const [viewFields, setViewFields] = useState(initialViewFields)
  const [tableFields, setTableFields] = useState<TableField[]>(initialTableFields)
  const [filters, setFilters] = useState(initialViewFilters)
  const [sorts, setSorts] = useState(initialViewSorts)
  const [userRole, setUserRole] = useState<"admin" | "editor">("editor")
  const [groupBy, setGroupBy] = useState<string | null>(initialGroupBy ?? null)
  const [rowHeight, setRowHeight] = useState<"short" | "medium" | "tall">(
    initialGridSettings?.row_height || (view.config as { row_height?: "short" | "medium" | "tall" })?.row_height || "medium"
  )
  const [hiddenFields, setHiddenFields] = useState<string[]>(
    viewFields.filter(f => !f.visible).map(f => f.field_name)
  )
  const [kanbanGroupField, setKanbanGroupField] = useState<string | undefined>(
    initialGroupBy || (view.config as { kanban_group_field?: string })?.kanban_group_field
  )
  const [cardFields, setCardFields] = useState<string[]>(
    (view.config as { card_fields?: string[] })?.card_fields || []
  )
  const [fieldBuilderOpen, setFieldBuilderOpen] = useState(false)
  const [editingField, setEditingField] = useState<TableField | null>(null)
  const [designSidebarOpen, setDesignSidebarOpen] = useState(false)

  // Load user role from profiles so we can correctly gate actions (e.g. bulk delete).
  // Mapping: profiles.admin -> "admin"; profiles.member -> "editor" (can edit, cannot delete).
  useEffect(() => {
    loadUserRole()
  }, [])

  async function loadUserRole() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setUserRole("editor")
        return
      }

      // Try profiles table first (new system)
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle()

      if (!profileError && profile?.role) {
        setUserRole(profile.role === "admin" ? "admin" : "editor")
        return
      }

      // Fallback to user_roles table (legacy support)
      if (
        profileError?.code === "PGRST116" ||
        profileError?.message?.includes("relation") ||
        profileError?.message?.includes("does not exist")
      ) {
        const { data: legacyRole, error: legacyError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle()

        if (!legacyError && legacyRole?.role) {
          setUserRole(legacyRole.role === "admin" || legacyRole.role === "editor" ? "admin" : "editor")
          return
        }
      }

      // Default to editor so existing edit flows keep working; server still enforces admin-only deletes.
      setUserRole("editor")
    } catch (error) {
      console.error("Error loading user role:", error)
      setUserRole("editor")
    }
  }

  async function loadFields() {
    try {
      const response = await fetch(`/api/tables/${tableId}/fields`)
      const data = await response.json()
      if (data.fields) {
        setTableFields(data.fields)
      }
    } catch (error) {
      console.error("Error loading fields:", error)
    }
  }

  async function loadViewFields() {
    try {
      if (!viewUuid) {
        console.warn("AirtableViewPage: viewId is not a valid UUID; cannot load view fields.")
        return
      }
      const { data } = await supabase
        .from("view_fields")
        .select("field_name, visible, position")
        .eq("view_id", viewUuid)
        .order("position", { ascending: true })

      if (data) {
        setViewFields(data)
      }
    } catch (error) {
      console.error("Error loading view fields:", error)
    }
  }

  async function handleFieldSave() {
    await loadFields()
    await loadViewFields()
    setFieldBuilderOpen(false)
    setEditingField(null)
    router.refresh()
  }

  function handleAddField() {
    setEditingField(null)
    setFieldBuilderOpen(true)
  }

  function handleEditField(fieldName: string) {
    const field = tableFields.find((f) => f.name === fieldName)
    setEditingField(field || null)
    setFieldBuilderOpen(true)
  }

  async function handleDeleteField(fieldName: string) {
    if (!confirm(`Are you sure you want to delete the field "${fieldName}"? This action cannot be undone.`)) {
      return
    }

    try {
      const field = tableFields.find((f) => f.name === fieldName)
      if (!field) return

      const response = await fetch(`/api/tables/${tableId}/fields?fieldId=${field.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || "Failed to delete field")
        return
      }

      await loadFields()
      await loadViewFields()
      router.refresh()
    } catch (error) {
      console.error("Error deleting field:", error)
      alert("Failed to delete field")
    }
  }

  async function handleReorderFields(fieldNames: string[]) {
    try {
      if (!viewUuid) {
        console.warn("AirtableViewPage: viewId is not a valid UUID; cannot persist field order.")
        return
      }
      // Update view_fields positions
      const updates = fieldNames.map((fieldName, index) => ({
        field_name: fieldName,
        position: index,
      }))

      await Promise.all(
        updates.map((update) =>
          supabase
            .from("view_fields")
            .update({ position: update.position })
            .eq("view_id", viewUuid)
            .eq("field_name", update.field_name)
        )
      )

      await loadViewFields()
    } catch (error) {
      console.error("Error reordering fields:", error)
      alert("Failed to reorder fields")
    }
  }

  // View type is locked at creation - cannot be changed
  // Users should create a new view instead

  async function handleNewRecord() {
    try {
      // Prefer grid-owned insert so the new row shows immediately (spreadsheet-style)
      const actions = gridActionsRef.current
      if (actions) {
        await actions.createNewRow()
        return
      }

      // Fallback: insert directly (e.g. grid not mounted yet)
      const { error } = await supabase
        .from(table.supabase_table)
        .insert([{ created_at: new Date().toISOString() }])
      if (error) throw error
    } catch (error) {
      const e = error as any
      console.error("Error creating record:", e)
      const message =
        e?.message ||
        e?.error_description ||
        (typeof e === "string" ? e : "") ||
        "Unknown error"
      const code = e?.code ? ` (code: ${e.code})` : ""
      alert(`Failed to create record${code}: ${message}`)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50">
      <div className="flex-shrink-0">
        <ViewBuilderToolbar
          viewId={viewId}
          viewName={view.name}
          viewType={view.type as ViewType}
          tableId={tableId}
          tableFields={tableFields}
          viewFields={viewFields}
          filters={filters}
          sorts={sorts}
          groupBy={groupBy || undefined}
          rowHeight={rowHeight}
          hiddenFields={hiddenFields}
          userRole={userRole}
          onFiltersChange={(newFilters) => {
            setFilters(newFilters as typeof filters)
            router.refresh()
          }}
          onSortsChange={(newSorts) => {
            setSorts(newSorts as typeof sorts)
            router.refresh()
          }}
          onGroupChange={(fieldName) => {
            setGroupBy(fieldName)
            router.refresh()
          }}
          onRowHeightChange={async (height) => {
            setRowHeight(height)
            try {
              if (!viewUuid) return
              // Save row height to grid_view_settings using client-side supabase
              const { data: existing } = await supabase
                .from('grid_view_settings')
                .select('id')
                .eq('view_id', viewUuid)
                .maybeSingle()

              if (existing) {
                // Update existing settings
                await supabase
                  .from('grid_view_settings')
                  .update({ row_height: height })
                  .eq('view_id', viewUuid)
              } else {
                // Create new settings
                await supabase
                  .from('grid_view_settings')
                  .insert([
                    {
                      view_id: viewUuid,
                      row_height: height,
                      column_widths: {},
                      column_order: [],
                      column_wrap_text: {},
                      frozen_columns: 0,
                    },
                  ])
              }
            } catch (error) {
              console.error("Error saving row height:", error)
              // Still update local state even if save fails
            }
            router.refresh()
          }}
          onHiddenFieldsChange={(fields) => {
            setHiddenFields(fields)
            router.refresh()
          }}
          onViewAction={(action) => {
            if (action === "delete") {
              // ViewManagementDialog handles the deletion and redirect
              // No additional action needed here
            } else if (action === "setDefault") {
              // TODO: Implement set as default
              alert("Set as default functionality coming soon")
            }
          }}
          onDesign={() => setDesignSidebarOpen(true)}
          onAddField={() => setDesignSidebarOpen(true)}
          onNewRecord={handleNewRecord}
        />
      </div>
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {view.type === "grid" ? (
          <AirtableGridView
            tableName={table.supabase_table}
            tableId={tableId}
            viewName={view.name}
            viewId={viewId}
            viewFilters={filters}
            rowHeight={rowHeight}
            editable={true}
            fields={tableFields}
            onTableFieldsRefresh={loadFields}
            onAddField={handleAddField}
            onEditField={handleEditField}
            groupBy={groupBy || undefined}
            userRole={userRole}
            disableRecordPanel={false}
            onActionsReady={handleGridActionsReady}
          />
        ) : view.type === "kanban" ? (
          <AirtableKanbanView
            tableId={tableId}
            viewId={viewId}
            supabaseTableName={table.supabase_table}
            tableFields={tableFields}
            viewFields={viewFields}
            viewFilters={filters}
            viewSorts={sorts}
            kanbanGroupField={kanbanGroupField}
            cardFields={cardFields}
            userRole={userRole}
          />
        ) : null}
      </div>
      <FieldBuilderModal
        isOpen={fieldBuilderOpen}
        onClose={() => {
          setFieldBuilderOpen(false)
          setEditingField(null)
        }}
        tableId={tableId}
        field={editingField}
        onSave={handleFieldSave}
        tableFields={tableFields}
      />
      <DesignSidebar
        isOpen={designSidebarOpen}
        onClose={() => setDesignSidebarOpen(false)}
        tableId={tableId}
        tableName={table.name}
        supabaseTableName={table.supabase_table}
        onFieldsUpdated={() => {
          handleFieldSave()
          loadFields()
          loadViewFields()
        }}
        hideViewsTab={true}
      />
    </div>
  )
}
