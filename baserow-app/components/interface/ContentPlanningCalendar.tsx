"use client"

import { useCallback, useMemo } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import type { EventClickArg, EventContentArg, EventInput } from "@fullcalendar/core"
import { MarketingPanelPrimary } from "@/components/layout/ui-system"
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

function accentBg(accent: string): string {
  if (accent.startsWith("#") && accent.length === 7) return `${accent}1E`
  return `${accent}22`
}

function PlanningEventContent({ arg }: { arg: EventContentArg }) {
  const contentType = arg.event.extendedProps?.contentType as string | null
  const status = arg.event.extendedProps?.status as string | null
  const accent = (arg.event.extendedProps?.accentColor as string) || "#3B82F6"

  return (
    <div className="fc-planning-event flex flex-col gap-1 min-w-0 px-1.5 py-1 overflow-hidden">
      <span className="text-xs font-semibold leading-tight truncate text-foreground">
        {arg.event.title}
      </span>
      <div className="flex items-center gap-1 min-w-0 flex-wrap">
        {contentType ? (
          <span
            className="inline-flex max-w-full truncate rounded px-1 py-px text-[10px] font-medium leading-none opacity-90"
            style={{ backgroundColor: accentBg(accent), color: accent }}
          >
            {contentType}
          </span>
        ) : null}
        {status ? (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground truncate">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full opacity-70"
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

function viewModeToAspect(viewMode: CalendarViewMode): number {
  if (viewMode === "weeks4") return 0.95
  if (viewMode === "weeks8") return 1.3
  if (viewMode === "weeks6") return 1.1
  return 1.25
}

function viewModeToDensity(viewMode: CalendarViewMode): "compact" | "spacious" | undefined {
  if (viewMode === "weeks8") return "compact"
  if (viewMode === "weeks4") return "spacious"
  return undefined
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

  const headerToolbar = useMemo(
    () => ({
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,dayGridWeek4,dayGridWeek6,dayGridWeek8",
    }),
    []
  )

  const density = viewModeToDensity(viewMode)

  return (
    <MarketingPanelPrimary
      className={cn("overflow-hidden min-h-[min(72vh,620px)] flex-1 shadow-none", className)}
    >
      <div
        className="calendar-embed calendar-embed--hero h-full min-h-0"
        {...(density ? { "data-density": density } : {})}
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
      </div>
    </MarketingPanelPrimary>
  )
}
