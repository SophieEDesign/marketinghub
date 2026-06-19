"use client"

import { useEffect, useMemo, useState } from "react"
import { Search, SlidersHorizontal, Plus, MoreHorizontal } from "lucide-react"
import type { PageBlock } from "@/lib/interface/types"
import { useCampaignsOverviewData } from "@/hooks/useCampaignsOverviewData"
import {
  EMPTY_CAMPAIGN_FILTERS,
  filterCampaigns,
  formatDateRange,
  normalizeText,
  type CampaignOverviewItem,
  type CampaignOverviewFilters,
} from "@/lib/marketing/campaigns-overview"
import { campaignsOverviewSubtitle } from "@/lib/marketing/campaigns-overview-config"
import {
  campaignsKpiConfigFromBlock,
  computeCampaignKpis,
} from "@/lib/marketing/campaigns-overview-kpi"
import { useRecordModal } from "@/contexts/RecordModalContext"
import { FilterResultsAnnouncer } from "@/components/a11y/FilterResultsAnnouncer"
import MarketingDemoDataBanner from "@/components/interface/primitives/MarketingDemoDataBanner"
import DashboardEmpty from "@/components/interface/primitives/DashboardEmpty"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChoicePill } from "@/components/fields/ChoicePill"
import { cn } from "@/lib/utils"
import {
  marketingBlockRootClass,
  marketingBlockScrollPanelClass,
} from "@/lib/interface/marketing-block-layout"

interface CampaignsOverviewBlockProps {
  block: PageBlock
  isEditing?: boolean
  interfaceMode?: "view" | "edit"
  isFullPage?: boolean
}

function CampaignValuePill({ value }: { value?: string }) {
  if (!value) return <span className="text-xs text-muted-foreground">-</span>
  return (
    <ChoicePill
      label={value}
      fieldType="single_select"
      truncate
      className="max-w-[140px]"
    />
  )
}

