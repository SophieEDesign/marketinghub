"use client"

import { useState, useEffect, useMemo } from "react"
import React from "react"
import { supabase } from "@/lib/supabase/client"
import { Plus, ChevronDown, ChevronRight } from "lucide-react"
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
  searchTerm?: string
  groupBy?: string
}

const ITEMS_PER_PAGE = 100

export default function GridView({
  tableId,
  viewId,
  supabaseTableName,
  viewFields,
  viewFilters = [],
  viewSorts = [],
  searchTerm = "",
  groupBy,
}: GridViewProps) {
  const [rows, setRows] = useState<Record<string, any>[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [tableError, setTableError] = useState<string | null>(null)

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

      // Apply filters at query level
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

      // Apply sorting at query level
      if (viewSorts.length > 0) {
        // Apply multiple sorts if needed
        for (let i = 0; i < viewSorts.length; i++) {
          const sort = viewSorts[i]
          if (i === 0) {
            query = query.order(sort.field_name, {
              ascending: sort.direction === "asc",
            })
          } else {
            // For additional sorts, we'd need to chain them
            // Supabase supports multiple order() calls
            query = query.order(sort.field_name, {
              ascending: sort.direction === "asc",
            })
          }
        }
      } else {
        // Default sort by id descending
        query = query.order("id", { ascending: false })
      }

      // Limit results
      query = query.limit(ITEMS_PER_PAGE)

      const { data, error } = await query

      if (error) {
        console.error("Error loading rows:", error)
        // Check if table doesn't exist
        if (error.code === "42P01" || error.message?.includes("does not exist") || error.message?.includes("relation")) {
          setTableError(`The table "${supabaseTableName}" does not exist. Attempting to create it...`)
          
          // Try to create the table automatically
          try {
            const createResponse = await fetch('/api/tables/create-table', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tableName: supabaseTableName })
            })
            
            const createResult = await createResponse.json()
            
            if (createResult.success) {
              // Table created, reload rows
              setTableError(null)
              loadRows()
              return
            } else {
              // Show the SQL needed to create the table
              setTableError(createResult.message || createResult.error || `Table "${supabaseTableName}" does not exist.`)
            }
          } catch (createError) {
            console.error('Failed to create table:', createError)
            setTableError(`The table "${supabaseTableName}" does not exist and could not be created automatically.`)
          }
        } else {
          setTableError(`Error loading data: ${error.message}`)
        }
        setRows([])
      } else {
        setTableError(null)
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
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          setTableError(`The table "${supabaseTableName}" does not exist in Supabase.`)
        }
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
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          setTableError(`The table "${supabaseTableName}" does not exist in Supabase.`)
        }
      } else {
        await loadRows()
        // Optionally select the new row
        if (data) {
          setSelectedRowId(data.id)
          setDrawerOpen(true)
        }
      }
    } catch (error: any) {
      console.error("Error adding row:", error)
      if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
        setTableError(`The table "${supabaseTableName}" does not exist in Supabase.`)
      }
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

  // Apply client-side search
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows

    const searchLower = searchTerm.toLowerCase()
    return rows.filter((row) => {
      return visibleFields.some((field) => {
        const value = row[field.field_name]
        if (value === null || value === undefined) return false
        return String(value).toLowerCase().includes(searchLower)
      })
    })
  }, [rows, searchTerm, visibleFields])

  // Group rows if groupBy is set
  const groupedRows = useMemo(() => {
    if (!groupBy) return null

    const groups: Record<string, Record<string, any>[]> = {}

    filteredRows.forEach((row) => {
      const groupValue = row[groupBy] ?? "Uncategorized"
      const groupKey = String(groupValue)
      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(row)
    })

    // Sort group keys
    const sortedGroupKeys = Object.keys(groups).sort()

    return sortedGroupKeys.map((key) => ({
      key,
      value: groups[key][0][groupBy],
      rows: groups[key],
    }))
  }, [filteredRows, groupBy])

  function toggleGroup(groupKey: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }
      return next
    })
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

  if (tableError) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="max-w-md p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">Table Not Found</h3>
          <p className="text-sm text-yellow-700 mb-4">{tableError}</p>
          <p className="text-xs text-yellow-600">
            The table <code className="bg-yellow-100 px-1 py-0.5 rounded">{supabaseTableName}</code> needs to be created in your Supabase database.
            You can create it manually in the Supabase dashboard or use a migration.
          </p>
        </div>
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
          {filteredRows.length} {filteredRows.length === 1 ? "row" : "rows"}
          {searchTerm && filteredRows.length !== rows.length && (
            <span className="ml-1">(filtered from {rows.length})</span>
          )}
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
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleFields.length}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    {searchTerm ? "No rows match your search" : "No rows found"}
                  </td>
                </tr>
              ) : groupBy && groupedRows ? (
                // Render grouped rows
                groupedRows.map((group) => {
                  const isCollapsed = collapsedGroups.has(group.key)
                  return (
                    <React.Fragment key={group.key}>
                      {/* Group header */}
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <td
                          colSpan={visibleFields.length}
                          className="px-4 py-2"
                        >
                          <button
                            onClick={() => toggleGroup(group.key)}
                            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 w-full text-left"
                          >
                            {isCollapsed ? (
                              <ChevronRight className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                            <span className="font-semibold">
                              {groupBy}: {String(group.value ?? "Uncategorized")}
                            </span>
                            <span className="text-gray-500 ml-2">
                              ({group.rows.length} {group.rows.length === 1 ? "row" : "rows"})
                            </span>
                          </button>
                        </td>
                      </tr>
                      {/* Group rows */}
                      {!isCollapsed &&
                        group.rows.map((row) => (
                          <tr
                            key={row.id}
                            className="border-b border-gray-100 hover:bg-blue-50 transition-colors cursor-pointer"
                            onClick={() => handleRowClick(row.id)}
                          >
                            {visibleFields.map((field) => (
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
                            ))}
                          </tr>
                        ))}
                    </React.Fragment>
                  )
                })
              ) : (
                // Render ungrouped rows
                filteredRows.map((row) => (
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
