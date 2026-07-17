"use client"

import {
  CalendarDays,
  FileText,
  Globe,
  Image,
  Layers,
  Mail,
  Megaphone,
} from "lucide-react"
import {
  THINGS_TO_DO_LINKED_TYPES,
  THINGS_TO_DO_PRIORITIES,
  THINGS_TO_DO_STATUSES,
  THINGS_TO_DO_TYPES,
  type ThingsToDoFilters,
} from "@/lib/marketing/things-to-do"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { debugLog } from "@/lib/debug"

const FILTER_CONTROL = "h-8 w-full text-xs border-border/40"

interface FilterOptions {
  owners: { id: string; name: string; initials: string }[]
  reviewers: { id: string; name: string; initials: string }[]
  campaigns: { id: string; title: string }[]
  contentTypes: string[]
  channels: string[]
}

interface ThingsToDoFilterSidebarProps {
  filters: ThingsToDoFilters
  options: FilterOptions
  showQuickLinks: boolean
  onFiltersChange: (patch: Partial<ThingsToDoFilters>) => void
  onClear: () => void
  className?: string
}

function SidebarSelect({
  label,
  value,
  allLabel,
  options,
  onChange,
}: {
  label: string
  value: string[]
  allLabel: string
  options: { value: string; label: string }[]
  onChange: (v: string[]) => void
}) {
  const current = value[0] ?? "all"
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-medium text-muted-foreground">{label}</Label>
      <Select value={current} onValueChange={(v) => onChange(v === "all" ? [] : [v])}>
        <SelectTrigger className={FILTER_CONTROL} aria-label={label}>
          <SelectValue placeholder={allLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

const QUICK_LINKS = [
  { label: "All Content", icon: FileText },
  { label: "Campaigns", icon: Megaphone },
  { label: "Events", icon: CalendarDays },
  { label: "Media Library", icon: Image },
  { label: "Website Pages", icon: Globe },
  { label: "Newsletters", icon: Mail },
  { label: "Themes", icon: Layers },
]

export function ThingsToDoFilterSidebar({
  filters,
  options,
  showQuickLinks,
  onFiltersChange,
  onClear,
  className,
}: ThingsToDoFilterSidebarProps) {
  const hasActive =
    filters.types.length > 0 ||
    filters.statuses.length > 0 ||
    filters.priorities.length > 0 ||
    filters.owners.length > 0 ||
    filters.reviewers.length > 0 ||
    filters.campaigns.length > 0 ||
    filters.linkedTypes.length > 0 ||
    filters.contentTypes.length > 0 ||
    filters.channels.length > 0 ||
    !!filters.dueDatePreset

  return (
    <aside
      className={cn(
        "flex w-full shrink-0 flex-col border-b border-border/30 bg-muted/10 lg:w-[196px] lg:border-b-0 lg:border-r",
        className
      )}
    >
      <div className="flex items-center justify-between px-3 py-2.5 lg:px-4">
        <span className="text-xs font-semibold text-foreground">Filters</span>
        {hasActive ? (
          <button
            type="button"
            onClick={onClear}
            className="text-[10px] font-medium text-primary hover:underline"
          >
            Clear all
          </button>
        ) : null}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 pb-4 lg:px-3">
        <SidebarSelect
          label="Type"
          value={filters.types}
          allLabel="All types"
          options={THINGS_TO_DO_TYPES}
          onChange={(types) => onFiltersChange({ types })}
        />
        <SidebarSelect
          label="Status"
          value={filters.statuses}
          allLabel="All statuses"
          options={THINGS_TO_DO_STATUSES}
          onChange={(statuses) => onFiltersChange({ statuses })}
        />
        <SidebarSelect
          label="Priority"
          value={filters.priorities}
          allLabel="All priorities"
          options={THINGS_TO_DO_PRIORITIES}
          onChange={(priorities) => onFiltersChange({ priorities })}
        />
        <SidebarSelect
          label="Owner"
          value={filters.owners}
          allLabel="All owners"
          options={options.owners.map((o) => ({ value: o.id, label: o.name }))}
          onChange={(owners) => onFiltersChange({ owners })}
        />
        <SidebarSelect
          label="Reviewer"
          value={filters.reviewers}
          allLabel="All reviewers"
          options={options.reviewers.map((r) => ({ value: r.id, label: r.name }))}
          onChange={(reviewers) => onFiltersChange({ reviewers })}
        />
        <SidebarSelect
          label="Campaign"
          value={filters.campaigns}
          allLabel="All campaigns"
          options={options.campaigns.map((c) => ({ value: c.id, label: c.title }))}
          onChange={(campaigns) => onFiltersChange({ campaigns })}
        />
        <SidebarSelect
          label="Linked record type"
          value={filters.linkedTypes}
          allLabel="All record types"
          options={THINGS_TO_DO_LINKED_TYPES}
          onChange={(linkedTypes) => onFiltersChange({ linkedTypes })}
        />
        <SidebarSelect
          label="Content type"
          value={filters.contentTypes}
          allLabel="All content types"
          options={options.contentTypes.map((t) => ({ value: t, label: t }))}
          onChange={(contentTypes) => onFiltersChange({ contentTypes })}
        />
        <SidebarSelect
          label="Channel"
          value={filters.channels}
          allLabel="All channels"
          options={options.channels.map((c) => ({ value: c, label: c }))}
          onChange={(channels) => onFiltersChange({ channels })}
        />
        <div className="space-y-1">
          <Label className="text-[10px] font-medium text-muted-foreground">Due date</Label>
          <Select
            value={filters.dueDatePreset ?? "all"}
            onValueChange={(v) =>
              onFiltersChange({
                dueDatePreset:
                  v === "all" ? undefined : (v as ThingsToDoFilters["dueDatePreset"]),
              })
            }
          >
            <SelectTrigger className={FILTER_CONTROL} aria-label="Due date">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="today">Due today</SelectItem>
              <SelectItem value="this-week">Due this week</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {showQuickLinks ? (
          <div className="space-y-2 border-t border-border/40 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Quick links
            </p>
            <div className="flex flex-col gap-0.5">
              {QUICK_LINKS.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    // TODO: navigate to related Marketing Hub tables/pages.
                    debugLog(`[ThingsToDo] Quick link: ${label}`)
                  }}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  )
}
