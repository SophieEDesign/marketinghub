'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventInput } from '@fullcalendar/core'
import ViewToolbar from './ViewToolbar'
import RowDetail from './RowDetail'
import type { ViewField } from '@/types/database'

interface CalendarViewProps {
  tableId: string
  viewId: string
  rows: Record<string, any>[]
  visibleFields: ViewField[]
}

export default function CalendarView({
  tableId,
  viewId,
  rows,
  visibleFields,
}: CalendarViewProps) {
  const [selectedRow, setSelectedRow] = useState<Record<string, any> | null>(null)

  // Ensure visibleFields is always an array
  const safeVisibleFields = Array.isArray(visibleFields) ? visibleFields : []

  // Find date field (first field that might be a date)
  const dateField = safeVisibleFields[0]?.field_name || ''

  function getEvents(): EventInput[] {
    if (!dateField) return []

    // Ensure rows is an array
    if (!Array.isArray(rows)) {
      console.warn('CalendarView: rows is not an array', typeof rows, rows)
      return []
    }

    return rows
      .filter((row) => row && row[dateField])
      .map((row) => {
        const dateValue = row[dateField]
        // Filter and get title from first non-date field
        // safeVisibleFields is already validated as an array above
        const filteredFields = Array.isArray(safeVisibleFields) 
          ? safeVisibleFields.filter((f) => f && f.field_name !== dateField)
          : []
        
        // Ensure filteredFields is an array before calling slice
        const slicedFields = Array.isArray(filteredFields) ? filteredFields.slice(0, 1) : []
        const title = slicedFields.length > 0
          ? slicedFields
              .map((f) => {
                if (!f || !f.field_name) return 'Untitled'
                return String(row[f.field_name] || 'Untitled')
              })
              .join(' ')
          : 'Untitled'

        return {
          id: row.id,
          title: title || 'Untitled',
          start: dateValue,
          extendedProps: {
            row,
          },
        }
      })
  }

  return (
    <div className="w-full space-y-4">
      <ViewToolbar viewId={viewId} />
      
      <Card>
        <CardContent className="p-4">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            events={getEvents()}
            editable={true}
            eventClick={(info) => {
              setSelectedRow(info.event.extendedProps.row)
            }}
            dateClick={(info) => {
              // Could create new row on date click
              console.log('Date clicked:', info.dateStr)
            }}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,dayGridWeek,dayGridDay',
            }}
          />
        </CardContent>
      </Card>

      {selectedRow && (
        <RowDetail
          row={selectedRow}
          tableId={tableId}
          visibleFields={safeVisibleFields}
          onClose={() => setSelectedRow(null)}
        />
      )}
    </div>
  )
}
