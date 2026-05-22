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
import {
  DEFAULT_KPI_SUMMARY_CARDS,
  type KpiSummaryAccent,
  type KpiSummaryCardConfig,
  type KpiSummaryTrendDirection,
} from "@/lib/interface/kpi-summary-defaults"

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

function KpiCard({ card }: { card: KpiSummaryCardConfig }) {
  const Icon = resolveIcon(card.icon)
  const accent = ACCENT_STYLES[card.accent] ?? ACCENT_STYLES.purple

  return (
    <div className="flex min-h-[100px] flex-col rounded-xl border border-[#E6E6EF] bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {Icon ? (
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              accent.iconWrap
            )}
          >
            <Icon className={cn("h-4 w-4", accent.icon)} aria-hidden />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[#6B7280]">{card.label}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-[#111827]">
            {card.value}
          </p>
          <p className={cn("mt-1 text-xs font-medium", trendColor(card.trend_direction))}>
            {card.trend}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function KPISummaryBlock({ block }: KPISummaryBlockProps) {
  const cards =
    (block.config?.kpi_summary_cards?.length
      ? block.config.kpi_summary_cards
      : DEFAULT_KPI_SUMMARY_CARDS) as KpiSummaryCardConfig[]

  return (
    <div className="h-full min-h-0 w-full">
      <div className="grid h-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <KpiCard key={card.id} card={card} />
        ))}
      </div>
    </div>
  )
}
