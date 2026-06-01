"use client"

import { format, isSameMonth } from "date-fns"
import DashboardEmpty from "@/components/interface/primitives/DashboardEmpty"
import { EventAvatarStack } from "@/components/interface/events/EventAvatarStack"
import type { MarketingEventItem } from "@/lib/marketing/events"
import { statusAccentColor } from "@/lib/marketing/events"
import { cn } from "@/lib/utils"

export function EventListView({
  items,
  selectedId,
  onSelect,
  cursorDate,
  fillContainer = false,
}: {
  items: MarketingEventItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  cursorDate: Date
  fillContainer?: boolean
}) {
  const sorted = [...items].filter((i) => i.startDate).sort((a, b) => {
    const ta = a.startDate!.getTime()
    const tb = b.startDate!.getTime()
    return ta - tb
  })

  if (sorted.length === 0) {
    return (
      <DashboardEmpty
        title="No events match your filters"
        description="Try adjusting filters or add a new event."
        variant="compact"
        className="py-12"
      />
    )
  }

  const groups: { label: string; items: MarketingEventItem[] }[] = []
  for (const item of sorted) {
    const d = item.startDate!
    const label = isSameMonth(d, cursorDate)
      ? format(d, "EEEE d MMM")
      : format(d, "MMMM yyyy")
    const last = groups[groups.length - 1]
    if (last && last.label === label) {
      last.items.push(item)
    } else {
      groups.push({ label, items: [item] })
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 min-h-0 overflow-y-auto pr-1",
        fillContainer ? "h-full flex-1" : "max-h-[min(68vh,580px)]"
      )}
    >
      {groups.map((group) => (
        <section key={group.label}>
          <h3 className="text-xs font-semibold text-muted-foreground mb-2 sticky top-0 bg-background/90 py-1 backdrop-blur-sm z-[1]">
            {group.label}
          </h3>
          <ul className="flex flex-col gap-1.5">
            {group.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    "w-full text-left rounded-lg border px-3 py-2.5 transition-colors",
                    "hover:bg-muted/30",
                    selectedId === item.id
                      ? "border-accent-link/40 bg-muted/25 ring-1 ring-accent-link/20"
                      : "border-border/40 bg-card/50"
                  )}
                  style={{ borderLeftWidth: 3, borderLeftColor: item.accentColor }}
                >
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate text-foreground">{item.eventName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {item.dateRangeLabel}
                        {item.locationLabel ? ` · ${item.locationLabel}` : ""}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        {item.eventType ? (
                          <span
                            className="text-[10px] font-medium rounded px-1.5 py-px"
                            style={{
                              backgroundColor: item.backgroundColor,
                              color: item.accentColor,
                            }}
                          >
                            {item.eventType}
                          </span>
                        ) : null}
                        {item.status ? (
                          <span
                            className="text-[10px] font-medium rounded-full px-1.5 py-px"
                            style={{
                              backgroundColor: `${statusAccentColor(item.status)}22`,
                              color: statusAccentColor(item.status),
                            }}
                          >
                            {item.status}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <EventAvatarStack labels={item.attendeeLabels} className="shrink-0 mt-0.5" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
