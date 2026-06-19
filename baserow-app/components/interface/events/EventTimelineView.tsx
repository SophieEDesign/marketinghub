"use client"

import { useMemo } from "react"
import { format } from "date-fns"
import DashboardEmpty from "@/components/interface/primitives/DashboardEmpty"
import type { MarketingEventItem } from "@/lib/marketing/events"
import { cn } from "@/lib/utils"

function monthKey(d: Date): string {
  return format(d, "yyyy-MM")
}

export function EventTimelineView({
  items,
  selectedId,
  onSelect,
  rangeStart: _rangeStart,
  fillContainer = false,
}: {
  items: MarketingEventItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  rangeStart: Date
  fillContainer?: boolean
}) {
  const withDates = useMemo(() => items.filter((i) => i.startDate), [items])

  const groups = useMemo(() => {
    const sorted = [...withDates].sort(
      (a, b) => (a.startDate?.getTime() ?? 0) - (b.startDate?.getTime() ?? 0)
    )
    const map = new Map<string, { label: string; items: MarketingEventItem[] }>()
    for (const item of sorted) {
      const d = item.startDate!
      const key = monthKey(d)
      const existing = map.get(key)
      if (existing) {
        existing.items.push(item)
      } else {
        map.set(key, { label: format(d, "MMMM yyyy"), items: [item] })
      }
    }
    return Array.from(map.values())
  }, [withDates])

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

  return (
    <div
      className={cn(
        "overflow-y-auto rounded-2xl border border-[#e4e7ec] bg-white px-5 py-4 md:px-6",
        fillContainer ? "min-h-0 h-full flex-1" : "min-h-[min(68vh,520px)]"
      )}
    >
      {groups.map((group) => (
        <section key={group.label} className="pt-4 first:pt-1">
          <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#005b8f]">
            {group.label}
          </h3>
          <div className="ml-1 border-l-2 border-[#e4e7ec] py-2 pl-5">
            <ul className="flex flex-col gap-3.5">
              {group.items.map((item) => (
                <li key={item.id} className="relative">
                  <span
                    className="absolute -left-[27px] top-1 h-[13px] w-[13px] rounded-full border-[3px] bg-white"
                    style={{ borderColor: item.accentColor }}
                    aria-hidden
                  />
                  <button
                    type="button"
                    onClick={() => onSelect(item.id)}
                    aria-label={`Open event: ${item.eventName}`}
                    className={cn(
                      "flex w-full items-center gap-3 text-left transition-opacity hover:opacity-90",
                      selectedId === item.id && "opacity-100"
                    )}
                  >
                    <span className="w-[70px] shrink-0 text-xs font-bold text-[#1f2a44]">
                      {item.startDate ? format(item.startDate, "d MMM") : "—"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[#1f2a44]">
                        {item.eventName}
                      </span>
                      <span className="mt-1 block text-[11.5px] font-medium text-[#9aa1ab]">
                        {[item.eventType, item.locationLabel].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}
    </div>
  )
}
