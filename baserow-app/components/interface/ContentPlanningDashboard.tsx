"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { ChevronRight, Palette, Plus, Search } from "lucide-react"
import ContentPlanningCalendar from "@/components/interface/ContentPlanningCalendar"
import { EditableDashboardRegion } from "@/components/interface/EditableDashboardRegion"
import {
  MarketingFilterStrip,
  MarketingInsightCard,
  MarketingPanelSecondary,
} from "@/components/layout/ui-system"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRecordModal } from "@/contexts/RecordModalContext"
import { useContentPlanningData } from "@/hooks/useContentPlanningData"
import {
  buildCalendarEvents,
  buildCampaignCards,
  detectContentGaps,
  filterContentItems,
  getCurrentQuarter,
  getOverdueItems,
  getUpcomingContentList,
  getUpcomingDeadlines,
  quarterLabel,
  type CalendarViewMode,
  type ContentColorMode,
  type ContentPlanningFilters,
  type QuarterNum,
} from "@/lib/marketing/content-planning"
import { cn } from "@/lib/utils"

const FILTER_CONTROL = "h-8 text-xs border-border/40"

interface ContentPlanningDashboardProps {
  canEdit?: boolean
}

function FilterMultiSelect({
  label,
  options,
  values,
  onChange,
  placeholder,
  className,
}: {
  label: string
  options: string[]
  values: string[]
  onChange: (v: string[]) => void
  placeholder: string
  className?: string
}) {
  if (options.length === 0) return null
  const current = values[0] ?? "all"
  return (
    <Select
      value={current}
      onValueChange={(v) => onChange(v === "all" ? [] : [v])}
    >
      <SelectTrigger className={cn(FILTER_CONTROL, "w-[120px]", className)} aria-label={label}>
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

const COLOR_MODE_LABELS: Record<ContentColorMode, string> = {
  theme: "Theme",
  contentType: "Type",
  status: "Status",
}

export default function ContentPlanningDashboard({ canEdit = false }: ContentPlanningDashboardProps) {
  const { openRecordModal } = useRecordModal()
  const {
    loading,
    error,
    tableIds,
    fields,
    allItems,
    themeRows,
    campaignRows,
    themeLabelById,
    filterOptions,
    statusColors,
    typeColors,
    reload,
  } = useContentPlanningData()

  const [year, setYear] = useState(() => new Date().getFullYear())
  const [quarter, setQuarter] = useState<QuarterNum | "all">(getCurrentQuarter())
  const [contentTypes, setContentTypes] = useState<string[]>([])
  const [divisions, setDivisions] = useState<string[]>([])
  const [statuses, setStatuses] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [colorMode, setColorMode] = useState<ContentColorMode>("theme")
  const [calendarView, setCalendarView] = useState<CalendarViewMode>("month")

  const filters: ContentPlanningFilters = useMemo(
    () => ({ year, quarter, contentTypes, divisions, statuses, search }),
    [year, quarter, contentTypes, divisions, statuses, search]
  )

  const filteredItems = useMemo(
    () => filterContentItems(allItems, filters),
    [allItems, filters]
  )

  const calendarEvents = useMemo(
    () => buildCalendarEvents(filteredItems, colorMode, statusColors, typeColors),
    [filteredItems, colorMode, statusColors, typeColors]
  )

  const deadlines = useMemo(() => getUpcomingDeadlines(filteredItems), [filteredItems])
  const overdue = useMemo(() => getOverdueItems(filteredItems), [filteredItems])
  const upcomingList = useMemo(() => getUpcomingContentList(filteredItems), [filteredItems])
  const gaps = useMemo(() => {
    if (!fields) return []
    return detectContentGaps(filteredItems, filters, themeRows, fields)
  }, [filteredItems, filters, themeRows, fields])

  const campaignCards = useMemo(() => {
    if (!fields) return []
    return buildCampaignCards({
      campaignRows,
      items: allItems,
      fields,
      themeLabelById,
    })
  }, [campaignRows, allItems, fields, themeLabelById])

  const openContent = (recordId: string | null, initialData?: Record<string, unknown>) => {
    if (!tableIds) return
    openRecordModal({
      tableId: tableIds.contentTableId,
      recordId,
      supabaseTableName: tableIds.contentSupabaseTable,
      initialData,
      onRecordUpdated: reload,
      onDeleted: reload,
      onSave: () => reload(),
    })
  }

  const openCampaign = (recordId: string) => {
    if (!tableIds) return
    openRecordModal({
      tableId: tableIds.campaignsTableId,
      recordId,
      supabaseTableName: tableIds.campaignsSupabaseTable,
      onRecordUpdated: reload,
      onDeleted: reload,
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" text="Loading content planning…" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-card-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
        {error}
      </div>
    )
  }

  const visibleGaps = gaps.slice(0, 3)

  return (
    <div className="flex flex-col gap-3 md:gap-4 min-w-0 pb-4">
      <EditableDashboardRegion id="page-header" label="Page header">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-lg font-medium tracking-tight text-foreground">Content Planning</h1>
        <p className="text-sm text-muted-foreground">
          Plan, schedule and track upcoming marketing content.
        </p>
      </header>
      </EditableDashboardRegion>

      <EditableDashboardRegion id="filter-strip" label="Filters">
      <MarketingFilterStrip>
        <div className="relative flex-1 min-w-[200px] max-w-md order-first">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search content…"
            className={cn(FILTER_CONTROL, "pl-8 bg-background ring-1 ring-border/30 w-full")}
          />
        </div>

        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className={cn(FILTER_CONTROL, "w-[88px]")} aria-label="Year">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {filterOptions.years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={quarter === "all" ? "all" : String(quarter)}
          onValueChange={(v) => setQuarter(v === "all" ? "all" : (Number(v) as QuarterNum))}
        >
          <SelectTrigger className={cn(FILTER_CONTROL, "w-[100px]")} aria-label="Quarter">
            <SelectValue placeholder="Quarter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All quarters</SelectItem>
            {([1, 2, 3, 4] as const).map((q) => (
              <SelectItem key={q} value={String(q)}>
                {quarterLabel(q)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <FilterMultiSelect
          label="Content type"
          options={filterOptions.contentTypes}
          values={contentTypes}
          onChange={setContentTypes}
          placeholder="All types"
        />
        <FilterMultiSelect
          label="Team"
          options={filterOptions.divisions}
          values={divisions}
          onChange={setDivisions}
          placeholder="All teams"
        />
        <FilterMultiSelect
          label="Status"
          options={filterOptions.statuses}
          values={statuses}
          onChange={setStatuses}
          placeholder="All statuses"
        />

        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0 border-border/40"
              aria-label={`Colour by ${COLOR_MODE_LABELS[colorMode]}`}
            >
              <Palette className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-3" align="end">
            <p className="text-xs font-medium text-muted-foreground mb-2">Colour by</p>
            <RadioGroup
              value={colorMode}
              onValueChange={(v) => setColorMode(v as ContentColorMode)}
              className="gap-2"
            >
              {(Object.keys(COLOR_MODE_LABELS) as ContentColorMode[]).map((mode) => (
                <div key={mode} className="flex items-center gap-2">
                  <RadioGroupItem value={mode} id={`color-${mode}`} />
                  <Label htmlFor={`color-${mode}`} className="text-xs font-normal cursor-pointer">
                    {COLOR_MODE_LABELS[mode]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </PopoverContent>
        </Popover>

        {overdue.length > 0 ? (
          <Badge variant="outline" className="text-[11px] font-normal border-destructive/40 text-destructive">
            {overdue.length} overdue
          </Badge>
        ) : null}
        {deadlines.length > 0 ? (
          <Badge variant="outline" className="text-[11px] font-normal">
            {deadlines.length} due soon
          </Badge>
        ) : null}

        {canEdit ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(FILTER_CONTROL, "ml-auto shrink-0")}
            onClick={() => openContent(null)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add content
          </Button>
        ) : null}
      </MarketingFilterStrip>
      </EditableDashboardRegion>

      <div className="flex flex-col xl:flex-row gap-3 min-h-0">
        <div className="flex-1 min-w-0 flex flex-col gap-2 min-h-0">
          <EditableDashboardRegion id="calendar" label="Content calendar">
          <ContentPlanningCalendar
            events={calendarEvents}
            viewMode={calendarView}
            onViewModeChange={setCalendarView}
            onEventClick={(id) => openContent(id)}
          />
          </EditableDashboardRegion>

          <EditableDashboardRegion id="upcoming-list" label="Upcoming content">
          <MarketingPanelSecondary title="Upcoming content" className="max-h-[200px] shrink-0">
            <ul className="divide-y divide-border/25">
              {upcomingList.length === 0 ? (
                <li className="py-3 text-[11px] text-muted-foreground text-center">
                  No upcoming content for this period
                </li>
              ) : (
                upcomingList.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openContent(item.id)}
                      className="w-full flex items-center gap-2 px-1 py-1.5 text-left hover:bg-muted/30 transition-colors group"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {[item.themeLabel, item.status].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                        {item.date || item.dueDate
                          ? format(item.date ?? item.dueDate!, "d MMM")
                          : "—"}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0" />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </MarketingPanelSecondary>
          </EditableDashboardRegion>
        </div>

        <aside className="w-full xl:w-[260px] shrink-0 flex flex-col gap-2 xl:max-h-[calc(100vh-12rem)]">
          <EditableDashboardRegion id="deadlines" label="Upcoming deadlines">
          <MarketingPanelSecondary title="Upcoming deadlines" className="max-h-[180px]">
            <ul className="flex flex-col gap-0.5">
              {deadlines.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-1">No upcoming deadlines</p>
              ) : (
                deadlines.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openContent(item.id)}
                      className="w-full text-left rounded-md px-1.5 py-1 hover:bg-muted/30 transition-colors"
                    >
                      <p className="text-xs font-medium truncate">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 flex justify-between gap-2">
                        <span className="truncate">{item.assignee ?? "Unassigned"}</span>
                        <span className="shrink-0 tabular-nums">
                          {format(item.dueDate ?? item.date!, "d MMM")}
                        </span>
                      </p>
                      {item.status ? (
                        <span className="text-[10px] text-muted-foreground">{item.status}</span>
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </MarketingPanelSecondary>
          </EditableDashboardRegion>

          <EditableDashboardRegion id="campaigns" label="Upcoming campaigns">
          <MarketingPanelSecondary title="Upcoming campaigns" className="max-h-[200px]">
            <ul className="flex flex-col gap-0.5">
              {campaignCards.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-1">No active campaigns</p>
              ) : (
                campaignCards.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => openCampaign(c.id)}
                      className="w-full text-left rounded-md px-1.5 py-1.5 hover:bg-muted/30 transition-colors"
                    >
                      <p className="text-xs font-medium truncate">{c.name}</p>
                      {c.themeLabel ? (
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">{c.themeLabel}</p>
                      ) : null}
                      <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-1 text-[10px] text-muted-foreground">
                        <span>{c.postsPlanned} planned</span>
                        <span>{c.scheduledCount} scheduled</span>
                        {c.overdueCount > 0 ? (
                          <span className="text-destructive font-medium">{c.overdueCount} overdue</span>
                        ) : null}
                      </div>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </MarketingPanelSecondary>
          </EditableDashboardRegion>

          {visibleGaps.length > 0 ? (
            <EditableDashboardRegion id="content-gaps" label="Content gaps">
            <MarketingInsightCard title="Content gaps">
              <ul className="flex flex-col gap-1.5">
                {visibleGaps.map((gap) => (
                  <li
                    key={gap.id}
                    className={cn(
                      "rounded-md px-2 py-1 text-[11px]",
                      gap.severity === "warning"
                        ? "bg-amber-500/10 text-amber-900 dark:text-amber-100"
                        : "text-muted-foreground"
                    )}
                  >
                    <p className="font-medium">{gap.label}</p>
                    <p className="mt-0.5 opacity-80">{gap.detail}</p>
                  </li>
                ))}
              </ul>
            </MarketingInsightCard>
            </EditableDashboardRegion>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
