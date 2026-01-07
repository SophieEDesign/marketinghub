"use client"

import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, ChevronLeft, ChevronRight } from "lucide-react"
import type { TableRow, ViewFilter, ViewSort } from "@/types/database"
import { useViewMeta } from "@/hooks/useViewMeta"

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
  
  // Use cached metadata hook (serialized, no parallel requests)
  const { metadata: viewMeta, loading: metaLoading } = useViewMeta(viewId, tableId)
  
  // Extract filters and sorts from cached metadata
  const filters = viewMeta?.filters || []
  const sorts = viewMeta?.sorts || []
  
  // Track previous values to prevent infinite loops
  const prevFiltersRef = useRef<string>('')
  const prevSortsRef = useRef<string>('')
  const prevTableIdRef = useRef<string>('')
  const prevPageRef = useRef<number>(1)
  const loadingRowsRef = useRef(false)

  useEffect(() => {
    // CRITICAL: Only skip reload if we already have data AND inputs haven't changed
    // This prevents the race condition where guards fire before data is committed
    const hasData = Array.isArray(rows) && rows.length > 0
    
    // Create stable keys for comparison
    const filtersKey = JSON.stringify(filters)
    const sortsKey = JSON.stringify(sorts)
    
    // Only load rows if something actually changed
    const filtersChanged = prevFiltersRef.current !== filtersKey
    const sortsChanged = prevSortsRef.current !== sortsKey
    const tableIdChanged = prevTableIdRef.current !== tableId
    const pageChanged = prevPageRef.current !== page
    
    // Only skip reload if we have data AND nothing changed
    // If we don't have data, we MUST load regardless of refs matching
    if (hasData && !filtersChanged && !sortsChanged && !tableIdChanged && !pageChanged) {
      return // No actual change, skip loading
    }
    
    // Prevent concurrent row loads
    if (loadingRowsRef.current) {
      return
    }
    
    // Update refs
    prevFiltersRef.current = filtersKey
    prevSortsRef.current = sortsKey
    prevTableIdRef.current = tableId
    prevPageRef.current = page
    
    loadRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, page, filters, sorts])

  async function loadRows() {
    if (!tableId) {
      console.warn("GridView: tableId is required")
      setRows([])
      setLoading(false)
      return
    }

    // Prevent concurrent loads
    if (loadingRowsRef.current) {
      return
    }

    // Sanitize tableId - remove any trailing :X patterns (might be view ID or malformed)
    const sanitizedTableId = tableId.split(':')[0]

    loadingRowsRef.current = true
    setLoading(true)
    try {
      let query = supabase
        .from("table_rows")
        .select("*")
        .eq("table_id", sanitizedTableId)
        .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1)

      // Apply sorting
      if (sorts.length > 0) {
        const firstSort = sorts[0]
        query = query.order("created_at", {
          ascending: firstSort.direction === "asc",
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
          // CRITICAL: Do NOT retry automatically on network failure
          // Keep existing rows if available
          if (rows.length === 0) {
            setRows([])
          }
        }
      } else {
        setRows(data || [])
      }
    } catch (error) {
      console.error("Error loading rows:", error)
      // CRITICAL: Do NOT retry automatically on network failure
      // Keep existing rows if available
      if (rows.length === 0) {
        setRows([])
      }
    } finally {
      setLoading(false)
      loadingRowsRef.current = false
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

  // Show loading if metadata or rows are loading
  if (metaLoading || loading) {
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
        <div className="overflow-x-auto pb-3">
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
