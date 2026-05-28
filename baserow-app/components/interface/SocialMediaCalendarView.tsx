"use client"

import { useCallback, useMemo } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import type { EventClickArg, EventContentArg, EventInput } from "@fullcalendar/core"
import { SocialCalendarEventCard } from "@/components/interface/social/SocialCalendarEventCard"
import type { SocialCalendarEvent } from "@/lib/marketing/social-media-calendar"
import { cn } from "@/lib/utils"

const CALENDAR_PLUGINS = [dayGridPlugin, interactionPlugin]

interface SocialMediaCalendarViewProps {
  events: SocialCalendarEvent[]
  viewMode: "month" | "week"
  onEventClick?: (id: string) => void
  compact?: boolean
  showPlatformIcons?: boolean
  showApprovalStatus?: boolean
  className?: string
}

export default function SocialMediaCalendarView({
  events,
  viewMode,
  onEventClick,
  compact = false,
  showPlatformIcons = true,
  showApprovalStatus = true,
  className,
}: SocialMediaCalendarViewProps) {
  const fcEvents: EventInput[] = useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
        allDay: true,
        backgroundColor: "transparent",
        borderColor: "transparent",
        extendedProps: {
          accentColor: e.accentColor,
          platforms: e.platforms,
          scheduledTime: e.scheduledTime,
          captionSnippet: e.captionSnippet,
          thumbnailUrl: e.thumbnailUrl,
          normalizedStatus: e.normalizedStatus,
          statusLabel: e.statusLabel,
        },
      })),
    [events]
  )

  const calendarViews = useMemo(
    () => ({
      dayGridMonth: { type: "dayGrid" as const, duration: { months: 1 }, buttonText: "Month" },
      dayGridWeek: {
        type: "dayGrid" as const,
        duration: { weeks: 1 },
        dateAlignment: "week" as const,
        buttonText: "Week",
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
    (arg: EventContentArg) => (
      <SocialCalendarEventCard
        arg={arg}
        showPlatformIcons={showPlatformIcons}
        showApprovalStatus={showApprovalStatus}
      />
    ),
    [showPlatformIcons, showApprovalStatus]
  )

  const headerToolbar = useMemo(
    () => ({
      left: "prev,next today",
      center: "title",
      right: "",
    }),
    []
  )

  return (
    <div
      className={cn(
        "social-calendar-embed social-calendar-embed--hero h-full min-h-0",
        className
      )}
    >
      <FullCalendar
        key={viewMode}
        plugins={CALENDAR_PLUGINS}
        initialView={viewMode === "week" ? "dayGridWeek" : "dayGridMonth"}
        views={calendarViews}
        headerToolbar={headerToolbar}
        events={fcEvents}
        firstDay={1}
        height="auto"
        aspectRatio={compact ? 0.9 : viewMode === "week" ? 1.05 : 1.2}
        eventClick={handleEventClick}
        eventContent={eventContent}
        dayMaxEvents={viewMode === "month" ? (compact ? 1 : 2) : compact ? 3 : 5}
        moreLinkClick="popover"
        fixedWeekCount={viewMode === "month"}
      />
    </div>
  )
}
