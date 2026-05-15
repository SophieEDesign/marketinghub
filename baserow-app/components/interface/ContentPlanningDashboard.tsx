"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { ChevronRight, Plus, Search } from "lucide-react"
import ContentPlanningCalendar from "@/components/interface/ContentPlanningCalendar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
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

interface ContentPlanningDashboardProps {
  canEdit?: boolean
}

function FilterMultiSelect({
  label,
  options,
  values,
  onChange,
  placeholder,
}: {
  label: string
  options: string[]
  values: string[]
  onChange: (v: string[]) => void
  placeholder: string
}) {
  if (options.length === 0) return null
  const current = values[0] ?? "all"
  return (
    <Select
      value={current}
      onValueChange={(v) => onChange(v === "all" ? [] : [v])}
    >
      <SelectTrigger className="h-9 w-[130px] text-xs" aria-label={label}>
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

function SidebarSection({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "rounded-card-lg border border-border/60 bg-card shadow-sm flex flex-col min-h-0",
        className
      )}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-3 pt-3 pb-2 border-b border-border/40 shrink-0">
        {title}
      </h3>
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">{children}</div>
    </section>
  )
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

  return (
    <div className="flex flex-col gap-4 md:gap-5 min-w-0 pb-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Content Planning</h1>
        <p className="text-sm text-muted-foreground">
          Plan, schedule and track upcoming marketing content.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-card-lg border border-border/60 bg-card px-3 py-2.5 shadow-sm">
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="h-9 w-[100px] text-xs" aria-label="Year">
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
          <SelectTrigger className="h-9 w-[110px] text-xs" aria-label="Quarter">
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

        <div className="relative flex-1 min-w-[140px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search content…"
            className="h-9 pl-8 text-xs"
          />
        </div>

        <Select value={colorMode} onValueChange={(v) => setColorMode(v as ContentColorMode)}>
          <SelectTrigger className="h-9 w-[120px] text-xs hidden sm:flex" aria-label="Colour by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="theme">Colour: Theme</SelectItem>
            <SelectItem value="contentType">Colour: Type</SelectItem>
            <SelectItem value="status">Colour: Status</SelectItem>
          </SelectContent>
        </Select>

        {canEdit ? (
          <Button
            type="button"
            size="sm"
            className="h-9 ml-auto shrink-0"
            onClick={() => openContent(null)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add content
          </Button>
        ) : null}
      </div>

      {(overdue.length > 0 || deadlines.length > 0) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {overdue.length > 0 ? (
            <Badge variant="destructive" className="font-normal">
              {overdue.length} overdue
            </Badge>
          ) : null}
          {deadlines.length > 0 ? (
            <Badge variant="secondary" className="font-normal">
              {deadlines.length} due soon
            </Badge>
          ) : null}
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-4 min-h-0">
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <ContentPlanningCalendar
            events={calendarEvents}
            viewMode={calendarView}
            onViewModeChange={setCalendarView}
            onEventClick={(id) => openContent(id)}
          />

          <section className="rounded-card-lg border border-border/60 bg-card shadow-sm flex flex-col max-h-[320px]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 shrink-0">
              <h2 className="text-sm font-semibold text-foreground">Upcoming Content</h2>
              <span className="text-xs text-muted-foreground">{upcomingList.length} items</span>
            </div>
            <ul className="overflow-y-auto flex-1 min-h-0 divide-y divide-border/40">
              {upcomingList.length === 0 ? (
                <li className="px-4 py-6 text-sm text-muted-foreground text-center">
                  No upcoming content for this period
                </li>
              ) : (
                upcomingList.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openContent(item.id)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/40 transition-colors group"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {[item.themeLabel, item.status].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                        {item.date || item.dueDate
                          ? format(item.date ?? item.dueDate!, "d MMM")
                          : "—"}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground shrink-0" />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>

        <aside className="w-full xl:w-[300px] shrink-0 flex flex-col gap-3 xl:max-h-[calc(100vh-12rem)]">
          <SidebarSection title="Upcoming Deadlines" className="max-h-[220px]">
            <ul className="flex flex-col gap-1.5">
              {deadlines.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No upcoming deadlines</p>
              ) : (
                deadlines.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openContent(item.id)}
                      className="w-full text-left rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
                    >
                      <p className="text-sm font-medium truncate">{item.title}</p>
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
          </SidebarSection>

          <SidebarSection title="Content Gaps" className="max-h-[180px]">
            <ul className="flex flex-col gap-2">
              {gaps.map((gap) => (
                <li
                  key={gap.id}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-xs",
                    gap.severity === "warning"
                      ? "bg-amber-500/10 text-amber-900 dark:text-amber-100"
                      : "bg-muted/50 text-muted-foreground"
                  )}
                >
                  <p className="font-medium">{gap.label}</p>
                  <p className="mt-0.5 opacity-80">{gap.detail}</p>
                </li>
              ))}
            </ul>
          </SidebarSection>

          <SidebarSection title="Upcoming Campaigns" className="flex-1 min-h-[160px]">
            <ul className="flex flex-col gap-2">
              {campaignCards.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No active campaigns</p>
              ) : (
                campaignCards.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => openCampaign(c.id)}
                      className="w-full text-left rounded-md border border-border/50 bg-muted/20 px-2.5 py-2 hover:bg-muted/40 transition-colors"
                    >
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    {c.themeLabel ? (
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{c.themeLabel}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[10px] text-muted-foreground">
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
          </SidebarSection>
        </aside>
      </div>
    </div>
  )
}
