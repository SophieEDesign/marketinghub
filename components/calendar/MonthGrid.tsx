"use client"

import { useState, useRef, useCallback } from 'react'
import { format, isSameDay, isSameMonth, startOfDay, addDays, differenceInDays } from 'date-fns'
import EventCard from './EventCard'
import { cn } from '@/lib/utils'
import type { CalendarEvent, CalendarConfig } from './CalendarView'

interface MonthGridProps {
  days: Date[]
  currentDate: Date
  events: CalendarEvent[]
  onDateClick: (date: Date) => void
  onEventUpdate: (eventId: string, updates: { date?: Date; start_date?: Date; end_date?: Date }) => Promise<void>
  config: CalendarConfig
}

export default function MonthGrid({
  days,
  currentDate,
  events,
  onDateClick,
  onEventUpdate,
  config,
}: MonthGridProps) {
  const [draggingEvent, setDraggingEvent] = useState<string | null>(null)
  const [resizingEvent, setResizingEvent] = useState<{ id: string; edge: 'start' | 'end' } | null>(null)
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null)

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const adjustedWeekDays = [...weekDays.slice(config.first_day_of_week), ...weekDays.slice(0, config.first_day_of_week)]

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
      <div className="grid grid-cols-7 border-b border-gray-200">
        {adjustedWeekDays.map((day, idx) => {
          const isWeekend = idx >= 5 && !config.show_weekends
          if (isWeekend) return null
          return (
            <div
              key={day}
              className={cn(
                'p-2 text-center text-sm font-semibold text-gray-700 border-r border-gray-200 last:border-r-0',
                isWeekend && 'bg-gray-50'
              )}
            >
              {day}
            </div>
          )
        })}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-auto">
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
                'border-r border-b border-gray-200 p-1 min-h-[100px] cursor-pointer hover:bg-gray-50 transition-colors',
                !isCurrentMonth && 'bg-gray-50/50',
                isToday && 'bg-blue-50'
              )}
              onClick={() => onDateClick(day)}
              onMouseUp={() => {
                if (draggingEvent) handleDragEnd(day)
                if (resizingEvent) handleResizeEnd(day)
              }}
            >
              <div
                className={cn(
                  'text-xs font-medium mb-1',
                  isCurrentMonth ? 'text-gray-900' : 'text-gray-400',
                  isToday && 'text-blue-600 font-bold'
                )}
              >
                {format(day, 'd')}
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
                            'h-5 rounded text-xs px-1 text-white truncate flex items-center',
                            isStart && 'rounded-l-none',
                            isEnd && 'rounded-r-none',
                            !isStart && !isEnd && 'rounded-none'
                          )}
                          style={{
                            backgroundColor: event.color,
                            width: isStart || isEnd ? '100%' : 'calc(100% + 1px)',
                            marginLeft: isStart ? '0' : '-1px',
                          }}
                        >
                          {(isStart || daysDiff === 0) && <span className="truncate">{event.title}</span>}
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

                {/* Single-day events */}
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
                    />
                  ))}

                {dayEvents.length > (config.event_density === 'compact' ? 3 : 5) && (
                  <div className="text-xs text-gray-500 px-1">
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
