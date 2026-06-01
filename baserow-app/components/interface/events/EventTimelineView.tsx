"use client"

import { useMemo } from "react"
import { format } from "date-fns"
import DashboardEmpty from "@/components/interface/primitives/DashboardEmpty"
import {
  buildEventTimelineRange,
  getEventTimelineTodayPct,
  positionEventOnTimeline,
  type MarketingEventItem,
} from "@/lib/marketing/events"
import { cn } from "@/lib/utils"

const LABEL_COL_WIDTH = 200
const ROW_HEIGHT = 44
const MIN_TRACK_WIDTH = 720

export function EventTimelineView({
  items,
  selectedId,
  onSelect,
  rangeStart,
  fillContainer = false,
}: {
  items: MarketingEventItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  rangeStart: Date
  fillContainer?: boolean
}) {
  const withDates = useMemo(() => items.filter((i) => i.startDate), [items])

  const timeline = useMemo(
    () => buildEventTimelineRange(withDates, rangeStart),
    [withDates, rangeStart]
  )

  const todayPct = useMemo(() => getEventTimelineTodayPct(timeline), [timeline])

  const rows = useMemo(() => {
    return withDates
      .map((item) => ({
        item,
        position: positionEventOnTimeline(item, timeline),
      }))
      .filter((r): r is { item: MarketingEventItem; position: NonNullable<typeof r.position> } =>
        Boolean(r.position)
      )
  }, [withDates, timeline])

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

  if (rows.length === 0) {
    return (
      <DashboardEmpty
        title="No events in this period"
        description="Try adjusting filters or navigating to months that include your events."
        variant="compact"
        className="py-12"
      />
    )
  }

  return (
    <div
      className={cn(
        "overflow-auto",
        fillContainer ? "min-h-0 h-full flex-1" : "min-h-[min(68vh,520px)]"
      )}
    >
      <div
        className="relative"
        style={{ minWidth: `min(100%, ${LABEL_COL_WIDTH + MIN_TRACK_WIDTH}px)` }}
      >
        {/* Month header */}
        <div className="sticky top-0 z-20 flex border-b border-border/50 bg-background/95 backdrop-blur-sm">
          <div
            className="sticky left-0 z-30 shrink-0 border-r border-border/40 bg-background/95 px-3 py-2"
            style={{ width: LABEL_COL_WIDTH }}
          >
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Event
            </span>
          </div>
          <div className="relative flex flex-1">
            {timeline.months.map((m) => (
              <div
                key={m.toISOString()}
                className="flex-1 min-w-[52px] border-r border-border/30 px-1 py-2 text-center"
              >
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {format(m, "MMM yyyy")}
                </div>
              </div>
            ))}
            {todayPct != null ? (
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-10 border-l-2 border-dashed border-accent-link/70"
                style={{ left: `${todayPct}%` }}
                aria-hidden
              />
            ) : null}
          </div>
        </div>

        {/* Event rows */}
        {rows.map(({ item, position }) => (
          <div
            key={item.id}
            className="flex border-b border-border/30 hover:bg-muted/10"
            style={{ minHeight: ROW_HEIGHT }}
          >
            <div
              className="sticky left-0 z-10 flex shrink-0 items-center border-r border-border/40 bg-background/95 px-3"
              style={{ width: LABEL_COL_WIDTH }}
            >
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                className={cn(
                  "min-w-0 text-left text-xs font-medium text-foreground truncate hover:text-accent-link",
                  selectedId === item.id && "text-accent-link"
                )}
              >
                {item.eventName}
              </button>
            </div>
            <div className="relative flex flex-1" style={{ minHeight: ROW_HEIGHT }}>
              {timeline.months.map((m) => (
                <div
                  key={m.toISOString()}
                  className="flex-1 min-w-[52px] border-r border-border/15"
                  aria-hidden
                />
              ))}
              {todayPct != null ? (
                <div
                  className="pointer-events-none absolute top-0 bottom-0 z-[1] border-l-2 border-dashed border-accent-link/50"
                  style={{ left: `${todayPct}%` }}
                  aria-hidden
                />
              ) : null}
              <button
                type="button"
                title={`${item.eventName}\n${item.dateRangeLabel}`}
                onClick={() => onSelect(item.id)}
                className={cn(
                  "absolute top-1/2 z-[2] flex h-7 -translate-y-1/2 items-center overflow-hidden rounded-md border px-2 text-left text-[10px] font-medium shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-link",
                  selectedId === item.id && "ring-2 ring-accent-link ring-offset-1"
                )}
                style={{
                  left: `${position.leftPct}%`,
                  width: `${position.widthPct}%`,
                  minWidth: position.isSingleDay ? 56 : 72,
                  maxWidth: position.isSingleDay ? 120 : undefined,
                  backgroundColor: item.backgroundColor,
                  borderColor: item.accentColor,
                  color: item.accentColor,
                }}
              >
                <span
                  className="absolute inset-y-0 left-0 w-1 rounded-l-md"
                  style={{ backgroundColor: item.accentColor }}
                  aria-hidden
                />
                <span className="relative truncate pl-1.5">{item.dateRangeLabel}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
