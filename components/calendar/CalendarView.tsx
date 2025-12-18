"use client"

import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths, subMonths, isSameDay, isSameMonth, parseISO, addDays, differenceInDays } from 'date-fns'
import MonthGrid from './MonthGrid'
import AgendaPanel from './AgendaPanel'
import CreateEventModal from './CreateEventModal'
import CalendarSettings from './CalendarSettings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Settings, Search, Plus } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarPicker } from '@/components/ui/calendar'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import type { TableField } from '@/types/fields'

interface CalendarViewProps {
  tableId: string
  viewId: string
  rows: any[]
  visibleFields: Array<{ field_name: string; visible: boolean; position: number }>
}

export interface CalendarEvent {
  id: string
  title: string
  date: Date | null
  start_date: Date | null
  end_date: Date | null
  color: string
  allDay: boolean
  rowData: any
}

export interface CalendarConfig {
  calendar_date_field: string | null
  calendar_start_field: string | null
  calendar_end_field: string | null
  calendar_color_field: string | null
  first_day_of_week: number
  show_weekends: boolean
  event_density: 'compact' | 'expanded'
}

const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
]

export default function CalendarView({ tableId, viewId, rows, visibleFields }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [tableFields, setTableFields] = useState<TableField[]>([])
  const [config, setConfig] = useState<CalendarConfig>({
    calendar_date_field: null,
    calendar_start_field: null,
    calendar_end_field: null,
    calendar_color_field: null,
    first_day_of_week: 1, // Monday
    show_weekends: true,
    event_density: 'compact',
  })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'month' | 'agenda'>('month')

  // Load table fields
  useEffect(() => {
    loadFields()
    loadConfig()
  }, [tableId, viewId])

  // Load events when rows or config changes
  useEffect(() => {
    if (tableFields.length > 0 && (config.calendar_date_field || config.calendar_start_field)) {
      processEvents()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, config.calendar_date_field, config.calendar_start_field, config.calendar_end_field, config.calendar_color_field, tableFields, searchQuery])

  async function loadFields() {
    try {
      const response = await fetch(`/api/tables/${tableId}/fields`)
      const data = await response.json()
      if (data.fields) {
        setTableFields(data.fields)
      }
    } catch (error) {
      console.error('Error loading fields:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadConfig() {
    try {
      const { data: view } = await supabase
        .from('views')
        .select('config')
        .eq('id', viewId)
        .single()

      if (view?.config) {
        setConfig({
          calendar_date_field: view.config.calendar_date_field || null,
          calendar_start_field: view.config.calendar_start_field || null,
          calendar_end_field: view.config.calendar_end_field || null,
          calendar_color_field: view.config.calendar_color_field || null,
          first_day_of_week: view.config.first_day_of_week ?? 1,
          show_weekends: view.config.show_weekends ?? true,
          event_density: view.config.event_density || 'compact',
        })
      } else {
        // Auto-detect date fields
        const dateFields = tableFields.filter(
          (f) => f.type === 'date' && (f.name.toLowerCase().includes('date') || f.name.toLowerCase().includes('start') || f.name.toLowerCase().includes('end'))
        )
        if (dateFields.length > 0) {
          const startField = dateFields.find((f) => f.name.toLowerCase().includes('start'))
          const endField = dateFields.find((f) => f.name.toLowerCase().includes('end'))
          const dateField = dateFields.find((f) => !f.name.toLowerCase().includes('start') && !f.name.toLowerCase().includes('end'))

          setConfig({
            calendar_date_field: dateField?.name || startField?.name || null,
            calendar_start_field: startField?.name || null,
            calendar_end_field: endField?.name || null,
            calendar_color_field: null,
            first_day_of_week: 1,
            show_weekends: true,
            event_density: 'compact',
          })
        }
      }
    } catch (error) {
      console.error('Error loading config:', error)
    }
  }

  async function saveConfig(newConfig: Partial<CalendarConfig>) {
    try {
      const updatedConfig = { ...config, ...newConfig }
      setConfig(updatedConfig)

      const { error } = await supabase
        .from('views')
        .update({
          config: updatedConfig,
        })
        .eq('id', viewId)

      if (error) throw error
    } catch (error) {
      console.error('Error saving config:', error)
    }
  }

  function processEvents() {
    if (!config.calendar_date_field && !config.calendar_start_field) {
      setEvents([])
      return
    }

    const processedEvents: CalendarEvent[] = []

    rows.forEach((row) => {
      const dateValue = config.calendar_date_field ? row[config.calendar_date_field] : null
      const startValue = config.calendar_start_field ? row[config.calendar_start_field] : null
      const endValue = config.calendar_end_field ? row[config.calendar_end_field] : null

      // Skip if no date information
      if (!dateValue && !startValue && !endValue) return

      // Get title from first text field or primary field
      const titleField = tableFields.find((f) => f.type === 'text') || tableFields[0]
      const title = titleField ? (row[titleField.name] || 'Untitled') : 'Untitled'

      // Filter by search query
      if (searchQuery && !title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return
      }

      // Get color from select field if configured
      let color = DEFAULT_COLORS[0]
      if (config.calendar_color_field) {
        const colorValue = row[config.calendar_color_field]
        if (colorValue) {
          const field = tableFields.find((f) => f.name === config.calendar_color_field)
          const choices = field?.options?.choices || []
          const index = choices.indexOf(colorValue)
          color = DEFAULT_COLORS[index % DEFAULT_COLORS.length]
        }
      }

      // Determine dates
      let date: Date | null = null
      let start_date: Date | null = null
      let end_date: Date | null = null

      if (dateValue) {
        try {
          date = typeof dateValue === 'string' ? parseISO(dateValue) : new Date(dateValue)
          if (isNaN(date.getTime())) return
          start_date = date
          end_date = date
        } catch {
          return
        }
      } else if (startValue) {
        try {
          start_date = typeof startValue === 'string' ? parseISO(startValue) : new Date(startValue)
          if (isNaN(start_date.getTime())) return
          end_date = endValue
            ? (typeof endValue === 'string' ? parseISO(endValue) : new Date(endValue))
            : start_date
          if (end_date && isNaN(end_date.getTime())) end_date = start_date
          date = start_date
        } catch {
          return
        }
      }

      if (date || start_date) {
        processedEvents.push({
          id: row.id,
          title,
          date,
          start_date,
          end_date,
          color,
          allDay: true,
          rowData: row,
        })
      }
    })

    setEvents(processedEvents)
  }

  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: config.first_day_of_week as 0 | 1 | 2 | 3 | 4 | 5 | 6 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: config.first_day_of_week as 0 | 1 | 2 | 3 | 4 | 5 | 6 })
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  }, [currentDate, config.first_day_of_week])

  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return []
    return events.filter((event) => {
      if (event.start_date && event.end_date) {
        return (
          (isSameDay(event.start_date, selectedDate) ||
            isSameDay(event.end_date, selectedDate) ||
            (event.start_date <= selectedDate && event.end_date >= selectedDate)) &&
          event.title
        )
      }
      return event.date && isSameDay(event.date, selectedDate) && event.title
    })
  }, [selectedDate, events])

  const handleEventUpdate = useCallback(
    async (eventId: string, updates: { date?: Date; start_date?: Date; end_date?: Date }) => {
      try {
        const { data: table } = await supabase.from('tables').select('supabase_table').eq('id', tableId).single()
        if (!table) return

        const updateData: any = {}
        if (updates.date !== undefined) {
          if (config.calendar_date_field) {
            updateData[config.calendar_date_field] = updates.date.toISOString()
          }
          if (config.calendar_start_field) {
            updateData[config.calendar_start_field] = updates.date.toISOString()
          }
          if (config.calendar_end_field) {
            updateData[config.calendar_end_field] = updates.date.toISOString()
          }
        }
        if (updates.start_date !== undefined && config.calendar_start_field) {
          updateData[config.calendar_start_field] = updates.start_date.toISOString()
        }
        if (updates.end_date !== undefined && config.calendar_end_field) {
          updateData[config.calendar_end_field] = updates.end_date.toISOString()
        }

        const { error } = await supabase.from(table.supabase_table).update(updateData).eq('id', eventId)

        if (error) throw error

        // Reload events by refreshing the page data
        window.location.reload()
      } catch (error) {
        console.error('Error updating event:', error)
        alert('Failed to update event')
      }
    },
    [tableId, config]
  )

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading calendar...</div>
  }

  if (!config.calendar_date_field && !config.calendar_start_field) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-gray-500">No date fields configured for this calendar view.</p>
        <Button onClick={() => setSettingsOpen(true)}>
          <Settings className="mr-2 h-4 w-4" />
          Configure Calendar
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Toolbar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-[200px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(currentDate, 'MMMM yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker mode="single" selected={currentDate} onSelect={(date) => date && setCurrentDate(date)} />
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
                Today
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('month')}
              >
                Month
              </Button>
              <Button
                variant={viewMode === 'agenda' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('agenda')}
              >
                Agenda
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => setCreateModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Event
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {viewMode === 'month' ? (
          <>
            <div className="flex-1 overflow-auto">
              <MonthGrid
                days={monthDays}
                currentDate={currentDate}
                events={events}
                onDateClick={setSelectedDate}
                onEventUpdate={handleEventUpdate}
                config={config}
              />
            </div>
            <div className="w-80 border-l border-gray-200 bg-white">
              <AgendaPanel
                selectedDate={selectedDate}
                events={selectedDateEvents}
                onEventClick={(event) => {
                  window.location.href = `/data/${tableId}/rows/${event.id}`
                }}
                onCreateEvent={() => setCreateModalOpen(true)}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-auto p-6">
            <AgendaPanel
              selectedDate={null}
              events={events.sort((a, b) => {
                const dateA = a.start_date || a.date || new Date(0)
                const dateB = b.start_date || b.date || new Date(0)
                return dateA.getTime() - dateB.getTime()
              })}
              onEventClick={(event) => {
                window.location.href = `/data/${tableId}/rows/${event.id}`
              }}
              onCreateEvent={() => setCreateModalOpen(true)}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateEventModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        tableId={tableId}
        tableFields={tableFields}
        config={config}
        initialDate={selectedDate || currentDate}
        onEventCreated={() => {
          // Reload rows - this should trigger processEvents
          window.location.reload()
        }}
      />

      <CalendarSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        config={config}
        tableFields={tableFields}
        onSave={saveConfig}
      />
    </div>
  )
}
