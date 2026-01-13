"use client"

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { format } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar as CalendarPicker } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon } from 'lucide-react'
import { cn, formatDateObjectUK } from '@/lib/utils'
import type { TableField } from '@/types/fields'
import type { CalendarConfig } from './CalendarView'

interface CreateEventModalProps {
  open: boolean
  onClose: () => void
  tableId: string
  tableFields: TableField[]
  config: CalendarConfig
  initialDate: Date
  onEventCreated: () => void
}

export default function CreateEventModal({
  open,
  onClose,
  tableId,
  tableFields,
  config,
  initialDate,
  onEventCreated,
}: CreateEventModalProps) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState<Date>(initialDate)
  const [startDate, setStartDate] = useState<Date>(initialDate)
  const [endDate, setEndDate] = useState<Date>(initialDate)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setDate(initialDate)
      setStartDate(initialDate)
      setEndDate(initialDate)
    }
  }, [initialDate, open])

  const titleField = tableFields.find((f) => f.type === 'text') || tableFields[0]

  async function handleCreate() {
    if (!titleField) {
      alert('No title field found')
      return
    }

    setSaving(true)
    try {
      // Get table supabase name
      const { data: table, error: tableError } = await supabase
        .from('tables')
        .select('supabase_table')
        .eq('id', tableId)
        .single()
      
      if (tableError || !table) throw new Error('Table not found')

      const rowData: any = {
        [titleField.name]: title || 'Untitled',
      }

      // Set date fields based on config
      if (config.calendar_date_field) {
        rowData[config.calendar_date_field] = date.toISOString()
      }
      if (config.calendar_start_field) {
        rowData[config.calendar_start_field] = startDate.toISOString()
      }
      if (config.calendar_end_field) {
        rowData[config.calendar_end_field] = endDate.toISOString()
      }

      const { error } = await supabase.from(table.supabase_table).insert([rowData])

      if (error) throw error

      onEventCreated()
      setTitle('')
      onClose()
    } catch (error) {
      console.error('Error creating event:', error)
      alert('Failed to create event')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Event</DialogTitle>
          <DialogDescription>
            Create a new event in the calendar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="title">{titleField?.name || 'Title'}</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
              autoFocus
            />
          </div>

          {config.calendar_date_field && !config.calendar_start_field && (
            <div>
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? formatDateObjectUK(date, 'Pick a date') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarPicker mode="single" selected={date} onSelect={(d) => d && setDate(d)} />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {config.calendar_start_field && (
            <div>
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !startDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? formatDateObjectUK(startDate, 'Pick start date') : <span>Pick start date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarPicker mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {config.calendar_end_field && (
            <div>
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal', !endDate && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'PPP') : <span>Pick end date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarPicker mode="single" selected={endDate} onSelect={(d) => d && setEndDate(d)} />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating...' : 'Create Event'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
