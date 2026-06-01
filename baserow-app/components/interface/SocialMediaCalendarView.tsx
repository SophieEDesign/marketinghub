"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import type { EventClickArg, EventContentArg, EventDropArg, EventInput } from "@fullcalendar/core"
import { SocialCalendarEventCard } from "@/components/interface/social/SocialCalendarEventCard"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import type { SocialCalendarEvent } from "@/lib/marketing/social-media-calendar"
import { cn } from "@/lib/utils"

const CALENDAR_PLUGINS = [dayGridPlugin, interactionPlugin]

interface SocialMediaCalendarViewProps {
  events: SocialCalendarEvent[]
  viewMode: "month" | "week"
  onEventClick?: (id: string) => void
  /** When set and editable is true, dropping an event updates the record schedule date. */
  onEventDateChange?: (recordId: string, newDate: Date) => Promise<boolean>
  editable?: boolean
  compact?: boolean
  showPlatformIcons?: boolean
  showApprovalStatus?: boolean
  className?: string
}

export default function SocialMediaCalendarView({
  events,
  viewMode,
  onEventClick,
  onEventDateChange,
  editable = false,
  compact = false,
  showPlatformIcons = true,
  showApprovalStatus = true,
  className,
}: SocialMediaCalendarViewProps) {
  const { state: recordPanelState } = useRecordPanel()
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const fullCalendarRef = useRef<FullCalendar | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const requestCalendarResize = useCallback(() => {
    const api = fullCalendarRef.current?.getApi?.()
    if (!api?.updateSize) return
    requestAnimationFrame(() => {
      api.updateSize()
      requestAnimationFrame(() => api.updateSize())
    })
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el || !mounted) return
    const ro = new ResizeObserver(() => requestCalendarResize())
    ro.observe(el)
    return () => ro.disconnect()
  }, [mounted, requestCalendarResize])

  useEffect(() => {
    if (!mounted) return
    requestCalendarResize()
  }, [mounted, recordPanelState.isOpen, recordPanelState.width, requestCalendarResize])

  useEffect(() => {
    const onLayoutResize = () => requestCalendarResize()
    window.addEventListener("app:layout-resize", onLayoutResize)
    window.addEventListener("resize", onLayoutResize)
    return () => {
      window.removeEventListener("app:layout-resize", onLayoutResize)
      window.removeEventListener("resize", onLayoutResize)
    }
  }, [requestCalendarResize])

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
          postUrl: e.postUrl,
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

  const handleEventDrop = useCallback(
    async (info: EventDropArg) => {
      const recordId = info.event.id ? String(info.event.id) : null
      const newStart = info.event.start
      if (!recordId || !newStart || !onEventDateChange) {
        info.revert()
        return
      }
      const ok = await onEventDateChange(recordId, newStart)
      if (!ok) info.revert()
    },
    [onEventDateChange]
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

  const isMonth = viewMode === "month"
  const canDrag = editable && !!onEventDateChange

  return (
    <div
      ref={containerRef}
      className={cn(
        "social-calendar-embed social-calendar-embed--hero h-full min-h-0 w-full min-w-0",
        canDrag && "social-calendar-embed--draggable",
        className
      )}
    >
      {mounted ? (
        <FullCalendar
          ref={fullCalendarRef}
          key={viewMode}
          plugins={CALENDAR_PLUGINS}
          initialView={viewMode === "week" ? "dayGridWeek" : "dayGridMonth"}
          views={calendarViews}
          headerToolbar={headerToolbar}
          events={fcEvents}
          firstDay={1}
          height="auto"
          contentHeight="auto"
          expandRows={isMonth}
          aspectRatio={isMonth ? undefined : compact ? 0.9 : 1.05}
          eventClick={handleEventClick}
          eventContent={eventContent}
          editable={canDrag}
          eventDrop={canDrag ? handleEventDrop : undefined}
          eventDurationEditable={false}
          eventStartEditable={canDrag}
          eventDragMinDistance={8}
          dayMaxEvents={false}
          fixedWeekCount={isMonth}
          handleWindowResize
        />
      ) : (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          Loading calendar…
        </div>
      )}
    </div>
  )
}
