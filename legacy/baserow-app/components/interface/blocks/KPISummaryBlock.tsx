"use client"

import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  Calendar,
  CalendarDays,
  Rocket,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { PageBlock } from "@/lib/interface/types"
import type {
  KpiSummaryAccent,
  KpiSummaryTrendDirection,
} from "@/lib/interface/kpi-summary-defaults"
import { useKpiSummaryData } from "@/hooks/useKpiSummaryData"

interface KPISummaryBlockProps {
  block: PageBlock
  isEditing?: boolean
}

const ICON_MAP: Record<string, LucideIcon> = {
  rocket: Rocket,
  calendar: Calendar,
  barchart: BarChart3,
  bar_chart: BarChart3,
  calendardays: CalendarDays,
  calendar_days: CalendarDays,
}

const ACCENT_STYLES: Record<
  KpiSummaryAccent,
  { iconWrap: string; icon: string }
> = {
  purple: {
    iconWrap: "bg-[#F3F0FF]",
    icon: "text-[#6D4AFF]",
  },
  blue: {
    iconWrap: "bg-[#EAF3FF]",
    icon: "text-blue-600",
  },
  red: {
    iconWrap: "bg-[#FFEAF2]",
    icon: "text-[#E5484D]",
  },
}

function resolveIcon(name: string): LucideIcon | null {
  const key = name.trim().toLowerCase().replace(/[\s-]+/g, "")
  return ICON_MAP[key] ?? null
}

function trendColor(direction: KpiSummaryTrendDirection): string {
  if (direction === "up") return "text-[#22A06B]"
  if (direction === "down") return "text-[#E5484D]"
  return "text-[#6B7280]"
}

function KpiCard({
  label,
  value,
  trend,
  trendDirection,
  icon,
  accent,
}: {
  label: string
  value: string
  trend: string
  trendDirection: KpiSummaryTrendDirection
  icon: string
  accent: KpiSummaryAccent
}) {
  const Icon = resolveIcon(icon)
  const accentStyle = ACCENT_STYLES[accent] ?? ACCENT_STYLES.purple

  return (
    <div className="flex min-h-[100px] flex-col rounded-xl border border-[#E6E6EF] bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {Icon ? (
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              accentStyle.iconWrap
            )}
          >
            <Icon className={cn("h-4 w-4", accentStyle.icon)} aria-hidden />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[#6B7280]">{label}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-[#111827]">{value}</p>
          {trend ? (
            <p className={cn("mt-1 text-xs font-medium", trendColor(trendDirection))}>
              {trend}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function KPISummaryBlock({ block, isEditing = false }: KPISummaryBlockProps) {
  const { loading, error, showDemoBanner, bannerMessage, cards } = useKpiSummaryData({
    config: block.config,
  })

  if (loading) {
    return (
      <div className="flex h-full min-h-[100px] items-center justify-center text-sm text-muted-foreground">
        <div className="text-center">
          <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-b-2 border-muted-foreground" />
          Loading metrics…
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2">
      {showDemoBanner ? (
        <p className="rounded-md border border-amber-200/80 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
          {bannerMessage}
        </p>
      ) : null}
      {!showDemoBanner && error && isEditing ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <div className="grid h-full min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <KpiCard
            key={card.id}
            label={card.label}
            value={card.value}
            trend={card.trend}
            trendDirection={card.trend_direction}
            icon={card.icon}
            accent={card.accent}
          />
        ))}
      </div>
    </div>
  )
}
