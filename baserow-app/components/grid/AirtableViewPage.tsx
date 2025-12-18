"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import ViewTopBar from "@/components/layout/ViewTopBar"
import AirtableGridView from "./AirtableGridView"
import FieldBuilderModal from "./FieldBuilderModal"
import DesignSidebar from "@/components/layout/DesignSidebar"
import { supabase } from "@/lib/supabase/client"
import type { TableField } from "@/types/fields"

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
  const [fieldBuilderOpen, setFieldBuilderOpen] = useState(false)
  const [editingField, setEditingField] = useState<TableField | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
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
      <ViewTopBar
        viewName={view.name}
        viewType={view.type as "grid" | "kanban" | "calendar" | "form"}
        onDesign={() => setDesignSidebarOpen(true)}
        onAddField={handleAddField}
        onNewRecord={handleNewRecord}
        onSearch={setSearchQuery}
        onFilter={() => {
          // TODO: Implement filter dialog
          alert("Filter functionality coming soon")
        }}
        onSort={() => {
          // TODO: Implement sort dialog
          alert("Sort functionality coming soon")
        }}
        onGroup={() => {
          // TODO: Implement group dialog
          alert("Group functionality coming soon")
        }}
        onHideFields={() => {
          // TODO: Implement hide fields dialog
          alert("Hide fields functionality coming soon")
        }}
        onShare={() => {
          // TODO: Implement share dialog
          alert("Share functionality coming soon")
        }}
      />
      <div className="flex-1 overflow-hidden">
        <AirtableGridView
          tableId={tableId}
          viewId={viewId}
          supabaseTableName={table.supabase_table}
          viewFields={viewFields}
          viewFilters={initialViewFilters}
          viewSorts={initialViewSorts}
          tableFields={tableFields}
          onAddField={handleAddField}
          onEditField={handleEditField}
          onDeleteField={handleDeleteField}
          onReorderFields={handleReorderFields}
        />
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
