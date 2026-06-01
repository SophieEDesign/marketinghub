"use client"

import type { EventContentArg } from "@fullcalendar/core"

export function EventCalendarEventCard({ arg }: { arg: EventContentArg }) {
  const accent = (arg.event.extendedProps?.accentColor as string) || "#8B5CF6"
  const eventType = (arg.event.extendedProps?.eventType as string) || null
  const dateRangeLabel = (arg.event.extendedProps?.dateRangeLabel as string) || null

  return (
    <div
      className="fc-event-calendar-card group relative flex min-w-0 w-full cursor-pointer flex-col gap-0.5 overflow-hidden rounded-lg border border-border/50 bg-card px-2 py-1.5 shadow-sm transition-[box-shadow,background-color,border-color] hover:border-border hover:bg-muted/40 hover:shadow-md"
      style={{ borderLeftWidth: 4, borderLeftColor: accent }}
    >
      <span
        className="pointer-events-none absolute inset-0 rounded-lg bg-accent/0 transition-colors group-hover:bg-accent/[0.04]"
        aria-hidden
      />
      <span className="relative text-xs font-semibold leading-tight text-foreground line-clamp-2">
        {arg.event.title}
      </span>
      {arg.view.type.includes("dayGrid") ? (
        <span className="relative text-[10px] leading-tight text-muted-foreground truncate">
          {(arg.event.extendedProps?.locationLabel as string) || dateRangeLabel || ""}
        </span>
      ) : null}
      {eventType ? (
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
