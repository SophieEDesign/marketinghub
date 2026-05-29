"use client"

import type { EventContentArg } from "@fullcalendar/core"
import { isSameDay, subDays } from "date-fns"

function eventsOnSameDay(arg: EventContentArg) {
  const start = arg.event.start
  if (!start) return []
  return arg.view.calendar.getEvents().filter((e) => {
    const s = e.start
    return s ? isSameDay(s, start) : false
  })
}

function isSingleDayAllDayEvent(arg: EventContentArg): boolean {
  if (!arg.event.allDay) return false
  const start = arg.event.start
  if (!start) return false
  if (!arg.event.end) return true
  const inclusiveEnd = subDays(arg.event.end, 1)
  return isSameDay(start, inclusiveEnd)
}

/** Compact "• 1 event" row for sparse single-day cells (matches marketing calendar mock). */
export function shouldShowCompactEventSummary(arg: EventContentArg): boolean {
  if (!arg.view.type.includes("dayGrid")) return false
  const sameDay = eventsOnSameDay(arg)
  if (sameDay.length !== 1) return false
  return isSingleDayAllDayEvent(arg)
}

export function EventCalendarEventCard({ arg }: { arg: EventContentArg }) {
  const accent = (arg.event.extendedProps?.accentColor as string) || "#8B5CF6"
  const eventType = (arg.event.extendedProps?.eventType as string) || null
  const dateRangeLabel = (arg.event.extendedProps?.dateRangeLabel as string) || null

  if (shouldShowCompactEventSummary(arg)) {
    return (
      <div className="fc-event-calendar-summary flex items-center gap-1.5 px-0.5 py-0.5 min-w-0">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: accent }}
          aria-hidden
        />
        <span className="text-[11px] font-medium text-accent-link truncate">1 event</span>
      </div>
    )
  }

  return (
    <div
      className="fc-event-calendar-card flex min-w-0 w-full flex-col gap-0.5 overflow-hidden rounded-lg border border-border/50 bg-card px-2 py-1.5 shadow-sm"
      style={{ borderLeftWidth: 4, borderLeftColor: accent }}
    >
      <span className="text-xs font-semibold leading-tight text-foreground line-clamp-2">
        {arg.event.title}
      </span>
      {dateRangeLabel && arg.view.type.includes("dayGrid") ? (
        <span className="text-[10px] leading-tight text-muted-foreground truncate">
          {dateRangeLabel}
        </span>
      ) : null}
      {eventType ? (
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground truncate">
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
