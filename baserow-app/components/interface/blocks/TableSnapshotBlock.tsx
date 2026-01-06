"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { PageBlock } from "@/lib/interface/types"
import { Table2, ExternalLink } from "lucide-react"

interface TableSnapshotBlockProps {
  block: PageBlock
  isEditing?: boolean
}

export default function TableSnapshotBlock({ block, isEditing = false }: TableSnapshotBlockProps) {
  const router = useRouter()
  const { config } = block
  const viewId = config?.view_id
  const tableId = config?.table_id
  const rowLimit = config?.row_limit || 10
  const highlightRules = config?.highlight_rules || []
  const clickThrough = config?.click_through
  
  const [rows, setRows] = useState<any[]>([])
  const [fields, setFields] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tableName, setTableName] = useState<string>("")

  useEffect(() => {
    if (viewId || tableId) {
      loadSnapshot()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewId, tableId, rowLimit])

  async function loadSnapshot() {
    if (!tableId) return

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Get table info
      const { data: table, error: tableError } = await supabase
        .from("tables")
        .select("supabase_table, name")
        .eq("id", tableId)
        .single()

      if (tableError || !table?.supabase_table) {
        throw new Error("Table not found")
      }

      setTableName(table.name || "")

      // Load view fields if viewId is provided
      let fieldNames: string[] = []
      if (viewId) {
        const { data: viewFields } = await supabase
          .from("view_fields")
          .select("field_name, visible, position")
          .eq("view_id", viewId)
          .eq("visible", true)
          .order("position")

        fieldNames = (viewFields || []).map((vf: any) => vf.field_name)
      }

      // Load table fields if no view fields
      if (fieldNames.length === 0) {
        const { data: tableFields } = await supabase
          .from("table_fields")
          .select("name, type")
          .eq("table_id", tableId)
          .order("position")

        fieldNames = (tableFields || []).slice(0, 5).map((tf: any) => tf.name)
        setFields(tableFields || [])
      } else {
        // Get field metadata
        const { data: tableFields } = await supabase
          .from("table_fields")
          .select("name, type")
          .eq("table_id", tableId)
          .in("name", fieldNames)

        setFields(tableFields || [])
      }

      // Load rows
      let query: any = supabase
        .from(table.supabase_table)
        .select(fieldNames.join(", "))
        .limit(rowLimit)

      // Apply view filters if viewId is provided
      if (viewId) {
        const { data: filters } = await supabase
          .from("view_filters")
          .select("*")
          .eq("view_id", viewId)

        if (filters && filters.length > 0) {
          filters.forEach((filter: any) => {
            if (filter.operator === "eq") {
              query = query.eq(filter.field_name, filter.value)
            } else if (filter.operator === "neq") {
              query = query.neq(filter.field_name, filter.value)
            } else if (filter.operator === "gt") {
              query = query.gt(filter.field_name, filter.value)
            } else if (filter.operator === "gte") {
              query = query.gte(filter.field_name, filter.value)
            } else if (filter.operator === "lt") {
              query = query.lt(filter.field_name, filter.value)
            } else if (filter.operator === "lte") {
              query = query.lte(filter.field_name, filter.value)
            } else if (filter.operator === "contains") {
              query = query.ilike(filter.field_name, `%${filter.value}%`)
            }
          })
        }

        // Apply view sorts
        const { data: sorts } = await supabase
          .from("view_sorts")
          .select("*")
          .eq("view_id", viewId)
          .order("position")

        if (sorts && sorts.length > 0) {
          sorts.forEach((sort: any, index: number) => {
            if (index === 0) {
              query = query.order(sort.field_name, { ascending: sort.direction === "asc" })
            }
          })
        }
      }

      const { data: rowsData, error: rowsError } = await query

      if (rowsError) throw rowsError

      setRows(rowsData || [])
    } catch (err: any) {
      console.error("Error loading table snapshot:", err)
      setError(err.message || "Failed to load table snapshot")
    } finally {
      setLoading(false)
    }
  }

  function getRowStyle(row: any): React.CSSProperties {
    const style: React.CSSProperties = {}
    
    highlightRules.forEach((rule: any) => {
      const fieldValue = row[rule.field]
      let matches = false

      if (rule.operator === "eq" && fieldValue === rule.value) matches = true
      else if (rule.operator === "neq" && fieldValue !== rule.value) matches = true
      else if (rule.operator === "gt" && parseFloat(fieldValue) > parseFloat(rule.value)) matches = true
      else if (rule.operator === "lt" && parseFloat(fieldValue) < parseFloat(rule.value)) matches = true
      else if (rule.operator === "contains" && String(fieldValue).includes(rule.value)) matches = true

      if (matches && rule.background_color) {
        style.backgroundColor = rule.background_color
      }
      if (matches && rule.text_color) {
        style.color = rule.text_color
      }
    })

    return style
  }

  function handleRowClick() {
    if (clickThrough && !isEditing) {
      if (viewId) {
        router.push(`/tables/${tableId}/views/${viewId}`)
      } else if (tableId) {
        router.push(`/tables/${tableId}`)
      }
    }
  }

  // Empty state
  if (!tableId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <Table2 className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="mb-1">{isEditing ? "Configure table snapshot" : "No table configured"}</p>
          {isEditing && (
            <p className="text-xs text-gray-400">Select a table or view in settings</p>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mx-auto mb-2"></div>
          <p className="text-sm">Loading snapshot...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-400 text-sm p-4">
        <div className="text-center">
          <p className="mb-1">Error loading snapshot</p>
          <p className="text-xs">{error}</p>
        </div>
      </div>
    )
  }

  // Apply appearance settings
  const appearance = config.appearance || {}
  const blockStyle: React.CSSProperties = {
    backgroundColor: appearance.background_color,
    borderColor: appearance.border_color,
    borderWidth: appearance.border_width !== undefined ? `${appearance.border_width}px` : '1px',
    borderRadius: appearance.border_radius !== undefined ? `${appearance.border_radius}px` : '8px',
    padding: appearance.padding !== undefined ? `${appearance.padding}px` : '16px',
  }

  const title = appearance.title || config.title
  const showTitle = appearance.show_title !== false && title

  const displayFields = fields.slice(0, 5) // Limit to 5 columns for readability

  return (
    <div className="h-full w-full overflow-auto flex flex-col" style={blockStyle}>
      {showTitle && (
        <div
          className="mb-4 pb-2 border-b flex items-center justify-between"
          style={{
            backgroundColor: appearance.header_background,
            color: appearance.header_text_color || appearance.title_color,
          }}
        >
          <h3 className="text-lg font-semibold">{title}</h3>
          {clickThrough && !isEditing && (
            <button
              onClick={handleRowClick}
              className="text-xs flex items-center gap-1 hover:underline"
            >
              View all
              <ExternalLink className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
            <div className="text-center">
              <Table2 className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p>No records found</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto pb-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {displayFields.map((field) => (
                    <th
                      key={field.name}
                      className="text-left p-2 font-semibold text-gray-700"
                    >
                      {field.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={index}
                    className={`border-b hover:bg-gray-50 ${clickThrough && !isEditing ? 'cursor-pointer' : ''}`}
                    style={getRowStyle(row)}
                    onClick={handleRowClick}
                  >
                    {displayFields.map((field) => (
                      <td key={field.name} className="p-2">
                        {row[field.name] !== null && row[field.name] !== undefined
                          ? String(row[field.name])
                          : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length >= rowLimit && (
              <div className="text-xs text-gray-400 text-center mt-2 p-2">
                Showing {rowLimit} of many records
                {clickThrough && !isEditing && (
                  <button
                    onClick={handleRowClick}
                    className="ml-2 text-blue-600 hover:underline"
                  >
                    View all
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

