"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Plus } from "lucide-react"
import type { TableRow } from "@/types/database"

interface KanbanViewProps {
  tableId: string
  viewId: string
  groupingFieldId: string
  fieldIds: string[]
}

export default function KanbanView({ tableId, viewId, groupingFieldId, fieldIds }: KanbanViewProps) {
  const [rows, setRows] = useState<TableRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId])

  async function loadRows() {
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

  function groupRowsByField() {
    const groups: Record<string, TableRow[]> = {}
    rows.forEach((row) => {
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
