"use client"

import { Calendar, Check, Globe, Users, ArrowRight } from "lucide-react"
import MetricCard from "@/components/interface/primitives/MetricCard"
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

export default function EventMetricStrip({
  upcoming,
  teamAttending,
  countries,
  thisMonth,
  className,
  onExport,
}: EventMetricStripProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-stretch gap-2 md:gap-3 pt-2 border-t border-border/30",
        className
      )}
    >
      <MetricCard label="Upcoming events" value={upcoming} accentIndex={0} className="flex-1 min-w-[120px]" />
      <MetricCard label="Team attending" value={teamAttending} accentIndex={1} className="flex-1 min-w-[120px]" />
      <MetricCard label="Countries" value={countries} accentIndex={2} className="flex-1 min-w-[100px]" />
      <MetricCard label="This month" value={thisMonth} accentIndex={3} className="flex-1 min-w-[100px]" />
      <div className="flex items-center ml-auto">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={onExport}
        >
          Export calendar
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
      <span className="sr-only">
        <Calendar aria-hidden /> <Users aria-hidden /> <Globe aria-hidden /> <Check aria-hidden />
      </span>
    </div>
  )
}
