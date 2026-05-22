"use client"

import { Search } from "lucide-react"
import {
  CONTENT_TIMELINE_CHANNELS,
  CONTENT_TIMELINE_STATUSES,
  CONTENT_TIMELINE_THEMES,
  CONTENT_TIMELINE_TYPES,
  type ContentTimelineFilters,
} from "@/lib/marketing/content-timeline"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

const FILTER_CONTROL = "h-8 text-xs border-border/40"

interface ContentTimelineFilterBarProps {
  filters: ContentTimelineFilters
  ownerOptions: string[]
  divisionOptions: string[]
  compact: boolean
  onFiltersChange: (patch: Partial<ContentTimelineFilters>) => void
  onClear: () => void
  onCompactChange: (compact: boolean) => void
}

function FilterSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string
  value: string[]
  options: { value: string; label: string }[] | readonly string[]
  placeholder: string
  onChange: (v: string[]) => void
}) {
  const current = value[0] ?? "all"
  const normalized =
    typeof options[0] === "string"
      ? (options as readonly string[]).map((o) => ({ value: o, label: o }))
      : (options as { value: string; label: string }[])

  return (
    <Select value={current} onValueChange={(v) => onChange(v === "all" ? [] : [v])}>
      <SelectTrigger className={cn(FILTER_CONTROL, "w-[110px] shrink-0")} aria-label={label}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {normalized.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function ContentTimelineFilterBar({
  filters,
  ownerOptions,
  divisionOptions,
  compact,
  onFiltersChange,
  onClear,
  onCompactChange,
}: ContentTimelineFilterBarProps) {
  const hasActive =
    filters.themes.length > 0 ||
    filters.types.length > 0 ||
    filters.channels.length > 0 ||
    filters.statuses.length > 0 ||
    filters.owners.length > 0 ||
    filters.divisions.length > 0 ||
    filters.search.trim().length > 0 ||
    Boolean(filters.dateFrom || filters.dateTo)

  return (
    <div className="shrink-0 border-b border-border/40 px-3 py-2 md:px-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[140px] flex-1 sm:max-w-[200px]">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={filters.search}
              onChange={(e) => onFiltersChange({ search: e.target.value })}
              placeholder="Search content..."
              className={cn(FILTER_CONTROL, "pl-8")}
              aria-label="Search content"
            />
          </div>

          <div className="flex flex-1 flex-wrap items-center gap-1.5 overflow-x-auto pb-0.5">
            <FilterSelect
              label="Theme"
              value={filters.themes}
              options={CONTENT_TIMELINE_THEMES}
              placeholder="Theme"
              onChange={(themes) => onFiltersChange({ themes })}
            />
            <FilterSelect
              label="Content type"
              value={filters.types}
              options={CONTENT_TIMELINE_TYPES}
              placeholder="Type"
              onChange={(types) => onFiltersChange({ types })}
            />
            <FilterSelect
              label="Channel"
              value={filters.channels}
              options={CONTENT_TIMELINE_CHANNELS}
              placeholder="Channel"
              onChange={(channels) => onFiltersChange({ channels })}
            />
            <FilterSelect
              label="Status"
              value={filters.statuses}
              options={CONTENT_TIMELINE_STATUSES}
              placeholder="Status"
              onChange={(statuses) => onFiltersChange({ statuses })}
            />
            <FilterSelect
              label="Owner"
              value={filters.owners}
              options={ownerOptions}
              placeholder="Owner"
              onChange={(owners) => onFiltersChange({ owners })}
            />
            <FilterSelect
              label="Division"
              value={filters.divisions}
              options={divisionOptions}
              placeholder="Division"
              onChange={(divisions) => onFiltersChange({ divisions })}
            />
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {hasActive && (
              <button
                type="button"
                onClick={onClear}
                className="text-xs text-blue-600 hover:underline"
              >
                Clear filters
              </button>
            )}
            <div className="flex items-center gap-2">
              <Switch id="ct-compact" checked={compact} onCheckedChange={onCompactChange} />
              <Label htmlFor="ct-compact" className="text-xs text-muted-foreground cursor-pointer">
                Compact
              </Label>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
