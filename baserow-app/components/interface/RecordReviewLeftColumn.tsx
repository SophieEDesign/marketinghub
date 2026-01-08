"use client"

/**
 * Record Review Left Column (Fixed Structural UI)
 * 
 * This is NOT a block - it's a fixed structural component that:
 * - Shows record list/table
 * - Provides search, filter, sort
 * - Manages field visibility settings
 * - Handles record selection (sets recordId in UI state)
 * 
 * The left column is always present, regardless of edit/view mode.
 * It's not draggable, not part of the canvas blocks.
 */

import { useState, useEffect, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import type { TableField } from "@/types/fields"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

interface RecordReviewLeftColumnProps {
  tableId: string | null // From page.settings.tableId
  selectedRecordId: string | null
  onRecordSelect: (recordId: string) => void
  leftPanelSettings?: {
    visibleFieldIds: string[] // From page.settings.leftPanel.visibleFieldIds
    fieldOrder?: string[] // From page.settings.leftPanel.fieldOrder
    showLabels?: boolean // From page.settings.leftPanel.showLabels
    compact?: boolean // From page.settings.leftPanel.compact
  }
}

export default function RecordReviewLeftColumn({
  tableId,
  selectedRecordId,
  onRecordSelect,
  leftPanelSettings,
}: RecordReviewLeftColumnProps) {
  const [records, setRecords] = useState<any[]>([])
  const [fields, setFields] = useState<TableField[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [tableName, setTableName] = useState<string | null>(null)
  
  // Get visible field IDs from page settings (single source of truth)
  const visibleFieldIds = leftPanelSettings?.visibleFieldIds || []
  const fieldOrder = leftPanelSettings?.fieldOrder || []
  const showLabels = leftPanelSettings?.showLabels ?? true
  const compact = leftPanelSettings?.compact ?? false

  // Load table name and fields
  useEffect(() => {
    if (!tableId) return

    async function loadTableInfo() {
      const supabase = createClient()
      
      // Load table name
      const { data: table } = await supabase
        .from("tables")
        .select("name, supabase_table")
        .eq("id", tableId)
        .single()

      if (table) {
        setTableName(table.name)
        
        // Load fields
        const { data: tableFields } = await supabase
          .from("table_fields")
          .select("*")
          .eq("table_id", tableId)
          .order("order_index", { ascending: true })

        if (tableFields) {
          setFields(tableFields as TableField[])
        }

        // Load records
        await loadRecords(table.supabase_table)
      }
    }

    loadTableInfo()
  }, [tableId])

  const loadRecords = useCallback(async (supabaseTableName: string) => {
    if (!supabaseTableName) return

    setLoading(true)
    try {
      const supabase = createClient()
      let query = supabase.from(supabaseTableName).select("*").limit(100)

      // Apply search filter
      if (searchQuery.trim()) {
        // Simple search - can be enhanced
        query = query.or(`name.ilike.%${searchQuery}%,id.ilike.%${searchQuery}%`)
      }

      const { data, error } = await query

      if (error) {
        console.error("Error loading records:", error)
      } else {
        setRecords(data || [])
      }
    } catch (error) {
      console.error("Error loading records:", error)
    } finally {
      setLoading(false)
    }
  }, [searchQuery])

  useEffect(() => {
    if (tableId) {
      const supabase = createClient()
      supabase
        .from("tables")
        .select("supabase_table")
        .eq("id", tableId)
        .single()
        .then(({ data: table }) => {
          if (table?.supabase_table) {
            loadRecords(table.supabase_table)
          }
        })
    }
  }, [tableId, loadRecords])

  // Get ordered fields based on page settings
  const orderedFields = useMemo(() => {
    if (fieldOrder.length > 0) {
      // Use fieldOrder from settings
      return fieldOrder
        .map(id => fields.find(f => f.id === id))
        .filter((f): f is TableField => f !== undefined)
        .concat(fields.filter(f => !fieldOrder.includes(f.id)))
    }
    // If no fieldOrder, use table field order
    return fields
  }, [fields, fieldOrder])

  if (!tableId) {
    return (
      <div className="w-80 border-r border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-500">No table selected</p>
      </div>
    )
  }

  return (
    <div className="w-80 border-r border-gray-200 bg-white flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">{tableName || "Records"}</h3>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search records..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Record List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-sm text-gray-500">Loading records...</div>
        ) : records.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">No records found</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {records.map((record) => {
              const isSelected = record.id === selectedRecordId
              
              // Get display value from first visible field (from page settings)
              // If no visibleFieldIds specified, show all fields
              const displayFields = visibleFieldIds.length === 0
                ? orderedFields
                : orderedFields.filter(f => visibleFieldIds.includes(f.id))
              
              const displayField = displayFields[0]
              const displayValue = displayField 
                ? record[displayField.name] || record.id
                : record.name || record.id

              return (
                <button
                  key={record.id}
                  onClick={() => onRecordSelect(record.id)}
                  className={`w-full text-left p-3 hover:bg-gray-50 transition-colors ${
                    isSelected ? "bg-blue-50 border-l-4 border-blue-500" : ""
                  } ${compact ? "py-2" : ""}`}
                >
                  <div className={`font-medium text-gray-900 truncate ${compact ? "text-xs" : "text-sm"}`}>
                    {String(displayValue || record.id)}
                  </div>
                  {showLabels && displayField && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      {displayField.name}
                    </div>
                  )}
                  {isSelected && (
                    <Badge variant="secondary" className="mt-1 text-xs">
                      Selected
                    </Badge>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
