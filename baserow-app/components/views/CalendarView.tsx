"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import { filterRowsBySearch } from "@/lib/search/filterRows"
import { applyFiltersToQuery, type FilterConfig } from "@/lib/interface/filters"
import type { EventInput } from "@fullcalendar/core"
import type { TableRow } from "@/types/database"
import type { TableField } from "@/types/fields"

interface CalendarViewProps {
  tableId: string
  viewId: string
  dateFieldId: string
  fieldIds: string[]
  searchQuery?: string
  tableFields?: any[]
  filters?: FilterConfig[] // Dynamic filters from config
  onRecordClick?: (recordId: string) => void // Emit recordId on click
}

export default function CalendarView({ 
  tableId, 
  viewId, 
  dateFieldId, 
  fieldIds,
  searchQuery = "",
  tableFields = [],
  filters = [],
  onRecordClick
}: CalendarViewProps) {
  const router = useRouter()
  const [rows, setRows] = useState<TableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [resolvedTableId, setResolvedTableId] = useState<string>(tableId)
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')
  const [supabaseTableName, setSupabaseTableName] = useState<string | null>(null)

  useEffect(() => {
    resolveTableId()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, viewId])

  useEffect(() => {
    if (resolvedTableId) {
      loadTableInfo()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTableId])

  useEffect(() => {
    if (resolvedTableId && supabaseTableName) {
      loadRows()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTableId, supabaseTableName, filters, searchQuery])

  async function resolveTableId() {
    // If tableId is provided, use it
    if (tableId) {
      setResolvedTableId(tableId)
      return
    }

    // If no tableId but we have viewId, fetch the view's table_id
    if (!tableId && viewId) {
      try {
        const { data: view, error } = await supabase
          .from("views")
          .select("table_id")
          .eq("id", viewId)
          .single()

        if (error) {
          // Silently handle error - will show setup state
          setResolvedTableId("")
          setLoading(false)
          return
        }

        if (view?.table_id) {
          setResolvedTableId(view.table_id)
        } else {
          // View exists but has no table_id - show setup state
          setResolvedTableId("")
          setLoading(false)
        }
      } catch (error) {
        // Silently handle error - will show setup state
        setResolvedTableId("")
        setLoading(false)
      }
    } else {
      setResolvedTableId("")
      setLoading(false)
    }
  }

  async function loadTableInfo() {
    if (!resolvedTableId) return
    
    const sanitizedTableId = resolvedTableId.split(':')[0]
    if (!sanitizedTableId || sanitizedTableId.trim() === '') return

    try {
      const supabase = createClient()
      const { data: table } = await supabase
        .from("tables")
        .select("supabase_table")
        .eq("id", sanitizedTableId)
        .single()

      if (table?.supabase_table) {
        setSupabaseTableName(table.supabase_table)
      }
    } catch (error) {
      console.error('Calendar: Error loading table info:', error)
    }
  }

  async function loadRows() {
    // Gracefully handle missing tableId for SQL-view backed pages
    if (!resolvedTableId || !supabaseTableName) {
      setRows([])
      setLoading(false)
      return
    }
    
    setLoading(true)
    try {
      const supabase = createClient()
      
      // Build query with filters
      let query = supabase
        .from(supabaseTableName)
        .select("*")

      // Apply filters using shared filter system
      const normalizedFields = tableFields.map(f => ({ name: f.name || f.field_name || f.id, type: f.type || f.field_type }))
      query = applyFiltersToQuery(query, filters, normalizedFields)

      // Apply search query if provided
      if (searchQuery && fieldIds.length > 0) {
        // For search, we'll filter client-side after loading
        // This is simpler than building complex OR queries
      }

      const { data, error } = await query

      if (error) {
        console.error('Calendar: Error loading rows:', error)
        setRows([])
      } else {
        // Convert flat rows to TableRow format
        const tableRows: TableRow[] = (data || []).map((row: any) => ({
          id: row.id,
          table_id: resolvedTableId,
          data: row,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }))
        setRows(tableRows)
      }
    } catch (error) {
      console.error('Calendar: Exception loading rows:', error)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

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

  // Find date field in tableFields to validate it exists and is a date type
  const dateField = useMemo(() => {
    if (!dateFieldId || !tableFields.length) return null
    // Try to find by name first, then by id
    return tableFields.find(f => 
      f.name === dateFieldId || 
      f.id === dateFieldId ||
      f.field_name === dateFieldId
    )
  }, [dateFieldId, tableFields])

  const isValidDateField = useMemo(() => {
    if (!dateField) return false
    const fieldType = dateField.type || dateField.field_type
    return fieldType === 'date' || fieldType === 'datetime' || fieldType === 'timestamp'
  }, [dateField])

  function getEvents(): EventInput[] {
    if (!dateFieldId || !isValidDateField) return []
    
    try {
      return filteredRows
        .filter((row) => {
          if (!row || !row.data) return false
          const dateValue = row.data[dateFieldId]
          if (!dateValue) return false
          // Accept string dates, Date objects, or ISO strings
          return typeof dateValue === 'string' || dateValue instanceof Date
        })
        .map((row) => {
          const dateValue = row.data[dateFieldId]
          // Use first non-date field as title, or fallback to row ID
          const titleField = (Array.isArray(fieldIds) ? fieldIds : [])
            .filter((fid) => fid !== dateFieldId)
            .slice(0, 1)[0]
          
          const title = titleField 
            ? String(row.data[titleField] || "Untitled")
            : `Event ${row.id.substring(0, 8)}`

          return {
            id: row.id,
            title: title || "Untitled",
            start: dateValue,
            extendedProps: {
              rowId: row.id,
              rowData: row.data,
            },
          }
        })
    } catch (error) {
      console.error('Calendar: Error generating events:', error)
      return []
    }
  }

  if (loading) {
    return <div className="p-4">Loading...</div>
  }

  // Handle missing tableId gracefully - show setup state
  if (!resolvedTableId || resolvedTableId.trim() === '') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
        <div className="text-sm mb-2 text-center font-medium">
          Calendar view requires a table connection.
        </div>
        <div className="text-xs text-gray-400 text-center">
          This page isn&apos;t connected to a table. Please configure it in Settings.
        </div>
      </div>
    )
  }

  // Handle missing or invalid date field - show setup state
  if (!dateFieldId || !isValidDateField) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
        <div className="text-sm mb-2 text-center font-medium">
          Calendar view requires a date field.
        </div>
        <div className="text-xs text-gray-400 text-center">
          {!dateFieldId 
            ? "Please select a date field in block settings."
            : `The selected field "${dateFieldId}" is not a date field. Please select a date field in block settings.`
          }
        </div>
      </div>
    )
  }

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

  // Render filters above calendar
  const renderFilters = () => {
    if (!filters || filters.length === 0) return null

    return (
      <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-xs font-semibold text-gray-600 mb-2">Filters</div>
        <div className="flex flex-wrap gap-2">
          {filters.map((filter, idx) => (
            <div
              key={idx}
              className="px-2 py-1 bg-white border border-gray-300 rounded text-xs"
            >
              <span className="font-medium">{filter.field}</span>
              <span className="mx-1 text-gray-400">{filter.operator}</span>
              <span className="text-gray-600">{String(filter.value || '')}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full p-6 bg-gray-50">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {renderFilters()}
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          events={getEvents()}
          editable={true}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: viewMode === 'month' ? "dayGridWeek,dayGridMonth" : "dayGridMonth,dayGridWeek",
          }}
          initialView={viewMode === 'month' ? "dayGridMonth" : "dayGridWeek"}
          viewDidMount={(view) => {
            // Update view mode when user changes view
            if (view.view.type === 'dayGridMonth') {
              setViewMode('month')
            } else if (view.view.type === 'dayGridWeek') {
              setViewMode('week')
            }
          }}
          eventClick={(info) => {
            // Emit recordId and navigate to Record Review page
            const recordId = info.event.id
            if (recordId && onRecordClick) {
              onRecordClick(recordId)
            } else if (recordId && resolvedTableId) {
              // Navigate to record review page
              router.push(`/tables/${resolvedTableId}/records/${recordId}`)
            }
          }}
          dateClick={(info) => {
            // Date clicked - could create new record in future
            // Silently handle for now
          }}
        />
      </div>
    </div>
  )
}
