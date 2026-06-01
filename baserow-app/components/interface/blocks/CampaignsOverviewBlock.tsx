"use client"

import { useMemo, useState } from "react"
import { Search, SlidersHorizontal, Plus, MoreHorizontal } from "lucide-react"
import type { PageBlock } from "@/lib/interface/types"
import { useCampaignsOverviewData } from "@/hooks/useCampaignsOverviewData"
import {
  EMPTY_CAMPAIGN_FILTERS,
  computeCampaignKpis,
  filterCampaigns,
  formatDateRange,
  type CampaignOverviewFilters,
} from "@/lib/marketing/campaigns-overview"
import { campaignsOverviewSubtitle } from "@/lib/marketing/campaigns-overview-config"
import { useRecordModal } from "@/contexts/RecordModalContext"
import MarketingDemoDataBanner from "@/components/interface/primitives/MarketingDemoDataBanner"
import DashboardEmpty from "@/components/interface/primitives/DashboardEmpty"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { marketingBlockRootClass } from "@/lib/interface/marketing-block-layout"
import { resolveBlockUsesFullPageLayout } from "@/lib/interface/full-page-layout"

interface CampaignsOverviewBlockProps {
  block: PageBlock
  isEditing?: boolean
  isFullPage?: boolean
}

function Badge({ value }: { value?: string }) {
  if (!value) return <span className="text-xs text-muted-foreground">-</span>
  return <span className="rounded-full border border-border/50 px-2 py-0.5 text-xs">{value}</span>
}

function ProgressPill({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-xs text-muted-foreground">-</span>
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 text-xs text-muted-foreground">{value}%</span>
      <div className="h-1.5 w-20 rounded-full bg-muted">
        <div className="h-full rounded-full bg-blue-500" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

export default function CampaignsOverviewBlock({
  block,
  isEditing = false,
  isFullPage = false,
}: CampaignsOverviewBlockProps) {
  const { config } = block
  const { openRecordModal } = useRecordModal()
  const { loading, items, demoMessage, showDemoBanner, showEmptyState } = useCampaignsOverviewData(config)
  const [query, setQuery] = useState("")
  const [filters, setFilters] = useState(EMPTY_CAMPAIGN_FILTERS)
  const [view, setView] = useState(config?.campaigns_default_view || "list")

  const filteredItems = useMemo(() => filterCampaigns(items, filters, query), [items, filters, query])
  const kpis = useMemo(() => computeCampaignKpis(filteredItems), [filteredItems])

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

  const useFullPage = resolveBlockUsesFullPageLayout(block, isFullPage)
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
        useFullPage,
        "rounded-2xl border border-border/40 bg-background shadow-sm"
      )}
    >
      {showDemoBanner ? <MarketingDemoDataBanner message={demoMessage} /> : null}
      <div className="border-b border-border/40 px-5 py-4">
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
        <div className="grid grid-cols-1 gap-3 border-b border-border/40 p-4 md:grid-cols-5">
          {[
            ["Active campaigns", kpis.active],
            ["Planned campaigns", kpis.planned],
            ["Completed campaigns", kpis.completed],
            ["Content items", kpis.contentItems],
            ["Open tasks", kpis.openTasks],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-border/40 bg-muted/10 p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {config?.campaigns_show_filters !== false ? (
        <div className="flex flex-wrap gap-2 border-b border-border/40 p-3">
          {[
            ["Status", "status", options.status],
            ["Stage", "stage", options.stage],
            ["Type", "campaignType", options.type],
            ["Division", "division", options.division],
            ["Owner", "owner", options.owner],
            ["Priority", "priority", options.priority],
          ].map(([label, key, list]) => (
            <select
              key={String(key)}
              className="h-8 rounded-md border border-border/50 bg-background px-2 text-xs"
              value={filters[key as keyof CampaignOverviewFilters]}
              onChange={(e) => updateFilter(key as keyof CampaignOverviewFilters, e.target.value)}
            >
              <option value="all">{label}: All</option>
              {(list as string[]).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          ))}
          <div className="ml-auto flex items-center gap-2">
            {["list", "kanban", "calendar", "timeline"].map((mode) => {
              const supported = mode === "list"
              return (
                <Button
                  key={mode}
                  variant={view === mode ? "default" : "outline"}
                  size="sm"
                  className="h-8 capitalize"
                  onClick={() => supported && setView(mode)}
                  disabled={!supported}
                  title={!supported ? "Coming soon" : ""}
                >
                  {mode}
                </Button>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
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
              {config?.campaigns_show_progress !== false ? <th className="px-3 py-2">Progress</th> : null}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr
                key={item.id}
                className={cn(
                  "cursor-pointer border-b border-border/20 hover:bg-muted/20",
                  dense ? "h-10" : "h-14"
                )}
                onClick={() => {
                  if (isEditing || clickAction === "none") return
                  if (!item.recordTableId || !item.recordSupabaseTable) return
                  openRecordModal({
                    tableId: item.recordTableId,
                    recordId: item.id,
                    supabaseTableName: item.recordSupabaseTable,
                  })
                }}
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
                <td className="px-3 py-2"><Badge value={item.type} /></td>
                <td className="px-3 py-2"><Badge value={item.division} /></td>
                <td className="px-3 py-2"><Badge value={item.status} /></td>
                <td className="px-3 py-2"><Badge value={item.priority} /></td>
                <td className="px-3 py-2"><Badge value={item.stage} /></td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{formatDateRange(item.startDate, item.endDate)}</td>
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
      {/* TODO: later open dedicated Campaign Detail page or Campaign Workspace. */}
    </div>
  )
}
