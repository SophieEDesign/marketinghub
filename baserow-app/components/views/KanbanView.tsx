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
    <div className="w-full overflow-x-auto">
      <div className="flex gap-4 min-w-max p-4">
        {groups.map((groupName) => (
          <div key={groupName} className="flex-shrink-0 w-80">
            <div className="bg-muted/50 rounded-lg p-3 mb-2 font-medium">
              {groupName} ({groupedRows[groupName].length})
            </div>
            <div className="space-y-2">
              {groupedRows[groupName].map((row) => (
                <Card key={row.id} className="cursor-pointer hover:shadow-md">
                  <CardContent className="p-3">
                    <div className="space-y-1">
                      {fieldIds
                        .filter((fid) => fid !== groupingFieldId)
                        .slice(0, 3)
                        .map((fieldId) => (
                          <div key={fieldId} className="text-sm">
                            <span className="text-muted-foreground">Field {fieldId}: </span>
                            <span>{String(row.data[fieldId] || "")}</span>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2"
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
