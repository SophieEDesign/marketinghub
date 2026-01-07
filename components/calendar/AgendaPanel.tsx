"use client"

import { format, isSameDay } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import EventCard from './EventCard'
import type { CalendarEvent } from './CalendarView'
import type { TableField } from '@/types/fields'

interface AgendaPanelProps {
  selectedDate: Date | null
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  onCreateEvent: () => void
  displayFields?: string[]
  tableFields?: TableField[]
}

export default function AgendaPanel({ selectedDate, events, onEventClick, onCreateEvent, displayFields = [], tableFields = [] }: AgendaPanelProps) {
  const groupedEvents = events.reduce((acc, event) => {
    const dateKey = event.start_date
      ? format(event.start_date, 'yyyy-MM-dd')
      : event.date
      ? format(event.date, 'yyyy-MM-dd')
      : 'no-date'

    if (!acc[dateKey]) {
      acc[dateKey] = []
    }
    acc[dateKey].push(event)
    return acc
  }, {} as Record<string, CalendarEvent[]>)

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-lg">
            {selectedDate ? format(selectedDate, 'EEEE, MMMM d') : 'All Events'}
          </h3>
          <Button size="sm" onClick={onCreateEvent}>
            <Plus className="mr-1 h-3 w-3" />
            Add Event
          </Button>
        </div>
        {selectedDate && (
          <p className="text-sm text-gray-500">{events.length} {events.length === 1 ? 'event' : 'events'}</p>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-6">
        {Object.entries(groupedEvents)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([dateKey, dayEvents]) => {
            const date = new Date(dateKey)
            return (
              <div key={dateKey}>
                <div className="sticky top-0 bg-white z-10 pb-2 mb-2 border-b border-gray-200">
                  <h4 className="font-semibold text-sm text-gray-700">{format(date, 'EEEE, MMMM d')}</h4>
                </div>
                <div className="space-y-2">
                  {dayEvents
                    .sort((a, b) => {
                      const timeA = a.start_date || a.date || new Date(0)
                      const timeB = b.start_date || b.date || new Date(0)
                      return timeA.getTime() - timeB.getTime()
                    })
                    .map((event) => (
                      <div
                        key={event.id}
                        onClick={() => onEventClick(event)}
                        className="cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
                      >
                        <EventCard 
                          event={event} 
                          onDragStart={() => {}} 
                          onClick={() => onEventClick(event)}
                          displayFields={displayFields}
                          tableFields={tableFields}
                        />
                        {event.start_date && event.end_date && (
                          <p className="text-xs text-gray-500 mt-1">
                            {format(event.start_date, 'HH:mm')} - {format(event.end_date, 'HH:mm')}
                          </p>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )
          })}

        {events.length === 0 && (
          <div className="text-center text-gray-500 py-12">
            <p>No events {selectedDate ? 'on this day' : 'found'}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={onCreateEvent}>
              <Plus className="mr-2 h-4 w-4" />
              Create Event
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
