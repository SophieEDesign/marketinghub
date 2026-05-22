"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { addMonths, addWeeks, subMonths, subWeeks } from "date-fns"
import { Filter, Plus, Search } from "lucide-react"
import EventCalendarView from "@/components/interface/EventCalendarView"
import EventCalendarToolbar from "@/components/interface/EventCalendarToolbar"
import EventDetailPanel, { EventDetailPanelOverlay } from "@/components/interface/EventDetailPanel"
import EventMetricStrip from "@/components/interface/EventMetricStrip"
import EventEmptyState from "@/components/interface/EventEmptyState"
import { EditableDashboardRegion } from "@/components/interface/EditableDashboardRegion"
import DashboardEmpty from "@/components/interface/primitives/DashboardEmpty"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useRecordModal } from "@/contexts/RecordModalContext"
import { useEventCalendarData } from "@/hooks/useEventCalendarData"
import {
  buildEventCalendarEvents,
  computeEventMetrics,
  filterEventItems,
  type EventCalendarFilters,
  type EventCalendarViewMode,
} from "@/lib/marketing/events"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"

interface EventCalendarDashboardProps {
  canEdit?: boolean
}

function CalendarSkeleton() {
  return (
    <div className="rounded-card border border-border/30 p-4 min-h-[min(72vh,620px)] animate-pulse">
      <div className="grid grid-cols-7 gap-2 mb-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-4 bg-muted/40 rounded" />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2 flex-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="h-16 bg-muted/25 rounded" />
        ))}
      </div>
    </div>
  )
}

