"use client"

import { useMemo, type ReactNode } from "react"
import { format } from "date-fns"
import { ArrowUpRight, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import { useRecordModal } from "@/contexts/RecordModalContext"
import { useContentPlanningData } from "@/hooks/useContentPlanningData"
import { useThemeOverviewData } from "@/hooks/useThemeOverviewData"
import type { ContentPlanningItem } from "@/lib/marketing/content-planning"
import {
  buildMarketingHomeKpis,
  buildPipelineCounts,
  buildSocialSnapshot,
  enrichWeekStripWithItems,
  getUpcomingForHome,
  getWeekDayStrip,
  resolveHeroFromTheme,
} from "@/lib/marketing/marketing-home"
import { EditableDashboardRegion } from "@/components/interface/EditableDashboardRegion"
import DashboardPanel from "@/components/interface/primitives/DashboardPanel"
import DashboardEmpty from "@/components/interface/primitives/DashboardEmpty"
import MetricCard from "@/components/interface/primitives/MetricCard"
import { DASHBOARD_PAGE_GAP } from "@/lib/interface/spacing-tokens"
import { TEXT_LABEL, TEXT_PAGE_TITLE } from "@/lib/interface/typography-tokens"
import { cn } from "@/lib/utils"

interface MarketingHomeDashboardProps {
  canEdit?: boolean
}

const PIPELINE_STAGES = [
  { key: "ideas" as const, label: "Ideas" },
  { key: "drafting" as const, label: "Drafting" },
  { key: "review" as const, label: "Review" },
  { key: "scheduled" as const, label: "Scheduled" },
  { key: "published" as const, label: "Published" },
]

function StatusPill({ status, color }: { status: string | null; color?: string }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <span
      className="inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-muted/60 text-foreground/90 truncate"
      style={color ? { backgroundColor: `${color}22`, color } : undefined}
    >
      {status}
    </span>
  )
}

function UpcomingRow({
  item,
  onOpen,
}: {
  item: ContentPlanningItem
  onOpen: (id: string) => void
}) {
  const date = item.date ?? item.dueDate
  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      className="w-full flex items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-muted/50 transition-colors group"
    >
      <div
        className="w-0.5 self-stretch rounded-full shrink-0 mt-0.5 min-h-[2rem]"
        style={{ backgroundColor: item.accentColor }}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-snug break-words">{item.title}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
          <span className="text-xs text-muted-foreground">
            {date ? format(date, "d MMM yyyy") : "—"}
          </span>
          {item.contentType ? (
            <span className="text-xs text-muted-foreground/80">{item.contentType}</span>
          ) : null}
          <StatusPill status={item.status} color={item.accentColor} />
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground shrink-0 mt-1" />
    </button>
  )
}

