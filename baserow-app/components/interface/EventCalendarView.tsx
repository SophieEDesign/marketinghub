"use client"

import { useCallback, useMemo } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import interactionPlugin from "@fullcalendar/interaction"
import type { EventClickArg, EventContentArg, EventMountArg, EventInput } from "@fullcalendar/core"
import { mountCalendarEventKeyboard } from "@/lib/a11y/calendar-event-keyboard"
import { EventListView } from "@/components/interface/events/EventListView"
import { EventTimelineView } from "@/components/interface/events/EventTimelineView"
import { EventCalendarEventCard } from "@/components/interface/EventCalendarEventCard"
import {
  type EventCalendarEvent,
  type EventCalendarViewMode,
} from "@/lib/marketing/events"
import { cn } from "@/lib/utils"

const CALENDAR_PLUGINS = [dayGridPlugin, timeGridPlugin, interactionPlugin]

function viewModeToInitial(viewMode: EventCalendarViewMode): string {
  if (viewMode === "week") return "timeGridWeek"
  return "dayGridMonth"
}

function dayCellClassNames(arg: { date: Date }) {
  return arg.date.getDay() === 0 ? ["fc-day-sunday"] : []
}

interface EventCalendarViewProps {
  events: EventCalendarEvent[]
  items: import("@/lib/marketing/events").MarketingEventItem[]
  viewMode: EventCalendarViewMode
  cursorDate: Date
  selectedId: string | null
  onEventClick?: (id: string) => void
  onDatesChange?: (date: Date) => void
  className?: string
  compact?: boolean
  isEditing?: boolean
  /** Full-page: fill parent and scroll inside instead of fixed viewport min-heights. */
  fillContainer?: boolean
}

export default function EventCalendarView({
  events,
  items,
  viewMode,
  cursorDate,
  selectedId,
  onEventClick,
  onDatesChange,
  className,
  compact = false,
  isEditing = false,
  fillContainer = false,
}: EventCalendarViewProps) {
  const panelMinH = fillContainer
    ? "min-h-0 flex-1 overflow-y-auto"
    : compact
      ? "min-h-[420px]"
      : "min-h-[min(72vh,620px)]"

  const fcEvents: EventInput[] = useMemo(
    () =>
      events.map((e) => {
        const input: EventInput = {
          id: e.id,
          title: e.title,
          start: e.start,
          allDay: e.allDay,
          display: e.display,
          backgroundColor: "transparent",
          borderColor: "transparent",
          extendedProps: e.extendedProps,
        }
        if (e.end) input.end = e.end
        return input
      }),
    [events]
  )

  const handleEventClick = useCallback(
    (arg: EventClickArg) => {
      if (onEventClick && arg.event.id) onEventClick(String(arg.event.id))
    },
    [onEventClick]
  )

  const eventContent = useCallback(
    (arg: EventContentArg) => <EventCalendarEventCard arg={arg} />,
    []
  )

  const handleEventDidMount = useCallback(
    (arg: EventMountArg) => {
      if (!onEventClick || !arg.event.id) return
      mountCalendarEventKeyboard(arg.el, arg.event.title || "Event", () =>
        onEventClick(String(arg.event.id))
      )
    },
    [onEventClick]
  )

  if (viewMode === "list") {
    return (
      <div className={cn("overflow-hidden flex-1 rounded-xl border border-border/40 bg-card", panelMinH, className)}>
        <EventListView
          items={items}
          selectedId={selectedId}
          onSelect={(id) => onEventClick?.(id)}
          cursorDate={cursorDate}
          fillContainer={fillContainer}
        />
      </div>
    )
  }

  if (viewMode === "timeline") {
    return (
      <div className={cn("overflow-hidden flex-1 rounded-xl border border-border/40 bg-card p-3", panelMinH, className)}>
        <EventTimelineView
          items={items}
          selectedId={selectedId}
          onSelect={(id) => onEventClick?.(id)}
          rangeStart={cursorDate}
          fillContainer={fillContainer}
        />
      </div>
    )
  }

  const initialDate = cursorDate

  return (
    <div
      className={cn(
        "flex-1 rounded-xl border border-border/40 bg-card shadow-sm w-full min-h-0 overflow-x-hidden overflow-y-auto",
        panelMinH,
        isEditing && "pointer-events-none opacity-90",
        className
      )}
    >
      <div className="calendar-embed calendar-embed--events h-full min-h-0 p-2 md:p-3">
        <FullCalendar
          key={`${viewMode}-${initialDate.toISOString()}`}
          plugins={CALENDAR_PLUGINS}
          initialView={viewModeToInitial(viewMode)}
          initialDate={initialDate}
          events={fcEvents}
          firstDay={1}
          height="auto"
          aspectRatio={viewMode === "week" ? 1.1 : 1.35}
          eventClick={handleEventClick}
          eventContent={eventContent}
          eventDidMount={handleEventDidMount}
          eventDisplay="block"
          displayEventEnd={false}
          dayMaxEvents={viewMode === "month" ? 2 : 8}
          moreLinkText={(n) => `+${n} more`}
          moreLinkClick="popover"
          fixedWeekCount={viewMode === "month"}
          headerToolbar={false}
          dayCellClassNames={dayCellClassNames}
          datesSet={(info) => {
            if (onDatesChange && info.view.currentStart) {
              onDatesChange(info.view.currentStart)
            }
          }}
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          allDaySlot={true}
        />
      </div>
    </div>
  )
}
