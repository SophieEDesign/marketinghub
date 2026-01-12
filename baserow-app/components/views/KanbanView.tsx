"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
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
  colorField?: string // Field name to use for card colors (single-select field)
  imageField?: string // Field name to use for card images
  fitImageSize?: boolean // Whether to fit image to container size
}

export default function KanbanView({ 
  tableId, 
  viewId, 
  groupingFieldId, 
  fieldIds,
  searchQuery = "",
  tableFields = [],
  colorField,
  imageField,
  fitImageSize = false,
}: KanbanViewProps) {
  // All hooks must be at the top level, before any conditional returns
  const [rows, setRows] = useState<TableRow[]>([])
  const [loading, setLoading] = useState(true)

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

  // Helper to get color from color field
  const getCardColor = useCallback((row: TableRow): string | null => {
    if (!colorField) return null
    
    const colorFieldObj = tableFields.find(f => f.name === colorField || f.id === colorField)
    if (!colorFieldObj || (colorFieldObj.type !== 'single_select' && colorFieldObj.type !== 'multi_select')) {
      return null
    }
    
    const colorValue = row.data[colorField]
    if (!colorValue) return null
    
    const choiceColors = colorFieldObj.options?.choiceColors
    if (!choiceColors) return null
    
    // Normalize value for lookup
    const normalizedValue = String(colorValue).trim()
    
    // Try exact match first
    if (choiceColors[normalizedValue]) {
      const color = choiceColors[normalizedValue]
      return color.startsWith('#') ? color : `#${color}`
    }
    
    // Try case-insensitive match
    const matchingKey = Object.keys(choiceColors).find(
      key => key.toLowerCase() === normalizedValue.toLowerCase()
    )
    if (matchingKey) {
      const color = choiceColors[matchingKey]
      return color.startsWith('#') ? color : `#${color}`
    }
    
    return null
  }, [colorField, tableFields])

  // Helper to get image from image field
  const getCardImage = useCallback((row: TableRow): string | null => {
    if (!imageField) return null
    
    const imageValue = row.data[imageField]
    if (!imageValue) return null
    
    // Handle attachment field (array of URLs) or URL field (single URL)
    if (Array.isArray(imageValue) && imageValue.length > 0) {
      return imageValue[0]
    }
    if (typeof imageValue === 'string' && (imageValue.startsWith('http') || imageValue.startsWith('/'))) {
      return imageValue
    }
    
    return null
  }, [imageField])

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
    
    // Sanitize tableId - remove any trailing :X patterns (might be view ID or malformed)
    const sanitizedTableId = tableId.split(':')[0]
    
    setLoading(true)
    try {
      // First, get the table to find its supabase_table name
      const { data: table, error: tableError } = await supabase
        .from("tables")
        .select("supabase_table")
        .eq("id", sanitizedTableId)
        .single()

      if (tableError || !table) {
        console.error("Error loading table:", tableError)
        setRows([])
        setLoading(false)
        return
      }

      // Load rows from the actual table (not table_rows)
      const { data, error } = await supabase
        .from(table.supabase_table)
        .select("*")
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error loading rows:", error)
        setRows([])
      } else {
        // Convert flat rows to TableRow format for compatibility
        const tableRows = (data || []).map((row: any) => ({
          id: row.id,
          table_id: sanitizedTableId,
          data: row,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }))
        setRows(tableRows)
      }
    } catch (error) {
      console.error("Error loading kanban rows:", error)
      setRows([])
    }
    setLoading(false)
  }

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
              {groupedRows[groupName].map((row) => {
                const cardColor = getCardColor(row)
                const cardImage = getCardImage(row)
                const borderColor = cardColor ? { borderLeftColor: cardColor, borderLeftWidth: '4px' } : {}
                
                return (
                <Card 
                  key={row.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow bg-white border-gray-200 rounded-lg"
                  style={borderColor}
                >
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      {/* Image if configured */}
                      {cardImage && (
                        <div className={`w-full ${fitImageSize ? 'h-auto' : 'h-32'} rounded overflow-hidden bg-gray-100 mb-2`}>
                          <img
                            src={cardImage}
                            alt=""
                            className={`w-full ${fitImageSize ? 'h-auto object-contain' : 'h-32 object-cover'}`}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        </div>
                      )}
                      {(Array.isArray(fieldIds) ? fieldIds : [])
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
                )
              })}
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
