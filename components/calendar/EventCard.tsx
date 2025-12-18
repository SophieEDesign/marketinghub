"use client"

import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { CalendarEvent } from './CalendarView'

interface EventCardProps {
  event: CalendarEvent
  onDragStart: (e: React.MouseEvent) => void
  compact?: boolean
  onClick?: () => void
}

export default function EventCard({ event, onDragStart, compact = false, onClick }: EventCardProps) {
  const timeStr =
    event.start_date && event.end_date
      ? `${format(event.start_date, 'HH:mm')} - ${format(event.end_date, 'HH:mm')}`
      : event.date
      ? format(event.date, 'HH:mm')
      : ''

  return (
    <div
      className={cn(
        'rounded px-1.5 py-0.5 text-xs cursor-pointer hover:opacity-80 transition-opacity truncate',
        compact ? 'text-[10px]' : 'text-xs'
      )}
      style={{ backgroundColor: `${event.color}20`, color: event.color, borderLeft: `3px solid ${event.color}` }}
      onMouseDown={onDragStart}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      title={event.title}
    >
      {!compact && timeStr && <span className="font-medium">{timeStr} </span>}
      <span>{event.title}</span>
    </div>
  )
}
