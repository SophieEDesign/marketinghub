"use client"

import type { EventContentArg } from "@fullcalendar/core"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export function EventCalendarEventCard({ arg }: { arg: EventContentArg }) {
  const accent = (arg.event.extendedProps?.accentColor as string) || "#005b8f"
  const isAttending = Boolean(arg.event.extendedProps?.currentUserAttending)
  const isDayGrid = arg.view.type.includes("dayGrid")
  const isContinuation = isDayGrid && !arg.isStart

  if (isContinuation) {
    return (
      <div
        className="fc-event-calendar-continuation h-[23px] min-h-[23px] w-full rounded-none border border-[#edf0f4] border-l-[3px] bg-white"
        style={{ borderLeftColor: accent }}
        aria-hidden
      />
    )
  }

  return (
    <div
      className={cn(
        "fc-event-calendar-card group flex h-[23px] min-h-[23px] w-full min-w-0 cursor-pointer items-center gap-1 overflow-hidden rounded-md border border-[#edf0f4] border-l-[3px] bg-white px-1.5 transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(31,42,68,0.12)]",
        isDayGrid && arg.isStart && !arg.isEnd && "rounded-r-none",
        isDayGrid && !arg.isStart && arg.isEnd && "rounded-l-none border-l-0 pl-1"
      )}
      style={{ borderLeftColor: accent }}
    >
      <span className="min-w-0 flex-1 truncate text-[10.5px] font-semibold leading-none text-[#2c3340]">
        {arg.event.title}
      </span>
      {isAttending ? (
        <Check className="h-3 w-3 shrink-0 text-[#1b7a52]" strokeWidth={2.5} aria-hidden />
      ) : null}
    </div>
  )
}
