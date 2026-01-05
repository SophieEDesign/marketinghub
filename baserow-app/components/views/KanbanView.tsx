"use client"

import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Plus } from "lucide-react"
import { filterRowsBySearch } from "@/lib/search/filterRows"
import type { TableRow } from "@/types/database"
import type { TableField } from "@/types/fields"

interface KanbanViewProps {
  tableId: string
  viewId: string
  groupingFieldId: string
  fieldIds: string[]
  searchQuery?: string
  tableFields?: any[]
}

export default function KanbanView({ 
  tableId, 
  viewId, 
  groupingFieldId, 
  fieldIds,
  searchQuery = "",
  tableFields = []
}: KanbanViewProps) {
  const [rows, setRows] = useState<TableRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId])

  async function loadRows() {
    if (!tableId) {
      console.warn("KanbanView: tableId is required")
      setRows([])
      setLoading(false)
      return
    }
    
    setLoading(true)
    const { data, error } = await supabase
      .from("table_rows")
      .select("*")
      .eq("table_id", tableId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error loading rows:", error)
    } else {
      setRows(data || [])
    }
    setLoading(false)
  }

  // Filter rows by search query
  const filteredRows = useMemo(() => {
    if (!searchQuery || !tableFields.length) return rows
    
    // Convert TableRow format to flat format for search
    const flatRows = rows.map((row) => ({
      ...row.data,
      _rowId: row.id, // Preserve row ID
    }))
    
    // Filter using search helper
    const filtered = filterRowsBySearch(flatRows, tableFields, searchQuery, fieldIds)
    const filteredIds = new Set(filtered.map((r) => r._rowId))
    
    // Map back to TableRow format
    return rows.filter((row) => filteredIds.has(row.id))
  }, [rows, tableFields, searchQuery, fieldIds])

  function groupRowsByField() {
    const groups: Record<string, TableRow[]> = {}
    filteredRows.forEach((row) => {
      const groupValue = row.data[groupingFieldId] || "Uncategorized"
      if (!groups[groupValue]) {
        groups[groupValue] = []
      }
      groups[groupValue].push(row)
    })
    return groups
  }

  if (loading) {
    return <div className="p-4">Loading...</div>
  }

  const groupedRows = groupRowsByField()
  const groups = Object.keys(groupedRows)

  // Empty state for search
  if (searchQuery && filteredRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <div className="text-sm mb-2">No records match your search</div>
        <button
          onClick={() => {
            const params = new URLSearchParams(window.location.search)
            params.delete("q")
            window.history.replaceState({}, "", `?${params.toString()}`)
            window.location.reload()
          }}
          className="text-xs text-blue-600 hover:text-blue-700 underline"
        >
          Clear search
        </button>
      </div>
    )
  }

  return (
    <div className="w-full h-full overflow-x-auto bg-gray-50">
      <div className="flex gap-4 min-w-max p-6">
        {groups.map((groupName) => (
          <div key={groupName} className="flex-shrink-0 w-80">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-3">
              <h3 className="text-sm font-semibold text-gray-900">{groupName}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{groupedRows[groupName].length} items</p>
            </div>
            <div className="space-y-2">
              {groupedRows[groupName].map((row) => (
                <Card 
                  key={row.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow bg-white border-gray-200 rounded-lg"
                >
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      {fieldIds
                        .filter((fid) => fid !== groupingFieldId)
                        .slice(0, 3)
                        .map((fieldId) => (
                          <div key={fieldId} className="text-sm">
                            <span className="text-gray-500 font-medium text-xs uppercase tracking-wide">
                              {fieldId}:{" "}
                            </span>
                            <span className="text-gray-900">{String(row.data[fieldId] || "—")}</span>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Card
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
