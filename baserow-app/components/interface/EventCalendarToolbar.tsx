"use client"

import { format } from "date-fns"
import { ChevronLeft, ChevronRight, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { EventCalendarViewMode } from "@/lib/marketing/events"

const FILTER_CONTROL = "h-8 text-xs border-border/40"

const VIEW_OPTIONS: { value: EventCalendarViewMode; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "list", label: "List" },
  { value: "timeline", label: "Timeline" },
]

function FilterSelect({
  label,
  options,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string
  options: string[]
  value: string
  onChange: (v: string) => void
  placeholder: string
  className?: string
}) {
  if (options.length === 0) return null
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn(FILTER_CONTROL, "w-[130px]", className)} aria-label={label}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

interface EventCalendarToolbarProps {
  viewMode: EventCalendarViewMode
  onViewModeChange: (mode: EventCalendarViewMode) => void
  cursorDate: Date
  onCursorDateChange: (date: Date) => void
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  eventTypes: string[]
  locations: string[]
  statuses: string[]
  owners: string[]
  filterEventType: string
  filterLocation: string
  filterStatus: string
  filterOwner: string
  onFilterEventType: (v: string) => void
  onFilterLocation: (v: string) => void
  onFilterStatus: (v: string) => void
  onFilterOwner: (v: string) => void
  showFilters?: boolean
  showFiltersRow?: boolean
}

export default function EventCalendarToolbar({
  viewMode,
  onViewModeChange,
  cursorDate,
  onPrev,
  onNext,
  onToday,
  eventTypes,
  locations,
  statuses,
  owners,
  filterEventType,
  filterLocation,
  filterStatus,
  filterOwner,
  onFilterEventType,
  onFilterLocation,
  onFilterStatus,
  onFilterOwner,
  showFilters = true,
  showFiltersRow = true,
}: EventCalendarToolbarProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border/40 p-0.5 bg-muted/20">
          {VIEW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onViewModeChange(opt.value)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                viewMode === opt.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={onPrev} aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onToday}>
            Today
          </Button>
          <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={onNext} aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold text-foreground ml-1 min-w-[120px]">
            {format(cursorDate, "MMMM yyyy")}
          </span>
        </div>
      </div>

      {showFilters && showFiltersRow ? (
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
          <FilterSelect
            label="Event type"
            options={eventTypes}
            value={filterEventType}
            onChange={onFilterEventType}
            placeholder="All event types"
          />
          <FilterSelect
            label="Location"
            options={locations}
            value={filterLocation}
            onChange={onFilterLocation}
            placeholder="All locations"
          />
          <FilterSelect
            label="Status"
            options={statuses}
            value={filterStatus}
            onChange={onFilterStatus}
            placeholder="All statuses"
          />
          <FilterSelect
            label="Owner"
            options={owners}
            value={filterOwner}
            onChange={onFilterOwner}
            placeholder="All owners"
          />
        </div>
      ) : null}
    </div>
  )
}
