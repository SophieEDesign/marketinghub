"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, ChevronLeft, ChevronRight } from "lucide-react"
import type { TableRow, ViewFilter, ViewSort } from "@/types/database"

interface GridViewProps {
  tableId: string
  viewId: string
  fieldIds: string[]
}

const ITEMS_PER_PAGE = 50

export default function GridView({ tableId, viewId, fieldIds }: GridViewProps) {
  const [rows, setRows] = useState<TableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<ViewFilter[]>([])
  const [sorts, setSorts] = useState<ViewSort[]>([])

  useEffect(() => {
    loadViewConfig()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewId])

  useEffect(() => {
    loadRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, page, filters, sorts])

  async function loadViewConfig() {
    const { data: viewFilters } = await supabase
      .from("view_filters")
      .select("*")
      .eq("view_id", viewId)

    const { data: viewSorts } = await supabase
      .from("view_sorts")
      .select("*")
      .eq("view_id", viewId)
      .order("order_index", { ascending: true })

    if (viewFilters) setFilters(viewFilters)
    if (viewSorts) setSorts(viewSorts)
  }

  async function loadRows() {
    setLoading(true)
    let query = supabase
      .from("table_rows")
      .select("*")
      .eq("table_id", tableId)
      .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1)

    // Apply sorting
    if (sorts.length > 0) {
      const firstSort = sorts[0]
      query = query.order("created_at", {
        ascending: firstSort.order_direction === "asc",
      })
    } else {
      query = query.order("created_at", { ascending: false })
    }

    const { data, error } = await query

    if (error) {
      console.error("Error loading rows:", error)
    } else {
      setRows(data || [])
    }
    setLoading(false)
  }

  async function handleCellEdit(rowId: string, fieldName: string, value: any) {
    const { data: row } = await supabase
      .from("table_rows")
      .select("*")
      .eq("id", rowId)
      .single()

    if (row) {
      const updatedData = { ...row.data, [fieldName]: value }
      await supabase
        .from("table_rows")
        .update({ data: updatedData, updated_at: new Date().toISOString() })
        .eq("id", rowId)

      loadRows()
    }
  }

  async function handleAddRow() {
    const { data: { user } } = await supabase.auth.getUser()
    const newRow = {
      table_id: tableId,
      data: {},
      created_by: user?.id,
    }

    const { error } = await supabase.from("table_rows").insert([newRow])
    if (!error) {
      loadRows()
    }
  }

  if (loading) {
    return <div className="p-4">Loading...</div>
  }

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={handleAddRow} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Row
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">Page {page}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page + 1)}
            disabled={rows.length < ITEMS_PER_PAGE}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b bg-muted/50">
                {fieldIds.map((fieldId) => (
                  <th
                    key={fieldId}
                    className="px-4 py-2 text-left text-sm font-medium min-w-[150px]"
                  >
                    Field {fieldId}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b hover:bg-muted/50">
                  {fieldIds.map((fieldId) => (
                    <td key={fieldId} className="px-4 py-2">
                      <EditableCell
                        value={row.data[fieldId] || ""}
                        onChange={(value) => handleCellEdit(row.id, fieldId, value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function EditableCell({
  value,
  onChange,
}: {
  value: any
  onChange: (value: any) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(String(value || ""))

  const handleBlur = () => {
    onChange(editValue)
    setEditing(false)
  }

  if (editing) {
    return (
      <Input
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleBlur()
          if (e.key === "Escape") setEditing(false)
        }}
        autoFocus
        className="h-8"
      />
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="min-h-[32px] flex items-center cursor-pointer hover:bg-muted/50 px-2 rounded"
    >
      {value || <span className="text-muted-foreground">Empty</span>}
    </div>
  )
}
