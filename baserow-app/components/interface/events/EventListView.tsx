"use client"

import { format, isSameMonth } from "date-fns"
import { Calendar, Check, MapPin } from "lucide-react"
import DashboardEmpty from "@/components/interface/primitives/DashboardEmpty"
import { EventAvatarStack } from "@/components/interface/events/EventAvatarStack"
import type { MarketingEventItem } from "@/lib/marketing/events"
import { accentBackground } from "@/lib/marketing/events"
import { cn } from "@/lib/utils"

function attendancePill(item: MarketingEventItem) {
  if (item.currentUserAttending) {
    return {
      label: "Attending",
      className: "border-[#bfe3cf] bg-[#e7f3ee] text-[#1b7a52]",
      icon: Check,
    }
  }
  return {
    label: "Not attending",
    className: "border-[#e2e5ea] bg-[#f3f4f6] text-[#9aa1ab]",
    icon: null,
  }
}

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
        "flex flex-col gap-6 min-h-0 overflow-y-auto p-3 md:p-4",
        fillContainer ? "h-full flex-1" : "max-h-[min(68vh,580px)]"
      )}
    >
      {groups.map((group) => (
        <section key={group.label}>
          <div className="mb-3 flex items-center gap-2.5">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#9aa1ab]">
              {group.label}
            </h3>
            <span className="h-px flex-1 bg-[#e4e7ec]" aria-hidden />
            <span className="text-[11px] font-semibold text-[#c0c5cd]">{group.items.length}</span>
          </div>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-3.5">
            {group.items.map((item) => {
              const att = attendancePill(item)
              const AttIcon = att.icon
              const typeBg = accentBackground(item.accentColor)
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(item.id)}
                    aria-label={`Open event: ${item.eventName}`}
                    className={cn(
                      "group relative flex w-full gap-3.5 overflow-hidden rounded-[15px] border border-[#e4e7ec] bg-white py-[15px] pl-[17px] pr-4 text-left shadow-[0_1px_2px_rgba(31,42,68,0.04)] transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-[#d7dce3] hover:shadow-[0_14px_30px_rgba(31,42,68,0.13)]",
                      selectedId === item.id && "ring-2 ring-[#005b8f]/25 border-[#cfe2ee]"
                    )}
                  >
                    <span
                      className="absolute inset-y-0 left-0 w-1"
                      style={{ backgroundColor: item.accentColor }}
                      aria-hidden
                    />
                    <div className="w-[54px] shrink-0 self-start overflow-hidden rounded-xl border border-[#eef1f4] text-center">
                      <div
                        className="px-1 py-1.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-white"
                        style={{ backgroundColor: item.accentColor }}
                      >
                        {item.startDate ? format(item.startDate, "MMM") : "—"}
                      </div>
                      <div className="bg-white py-1.5 text-xl font-bold leading-none text-[#1f2a44]">
                        {item.startDate ? format(item.startDate, "d") : "—"}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[14.5px] font-semibold leading-snug tracking-tight text-[#1f2a44]">
                          {item.eventName}
                        </p>
                        {item.eventType ? (
                          <span
                            className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold whitespace-nowrap"
                            style={{
                              backgroundColor: typeBg,
                              borderColor: `${item.accentColor}33`,
                              color: item.accentColor,
                            }}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: item.accentColor }}
                              aria-hidden
                            />
                            {item.eventType}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11.5px] font-medium text-[#9aa1ab]">
                        {item.locationLabel ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                            {item.locationLabel}
                          </span>
                        ) : null}
                        {item.locationLabel && item.dateRangeLabel ? (
                          <span className="h-[3px] w-[3px] rounded-full bg-[#cdd2da]" aria-hidden />
                        ) : null}
                        {item.dateRangeLabel ? (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3 shrink-0" aria-hidden />
                            {item.dateRangeLabel}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <EventAvatarStack labels={item.attendeeLabels} max={3} />
                          {item.attendeeCount > 0 ? (
                            <span className="text-[11px] font-medium text-[#9aa1ab]">
                              {item.attendeeCount} attending
                            </span>
                          ) : null}
                        </div>
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                            att.className
                          )}
                        >
                          {AttIcon ? <AttIcon className="h-3 w-3" aria-hidden /> : null}
                          {att.label}
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
