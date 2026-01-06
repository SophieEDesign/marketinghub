"use client"

import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { CalendarEvent } from './CalendarView'
import type { TableField } from '@/types/fields'

interface EventCardProps {
  event: CalendarEvent
  onDragStart: (e: React.MouseEvent) => void
  compact?: boolean
  onClick?: () => void
  displayFields?: string[] // Field names to display
  tableFields?: TableField[] // All table fields for lookup
}

export default function EventCard({ 
  event, 
  onDragStart, 
  compact = false, 
  onClick,
  displayFields = [],
  tableFields = []
}: EventCardProps) {
  const timeStr =
    event.start_date && event.end_date
      ? `${format(event.start_date, 'HH:mm')} - ${format(event.end_date, 'HH:mm')}`
      : event.date
      ? format(event.date, 'HH:mm')
      : ''

  // Get display text based on configured fields
  const getDisplayText = () => {
    if (displayFields.length === 0) {
      // Default: show only title
      return event.title
    }

    // Show title + selected fields
    const parts: string[] = [event.title]
    
    displayFields.forEach((fieldName) => {
      const value = event.rowData?.[fieldName]
      if (value !== null && value !== undefined && value !== '') {
        const field = tableFields.find(f => f.name === fieldName)
        let displayValue = String(value)
        
        // Format based on field type
        if (field?.type === 'date' && value) {
          try {
            displayValue = format(new Date(value), 'MMM d')
          } catch {
            displayValue = String(value)
          }
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

  const displayText = getDisplayText()

  return (
    <div
      className={cn(
        'rounded px-1.5 py-0.5 text-xs cursor-pointer hover:opacity-90 transition-opacity truncate text-white',
        compact ? 'text-[10px]' : 'text-xs'
      )}
      style={{ backgroundColor: event.color || '#3b82f6' }}
      onMouseDown={onDragStart}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      title={displayText}
    >
      <span>{displayText}</span>
    </div>
  )
}
