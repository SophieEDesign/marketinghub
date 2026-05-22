"use client"

import { addMonths, differenceInDays, format, startOfMonth } from "date-fns"
import DashboardEmpty from "@/components/interface/primitives/DashboardEmpty"
import type { MarketingEventItem } from "@/lib/marketing/events"
import { cn } from "@/lib/utils"

export function EventTimelineView({
  items,
  selectedId,
  onSelect,
  rangeStart,
}: {
  items: MarketingEventItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  rangeStart: Date
}) {
  const withDates = items.filter((i) => i.startDate)
  if (withDates.length === 0) {
    return (
      <DashboardEmpty
        title="No events in timeline"
        description="Events with dates appear on the timeline."
        variant="compact"
        className="py-12"
      />
    )
  }

  const months = [0, 1, 2, 3, 4, 5].map((i) => startOfMonth(addMonths(rangeStart, i)))
  const timelineStart = months[0]
  const timelineEnd = addMonths(months[months.length - 1], 1)
  const totalDays = Math.max(differenceInDays(timelineEnd, timelineStart), 1)

  function barStyle(item: MarketingEventItem): { left: string; width: string } | null {
    if (!item.startDate) return null
    const end = item.endDate ?? item.startDate
    const startOff = Math.max(0, differenceInDays(item.startDate, timelineStart))
    const endOff = Math.min(totalDays, differenceInDays(addMonths(end, 0), timelineStart) + 1)
    const widthDays = Math.max(endOff - startOff, 1)
    return {
      left: `${(startOff / totalDays) * 100}%`,
      width: `${(widthDays / totalDays) * 100}%`,
    }
  }

  return (
    <div className="min-h-[min(68vh,520px)] overflow-x-auto overflow-y-auto pr-1">
      <div className="min-w-[640px]">
        <div className="flex border-b border-border/40 pb-2 mb-3">
          {months.map((m) => (
            <div
              key={m.toISOString()}
              className="flex-1 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wide"
            >
              {format(m, "MMM yyyy")}
            </div>
          ))}
        </div>
        <ul className="flex flex-col gap-2">
          {withDates.map((item) => {
            const pos = barStyle(item)
            if (!pos) return null
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    "w-full text-left rounded-lg border border-border/30 px-2 py-2 hover:bg-muted/20 transition-colors",
                    selectedId === item.id && "ring-1 ring-accent-link/30 bg-muted/15"
                  )}
                >
                  <div className="flex items-center gap-3 mb-1.5 min-w-0">
                    <span className="text-xs font-medium truncate flex-1">{item.eventName}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{item.dateRangeLabel}</span>
                  </div>
                  <div className="relative h-6 rounded-md bg-muted/25 overflow-hidden">
                    <span
                      className="absolute top-0 bottom-0 rounded-md opacity-90"
                      style={{
                        ...pos,
                        backgroundColor: item.backgroundColor,
                        borderLeft: `3px solid ${item.accentColor}`,
                      }}
                    />
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
