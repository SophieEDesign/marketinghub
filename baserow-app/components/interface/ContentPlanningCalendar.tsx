"use client"

import { useCallback, useMemo } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import type { EventClickArg, EventContentArg, EventInput } from "@fullcalendar/core"
import {
  type CalendarPlanningEvent,
  type CalendarViewMode,
} from "@/lib/marketing/content-planning"
import { cn } from "@/lib/utils"

const CALENDAR_PLUGINS = [dayGridPlugin, interactionPlugin]

interface ContentPlanningCalendarProps {
  events: CalendarPlanningEvent[]
  viewMode: CalendarViewMode
  onViewModeChange: (mode: CalendarViewMode) => void
  onEventClick?: (id: string) => void
  className?: string
}

function PlanningEventContent({ arg }: { arg: EventContentArg }) {
  const contentType = arg.event.extendedProps?.contentType as string | null
  const status = arg.event.extendedProps?.status as string | null
  const accent = (arg.event.extendedProps?.accentColor as string) || "#3B82F6"

  return (
    <div className="fc-planning-event flex flex-col gap-0.5 min-w-0 px-1 py-0.5 overflow-hidden">
      <span className="text-[11px] font-medium leading-tight truncate text-foreground">
        {arg.event.title}
      </span>
      <div className="flex items-center gap-1 min-w-0 flex-wrap">
        {contentType ? (
          <span
            className="inline-flex max-w-full truncate rounded px-1 py-px text-[9px] font-medium leading-none"
            style={{ backgroundColor: `${accent}33`, color: accent }}
          >
            {contentType}
          </span>
        ) : null}
        {status ? (
          <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground truncate">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: accent }}
              aria-hidden
            />
            <span className="truncate">{status}</span>
          </span>
        ) : null}
      </div>
    </div>
  )
}

function viewModeToInitial(viewMode: CalendarViewMode): string {
  if (viewMode === "weeks4") return "dayGridWeek4"
  if (viewMode === "weeks6") return "dayGridWeek6"
  if (viewMode === "weeks8") return "dayGridWeek8"
  return "dayGridMonth"
}

function viewModeToHeight(viewMode: CalendarViewMode): number {
  if (viewMode === "weeks4") return 520
  if (viewMode === "weeks8") return 420
  if (viewMode === "weeks6") return 480
  return 560
}

function viewModeToAspect(viewMode: CalendarViewMode): number {
  if (viewMode === "weeks4") return 0.95
  if (viewMode === "weeks8") return 1.3
  if (viewMode === "weeks6") return 1.1
  return 1.25
}

export default function ContentPlanningCalendar({
  events,
  viewMode,
  onViewModeChange,
  onEventClick,
  className,
}: ContentPlanningCalendarProps) {
  const fcEvents: EventInput[] = useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
        allDay: true,
        backgroundColor: e.backgroundColor,
        borderColor: e.accentColor,
        extendedProps: {
          contentType: e.contentType,
          status: e.status,
          accentColor: e.accentColor,
        },
      })),
    [events]
  )

  const calendarViews = useMemo(
    () => ({
      dayGridMonth: { type: "dayGrid" as const, duration: { months: 1 }, buttonText: "Month" },
      dayGridWeek4: {
        type: "dayGrid" as const,
        duration: { weeks: 4 },
        dateAlignment: "week" as const,
        buttonText: "4 weeks",
      },
      dayGridWeek6: {
        type: "dayGrid" as const,
        duration: { weeks: 6 },
        dateAlignment: "week" as const,
        buttonText: "6 weeks",
      },
      dayGridWeek8: {
        type: "dayGrid" as const,
        duration: { weeks: 8 },
        dateAlignment: "week" as const,
        buttonText: "8 weeks",
      },
    }),
    []
  )

  const handleEventClick = useCallback(
    (arg: EventClickArg) => {
      if (onEventClick && arg.event.id) onEventClick(String(arg.event.id))
    },
    [onEventClick]
  )

  const eventContent = useCallback(
    (arg: EventContentArg) => <PlanningEventContent arg={arg} />,
    []
  )

  const handleDatesSet = useCallback(() => {
    /* anchor scroll handled by FullCalendar */
  }, [])

  const headerToolbar = useMemo(
    () => ({
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,dayGridWeek4,dayGridWeek6,dayGridWeek8",
    }),
    []
  )

  return (
    <div
      className={cn(
        "rounded-card-lg border border-border/60 bg-card shadow-sm overflow-hidden content-planning-calendar",
        viewMode === "weeks4" && "planning-cal-spacious",
        viewMode === "weeks8" && "planning-cal-compact",
        className
      )}
      style={{ minHeight: viewModeToHeight(viewMode) }}
    >
      <FullCalendar
        key={viewMode}
        plugins={CALENDAR_PLUGINS}
        initialView={viewModeToInitial(viewMode)}
        views={calendarViews}
        headerToolbar={headerToolbar}
        events={fcEvents}
        firstDay={1}
        height="auto"
        aspectRatio={viewModeToAspect(viewMode)}
        eventClick={handleEventClick}
        eventContent={eventContent}
        datesSet={handleDatesSet}
        dayMaxEvents={viewMode === "weeks8" ? 2 : viewMode === "month" ? 3 : 4}
        moreLinkClick="popover"
        fixedWeekCount={viewMode === "month"}
        viewDidMount={(info) => {
          const name = info.view.type
          const map: Record<string, CalendarViewMode> = {
            dayGridMonth: "month",
            dayGridWeek4: "weeks4",
            dayGridWeek6: "weeks6",
            dayGridWeek8: "weeks8",
          }
          const next = map[name]
          if (next && next !== viewMode) onViewModeChange(next)
        }}
      />
      <style jsx global>{`
        .content-planning-calendar .fc {
          --fc-border-color: hsl(var(--border) / 0.5);
          --fc-page-bg-color: transparent;
          --fc-neutral-bg-color: hsl(var(--muted) / 0.3);
          font-size: 12px;
        }
        .content-planning-calendar .fc .fc-toolbar-title {
          font-size: 0.95rem;
          font-weight: 600;
        }
        .content-planning-calendar .fc .fc-button {
          font-size: 0.75rem;
          padding: 0.25rem 0.5rem;
        }
        .content-planning-calendar .fc-event {
          border-radius: 6px;
          border-width: 0 0 0 3px;
          margin-bottom: 2px;
        }
        .content-planning-calendar .fc-daygrid-event {
          white-space: normal;
        }
        .content-planning-calendar.planning-cal-compact .fc-daygrid-day-frame {
          min-height: 4.5rem;
        }
        .content-planning-calendar.planning-cal-spacious .fc-daygrid-day-frame {
          min-height: 7rem;
        }
        .content-planning-calendar .fc-daygrid-day-frame {
          min-height: 5.5rem;
        }
      `}</style>
    </div>
  )
}
