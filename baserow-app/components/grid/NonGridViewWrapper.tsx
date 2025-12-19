"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import ViewTopBar from "@/components/layout/ViewTopBar"
import FormView from "@/components/views/FormView"
import KanbanView from "@/components/views/KanbanView"
import CalendarView from "@/components/views/CalendarView"
import DesignSidebar from "@/components/layout/DesignSidebar"
import { supabase } from "@/lib/supabase/client"

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
  const [designSidebarOpen, setDesignSidebarOpen] = useState(false)
  const [tableInfo, setTableInfo] = useState<{ name: string; supabase_table: string } | null>(null)

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
        onSearch={(query) => {
          // TODO: Implement search
        }}
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
          />
        )}
        {viewType === "calendar" && (
          <CalendarView
            tableId={tableId}
            viewId={viewId}
            dateFieldId={dateFieldId || fieldIds[0] || ""}
            fieldIds={fieldIds}
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
