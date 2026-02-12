"use client"

import { useState, useRef, useCallback } from 'react'
import { format, isSameDay, isSameMonth, startOfDay, addDays, differenceInDays, parseISO, isValid } from 'date-fns'
import { Plus } from 'lucide-react'
import EventCard from './EventCard'
import { cn, formatDateUK } from '@/lib/utils'
import type { CalendarEvent, CalendarConfig } from './CalendarView'
import type { TableField } from '@/types/fields'

// Helper function to format display text (same logic as EventCard)
function formatDisplayText(event: CalendarEvent, displayFields: string[] | null | undefined, tableFields: TableField[]): string {
  // Ensure displayFields is always an array
  const safeDisplayFields = (Array.isArray(displayFields) ? displayFields : []).slice(0, 3)
  if (safeDisplayFields.length === 0) {
    return event.title
  }

  const parts: string[] = [event.title]
  
  safeDisplayFields.forEach((fieldName) => {
    const value = event.rowData?.[fieldName]
    if (value !== null && value !== undefined && value !== '') {
      const field = tableFields.find(f => f.name === fieldName)
      let displayValue = String(value)
      
      // Format based on field type
      if (field?.type === 'date' && value) {
        // Use UK date format (DD/MM/YYYY)
        displayValue = formatDateUK(String(value), String(value))
      } else if (field?.type === 'checkbox') {
        displayValue = value ? '✓' : ''
      } else if (field?.type === 'number' || field?.type === 'currency') {
        displayValue = String(value)
      }
      
      if (displayValue) {
        parts.push(displayValue)
      }
    }
  })
  
  return parts.join(' • ')
}

interface MonthGridProps {
  days: Date[]
  currentDate: Date
  events: CalendarEvent[]
  onDateClick: (date: Date) => void
  onEventUpdate: (eventId: string, updates: { date?: Date; start_date?: Date; end_date?: Date }) => Promise<void>
  onEventClick?: (event: CalendarEvent) => void
  config: CalendarConfig
  tableFields: TableField[]
  onCreateEvent?: (date: Date) => void
}

