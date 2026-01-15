"use client"

import { format, isValid } from 'date-fns'
import { cn, formatDateUK } from '@/lib/utils'
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

function formatFieldValue(value: unknown, field?: TableField): string {
  if (value === null || value === undefined || value === '') return ''

  // Default string conversion
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

  return displayValue
}

export default function EventCard({ 
  event, 
  onDragStart, 
  compact = false, 
  onClick,
  displayFields = [],
  tableFields = []
}: EventCardProps) {
  // Ensure displayFields is always an array
  const safeDisplayFields = Array.isArray(displayFields) ? displayFields : []
  const timeStr =
    event.start_date && event.end_date && isValid(event.start_date) && isValid(event.end_date)
      ? `${format(event.start_date, 'HH:mm')} - ${format(event.end_date, 'HH:mm')}`
      : event.date && isValid(event.date)
      ? format(event.date, 'HH:mm')
      : ''

  const fieldItems =
    safeDisplayFields.length === 0
      ? []
      : safeDisplayFields
          .slice(0, 3)
          .map((fieldName) => {
            const value = event.rowData?.[fieldName]
            const field = tableFields.find((f) => f.name === fieldName)
            const displayValue = formatFieldValue(value, field)
            return displayValue ? { fieldName, displayValue } : null
          })
          .filter((x): x is { fieldName: string; displayValue: string } => Boolean(x))

  const tooltipText =
    fieldItems.length === 0
      ? event.title
      : [event.title, ...fieldItems.map((i) => `${i.fieldName}: ${i.displayValue}`)].join(' • ')

  return (
    <div
      className={cn(
        // More "card-like" appearance
        'w-full rounded-md px-2 py-1.5 cursor-pointer text-white',
        'shadow-sm ring-1 ring-white/20 hover:shadow-md transition-shadow',
        'overflow-hidden',
        compact ? 'text-[10px] py-1 px-1.5' : 'text-xs'
      )}
      style={{ backgroundColor: event.color || '#3b82f6' }}
      onMouseDown={onDragStart}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      title={tooltipText}
    >
      <div className={cn('min-w-0', compact ? 'space-y-0.5' : 'space-y-1')}>
        <div className={cn('font-medium leading-tight truncate', compact ? 'text-[10px]' : 'text-xs')}>
          {event.title}
        </div>

        {fieldItems.length > 0 && (
          <div
            className={cn(
              'grid grid-cols-3 gap-x-1.5 gap-y-0.5',
              'text-[10px] leading-tight text-white/95',
              compact && 'grid-cols-3 gap-x-1 gap-y-0.5 text-[9px]'
            )}
          >
            {fieldItems.map(({ fieldName, displayValue }) => (
              <div key={fieldName} className="min-w-0 truncate">
                <span className="text-white/80">{fieldName}:</span> <span>{displayValue}</span>
              </div>
            ))}
          </div>
        )}

        {timeStr && !compact && (
          <div className="text-[10px] text-white/80 leading-tight truncate">
            {timeStr}
          </div>
        )}
      </div>
    </div>
  )
}
