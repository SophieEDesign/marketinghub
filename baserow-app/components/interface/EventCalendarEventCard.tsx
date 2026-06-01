"use client"

import type { EventContentArg } from "@fullcalendar/core"
import { differenceInDays, startOfDay } from "date-fns"
import { cn } from "@/lib/utils"

function isMultiDayBlockEvent(arg: EventContentArg): boolean {
  if (!arg.view.type.includes("dayGrid") || !arg.event.allDay) return false
  const start = arg.event.start
  const end = arg.event.end
  if (!start || !end) return false
  return differenceInDays(startOfDay(end), startOfDay(start)) > 1
}

export function EventCalendarEventCard({ arg }: { arg: EventContentArg }) {
  const accent = (arg.event.extendedProps?.accentColor as string) || "#8B5CF6"
  const eventType = (arg.event.extendedProps?.eventType as string) || null
  const dateRangeLabel = (arg.event.extendedProps?.dateRangeLabel as string) || null
  const isDayGrid = arg.view.type.includes("dayGrid")
  const multiDay = isMultiDayBlockEvent(arg)

  if (isDayGrid && multiDay && !arg.isStart) {
    return (
      <div
        className="fc-event-calendar-continuation h-full min-h-[1.35rem] w-full rounded-none border-y border-border/40 bg-card/90"
        style={{ borderLeftWidth: 4, borderLeftColor: accent }}
        aria-hidden
      />
    )
  }

  return (
    <div
      className={cn(
        "fc-event-calendar-card group relative flex min-w-0 w-full cursor-pointer flex-col gap-0.5 overflow-hidden border border-border/50 bg-card px-2 py-1.5 shadow-sm transition-[box-shadow,background-color,border-color] hover:border-border hover:bg-muted/40 hover:shadow-md",
        isDayGrid && multiDay && arg.isStart && !arg.isEnd && "rounded-r-none",
        isDayGrid && multiDay && !arg.isStart && arg.isEnd && "rounded-l-none border-l-0 pl-1",
        isDayGrid && multiDay && arg.isStart && arg.isEnd && "rounded-lg",
        (!multiDay || !isDayGrid) && "rounded-lg"
      )}
      style={{ borderLeftWidth: multiDay && !arg.isStart ? 0 : 4, borderLeftColor: accent }}
    >
      <span
        className="pointer-events-none absolute inset-0 rounded-[inherit] bg-accent/0 transition-colors group-hover:bg-accent/[0.04]"
        aria-hidden
      />
      <span className="relative text-xs font-semibold leading-tight text-foreground line-clamp-2">
        {arg.event.title}
      </span>
      {isDayGrid && (multiDay ? arg.isStart : true) ? (
        <span className="relative text-[10px] leading-tight text-muted-foreground truncate">
          {dateRangeLabel || (arg.event.extendedProps?.locationLabel as string) || ""}
        </span>
      ) : null}
      {eventType && (multiDay ? arg.isStart : true) ? (
        <span className="relative inline-flex items-center gap-1 text-[10px] text-muted-foreground truncate">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: accent }}
            aria-hidden
          />
          {eventType}
        </span>
      ) : null}
    </div>
  )
}
