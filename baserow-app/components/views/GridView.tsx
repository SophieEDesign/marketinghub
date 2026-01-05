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
    try {
      const { data: viewFilters, error: filtersError } = await supabase
        .from("view_filters")
        .select("*")
        .eq("view_id", viewId)

      if (filtersError) {
        console.warn("Error loading view filters:", filtersError)
      } else if (viewFilters) {
        setFilters(viewFilters)
      }

      // Try to load view sorts - handle case where order_index column doesn't exist
      const { data: viewSorts, error: sortsError } = await supabase
        .from("view_sorts")
        .select("*")
        .eq("view_id", viewId)

      if (sortsError) {
        // If order_index column doesn't exist, try without ordering
        if (sortsError.code === '42703' || sortsError.message?.includes('order_index')) {
          const { data: sortsWithoutOrder } = await supabase
            .from("view_sorts")
            .select("*")
            .eq("view_id", viewId)
          
          if (sortsWithoutOrder) {
            setSorts(sortsWithoutOrder)
          }
        } else {
          console.warn("Error loading view sorts:", sortsError)
        }
      } else if (viewSorts) {
        // Sort client-side if order_index exists
        const sorted = [...viewSorts].sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
        setSorts(sorted)
      }
    } catch (error) {
      console.error("Error loading view config:", error)
    }
  }

  async function loadRows() {
    if (!tableId) {
      console.warn("GridView: tableId is required")
      setRows([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
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
        // Handle case where table_rows doesn't exist (PGRST205)
        if (error.code === 'PGRST205' || error.message?.includes('table_rows')) {
          console.warn("table_rows table does not exist. Run migration to create it.")
          setRows([])
        } else {
          console.error("Error loading rows:", error)
          setRows([])
        }
      } else {
        setRows(data || [])
      }
    } catch (error) {
      console.error("Error loading rows:", error)
      setRows([])
    } finally {
      setLoading(false)
    }
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
    if (!tableId) {
      console.warn("Cannot add row: tableId is required")
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const newRow = {
        table_id: tableId,
        data: {},
        created_by: user?.id,
      }

      const { error } = await supabase.from("table_rows").insert([newRow])
      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('table_rows')) {
          console.warn("table_rows table does not exist. Run migration to create it.")
        } else {
          console.error("Error adding row:", error)
        }
      } else {
        loadRows()
      }
    } catch (error) {
      console.error("Error adding row:", error)
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
