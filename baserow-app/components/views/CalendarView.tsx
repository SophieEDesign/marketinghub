"use client"

import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import { filterRowsBySearch } from "@/lib/search/filterRows"
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
}

export default function CalendarView({ 
  tableId, 
  viewId, 
  dateFieldId, 
  fieldIds,
  searchQuery = "",
  tableFields = []
}: CalendarViewProps) {
  const [rows, setRows] = useState<TableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [resolvedTableId, setResolvedTableId] = useState<string>(tableId)

  useEffect(() => {
    resolveTableId()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, viewId])

  useEffect(() => {
    if (resolvedTableId) {
      loadRows()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTableId])

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

  async function loadRows() {
    // Gracefully handle missing tableId for SQL-view backed pages
    if (!resolvedTableId) {
      setRows([])
      setLoading(false)
      return
    }
    
    // Sanitize tableId - remove any trailing :X patterns (might be view ID or malformed)
    const sanitizedTableId = resolvedTableId.split(':')[0]
    
    if (!sanitizedTableId || sanitizedTableId.trim() === '') {
      setRows([])
      setLoading(false)
      return
    }
    
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("table_rows")
        .select("*")
        .eq("table_id", sanitizedTableId)

      if (error) {
        console.error('Calendar: Error loading rows:', error)
        setRows([])
      } else {
        setRows(data || [])
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

  return (
    <div className="w-full h-full p-6 bg-gray-50">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          events={getEvents()}
          editable={true}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,dayGridWeek,dayGridDay",
          }}
          eventClick={(info) => {
            // Event clicked - could navigate to record detail in future
            // Silently handle for now
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
