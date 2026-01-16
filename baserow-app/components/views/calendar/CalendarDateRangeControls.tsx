"use client"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, X } from "lucide-react"
import { format } from "date-fns"

export interface CalendarDateRangeControlsProps {
  dateFrom?: Date
  dateTo?: Date
  onDateFromChange: (date?: Date) => void
  onDateToChange: (date?: Date) => void
  disabled?: boolean
}

export default function CalendarDateRangeControls({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  disabled = false,
}: CalendarDateRangeControlsProps) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-gray-600">Date Range</div>
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

