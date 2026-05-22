"use client"

import { useCallback, useMemo } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import interactionPlugin from "@fullcalendar/interaction"
import type { EventClickArg, EventContentArg, EventInput } from "@fullcalendar/core"
import { MarketingPanelPrimary } from "@/components/layout/ui-system"
import { EventAvatarStack } from "@/components/interface/events/EventAvatarStack"
import { EventListView } from "@/components/interface/events/EventListView"
import { EventTimelineView } from "@/components/interface/events/EventTimelineView"
import {
  type EventCalendarEvent,
  type EventCalendarViewMode,
} from "@/lib/marketing/events"
import { cn } from "@/lib/utils"

const CALENDAR_PLUGINS = [dayGridPlugin, timeGridPlugin, interactionPlugin]

function EventCalendarEventContent({ arg }: { arg: EventContentArg }) {
  const accent = (arg.event.extendedProps?.accentColor as string) || "#8B5CF6"
  const locationLabel = arg.event.extendedProps?.locationLabel as string | null
  const dateRangeLabel = arg.event.extendedProps?.dateRangeLabel as string | null
  const attendeeLabels = (arg.event.extendedProps?.attendeeLabels as string[]) || []

  return (
    <div
      className="fc-event-calendar-card flex flex-col gap-0.5 min-w-0 px-1.5 py-1 overflow-hidden rounded-md"
      style={{
        backgroundColor: arg.event.backgroundColor || `${accent}1A`,
        borderLeft: `3px solid ${accent}`,
      }}
    >
      <span className="text-xs font-semibold leading-tight truncate text-foreground">
        {arg.event.title}
      </span>
      {locationLabel ? (
        <span className="text-[10px] text-muted-foreground truncate">{locationLabel}</span>
      ) : null}
      {dateRangeLabel && arg.view.type.includes("dayGrid") ? (
        <span className="text-[10px] text-muted-foreground/80 truncate">{dateRangeLabel}</span>
      ) : null}
      <EventAvatarStack labels={attendeeLabels} max={3} className="mt-0.5" />
    </div>
  )
}

function viewModeToInitial(viewMode: EventCalendarViewMode): string {
  if (viewMode === "week") return "timeGridWeek"
  return "dayGridMonth"
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
}: EventCalendarViewProps) {
  const panelMinH = compact ? "min-h-[420px]" : "min-h-[min(72vh,620px)]"
  const fcEvents: EventInput[] = useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        allDay: e.allDay,
        backgroundColor: "transparent",
        borderColor: "transparent",
        extendedProps: e.extendedProps,
      })),
    [events]
  )

  const handleEventClick = useCallback(
    (arg: EventClickArg) => {
      if (onEventClick && arg.event.id) onEventClick(String(arg.event.id))
    },
    [onEventClick]
  )

  const eventContent = useCallback(
    (arg: EventContentArg) => <EventCalendarEventContent arg={arg} />,
    []
  )

  if (viewMode === "list") {
    return (
      <MarketingPanelPrimary className={cn("overflow-hidden flex-1", panelMinH, className)}>
        <EventListView
          items={items}
          selectedId={selectedId}
          onSelect={(id) => onEventClick?.(id)}
          cursorDate={cursorDate}
        />
      </MarketingPanelPrimary>
    )
  }

  if (viewMode === "timeline") {
    return (
      <MarketingPanelPrimary className={cn("overflow-hidden flex-1 p-3", panelMinH, className)}>
        <EventTimelineView
          items={items}
          selectedId={selectedId}
          onSelect={(id) => onEventClick?.(id)}
          rangeStart={cursorDate}
        />
      </MarketingPanelPrimary>
    )
  }

  const initialDate = cursorDate

  return (
    <MarketingPanelPrimary
      className={cn("overflow-hidden flex-1 shadow-none", panelMinH, className)}
    >
      <div className="calendar-embed calendar-embed--events h-full min-h-0">
        <FullCalendar
          key={`${viewMode}-${initialDate.toISOString()}`}
          plugins={CALENDAR_PLUGINS}
          initialView={viewModeToInitial(viewMode)}
          initialDate={initialDate}
          events={fcEvents}
          firstDay={1}
          height="auto"
          aspectRatio={viewMode === "week" ? 1.1 : 1.25}
          eventClick={handleEventClick}
          eventContent={eventContent}
          dayMaxEvents={viewMode === "month" ? 4 : 8}
          moreLinkClick="popover"
          fixedWeekCount={viewMode === "month"}
          headerToolbar={false}
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
    </MarketingPanelPrimary>
  )
}