export default function EventCalendarDashboard({ canEdit = false }: EventCalendarDashboardProps) {
  const { openRecordModal } = useRecordModal()
  const { toast } = useToast()
  const {
    loading,
    error,
    tableIds,
    allItems,
    filterOptions,
    currentUserId,
    reload,
    updateAttendees,
  } = useEventCalendarData()

  const [viewMode, setViewMode] = useState<EventCalendarViewMode>("month")
  const [cursorDate, setCursorDate] = useState(() => new Date())
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [filterEventType, setFilterEventType] = useState("all")
  const [filterLocation, setFilterLocation] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterOwner, setFilterOwner] = useState("all")
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)")
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  const filters: EventCalendarFilters = useMemo(
    () => ({
      search,
      eventTypes: filterEventType === "all" ? [] : [filterEventType],
      locations: filterLocation === "all" ? [] : [filterLocation],
      statuses: filterStatus === "all" ? [] : [filterStatus],
      owners: filterOwner === "all" ? [] : [filterOwner],
      attendeeFilter: "all",
    }),
    [search, filterEventType, filterLocation, filterStatus, filterOwner]
  )

  const filteredItems = useMemo(
    () => filterEventItems(allItems, filters, currentUserId),
    [allItems, filters, currentUserId]
  )

  const calendarEvents = useMemo(
    () => buildEventCalendarEvents(filteredItems),
    [filteredItems]
  )

  const metrics = useMemo(
    () => computeEventMetrics(filteredItems, cursorDate),
    [filteredItems, cursorDate]
  )

  const selectedEvent = useMemo(
    () => filteredItems.find((e) => e.id === selectedEventId) ?? null,
    [filteredItems, selectedEventId]
  )

  const panelOpen = !!selectedEventId && !!selectedEvent

  const handleAddEvent = useCallback(() => {
    if (!tableIds?.contentTableId) return
    openRecordModal({
      tableId: tableIds.contentTableId,
      recordId: null,
      supabaseTableName: tableIds.contentSupabaseTable,
      initialData: fields?.contentType
        ? { [fields.contentType]: "Event" }
        : { content_type: "Event" },
      onRecordUpdated: () => reload(),
    })
  }, [tableIds, fields?.contentType, openRecordModal, reload])

  const handleEditEvent = useCallback(() => {
    if (!tableIds?.contentTableId || !selectedEventId) return
    openRecordModal({
      tableId: tableIds.contentTableId,
      recordId: selectedEventId,
      supabaseTableName: tableIds.contentSupabaseTable,
      onRecordUpdated: () => reload(),
    })
  }, [tableIds, selectedEventId, openRecordModal, reload])

  const handleToggleAttending = useCallback(async () => {
    if (!selectedEvent || !currentUserId) {
      toast({ title: "Sign in required", description: "You must be signed in to mark attendance." })
      return
    }
    try {
      const next = selectedEvent.currentUserAttending
        ? selectedEvent.attendeeIds.filter((id) => id !== currentUserId)
        : [...new Set([...selectedEvent.attendeeIds, currentUserId])]
      await updateAttendees(selectedEvent.id, next)
      toast({
        title: selectedEvent.currentUserAttending ? "Removed from attendees" : "Marked as attending",
      })
    } catch (e) {
      toast({
        title: "Could not update attendance",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      })
    }
  }, [selectedEvent, currentUserId, updateAttendees, toast])

  const handleManageAttendees = useCallback(() => {
    handleEditEvent()
  }, [handleEditEvent])

  const onPrev = () => {
    if (viewMode === "week") setCursorDate((d) => subWeeks(d, 1))
    else setCursorDate((d) => subMonths(d, 1))
  }
  const onNext = () => {
    if (viewMode === "week") setCursorDate((d) => addWeeks(d, 1))
    else setCursorDate((d) => addMonths(d, 1))
  }
  const onToday = () => setCursorDate(new Date())

  const handleExport = () => {
    toast({ title: "Export", description: "Calendar export coming soon." })
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <header>
          <div className="h-8 w-48 bg-muted/40 rounded animate-pulse mb-2" />
          <div className="h-4 w-72 bg-muted/30 rounded animate-pulse" />
        </header>
        <CalendarSkeleton />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[76px] bg-muted/30 rounded-card animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <DashboardEmpty title="Could not load events" description={error} variant="default" />
        <Button type="button" variant="outline" className="mt-4" onClick={() => reload()}>
          Retry
        </Button>
      </div>
    )
  }

  const showEmpty = allItems.length === 0

  return (
    <div className="flex flex-col gap-4 md:gap-5 min-h-0 min-w-0 w-full">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-page-title text-foreground">Event Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Plan, manage and track marketing events, trade shows and activations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canEdit ? (
            <Button type="button" className="gap-2 h-9" onClick={handleAddEvent}>
              <Plus className="h-4 w-4" aria-hidden />
              Add event
            </Button>
          ) : null}
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5">
                <Filter className="h-4 w-4" aria-hidden />
                Filters
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <p className="text-xs text-muted-foreground mb-2">Use toolbar filters below for type, location, and status.</p>
            </PopoverContent>
          </Popover>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input
              placeholder="Search events..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-[200px] pl-8 text-sm"
              aria-label="Search events"
            />
          </div>
        </div>
      </header>

      <EditableDashboardRegion id="toolbar" label="Calendar toolbar">
        <EventCalendarToolbar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          cursorDate={cursorDate}
          onCursorDateChange={setCursorDate}
          onPrev={onPrev}
          onNext={onNext}
          onToday={onToday}
          eventTypes={filterOptions.eventTypes}
          locations={filterOptions.locations}
          statuses={filterOptions.statuses}
          owners={filterOptions.owners}
          filterEventType={filterEventType}
          filterLocation={filterLocation}
          filterStatus={filterStatus}
          filterOwner={filterOwner}
          onFilterEventType={setFilterEventType}
          onFilterLocation={setFilterLocation}
          onFilterStatus={setFilterStatus}
          onFilterOwner={setFilterOwner}
        />
      </EditableDashboardRegion>

      {showEmpty ? (
        <EventEmptyState onAddEvent={handleAddEvent} canEdit={canEdit} />
      ) : (
        <div className="flex flex-col lg:flex-row gap-0 lg:gap-4 min-h-0 min-w-0 flex-1">
          <EditableDashboardRegion
            id="calendar"
            label="Event calendar"
            className="flex-1 min-w-0 min-h-0"
          >
            <EventCalendarView
              events={calendarEvents}
              items={filteredItems}
              viewMode={viewMode}
              cursorDate={cursorDate}
              selectedId={selectedEventId}
              onEventClick={setSelectedEventId}
              onDatesChange={setCursorDate}
            />
          </EditableDashboardRegion>

          {!isMobile && (
            <EditableDashboardRegion id="detail-preview" label="Event detail panel">
              <EventDetailPanel
                event={selectedEvent}
                open={panelOpen}
                onClose={() => setSelectedEventId(null)}
                canEdit={canEdit}
                onEdit={handleEditEvent}
                onToggleAttending={handleToggleAttending}
                onManageAttendees={canEdit ? handleManageAttendees : undefined}
              />
            </EditableDashboardRegion>
          )}

          {isMobile && (
            <EventDetailPanel
              event={selectedEvent}
              open={panelOpen}
              onClose={() => setSelectedEventId(null)}
              canEdit={canEdit}
              onEdit={handleEditEvent}
              onToggleAttending={handleToggleAttending}
              onManageAttendees={canEdit ? handleManageAttendees : undefined}
              isMobile
            />
          )}

          {/* Tablet: md-lg overlay */}
          {!isMobile && (
            <div className="hidden md:block lg:hidden">
              <EventDetailPanelOverlay
                event={selectedEvent}
                open={panelOpen}
                onClose={() => setSelectedEventId(null)}
                canEdit={canEdit}
                onEdit={handleEditEvent}
                onToggleAttending={handleToggleAttending}
                onManageAttendees={canEdit ? handleManageAttendees : undefined}
              />
            </div>
          )}
        </div>
      )}

      {!showEmpty ? (
        <EditableDashboardRegion id="metrics" label="Summary metrics">
          <EventMetricStrip
            upcoming={metrics.upcoming}
            teamAttending={metrics.teamAttending}
            countries={metrics.countries}
            thisMonth={metrics.thisMonth}
            onExport={handleExport}
          />
        </EditableDashboardRegion>
      ) : null}

      {/* Event type legend */}
      {!showEmpty ? (
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground pt-1">
          {[
            ["Boat Show", "#3B82F6"],
            ["Racing / Sport", "#10B981"],
            ["Experience / Events", "#8B5CF6"],
            ["Hospitality", "#F97316"],
            ["International", "#14B8A6"],
            ["Other", "#EC4899"],
          ].map(([label, color]) => (
            <span key={label} className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
              {label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
