"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import { Plus } from "lucide-react"
import Cell from "./Cell"
import RecordDrawer from "./RecordDrawer"

interface GridViewProps {
  tableId: string
  viewId: string
  supabaseTableName: string
  viewFields: Array<{
    field_name: string
    visible: boolean
    position: number
  }>
  viewFilters?: Array<{
    field_name: string
    operator: string
    value?: string
  }>
  viewSorts?: Array<{
    field_name: string
    direction: string
  }>
}

const ITEMS_PER_PAGE = 100

export default function GridView({
  tableId,
  viewId,
  supabaseTableName,
  viewFields,
  viewFilters = [],
  viewSorts = [],
}: GridViewProps) {
  const [rows, setRows] = useState<Record<string, any>[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Get visible fields ordered by position
  const visibleFields = viewFields
    .filter((f) => f.visible)
    .sort((a, b) => a.position - b.position)

  useEffect(() => {
    loadRows()
  }, [supabaseTableName, viewFilters, viewSorts])

  async function loadRows() {
    if (!supabaseTableName) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      let query = supabase.from(supabaseTableName).select("*")

      // Apply filters
      for (const filter of viewFilters) {
        const fieldValue = filter.value
        switch (filter.operator) {
          case "equal":
            query = query.eq(filter.field_name, fieldValue)
            break
          case "not_equal":
            query = query.neq(filter.field_name, fieldValue)
            break
          case "contains":
            query = query.ilike(filter.field_name, `%${fieldValue}%`)
            break
          case "not_contains":
            query = query.not(filter.field_name, "ilike", `%${fieldValue}%`)
            break
          case "is_empty":
            query = query.or(`${filter.field_name}.is.null,${filter.field_name}.eq.`)
            break
          case "is_not_empty":
            query = query.not(filter.field_name, "is", null)
            break
          case "greater_than":
            query = query.gt(filter.field_name, fieldValue)
            break
          case "less_than":
            query = query.lt(filter.field_name, fieldValue)
            break
          case "greater_than_or_equal":
            query = query.gte(filter.field_name, fieldValue)
            break
          case "less_than_or_equal":
            query = query.lte(filter.field_name, fieldValue)
            break
        }
      }

      // Apply sorting
      if (viewSorts.length > 0) {
        const firstSort = viewSorts[0]
        query = query.order(firstSort.field_name, {
          ascending: firstSort.direction === "asc",
        })
      } else {
        // Default sort by id descending
        query = query.order("id", { ascending: false })
      }

      // Limit results
      query = query.limit(ITEMS_PER_PAGE)

      const { data, error } = await query

      if (error) {
        console.error("Error loading rows:", error)
        setRows([])
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

  async function handleCellSave(rowId: string, fieldName: string, value: any) {
    if (!rowId || !supabaseTableName) return

    try {
      const { error } = await supabase
        .from(supabaseTableName)
        .update({ [fieldName]: value })
        .eq("id", rowId)

      if (error) {
        console.error("Error saving cell:", error)
        throw error
      }

      // Update local state immediately for better UX
      setRows((prevRows) =>
        prevRows.map((row) =>
          row.id === rowId ? { ...row, [fieldName]: value } : row
        )
      )
    } catch (error) {
      throw error
    }
  }

  async function handleAddRow() {
    if (!supabaseTableName) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const newRow: Record<string, any> = {}

      // Initialize visible fields with empty values
      visibleFields.forEach((field) => {
        newRow[field.field_name] = null
      })

      const { data, error } = await supabase
        .from(supabaseTableName)
        .insert([newRow])
        .select()
        .single()

      if (error) {
        console.error("Error adding row:", error)
      } else {
        await loadRows()
        // Optionally select the new row
        if (data) {
          setSelectedRowId(data.id)
          setDrawerOpen(true)
        }
      }
    } catch (error) {
      console.error("Error adding row:", error)
    }
  }

  function handleRowClick(rowId: string) {
    setSelectedRowId(rowId)
    setDrawerOpen(true)
  }

  function handleDrawerClose() {
    setDrawerOpen(false)
    setSelectedRowId(null)
  }

  function handleDrawerSave() {
    loadRows()
  }

  function handleDrawerDelete() {
    loadRows()
    handleDrawerClose()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!supabaseTableName) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Table not configured</div>
      </div>
    )
  }

  return (
    <div className="w-full relative">
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={handleAddRow}
          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Row
        </button>
        <div className="text-sm text-gray-500">
          {rows.length} {rows.length === 1 ? "row" : "rows"}
        </div>
      </div>

      {/* Grid Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {visibleFields.map((field) => (
                  <th
                    key={field.field_name}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[150px] sticky top-0 bg-gray-50 z-10"
                  >
                    {field.field_name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleFields.length}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    No rows found
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-gray-100 hover:bg-blue-50 transition-colors cursor-pointer"
                    onClick={() => handleRowClick(row.id)}
                  >
                    {visibleFields.map((field) => {
                      // Don't make the cell clickable - row click opens drawer
                      return (
                        <td
                          key={field.field_name}
                          className="px-0 py-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Cell
                            value={row[field.field_name]}
                            fieldName={field.field_name}
                            onSave={async (value) => {
                              await handleCellSave(row.id, field.field_name, value)
                            }}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Drawer */}
      <RecordDrawer
        isOpen={drawerOpen}
        onClose={handleDrawerClose}
        tableName={supabaseTableName}
        rowId={selectedRowId}
        fieldNames={visibleFields.map((f) => f.field_name)}
        onSave={handleDrawerSave}
        onDelete={handleDrawerDelete}
      />
    </div>
  )
}
