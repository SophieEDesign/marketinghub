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

  // Find date field (first field that might be a date)
  const dateField = visibleFields[0]?.field_name || ''

  function getEvents(): EventInput[] {
    if (!dateField) return []

    return rows
      .filter((row) => row[dateField])
      .map((row) => {
        const dateValue = row[dateField]
        const title = visibleFields
          .filter((f) => f.field_name !== dateField)
          .slice(0, 1)
          .map((f) => String(row[f.field_name] || 'Untitled'))
          .join(' ')

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
          visibleFields={visibleFields}
          onClose={() => setSelectedRow(null)}
        />
      )}
    </div>
  )
}
