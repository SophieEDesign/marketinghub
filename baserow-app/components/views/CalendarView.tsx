"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import type { EventInput } from "@fullcalendar/core"
import type { TableRow } from "@/types/database"

interface CalendarViewProps {
  tableId: string
  viewId: string
  dateFieldId: string
  fieldIds: string[]
}

export default function CalendarView({ tableId, viewId, dateFieldId, fieldIds }: CalendarViewProps) {
  const [rows, setRows] = useState<TableRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRows()
  }, [tableId])

  async function loadRows() {
    setLoading(true)
    const { data, error } = await supabase
      .from("table_rows")
      .select("*")
      .eq("table_id", tableId)

    if (error) {
      console.error("Error loading rows:", error)
    } else {
      setRows(data || [])
    }
    setLoading(false)
  }

  function getEvents(): EventInput[] {
    return rows
      .filter((row) => row.data[dateFieldId])
      .map((row) => {
        const dateValue = row.data[dateFieldId]
        const title = fieldIds
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

  return (
    <div className="w-full p-4">
      <Card>
        <CardContent className="p-4">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            events={getEvents()}
            editable={true}
            eventClick={(info) => {
              console.log("Event clicked:", info.event.extendedProps)
            }}
            dateClick={(info) => {
              console.log("Date clicked:", info.dateStr)
            }}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,dayGridWeek,dayGridDay",
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
