"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import ViewBuilderToolbar from "./ViewBuilderToolbar"
import AirtableGridView from "./AirtableGridView"
import AirtableKanbanView from "./AirtableKanbanView"
import FieldBuilderModal from "./FieldBuilderModal"
import DesignSidebar from "@/components/layout/DesignSidebar"
import { supabase } from "@/lib/supabase/client"
import type { TableField } from "@/types/fields"
import type { ViewType } from "@/types/database"

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
    operator: string
    value?: string
  }>
  initialViewSorts: Array<{
    id: string
    field_name: string
    direction: string
  }>
  initialTableFields: any[]
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
}: AirtableViewPageProps) {
  const router = useRouter()
  const [viewFields, setViewFields] = useState(initialViewFields)
  const [tableFields, setTableFields] = useState<TableField[]>(initialTableFields)
  const [filters, setFilters] = useState(initialViewFilters)
  const [sorts, setSorts] = useState(initialViewSorts)
  const [groupBy, setGroupBy] = useState<string | null>((view.config as { groupBy?: string })?.groupBy || null)
  const [rowHeight, setRowHeight] = useState<"short" | "medium" | "tall">(
    (view.config as { row_height?: "short" | "medium" | "tall" })?.row_height || "medium"
  )
  const [hiddenFields, setHiddenFields] = useState<string[]>(
    viewFields.filter(f => !f.visible).map(f => f.field_name)
  )
  const [kanbanGroupField, setKanbanGroupField] = useState<string | undefined>(
    (view.config as { kanban_group_field?: string })?.kanban_group_field
  )
  const [cardFields, setCardFields] = useState<string[]>(
    (view.config as { card_fields?: string[] })?.card_fields || []
  )
  const [fieldBuilderOpen, setFieldBuilderOpen] = useState(false)
  const [editingField, setEditingField] = useState<TableField | null>(null)
  const [designSidebarOpen, setDesignSidebarOpen] = useState(false)

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
      const { data } = await supabase
        .from("view_fields")
        .select("field_name, visible, position")
        .eq("view_id", viewId)
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
            .eq("view_id", viewId)
            .eq("field_name", update.field_name)
        )
      )

      await loadViewFields()
    } catch (error) {
      console.error("Error reordering fields:", error)
      alert("Failed to reorder fields")
    }
  }

  async function handleSaveView() {
    const name = prompt("Enter name for the new view:")
    if (!name || !name.trim()) return

    try {
      // Get current view data
      const { data: currentView } = await supabase
        .from("views")
        .select("*")
        .eq("id", viewId)
        .single()

      if (!currentView) {
        alert("Current view not found")
        return
      }

      // Get view fields, filters, sorts
      const [fieldsRes, filtersRes, sortsRes] = await Promise.all([
        supabase.from("view_fields").select("*").eq("view_id", viewId),
        supabase.from("view_filters").select("*").eq("view_id", viewId),
        supabase.from("view_sorts").select("*").eq("view_id", viewId),
      ])

      // Create new view with current config
      const newConfig = {
        groupBy: groupBy || null,
        row_height: rowHeight,
        hidden_columns: hiddenFields,
      }

      const { data: newView, error: viewError } = await supabase
        .from("views")
        .insert([
          {
            table_id: tableId,
            name: name.trim(),
            type: currentView.type,
            config: newConfig,
          },
        ])
        .select()
        .single()

      if (viewError || !newView) {
        alert("Failed to create new view")
        return
      }

      // Copy view fields
      if (fieldsRes.data && fieldsRes.data.length > 0) {
        await supabase.from("view_fields").insert(
          fieldsRes.data.map((f) => ({
            view_id: newView.id,
            field_name: f.field_name,
            visible: f.visible,
            position: f.position,
          }))
        )
      }

      // Copy filters
      if (filtersRes.data && filtersRes.data.length > 0) {
        await supabase.from("view_filters").insert(
          filtersRes.data.map((f) => ({
            view_id: newView.id,
            field_name: f.field_name,
            operator: f.operator,
            value: f.value,
          }))
        )
      }

      // Copy sorts
      if (sortsRes.data && sortsRes.data.length > 0) {
        await supabase.from("view_sorts").insert(
          sortsRes.data.map((f) => ({
            view_id: newView.id,
            field_name: f.field_name,
            direction: f.direction,
            order_index: f.order_index,
          }))
        )
      }

      router.push(`/tables/${tableId}/views/${newView.id}`)
    } catch (error) {
      console.error("Error saving view:", error)
      alert("Failed to save view")
    }
  }

  async function handleViewTypeChange(newType: ViewType) {
    try {
      const { data: currentView } = await supabase
        .from("views")
        .select("config")
        .eq("id", viewId)
        .single()

      const currentConfig = (currentView?.config as Record<string, any>) || {}
      let newConfig = { ...currentConfig }

      // If switching to kanban, try to auto-detect a select field
      if (newType === "kanban" && !newConfig.kanban_group_field) {
        const selectField = tableFields.find(
          (f) => f.type === "single_select" || f.type === "multi_select"
        )
        if (selectField) {
          newConfig.kanban_group_field = selectField.name
        }
      }

      await supabase
        .from("views")
        .update({ type: newType, config: newConfig })
        .eq("id", viewId)

      router.refresh()
    } catch (error) {
      console.error("Error changing view type:", error)
      alert("Failed to change view type")
    }
  }

  async function handleNewRecord() {
    try {
      const { data, error } = await supabase
        .from(table.supabase_table)
        .insert([{}])
        .select()
        .single()

      if (error) {
        console.error("Error creating record:", error)
        alert("Failed to create record")
      } else {
        router.refresh()
      }
    } catch (error) {
      console.error("Error creating record:", error)
      alert("Failed to create record")
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
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
        userRole="editor"
        onViewTypeChange={handleViewTypeChange}
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
        onRowHeightChange={(height) => {
          setRowHeight(height)
          router.refresh()
        }}
        onHiddenFieldsChange={(fields) => {
          setHiddenFields(fields)
          router.refresh()
        }}
        onSaveView={handleSaveView}
        onViewAction={(action) => {
          if (action === "delete") {
            // Handled in ViewManagementDialog
          } else if (action === "setDefault") {
            // TODO: Implement set as default
            alert("Set as default functionality coming soon")
          }
        }}
        onDesign={() => setDesignSidebarOpen(true)}
        onAddField={() => setDesignSidebarOpen(true)}
        onNewRecord={handleNewRecord}
      />
      <div className="flex-1 overflow-hidden relative">
        {view.type === "grid" ? (
          <AirtableGridView
            tableName={table.supabase_table}
            viewName={view.name}
            rowHeight={rowHeight}
            editable={true}
            fields={tableFields}
            onAddField={handleAddField}
            onEditField={handleEditField}
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
            userRole="editor"
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
      />
    </div>
  )
}
