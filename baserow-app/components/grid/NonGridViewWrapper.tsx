"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import ViewTopBar from "@/components/layout/ViewTopBar"
import FormView from "@/components/views/FormView"
import KanbanView from "@/components/views/KanbanView"
import CalendarView from "@/components/views/CalendarView"
import DesignSidebar from "@/components/layout/DesignSidebar"
import { supabase } from "@/lib/supabase/client"
import type { TableField } from "@/types/fields"

interface NonGridViewWrapperProps {
  viewType: "form" | "kanban" | "calendar"
  viewName: string
  tableId: string
  viewId: string
  fieldIds: string[]
  groupingFieldId?: string
  dateFieldId?: string
}

export default function NonGridViewWrapper({
  viewType,
  viewName,
  tableId,
  viewId,
  fieldIds,
  groupingFieldId,
  dateFieldId,
}: NonGridViewWrapperProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchQuery = searchParams.get("q") || ""
  const [designSidebarOpen, setDesignSidebarOpen] = useState(false)
  const [tableInfo, setTableInfo] = useState<{ name: string; supabase_table: string } | null>(null)
  const [tableFields, setTableFields] = useState<TableField[]>([])

  useEffect(() => {
    async function loadTableInfo() {
      try {
        const { data, error } = await supabase
          .from("tables")
          .select("name, supabase_table")
          .eq("id", tableId)
          .single()

        if (!error && data) {
          setTableInfo(data)
        }
      } catch (error) {
        console.error("Error loading table info:", error)
      }
    }
    loadTableInfo()
  }, [tableId])

  // Load table fields
  useEffect(() => {
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
    loadFields()
  }, [tableId])


  async function handleNewRecord() {
    if (!tableInfo) return
    try {
      const { error } = await supabase
        .from(tableInfo.supabase_table)
        .insert([{}])

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

  function handleFieldsUpdated() {
    router.refresh()
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <ViewTopBar
        viewName={viewName}
        viewType={viewType}
        onSearch={() => {}} // Handled via URL params
        onDesign={() => setDesignSidebarOpen(true)}
        onAddField={() => setDesignSidebarOpen(true)}
        onNewRecord={handleNewRecord}
      />
      <div className="flex-1 overflow-hidden">
        {viewType === "form" && (
          <FormView
            tableId={tableId}
            viewId={viewId}
            fieldIds={fieldIds}
          />
        )}
        {viewType === "kanban" && (
          <KanbanView
            tableId={tableId}
            viewId={viewId}
            groupingFieldId={groupingFieldId || fieldIds[0] || ""}
            fieldIds={fieldIds}
            searchQuery={searchQuery}
            tableFields={tableFields}
          />
        )}
        {viewType === "calendar" && (
          <CalendarView
            tableId={tableId}
            viewId={viewId}
            dateFieldId={dateFieldId || fieldIds[0] || ""}
            fieldIds={fieldIds}
            searchQuery={searchQuery}
            tableFields={tableFields}
          />
        )}
      </div>
      {tableInfo && (
        <DesignSidebar
          isOpen={designSidebarOpen}
          onClose={() => setDesignSidebarOpen(false)}
          tableId={tableId}
          tableName={tableInfo.name}
          supabaseTableName={tableInfo.supabase_table}
          onFieldsUpdated={handleFieldsUpdated}
        />
      )}
    </div>
  )
}
