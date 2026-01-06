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
          console.error("Error loading view:", error)
          setResolvedTableId("")
          setLoading(false)
          return
        }

        if (view?.table_id) {
          setResolvedTableId(view.table_id)
        } else {
          console.warn("CalendarView: View does not have a table_id")
          setResolvedTableId("")
          setLoading(false)
        }
      } catch (error) {
        console.error("Error resolving tableId from view:", error)
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
      console.warn("CalendarView: tableId is required for table-backed pages. This page may be SQL-view backed.")
      setRows([])
      setLoading(false)
      return
    }
    
    // Sanitize tableId - remove any trailing :X patterns (might be view ID or malformed)
    const sanitizedTableId = resolvedTableId.split(':')[0]
    
    setLoading(true)
    const { data, error } = await supabase
      .from("table_rows")
      .select("*")
      .eq("table_id", sanitizedTableId)

    if (error) {
      console.error("Error loading rows:", error)
      setRows([])
    } else {
      setRows(data || [])
    }
    setLoading(false)
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

  function getEvents(): EventInput[] {
    return filteredRows
      .filter((row) => row.data[dateFieldId])
      .map((row) => {
        const dateValue = row.data[dateFieldId]
        const title = (Array.isArray(fieldIds) ? fieldIds : [])
          .filter((fid) => fid !== dateFieldId)
          .slice(0, 1)
          .map((fid) => String(row.data[fid] || "Untitled"))
          .join(" ")

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
  }

  if (loading) {
    return <div className="p-4">Loading...</div>
  }

  // Handle missing tableId gracefully (SQL-view backed pages)
  if (!resolvedTableId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
        <div className="text-sm mb-2 text-center">
          Calendar view requires a table connection. This page appears to be SQL-view backed.
        </div>
        <div className="text-xs text-gray-400 text-center">
          Please configure this page with a table anchor in Settings.
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
            console.log("Event clicked:", info.event.extendedProps)
          }}
          dateClick={(info) => {
            console.log("Date clicked:", info.dateStr)
          }}
        />
      </div>
    </div>
  )
}