export default function MarketingHomeDashboard({ canEdit: _canEdit = false }: MarketingHomeDashboardProps) {
  const { openRecordModal } = useRecordModal()
  const themeData = useThemeOverviewData()
  const contentData = useContentPlanningData()

  const loading = themeData.loading || contentData.loading
  const error = themeData.error || contentData.error

  const hero = useMemo(
    () => resolveHeroFromTheme(themeData.activeCard, themeData.selectedYear),
    [themeData.activeCard, themeData.selectedYear]
  )

  const kpis = useMemo(() => {
    if (!contentData.fields) {
      return { upcomingContent: 0, scheduledThisWeek: 0, overdueItems: 0, activeCampaigns: 0 }
    }
    return buildMarketingHomeKpis(
      contentData.allItems,
      contentData.campaignRows,
      contentData.fields.campaignStatus
    )
  }, [contentData.allItems, contentData.campaignRows, contentData.fields])

  const upcoming = useMemo(
    () => getUpcomingForHome(contentData.allItems, 5),
    [contentData.allItems]
  )

  const pipeline = useMemo(
    () => buildPipelineCounts(contentData.allItems),
    [contentData.allItems]
  )

  const social = useMemo(
    () => buildSocialSnapshot(contentData.allItems),
    [contentData.allItems]
  )

  const weekStrip = useMemo(
    () => enrichWeekStripWithItems(getWeekDayStrip(), contentData.allItems),
    [contentData.allItems]
  )

  const pipelineTotal = useMemo(
    () => Object.values(pipeline).reduce((a, b) => a + b, 0),
    [pipeline]
  )

  const openContent = (recordId: string) => {
    if (!contentData.tableIds) return
    openRecordModal({
      tableId: contentData.tableIds.contentTableId,
      recordId,
      supabaseTableName: contentData.tableIds.contentSupabaseTable,
      onRecordUpdated: contentData.reload,
      onDeleted: contentData.reload,
    })
  }

  const openTheme = () => {
    if (!themeData.tableIds || !themeData.activeCard) return
    openRecordModal({
      tableId: themeData.tableIds.quarterlyThemesTableId,
      recordId: themeData.activeCard.id,
      supabaseTableName: themeData.tableIds.quarterlyThemesSupabaseTable,
      onRecordUpdated: themeData.reload,
      onDeleted: themeData.reload,
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" text="Loading marketing overview…" />
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

  const accentColor = themeData.activeCard?.accentColor ?? "#6366f1"

  return (
    <div className={cn("flex flex-col min-w-0 pb-2", DASHBOARD_PAGE_GAP)}>
      <EditableDashboardRegion id="hero-quarter" label="Current quarter">
      <DashboardPanel
        elevated
        accentColor={accentColor}
        accentPosition="top"
        className="accent-tint-wash overflow-hidden"
        bodyClassName="px-3 py-3 sm:px-4 sm:py-4"
      >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={TEXT_LABEL}>Current quarter</p>
              <h1 className={cn(TEXT_PAGE_TITLE, "mt-0.5")}>{hero.quarterYear}</h1>
            </div>
            {themeData.activeCard ? (
              <Badge
                variant="secondary"
                className="shrink-0 text-xs font-medium"
                style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
              >
                Active theme
              </Badge>
            ) : null}
          </div>

          <button
            type="button"
            onClick={openTheme}
            disabled={!themeData.activeCard}
            className={cn(
              "mt-3 text-left w-full rounded-md transition-colors",
              themeData.activeCard && "hover:bg-muted/30 -mx-1 px-1 py-1"
            )}
          >
            <p className="text-lg font-semibold text-foreground leading-snug break-words">
              {hero.themeLabel}
            </p>
            {hero.coreFocus && hero.coreFocus !== hero.themeLabel ? (
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed break-words">
                <span className="font-medium text-foreground/80">Core focus · </span>
                {hero.coreFocus}
              </p>
            ) : null}
            {hero.messaging ? (
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed whitespace-pre-wrap break-words">
                {hero.messaging}
              </p>
            ) : null}
          </button>

          {hero.prompts.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1.5">
              {hero.prompts.slice(0, 3).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => openContent(p.id)}
                    className="text-sm text-left text-foreground/85 hover:text-accent-link flex items-start gap-2 w-full break-words"
                  >
                    <span className="text-muted-foreground mt-0.5">→</span>
                    <span>{p.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
      </DashboardPanel>
      </EditableDashboardRegion>

      <EditableDashboardRegion id="kpi-row" label="Key metrics">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Upcoming content" value={kpis.upcomingContent} accentIndex={0} />
        <MetricCard label="Scheduled this week" value={kpis.scheduledThisWeek} accentIndex={1} />
        <MetricCard
          label="Overdue items"
          value={kpis.overdueItems}
          accentIndex={2}
          hint={kpis.overdueItems > 0 ? "Needs attention" : undefined}
        />
        <MetricCard label="Active campaigns" value={kpis.activeCampaigns} accentIndex={3} />
      </div>
      </EditableDashboardRegion>

      <EditableDashboardRegion id="upcoming-content" label="Upcoming content">
        <DashboardPanel
          title="Upcoming content"
          subtitle="Next scheduled across all types"
          scrollBody
          maxBodyHeight="max-h-[min(280px,40vh)]"
          bodyClassName="px-2 py-1.5"
        >
          {upcoming.length === 0 ? (
            <DashboardEmpty variant="inline" title="Nothing scheduled ahead." className="px-2 py-3" />
          ) : (
            <ul className="divide-y divide-border/25">
              {upcoming.map((item) => (
                <li key={item.id}>
                  <UpcomingRow item={item} onOpen={openContent} />
                </li>
              ))}
            </ul>
          )}
        </DashboardPanel>
      </EditableDashboardRegion>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
        <EditableDashboardRegion id="social-snapshot" label="Social media snapshot">
        <DashboardPanel
          title="Social media snapshot"
          subtitle="Operational posting cadence"
          bodyClassName="px-3 py-3"
        >
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="rounded-md bg-muted/35 px-2.5 py-2 text-center">
              <p className="text-lg font-semibold tabular-nums">{social.scheduledThisWeek}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
                This week
              </p>
            </div>
            <div className="rounded-md bg-muted/35 px-2.5 py-2 text-center">
              <p className="text-lg font-semibold tabular-nums">{social.scheduledThisMonth}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
                This month
              </p>
            </div>
            <div className="rounded-md bg-muted/35 px-2.5 py-2 text-center">
              <p
                className={cn(
                  "text-lg font-semibold tabular-nums",
                  social.overduePosts > 0 && "text-amber-700 dark:text-amber-400"
                )}
              >
                {social.overduePosts}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
                Overdue
              </p>
            </div>
          </div>
          {social.gapHint ? (
            <p className="text-xs text-amber-700/90 dark:text-amber-400/90 mb-2">{social.gapHint}</p>
          ) : null}
          <div className="flex gap-1 justify-between">
            {weekStrip.map((day) => (
              <div
                key={day.label}
                className={cn(
                  "flex-1 rounded-md border px-0.5 py-1.5 text-center min-w-0",
                  day.hasContent
                    ? "border-sky-500/40 bg-sky-500/10"
                    : "border-border/40 bg-muted/20"
                )}
              >
                <p className="text-[10px] text-muted-foreground truncate">{day.label}</p>
                <p className="text-xs font-medium tabular-nums">{day.date}</p>
              </div>
            ))}
          </div>
        </DashboardPanel>
        </EditableDashboardRegion>

        <EditableDashboardRegion id="content-pipeline" label="Content pipeline">
        <DashboardPanel
          title="Content pipeline"
          subtitle={`${pipelineTotal} items across workflow stages`}
          bodyClassName="px-3 py-3"
        >
          <div className="flex flex-wrap gap-2">
            {PIPELINE_STAGES.map((stage) => {
              const count = pipeline[stage.key]
              const pct = pipelineTotal > 0 ? Math.round((count / pipelineTotal) * 100) : 0
              return (
                <div
                  key={stage.key}
                  className="flex-1 min-w-[88px] max-w-[140px] rounded-md border border-border/50 bg-muted/20 px-2.5 py-2"
                >
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground truncate">
                    {stage.label}
                  </p>
                  <p className="text-xl font-semibold tabular-nums mt-0.5">{count}</p>
                  <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent-link/70"
                      style={{ width: `${Math.max(pct, count > 0 ? 8 : 0)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </DashboardPanel>
        </EditableDashboardRegion>
      </div>
    </div>
  )
}
