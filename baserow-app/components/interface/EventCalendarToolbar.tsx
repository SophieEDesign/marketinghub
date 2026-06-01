"use client"

import { useMemo, useState } from "react"
import {
  addMonths,
  format,
  setMonth,
  setYear,
  startOfMonth,
} from "date-fns"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  LayoutList,
  SlidersHorizontal,
} from "lucide-react"
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

const FILTER_CONTROL = "h-8 text-xs border-border/40 bg-background"

const VIEW_OPTIONS: {
  value: EventCalendarViewMode
  label: string
  icon: typeof CalendarDays
}[] = [
  { value: "month", label: "Month", icon: CalendarDays },
  { value: "week", label: "Week", icon: CalendarDays },
  { value: "list", label: "List", icon: LayoutList },
  { value: "timeline", label: "Timeline", icon: SlidersHorizontal },
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
      <SelectTrigger
        className={cn(FILTER_CONTROL, "w-auto min-w-[140px] max-w-[200px]", className)}
        aria-label={label}
      >
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
  title?: string
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
  onClearFilters?: () => void
  showFilters?: boolean
  showFiltersRow?: boolean
}

export default function EventCalendarToolbar({
  title = "Event Calendar",
  viewMode,
  onViewModeChange,
  cursorDate,
  onCursorDateChange,
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
  onClearFilters,
  showFilters = true,
  showFiltersRow = true,
}: EventCalendarToolbarProps) {
  const [filtersExpanded, setFiltersExpanded] = useState(false)

  const monthOptions = useMemo(() => {
    const anchor = startOfMonth(cursorDate)
    const items: { value: string; label: string; date: Date }[] = []
    for (let i = -12; i <= 12; i++) {
      const d = addMonths(anchor, i)
      items.push({
        value: format(d, "yyyy-MM"),
        label: format(d, "MMMM yyyy"),
        date: d,
      })
    }
    return items
  }, [cursorDate])

  const monthValue = format(cursorDate, "yyyy-MM")

  const hasActiveFilters =
    filterEventType !== "all" ||
    filterLocation !== "all" ||
    filterStatus !== "all" ||
    filterOwner !== "all"

  const filtersVisible = showFilters && (showFiltersRow || filtersExpanded)

  return (
    <div className="flex flex-col gap-3 shrink-0">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {title ? (
          <h2 className="text-lg font-semibold text-foreground tracking-tight shrink-0">{title}</h2>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 lg:flex-1 lg:justify-center min-w-0">
          <div
            className="inline-flex rounded-lg border border-border/50 bg-muted/30 p-0.5 shrink-0"
            role="tablist"
            aria-label="Calendar view"
          >
            {VIEW_OPTIONS.map((opt) => {
              const Icon = opt.icon
              const active = viewMode === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onViewModeChange(opt.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                    active
                      ? "bg-accent-link/12 text-accent-link shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {opt.label}
                </button>
              )
            })}
          </div>
          {filtersVisible ? (
            <div className="flex flex-row flex-wrap items-center gap-2 min-w-0">
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
              {filtersExpanded && owners.length > 0 ? (
                <FilterSelect
                  label="Owner"
                  options={owners}
                  value={filterOwner}
                  onChange={onFilterOwner}
                  placeholder="All owners"
                />
              ) : null}
              {hasActiveFilters && onClearFilters ? (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="text-xs font-medium text-accent-link hover:underline shrink-0"
                >
                  Clear
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0 lg:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs font-medium"
            onClick={onToday}
          >
            Today
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={onPrev}
            aria-label="Previous period"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={onNext}
            aria-label="Next period"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Select
            value={monthValue}
            onValueChange={(v) => {
              const picked = monthOptions.find((m) => m.value === v)
              if (picked) onCursorDateChange(picked.date)
              else {
                const [y, m] = v.split("-").map(Number)
                if (y && m) onCursorDateChange(setMonth(setYear(cursorDate, y), m - 1))
              }
            }}
          >
            <SelectTrigger className={cn(FILTER_CONTROL, "w-[148px] font-semibold")} aria-label="Month">
              <SelectValue>{format(cursorDate, "MMMM yyyy")}</SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {monthOptions.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {showFilters ? (
            <Button
              type="button"
              variant={filtersExpanded ? "secondary" : "outline"}
              size="sm"
              className="h-8 gap-1.5 text-xs font-medium ml-0.5"
              onClick={() => setFiltersExpanded((v) => !v)}
              aria-expanded={filtersExpanded}
            >
              <Filter className="h-3.5 w-3.5" aria-hidden />
              Filters
            </Button>
          ) : null}
        </div>
      </div>

    </div>
  )
}
