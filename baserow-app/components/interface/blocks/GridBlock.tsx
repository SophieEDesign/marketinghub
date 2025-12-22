"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { PageBlock } from "@/lib/interface/types"
import GridViewWrapper from "@/components/grid/GridViewWrapper"

interface GridBlockProps {
  block: PageBlock
  isEditing?: boolean
}

export default function GridBlock({ block, isEditing = false }: GridBlockProps) {
  const { config } = block
  const tableId = config?.table_id
  const viewId = config?.view_id
  const [loading, setLoading] = useState(true)
  const [table, setTable] = useState<{ supabase_table: string } | null>(null)
  const [viewFields, setViewFields] = useState<Array<{ field_name: string; visible: boolean; position: number }>>([])
  const [viewFilters, setViewFilters] = useState<Array<{ id: string; field_name: string; operator: string; value?: string }>>([])
  const [viewSorts, setViewSorts] = useState<Array<{ id: string; field_name: string; direction: string }>>([])
  const [tableFields, setTableFields] = useState<any[]>([])
  const [groupBy, setGroupBy] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (tableId && viewId) {
      loadData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, viewId])

  async function loadData() {
    if (!tableId || !viewId) return

    setLoading(true)
    try {
      const supabase = createClient()

      // Use Promise.allSettled to handle missing tables gracefully
      const [tableRes, viewFieldsRes, viewFiltersRes, viewSortsRes, tableFieldsRes, viewRes] = await Promise.allSettled([
        supabase.from("tables").select("supabase_table").eq("id", tableId).single(),
        supabase
          .from("view_fields")
          .select("field_name, visible, position")
          .eq("view_id", viewId)
          .order("position", { ascending: true }),
        supabase
          .from("view_filters")
          .select("id, field_name, operator, value")
          .eq("view_id", viewId),
        supabase
          .from("view_sorts")
          .select("id, field_name, direction")
          .eq("view_id", viewId),
        supabase
          .from("table_fields")
          .select("*")
          .eq("table_id", tableId)
          .order("position", { ascending: true }),
        supabase.from("views").select("config, id").eq("id", viewId).maybeSingle(),
      ])

      if (tableRes.status === 'fulfilled' && !tableRes.value.error && tableRes.value.data) setTable(tableRes.value.data)
      if (viewFieldsRes.status === 'fulfilled' && !viewFieldsRes.value.error && viewFieldsRes.value.data) setViewFields(viewFieldsRes.value.data)
      if (viewFiltersRes.status === 'fulfilled' && !viewFiltersRes.value.error && viewFiltersRes.value.data) setViewFilters(viewFiltersRes.value.data)
      if (viewSortsRes.status === 'fulfilled' && !viewSortsRes.value.error && viewSortsRes.value.data) setViewSorts(viewSortsRes.value.data)
      if (tableFieldsRes.status === 'fulfilled' && !tableFieldsRes.value.error && tableFieldsRes.value.data) setTableFields(tableFieldsRes.value.data)
      if (viewRes.status === 'fulfilled' && !viewRes.value.error && viewRes.value.data?.config) {
        const config = viewRes.value.data.config as { groupBy?: string }
        setGroupBy(config.groupBy)
      }
    } catch (error) {
      console.error("Error loading grid data:", error)
    } finally {
      setLoading(false)
    }
  }

  if (!tableId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        {isEditing ? "Select a table to display" : "No table selected"}
      </div>
    )
  }

  if (!viewId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        {isEditing ? "Select a view to display" : "No view selected"}
      </div>
    )
  }

  if (loading || !table) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        Loading...
      </div>
    )
  }

  return (
    <div className="h-full w-full overflow-auto">
      <GridViewWrapper
        tableId={tableId}
        viewId={viewId}
        supabaseTableName={table.supabase_table}
        viewFields={viewFields}
        initialFilters={viewFilters}
        initialSorts={viewSorts}
        initialGroupBy={groupBy}
        initialTableFields={tableFields}
        isEditing={isEditing}
      />
    </div>
  )
}
