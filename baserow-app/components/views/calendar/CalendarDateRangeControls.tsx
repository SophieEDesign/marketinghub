"use client"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, X } from "lucide-react"
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, addMonths, startOfDay } from "date-fns"

export interface CalendarDateRangeControlsProps {
  dateFrom?: Date
  dateTo?: Date
  onDateFromChange: (date?: Date) => void
  onDateToChange: (date?: Date) => void
  disabled?: boolean
}

type DateRangePreset = 'today' | 'thisWeek' | 'thisMonth' | 'nextWeek' | 'nextMonth' | 'custom'

function getDateRangeForPreset(preset: DateRangePreset): { from: Date; to: Date } | null {
  const today = startOfDay(new Date())
  
  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case 'thisWeek':
      return {
        from: startOfWeek(today, { weekStartsOn: 1 }), // Monday
        to: endOfWeek(today, { weekStartsOn: 1 }), // Sunday
      }
    case 'thisMonth':
      return {
        from: startOfMonth(today),
        to: endOfMonth(today),
      }
    case 'nextWeek':
      const nextWeekStart = addWeeks(startOfWeek(today, { weekStartsOn: 1 }), 1)
      return {
        from: nextWeekStart,
        to: endOfWeek(nextWeekStart, { weekStartsOn: 1 }),
      }
    case 'nextMonth':
      const nextMonthStart = addMonths(startOfMonth(today), 1)
      return {
        from: nextMonthStart,
        to: endOfMonth(nextMonthStart),
      }
    case 'custom':
      return null
  }
}

export default function CalendarDateRangeControls({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  disabled = false,
}: CalendarDateRangeControlsProps) {
  // Determine current preset based on selected dates
  const getCurrentPreset = (): DateRangePreset => {
    if (!dateFrom || !dateTo) return 'custom'
    
    const today = startOfDay(new Date())
    const from = startOfDay(dateFrom)
    const to = startOfDay(dateTo)
    
    // Check if it matches today
    if (from.getTime() === today.getTime() && to.getTime() === today.getTime()) {
      return 'today'
    }
    
    // Check if it matches this week
    const thisWeekStart = startOfWeek(today, { weekStartsOn: 1 })
    const thisWeekEnd = endOfWeek(today, { weekStartsOn: 1 })
    if (from.getTime() === thisWeekStart.getTime() && to.getTime() === thisWeekEnd.getTime()) {
      return 'thisWeek'
    }
    
    // Check if it matches this month
    const thisMonthStart = startOfMonth(today)
    const thisMonthEnd = endOfMonth(today)
    if (from.getTime() === thisMonthStart.getTime() && to.getTime() === thisMonthEnd.getTime()) {
      return 'thisMonth'
    }
    
    // Check if it matches next week
    const nextWeekStart = addWeeks(thisWeekStart, 1)
    const nextWeekEnd = endOfWeek(nextWeekStart, { weekStartsOn: 1 })
    if (from.getTime() === nextWeekStart.getTime() && to.getTime() === nextWeekEnd.getTime()) {
      return 'nextWeek'
    }
    
    // Check if it matches next month
    const nextMonthStart = addMonths(thisMonthStart, 1)
    const nextMonthEnd = endOfMonth(nextMonthStart)
    if (from.getTime() === nextMonthStart.getTime() && to.getTime() === nextMonthEnd.getTime()) {
      return 'nextMonth'
    }
    
    return 'custom'
  }
  
  const currentPreset = getCurrentPreset()
  
  const handlePresetClick = (preset: DateRangePreset) => {
    const range = getDateRangeForPreset(preset)
    if (range) {
      onDateFromChange(range.from)
      onDateToChange(range.to)
    } else {
      // For custom, clear the dates
      onDateFromChange(undefined)
      onDateToChange(undefined)
    }
  }
  
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-gray-600">Date Range</div>
      
      {/* Preset Buttons */}
      <div className="flex items-center gap-1 flex-wrap">
        <Button
          variant={currentPreset === 'today' ? 'default' : 'outline'}
          size="sm"
          disabled={disabled}
          className="text-xs h-7"
          onClick={() => handlePresetClick('today')}
        >
          Today
        </Button>
        <Button
          variant={currentPreset === 'thisWeek' ? 'default' : 'outline'}
          size="sm"
          disabled={disabled}
          className="text-xs h-7"
          onClick={() => handlePresetClick('thisWeek')}
        >
          This Week
        </Button>
        <Button
          variant={currentPreset === 'thisMonth' ? 'default' : 'outline'}
          size="sm"
          disabled={disabled}
          className="text-xs h-7"
          onClick={() => handlePresetClick('thisMonth')}
        >
          This Month
        </Button>
        <Button
          variant={currentPreset === 'nextWeek' ? 'default' : 'outline'}
          size="sm"
          disabled={disabled}
          className="text-xs h-7"
          onClick={() => handlePresetClick('nextWeek')}
        >
          Next Week
        </Button>
        <Button
          variant={currentPreset === 'nextMonth' ? 'default' : 'outline'}
          size="sm"
          disabled={disabled}
          className="text-xs h-7"
          onClick={() => handlePresetClick('nextMonth')}
        >
          Next Month
        </Button>
      </div>
      
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Label htmlFor="date-from" className="text-xs text-gray-600 whitespace-nowrap">
            From:
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date-from"
                variant="outline"
                size="sm"
                disabled={disabled}
                className="w-[140px] justify-start text-left font-normal bg-white"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom && !isNaN(dateFrom.getTime()) ? format(dateFrom, "PPP") : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={(d) => onDateFromChange(d || undefined)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {dateFrom && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={disabled}
              onClick={() => onDateFromChange(undefined)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="date-to" className="text-xs text-gray-600 whitespace-nowrap">
            To:
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date-to"
                variant="outline"
                size="sm"
                disabled={disabled}
                className="w-[140px] justify-start text-left font-normal bg-white"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo && !isNaN(dateTo.getTime()) ? format(dateTo, "PPP") : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={(d) => onDateToChange(d || undefined)}
                disabled={(date) => (dateFrom ? date < dateFrom : false)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {dateTo && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={disabled}
              onClick={() => onDateToChange(undefined)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {(dateFrom || dateTo) && (
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            className="text-xs"
            onClick={() => {
              onDateFromChange(undefined)
              onDateToChange(undefined)
            }}
          >
            Clear range
          </Button>
        )}
      </div>
    </div>
  )
}