export default function MonthGrid({
  days,
  currentDate,
  events,
  onDateClick,
  onEventUpdate,
  onEventClick,
  config,
  tableFields,
  onCreateEvent,
}: MonthGridProps) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/7e9b68cb-9457-4ad2-a6ab-af4806759e7a', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: `log_${Date.now()}_marketing_monthgrid_render_start`,
      timestamp: Date.now(),
      runId: 'post-fix',
      hypothesisId: 'MCAL2',
      location: 'components/calendar/MonthGrid.tsx:render START',
      message: 'Marketing MonthGrid render START',
      data: { daysCount: Array.isArray(days) ? days.length : 'unknown', eventsCount: Array.isArray(events) ? events.length : 'unknown' },
    }),
  }).catch(() => {})
  // #endregion

  const [draggingEvent, setDraggingEvent] = useState<string | null>(null)
  const [resizingEvent, setResizingEvent] = useState<{ id: string; edge: 'start' | 'end' } | null>(null)
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null)

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  // Ensure first_day_of_week is a valid number
  const firstDay = typeof config.first_day_of_week === 'number' && !isNaN(config.first_day_of_week) 
    ? Math.max(0, Math.min(6, config.first_day_of_week)) 
    : 1
  const adjustedWeekDays = [...weekDays.slice(firstDay), ...weekDays.slice(0, firstDay)]

  const getEventsForDay = useCallback(
    (day: Date) => {
      return events.filter((event) => {
        if (event.start_date && event.end_date) {
          const start = startOfDay(event.start_date)
          const end = startOfDay(event.end_date)
          const dayStart = startOfDay(day)
          return dayStart >= start && dayStart <= end
        }
        return event.date && isSameDay(event.date, day)
      })
    },
    [events]
  )

  const getMultiDayEvents = useCallback(() => {
    return events.filter((event) => {
      if (event.start_date && event.end_date) {
        const daysDiff = differenceInDays(event.end_date, event.start_date)
        return daysDiff > 0
      }
      return false
    })
  }, [events])

  const handleDragStart = (eventId: string, e: React.MouseEvent) => {
    setDraggingEvent(eventId)
    setDragStartPos({ x: e.clientX, y: e.clientY })
    e.preventDefault()
  }

  const handleDragEnd = useCallback(
    async (day: Date) => {
      if (draggingEvent) {
        const event = events.find((e) => e.id === draggingEvent)
        if (event) {
          const dayStart = startOfDay(day)
          if (event.start_date && event.end_date) {
            const duration = differenceInDays(event.end_date, event.start_date)
            await onEventUpdate(draggingEvent, {
              start_date: dayStart,
              end_date: addDays(dayStart, duration),
            })
          } else {
            await onEventUpdate(draggingEvent, { date: dayStart })
          }
        }
        setDraggingEvent(null)
        setDragStartPos(null)
      }
    },
    [draggingEvent, events, onEventUpdate]
  )

  const handleResizeStart = (eventId: string, edge: 'start' | 'end', e: React.MouseEvent) => {
    e.stopPropagation()
    setResizingEvent({ id: eventId, edge })
    setDragStartPos({ x: e.clientX, y: e.clientY })
  }

  const handleResizeEnd = useCallback(
    async (day: Date) => {
      if (resizingEvent) {
        const event = events.find((e) => e.id === resizingEvent.id)
        if (event && event.start_date && event.end_date) {
          const dayStart = startOfDay(day)
          if (resizingEvent.edge === 'start') {
            await onEventUpdate(resizingEvent.id, {
              start_date: dayStart,
              end_date: event.end_date,
            })
          } else {
            await onEventUpdate(resizingEvent.id, {
              start_date: event.start_date,
              end_date: dayStart,
            })
          }
        }
        setResizingEvent(null)
        setDragStartPos(null)
      }
    },
    [resizingEvent, events, onEventUpdate]
  )

  const multiDayEvents = getMultiDayEvents()

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Week day headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {adjustedWeekDays.map((day, idx) => {
          const isWeekend = idx >= 5 && !config.show_weekends
          if (isWeekend) return null
          return (
            <div
              key={day}
              className={cn(
                'p-2 text-center text-xs font-medium text-gray-600 border-r border-gray-200 last:border-r-0 uppercase tracking-wide',
                isWeekend && 'bg-gray-50'
              )}
            >
              {day}
            </div>
          )
        })}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-auto bg-white">
        {days.map((day, idx) => {
          const isCurrentMonth = isSameMonth(day, currentDate)
          const isToday = isSameDay(day, new Date())
          const dayEvents = getEventsForDay(day)
          const isWeekend = day.getDay() === 0 || day.getDay() === 6
          const shouldHideWeekend = isWeekend && !config.show_weekends

          if (shouldHideWeekend) return null

          return (
            <div
              key={day.toISOString()}
              className={cn(
                'group border-r border-b border-gray-200 p-2 min-h-[120px] cursor-pointer hover:bg-gray-50/50 transition-colors relative',
                !isCurrentMonth && 'bg-gray-50/30',
                isToday && 'bg-blue-50/50'
              )}
              onClick={() => onDateClick(day)}
              onMouseUp={() => {
                if (draggingEvent) handleDragEnd(day)
                if (resizingEvent) handleResizeEnd(day)
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={cn(
                    'text-sm font-medium',
                    isCurrentMonth ? 'text-gray-900' : 'text-gray-400',
                    isToday && 'text-blue-600 font-semibold'
                  )}
                >
                  {format(day, 'd')}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onCreateEvent?.(day)
                  }}
                  className={cn(
                    'opacity-30 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-200',
                    'text-gray-500 hover:text-gray-700 flex items-center justify-center'
                  )}
                  title="Add event"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Multi-day event bars */}
              <div className="space-y-0.5">
                {multiDayEvents
                  .filter((event) => {
                    if (!event.start_date || !event.end_date) return false
                    const start = startOfDay(event.start_date)
                    const end = startOfDay(event.end_date)
                    const dayStart = startOfDay(day)
                    return dayStart >= start && dayStart <= end
                  })
                  .map((event) => {
                    if (!event.start_date || !event.end_date) return null
                    const start = startOfDay(event.start_date)
                    const end = startOfDay(event.end_date)
                    const dayStart = startOfDay(day)
                    const isStart = isSameDay(start, dayStart)
                    const isEnd = isSameDay(end, dayStart)
                    const daysDiff = differenceInDays(end, start)

                    return (
                      <div
                        key={event.id}
                        className="relative group"
                        onMouseDown={(e) => handleDragStart(event.id, e)}
                      >
                        <div
                          className={cn(
                            'h-5 rounded text-xs px-1.5 py-0.5 text-white truncate flex items-center cursor-pointer hover:opacity-90',
                            'shadow-sm ring-1 ring-white/20',
                            isStart && 'rounded-l-none',
                            isEnd && 'rounded-r-none',
                            !isStart && !isEnd && 'rounded-none'
                          )}
                          style={{
                            backgroundColor: event.color || '#3b82f6',
                            width: isStart || isEnd ? '100%' : 'calc(100% + 1px)',
                            marginLeft: isStart ? '0' : '-1px',
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            onEventClick?.(event)
                          }}
                          title={formatDisplayText(event, Array.isArray(config.calendar_display_fields) ? config.calendar_display_fields : [], tableFields)}
                        >
                          {(isStart || daysDiff === 0) && (
                            <span className="truncate">
                              {formatDisplayText(event, Array.isArray(config.calendar_display_fields) ? config.calendar_display_fields : [], tableFields)}
                            </span>
                          )}
                        </div>
                        {isStart && (
                          <div
                            className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-white/50"
                            onMouseDown={(e) => handleResizeStart(event.id, 'start', e)}
                          />
                        )}
                        {isEnd && (
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-white/50"
                            onMouseDown={(e) => handleResizeStart(event.id, 'end', e)}
                          />
                        )}
                      </div>
                    )
                  })}

                {/* Single-day events - Display as small pills */}
                {dayEvents
                  .filter((event) => {
                    if (event.start_date && event.end_date) {
                      return differenceInDays(event.end_date, event.start_date) === 0
                    }
                    return true
                  })
                  .slice(0, config.event_density === 'compact' ? 3 : 5)
                  .map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onDragStart={(e) => handleDragStart(event.id, e)}
                      compact={config.event_density === 'compact'}
                      onClick={() => onEventClick?.(event)}
                      displayFields={Array.isArray(config.calendar_display_fields) ? config.calendar_display_fields : []}
                      tableFields={tableFields}
                    />
                  ))}
                
                {dayEvents.length > (config.event_density === 'compact' ? 3 : 5) && (
                  <div className="text-xs text-gray-500 px-1.5 py-0.5">
                    +{dayEvents.length - (config.event_density === 'compact' ? 3 : 5)} more
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
