"use client"

import { Calendar, Check, Globe, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface EventMetricStripProps {
  upcoming: number
  teamAttending: number
  countries: number
  thisMonth: number
  className?: string
  onExport?: () => void
}

const METRIC_CARDS = [
  {
    key: "upcoming",
    label: "Upcoming",
    icon: Calendar,
    tint: "bg-[#e8f1f7] text-[#005b8f]",
  },
  {
    key: "attending",
    label: "You're attending",
    icon: Check,
    tint: "bg-[#e7f3ee] text-[#1b7a52]",
  },
  {
    key: "countries",
    label: "Countries",
    icon: Globe,
    tint: "bg-[#f7f1e6] text-[#b08d52]",
  },
  {
    key: "month",
    label: "This month",
    icon: Calendar,
    tint: "bg-[#e3f0fa] text-[#007dc5]",
  },
] as const

export default function EventMetricStrip({
  upcoming,
  teamAttending,
  countries,
  thisMonth,
  className,
  onExport,
}: EventMetricStripProps) {
  const values: Record<(typeof METRIC_CARDS)[number]["key"], number> = {
    upcoming,
    attending: teamAttending,
    countries,
    month: thisMonth,
  }

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2 xl:grid-cols-4",
        className
      )}
    >
      {METRIC_CARDS.map(({ key, label, icon: Icon, tint }) => (
        <div
          key={key}
          className="flex items-center gap-3 rounded-[14px] border border-[#e4e7ec] bg-white px-[17px] py-[15px] shadow-[0_1px_2px_rgba(31,42,68,0.04)]"
        >
          <div
            className={cn(
              "flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[11px]",
              tint
            )}
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[22px] font-bold tabular-nums leading-none text-[#1f2a44]">
              {values[key]}
            </p>
            <p className="mt-1.5 text-[11.5px] font-medium text-[#9aa1ab]">{label}</p>
          </div>
        </div>
      ))}
      {onExport ? (
        <div className="flex items-center justify-end sm:col-span-2 xl:col-span-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 border-[#d4d7dc] bg-white text-xs font-semibold text-[#1f2a44] hover:bg-[#fafbfc]"
            onClick={onExport}
          >
            Export calendar
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      ) : null}
    </div>
  )
}
