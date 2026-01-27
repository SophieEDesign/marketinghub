"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import ViewTopBar from "@/components/layout/ViewTopBar"
import FormView from "@/components/views/FormView"
import KanbanView from "@/components/views/KanbanView"
import CalendarView from "@/components/views/CalendarView"
import TimelineView from "@/components/views/TimelineView"
import HorizontalGroupedView from "@/components/views/HorizontalGroupedView"
import DesignSidebar from "@/components/layout/DesignSidebar"
import { supabase } from "@/lib/supabase/client"
import type { TableField } from "@/types/fields"
import type { ViewFilter, ViewSort } from "@/types/database"
import { applyFiltersToQuery, type FilterConfig } from "@/lib/interface/filters"
import type { GroupRule } from "@/lib/grouping/types"

interface NonGridViewWrapperProps {
  viewType: "form" | "kanban" | "calendar" | "timeline" | "horizontal_grouped"
  viewName: string
  tableId: string
  viewId: string
  fieldIds: string[]
  groupingFieldId?: string
  groupByRules?: GroupRule[]
  dateFieldId?: string
  viewFilters?: ViewFilter[]
  viewSorts?: ViewSort[]
  tableFields?: TableField[]
}

export default function NonGridViewWrapper({
  viewType,
  viewName,
  tableId,
  viewId,
  fieldIds: fieldIdsProp,
  groupingFieldId,
  groupByRules,
  dateFieldId,
  viewFilters = [],
  viewSorts = [],
  tableFields: tableFieldsProp = [],
}: NonGridViewWrapperProps) {
  // Ensure fieldIds is always an array
  const fieldIds = Array.isArray(fieldIdsProp) ? fieldIdsProp : []
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchQuery = searchParams.get("q") || ""
  const [designSidebarOpen, setDesignSidebarOpen] = useState(false)
  const [tableInfo, setTableInfo] = useState<{ name: string; supabase_table: string } | null>(null)
  const [tableFields, setTableFields] = useState<TableField[]>(tableFieldsProp)

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

  // Load table fields (only if not provided as prop)
  useEffect(() => {
    if (tableFieldsProp.length > 0) {
      setTableFields(tableFieldsProp)
      return
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
    loadFields()
  }, [tableId, tableFieldsProp])


  async function handleNewRecord() {
    if (!tableInfo) return
    try {
      const { error } = await supabase
        .from(tableInfo.supabase_table)
        .insert([{ created_at: new Date().toISOString() }])

      if (error) {
        console.error("Error creating record:", error)
        const message = (error as any)?.message || 'Unknown error'
        const code = (error as any)?.code ? ` (code: ${(error as any).code})` : ''
        alert(`Failed to create record${code}: ${message}`)
      } else {
        router.refresh()
      }
    } catch (error) {
      console.error("Error creating record:", error)
      const e = error as any
      const message = e?.message || 'Unknown error'
      const code = e?.code ? ` (code: ${e.code})` : ''
      alert(`Failed to create record${code}: ${message}`)
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
        {viewType === "timeline" && (
          <TimelineView
            tableId={tableId}
            viewId={viewId}
            dateFieldId={dateFieldId || fieldIds[0] || ""}
            fieldIds={fieldIds}
            searchQuery={searchQuery}
            tableFields={tableFields}
          />
        )}
        {viewType === "horizontal_grouped" && tableInfo && (
          <HorizontalGroupedView
            tableId={tableId}
            viewId={viewId}
            supabaseTableName={tableInfo.supabase_table}
            tableFields={tableFields}
            filters={viewFilters.map(f => ({
              field: f.field_name,
              operator: f.operator as FilterConfig['operator'],
              value: f.value,
            }))}
            sorts={viewSorts.map(s => ({
              field_name: s.field_name,
              direction: s.direction as 'asc' | 'desc',
            }))}
            groupBy={groupingFieldId}
            groupByRules={groupByRules}
            searchQuery={searchQuery}
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
          hideViewsTab={true}
        />
      )}
    </div>
  )
}