function ProgressPill({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-xs text-muted-foreground">-</span>
  const barTone =
    value >= 75
      ? "bg-emerald-500"
      : value >= 45
        ? "bg-blue-500"
        : value >= 20
          ? "bg-amber-500"
          : "bg-rose-500"
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 text-xs font-medium text-muted-foreground">{value}%</span>
      <div className="h-1.5 w-20 rounded-full bg-muted">
        <div className={cn("h-full rounded-full", barTone)} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

type CampaignView = "list" | "kanban" | "calendar" | "timeline"
type CampaignGroupBy = NonNullable<PageBlock["config"]["campaigns_group_by"]>

function campaignGroupLabel(item: CampaignOverviewItem, groupBy: CampaignGroupBy): string {
  if (groupBy === "none") return "All campaigns"
  const value =
    groupBy === "status"
      ? item.status
      : groupBy === "stage"
        ? item.stage
        : groupBy === "type"
          ? item.type
          : groupBy === "division"
            ? item.division
            : groupBy === "owner"
              ? item.owner
              : item.priority
  return value && value.trim() ? value : "Unassigned"
}

export default function CampaignsOverviewBlock({
  block,
  isEditing = false,
  interfaceMode = "view",
  isFullPage = false,
}: CampaignsOverviewBlockProps) {
  const { config } = block
  const { openRecordModal } = useRecordModal()
  const { loading, items, demoMessage, showDemoBanner, showEmptyState } = useCampaignsOverviewData(config)
  const [query, setQuery] = useState("")
  const [filters, setFilters] = useState(EMPTY_CAMPAIGN_FILTERS)
  const [view, setView] = useState<CampaignView>((config?.campaigns_default_view || "list") as CampaignView)

  const filteredItems = useMemo(() => filterCampaigns(items, filters, query), [items, filters, query])
  const kpiConfig = useMemo(() => campaignsKpiConfigFromBlock(config), [config])
  const kpis = useMemo(
    () => computeCampaignKpis(filteredItems, kpiConfig),
    [filteredItems, kpiConfig]
  )
  const groupBy = (config?.campaigns_group_by || "none") as CampaignGroupBy
  const groupedItems = useMemo(() => {
    if (groupBy === "none") return [{ label: "All campaigns", items: filteredItems }]
    const groups = new Map<string, CampaignOverviewItem[]>()
    filteredItems.forEach((item) => {
      const label = campaignGroupLabel(item, groupBy)
      const key = normalizeText(label) || "unassigned"
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(item)
    })
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, grouped]) => ({
        label: campaignGroupLabel(grouped[0], groupBy),
        items: grouped,
      }))
  }, [filteredItems, groupBy])

  useEffect(() => {
    setView((config?.campaigns_default_view || "list") as CampaignView)
  }, [config?.campaigns_default_view])

  const options = useMemo(() => {
    const uniq = (vals: string[]) => Array.from(new Set(vals.filter(Boolean))).sort((a, b) => a.localeCompare(b))
    return {
      status: uniq(items.map((i) => i.status || "")),
      stage: uniq(items.map((i) => i.stage || "")),
      type: uniq(items.map((i) => i.type || "")),
      division: uniq(items.map((i) => i.division || "")),
      owner: uniq(items.map((i) => i.owner || "")),
      priority: uniq(items.map((i) => i.priority || "")),
    }
  }, [items])

  const dense = config?.campaigns_density === "compact"
  const subtitle = campaignsOverviewSubtitle(config)
  const appearance = config?.appearance || {}
  const showTitle =
    (appearance.showTitle ?? (appearance as { show_title?: boolean }).show_title) !== false
  const clickAction =
    config?.campaigns_click_action ?? config?.click_action ?? "open_record"
  const updateFilter = (key: keyof CampaignOverviewFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }
  const openCampaignRecord = (item: CampaignOverviewItem) => {
    if (isEditing || clickAction === "none") return
    if (!item.recordTableId || !item.recordSupabaseTable) return
    openRecordModal({
      tableId: item.recordTableId,
      recordId: item.id,
      supabaseTableName: item.recordSupabaseTable,
      interfaceMode,
      recordLayoutType: "campaign",
    })
  }
  const dateGroupedItems = useMemo(() => {
    const monthLabel = (date: Date) =>
      date.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    const grouped = new Map<string, CampaignOverviewItem[]>()
    const noDate: CampaignOverviewItem[] = []

    for (const item of filteredItems) {
      const rawDate = item.startDate || item.endDate
      if (!rawDate) {
        noDate.push(item)
        continue
      }
      const parsed = new Date(rawDate)
      if (Number.isNaN(parsed.getTime())) {
        noDate.push(item)
        continue
      }
      const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(item)
    }

    const ordered = Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, list]) => ({
        key,
        label: monthLabel(new Date(`${key}-01`)),
        items: [...list].sort((a, b) => {
          const aDate = new Date(a.startDate || a.endDate || "").getTime()
          const bDate = new Date(b.startDate || b.endDate || "").getTime()
          return aDate - bDate
        }),
      }))

    if (noDate.length > 0) {
      ordered.push({ key: "no-date", label: "No scheduled date", items: noDate })
    }
    return ordered
  }, [filteredItems])

  const timelineItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      const aDate = new Date(a.startDate || a.endDate || "9999-12-31").getTime()
      const bDate = new Date(b.startDate || b.endDate || "9999-12-31").getTime()
      return aDate - bDate
    })
  }, [filteredItems])

  if (loading) {
    return (
      <div className="flex h-full min-h-[220px] items-center justify-center rounded-2xl border border-border/40 bg-background">
        <LoadingSpinner size="lg" text="Loading campaigns..." />
      </div>
    )
  }

  if (showEmptyState) {
    return (
      <div data-block-selectable className="flex h-full min-h-[240px] flex-col rounded-2xl border border-border/40 bg-background p-6">
        <h2 className="text-xl font-semibold text-foreground">{config?.title || "Campaigns"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        <div className="mt-4">
          <DashboardEmpty
            title="No Campaigns table connected"
            description="Select a Campaigns table in block settings, or enable demo data to preview this block."
            variant="default"
          />
        </div>
      </div>
    )
  }

  return (
    <div
      data-block-selectable
      className={marketingBlockRootClass(
        isFullPage,
        "rounded-2xl border border-border/40 bg-background shadow-sm"
      )}
    >
      {showDemoBanner ? <MarketingDemoDataBanner message={demoMessage} /> : null}
      <FilterResultsAnnouncer count={filteredItems.length} noun="campaigns" />
      <div className="shrink-0 border-b border-border/40 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          {showTitle ? (
            <div>
              <h2 className="text-xl font-semibold text-foreground">{config?.title || "Campaigns"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            </div>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            {config?.campaigns_show_search !== false ? (
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search campaigns..."
                  aria-label="Search campaigns"
                  className="h-8 w-[220px] pl-8"
                />
              </div>
            ) : null}
            <Button variant="outline" size="sm" className="h-8">
              <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
              Filters
            </Button>
            <Button size="sm" className="h-8">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New campaign
            </Button>
          </div>
        </div>
      </div>

      {config?.campaigns_show_kpis !== false ? (
        <div className="grid shrink-0 grid-cols-1 gap-3 border-b border-border/40 p-4 md:grid-cols-5">
          {[
            [kpis.labels.active, kpis.active, "border-emerald-200/60 bg-emerald-500/10"],
            [kpis.labels.planned, kpis.planned, "border-blue-200/60 bg-blue-500/10"],
            [kpis.labels.completed, kpis.completed, "border-violet-200/60 bg-violet-500/10"],
            [kpis.labels.contentItems, kpis.contentItems, "border-indigo-200/60 bg-indigo-500/10"],
            [kpis.labels.openTasks, kpis.openTasks, "border-amber-200/60 bg-amber-500/10"],
          ].map(([label, value, tone]) => (
            <div key={String(label)} className={cn("rounded-xl border p-3", String(tone))}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex shrink-0 items-start gap-3 border-b border-border/40 p-3">
        {config?.campaigns_show_filters !== false ? (
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1">
            {[
              ["Status", "status", options.status],
              ["Stage", "stage", options.stage],
              ["Type", "campaignType", options.type],
              ["Division", "division", options.division],
              ["Owner", "owner", options.owner],
              ["Priority", "priority", options.priority],
            ].map(([label, key, list]) => (
              <div key={String(key)} className="shrink-0">
                <Select
                  value={filters[key as keyof CampaignOverviewFilters]}
                  onValueChange={(value) =>
                    updateFilter(key as keyof CampaignOverviewFilters, value)
                  }
                >
                  <SelectTrigger className="h-8 w-[150px] rounded-md border border-border/50 bg-background px-2 text-xs">
                    <SelectValue placeholder={`${label}: All`} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{label}: All</SelectItem>
                    {(list as string[]).map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {(["list", "kanban", "calendar", "timeline"] as CampaignView[]).map((mode) => (
            <Button
              key={mode}
              variant={view === mode ? "default" : "outline"}
              size="sm"
              className="h-8 capitalize"
              onClick={() => setView(mode)}
            >
              {mode}
            </Button>
          ))}
        </div>
      </div>

      <div className={cn("min-h-0 flex-1 overflow-auto", marketingBlockScrollPanelClass(isFullPage))}>
        {view === "list" ? (
          groupedItems.map((group) => (
            <div key={group.label} className="border-b border-border/20">
              {groupBy !== "none" ? (
                <div className="sticky top-0 z-10 border-b border-border/30 bg-muted/20 px-4 py-2 text-xs font-medium text-muted-foreground">
                  {group.label} ({group.items.length})
                </div>
              ) : null}
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border/40 text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2">Campaign</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Division</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Priority</th>
                    <th className="px-3 py-2">Stage</th>
                    <th className="px-3 py-2">Dates</th>
                    <th className="px-3 py-2">Owner</th>
                    {config?.campaigns_show_progress !== false ? (
                      <th className="px-3 py-2">Progress</th>
                    ) : null}
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((item) => (
                    <tr
                      key={item.id}
                      className={cn(
                        "cursor-pointer border-b border-border/20 transition-colors even:bg-muted/[0.06] hover:bg-muted/30",
                        dense ? "h-10" : "h-14"
                      )}
                      onClick={() => openCampaignRecord(item)}
                    >
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          {config?.campaigns_show_thumbnails !== false ? (
                            <div className="h-8 w-10 rounded-md bg-muted/60" />
                          ) : null}
                          <div>
                            <p className="text-sm font-medium">{item.title}</p>
                            {item.needsAttention ? (
                              <p className="text-[11px] text-amber-700">Needs attention</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2"><CampaignValuePill value={item.type} /></td>
                      <td className="px-3 py-2"><CampaignValuePill value={item.division} /></td>
                      <td className="px-3 py-2"><CampaignValuePill value={item.status} /></td>
                      <td className="px-3 py-2"><CampaignValuePill value={item.priority} /></td>
                      <td className="px-3 py-2"><CampaignValuePill value={item.stage} /></td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {formatDateRange(item.startDate, item.endDate)}
                      </td>
                      <td className="px-3 py-2 text-xs">{item.owner || "-"}</td>
                      {config?.campaigns_show_progress !== false ? (
                        <td className="px-3 py-2"><ProgressPill value={item.progress} /></td>
                      ) : null}
                      <td className="px-3 py-2 text-right">
                        <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        ) : view === "kanban" ? (
          <div className="space-y-4 p-4">
            {groupedItems.map((group) => (
              <div key={group.label}>
                {groupBy !== "none" ? (
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {group.label} ({group.items.length})
                  </h3>
                ) : null}
                <div className="grid gap-3 md:grid-cols-3">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="cursor-pointer rounded-lg border border-border/40 bg-muted/10 p-3 hover:bg-muted/20"
                      onClick={() => openCampaignRecord(item)}
                    >
                      <p className="text-sm font-semibold">{item.title}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <CampaignValuePill value={item.status} />
                        <CampaignValuePill value={item.stage} />
                        <CampaignValuePill value={item.priority} />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Period: {formatDateRange(item.startDate, item.endDate)}
                      </p>
                      {config?.campaigns_show_progress !== false ? (
                        <div className="mt-2">
                          <ProgressPill value={item.progress} />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : view === "calendar" ? (
          <div className="space-y-4 p-4">
            {dateGroupedItems.map((group) => (
              <div key={group.key} className="rounded-xl border border-border/40 bg-muted/5">
                <div className="border-b border-border/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label} ({group.items.length})
                </div>
                <div className="grid gap-3 p-3 md:grid-cols-2">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="rounded-lg border border-border/40 bg-background p-3 text-left transition-colors hover:bg-muted/20"
                      onClick={() => openCampaignRecord(item)}
                    >
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDateRange(item.startDate, item.endDate)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <CampaignValuePill value={item.status} />
                        <CampaignValuePill value={item.stage} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3 p-4">
            {timelineItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="w-full rounded-lg border border-border/40 bg-background p-3 text-left transition-colors hover:bg-muted/20"
                onClick={() => openCampaignRecord(item)}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <span className="text-xs text-muted-foreground">
                    {formatDateRange(item.startDate, item.endDate)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <CampaignValuePill value={item.status} />
                  <CampaignValuePill value={item.priority} />
                  <CampaignValuePill value={item.owner} />
                </div>
              </button>
            ))}
            {timelineItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/50 p-6 text-center text-sm text-muted-foreground">
                No campaigns match the current filters.
              </div>
            ) : null}
          </div>
        )}
      </div>
      {/* TODO: later open dedicated Campaign Detail page or Campaign Workspace. */}
    </div>
  )
}
