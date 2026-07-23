"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { addMonths, addWeeks, subMonths, subWeeks } from "date-fns"
import { Calendar, ChevronDown, Plus, Search } from "lucide-react"
import EventCalendarView from "@/components/interface/EventCalendarView"
import EventCalendarToolbar from "@/components/interface/EventCalendarToolbar"
import EventMetricStrip from "@/components/interface/EventMetricStrip"
import EventEmptyState from "@/components/interface/EventEmptyState"
import EventMemberSubmissionSheet from "@/components/interface/EventMemberSubmissionSheet"
import DashboardEmpty from "@/components/interface/primitives/DashboardEmpty"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRecordModal } from "@/contexts/RecordModalContext"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import { createClient } from "@/lib/supabase/client"
import type { EventRecordContextualPayload } from "@/lib/records/record-drawer-mode"
import type { MarketingEventItem } from "@/lib/marketing/events"
import { useEventCalendarData } from "@/hooks/useEventCalendarData"
import {
  isMarketingMockEnabled,
  marketingDemoState,
} from "@/lib/marketing/block-config-resolver"
import MarketingDemoDataBanner from "@/components/interface/primitives/MarketingDemoDataBanner"
import { EVENT_CALENDAR_MOCK_ITEMS } from "@/lib/marketing/event-calendar-mock-data"
import { filterEventsByAudience } from "@/lib/marketing/event-calendar-visibility"
import { eventCalendarWorkflowFromConfig } from "@/lib/marketing/event-calendar-config"
import {
  downloadCalendarIcs,
} from "@/lib/marketing/event-calendar-ics"
import {
  buildEventCalendarEvents,
  buildEventCalendarCreateInitialData,
  buildEventCalendarRescheduleUpdates,
  computeEventMetrics,
  eventCalendarSettingsFromConfig,
  EVENT_TYPE_LEGEND,
  filterEventItems,
  normalizeEventCalendarDateStr,
  type EventAttendanceStatus,
  type EventCalendarBlockSettings,
  type EventCalendarFilters,
  type EventCalendarViewMode,
} from "@/lib/marketing/events"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import type { BlockConfig } from "@/lib/interface/types"

export interface EventCalendarCoreProps {
  settings: EventCalendarBlockSettings
  config?: BlockConfig
  canEdit?: boolean
  className?: string
}

function CalendarSkeleton({ compact }: { compact: boolean }) {
  const minH = compact ? "min-h-[420px]" : "min-h-[min(72vh,620px)]"
  return (
    <div className={cn("rounded-card border border-border/30 p-4 animate-pulse", minH)}>
      <div className="grid grid-cols-7 gap-2 mb-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-4 bg-muted/40 rounded" />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2 flex-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className={cn("bg-muted/25 rounded", compact ? "h-12" : "h-16")} />
        ))}
      </div>
    </div>
  )
}

export function EventCalendarCore({
  settings,
  config,
  canEdit = false,
  isEditing = false,
  interfaceMode = "view",
  embeddedInBlock = true,
  className,
}: EventCalendarCoreProps & {
  isEditing?: boolean
  interfaceMode?: "view" | "edit"
  embeddedInBlock?: boolean
}) {
  const { openRecordModal } = useRecordModal()
  const { state: recordPanelState, setRecordDrawerMode, closeRecord } = useRecordPanel()
  const { toast } = useToast()
  const {
    loading,
    error,
    fromLiveData,
    hasTable,
    tableIds,
    fields,
    allItems: liveItems,
    filterOptions,
    currentUserId,
    reload,
    upsertAttendance,
    updateEventStatus,
  } = useEventCalendarData({ config })

  const workflow = useMemo(() => eventCalendarWorkflowFromConfig(config), [config])

  const forceMock = isMarketingMockEnabled(config, "event_calendar_use_mock")
  const demoState = marketingDemoState({ forceMock, fromLiveData, hasTable, error })
  /** When true, hides internal-only/draft events (for member/public pages). */
  const externalMode = settings.externalMode

  const sourceItems = useMemo(() => {
    if (demoState.useDemoData) return EVENT_CALENDAR_MOCK_ITEMS
    return liveItems
  }, [demoState.useDemoData, liveItems])

  const audienceItems = useMemo(
    () =>
      filterEventsByAudience(sourceItems, {
        externalMode,
        isAdminView: canEdit && !externalMode,
      }),
    [sourceItems, externalMode, canEdit]
  )

  const maxItems =
    typeof config?.event_calendar_max_items === "number"
      ? config.event_calendar_max_items
      : undefined

  const [viewMode, setViewMode] = useState<EventCalendarViewMode>(settings.defaultView)
  const [cursorDate, setCursorDate] = useState(() => new Date())
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [filterEventType, setFilterEventType] = useState("all")
  const [filterLocation, setFilterLocation] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterOwner, setFilterOwner] = useState("all")
  const [isMobile, setIsMobile] = useState(false)
  const [memberSubmitOpen, setMemberSubmitOpen] = useState(false)
  const [memberSubmitDate, setMemberSubmitDate] = useState<string | null>(null)

  useEffect(() => {
    setViewMode(settings.defaultView)
  }, [settings.defaultView])

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)")
    const update = () => {
      const mobile = mq.matches
      setIsMobile(mobile)
      if (mobile && (externalMode || settings.mobileDefaultView)) {
        setViewMode(settings.mobileDefaultView)
      }
    }
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [externalMode, settings.mobileDefaultView])

  const filters: EventCalendarFilters = useMemo(
    () => ({
      search: settings.showSearch ? search : "",
      eventTypes: filterEventType === "all" ? [] : [filterEventType],
      locations: filterLocation === "all" ? [] : [filterLocation],
      statuses: filterStatus === "all" ? [] : [filterStatus],
      owners: filterOwner === "all" ? [] : [filterOwner],
      attendeeFilter: "all",
    }),
    [search, filterEventType, filterLocation, filterStatus, filterOwner, settings.showSearch]
  )

  const filteredItems = useMemo(() => {
    const filtered = filterEventItems(audienceItems, filters, currentUserId)
    return maxItems != null && maxItems > 0 ? filtered.slice(0, maxItems) : filtered
  }, [audienceItems, filters, currentUserId, maxItems])

  const calendarEvents = useMemo(
    () => buildEventCalendarEvents(filteredItems),
    [filteredItems]
  )

  const metrics = useMemo(
    () => computeEventMetrics(filteredItems, cursorDate),
    [filteredItems, cursorDate]
  )

  const openRecordForEvent = useCallback(
    (
      id: string,
      options?: {
        initialDrawerMode?: "view" | "edit"
        event?: MarketingEventItem | null
      }
    ) => {
      if (!tableIds?.contentTableId) return
      const event =
        options?.event ?? filteredItems.find((item) => item.id === id) ?? null
      setSelectedEventId(id)
      openRecordModal({
        tableId: tableIds.contentTableId,
        recordId: id,
        supabaseTableName: tableIds.contentSupabaseTable,
        interfaceMode,
        recordLayoutType: "event",
        initialDrawerMode: options?.initialDrawerMode ?? "view",
        eventContextual: event ? makeEventContextual(event) : null,
        onRecordUpdated: () => reload(),
      })
    },
    // makeEventContextual is rebuilt each render so attendance/approval callbacks stay fresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tableIds, filteredItems, openRecordModal, interfaceMode, reload]
  )

  const handleEventClick = useCallback(
    (id: string) => {
      if (isEditing) return
      if (settings.clickAction === "none") return
      openRecordForEvent(id, { initialDrawerMode: "view" })
    },
    [isEditing, settings.clickAction, openRecordForEvent]
  )

  const handleAddEvent = useCallback(
    (scheduleDate?: string) => {
      if (isEditing) return
      if (!tableIds?.contentTableId) {
        toast({
          title: "Add event unavailable",
          description: "Connect a source table in block settings.",
        })
        return
      }

      if (!canEdit && settings.allowMemberSubmissions) {
        setMemberSubmitDate(normalizeEventCalendarDateStr(scheduleDate) ?? null)
        setMemberSubmitOpen(true)
        return
      }

      const initialData = buildEventCalendarCreateInitialData({
        fields,
        contentTypeDefault: workflow.contentTypeDefault,
        scheduleDate,
      })

      openRecordModal({
        tableId: tableIds.contentTableId,
        recordId: null,
        supabaseTableName: tableIds.contentSupabaseTable,
        interfaceMode,
        recordLayoutType: "event",
        initialData,
        onRecordUpdated: () => reload(),
      })
    },
    [
      isEditing,
      tableIds,
      fields,
      canEdit,
      settings.allowMemberSubmissions,
      workflow.contentTypeDefault,
      openRecordModal,
      interfaceMode,
      reload,
      toast,
    ]
  )

  const canCreateFromCalendar =
    settings.showAddButton &&
    !isEditing &&
    (canEdit || settings.allowMemberSubmissions) &&
    demoState.useLiveData &&
    !forceMock &&
    !!tableIds?.contentTableId

  const handleCalendarDateClick = useCallback(
    (dateStr: string) => {
      if (!canCreateFromCalendar) return
      handleAddEvent(dateStr)
    },
    [canCreateFromCalendar, handleAddEvent]
  )

  const calendarEditable =
    canEdit &&
    !isEditing &&
    demoState.useLiveData &&
    !forceMock &&
    !!tableIds?.contentSupabaseTable &&
    !!fields?.startDate

  const handleEventDateChange = useCallback(
    async (recordId: string, newDate: Date): Promise<boolean> => {
      if (!calendarEditable || !tableIds?.contentSupabaseTable || !fields?.startDate) {
        return false
      }
      const previous = filteredItems.find((item) => item.id === recordId)
      const updates = buildEventCalendarRescheduleUpdates({
        fields,
        newStart: newDate,
        previousStart: previous?.startDate ?? null,
        previousEnd: previous?.endDate ?? null,
      })
      if (!updates) return false

      try {
        const supabase = createClient()
        const { error: updateError } = await supabase
          .from(tableIds.contentSupabaseTable)
          .update(updates)
          .eq("id", recordId)
        if (updateError) throw updateError
        reload()
        return true
      } catch (err) {
        console.error("Event calendar: failed to reschedule event", err)
        toast({
          title: "Could not reschedule event",
          description: err instanceof Error ? err.message : "Try again",
          variant: "destructive",
        })
        return false
      }
    },
    [
      calendarEditable,
      tableIds?.contentSupabaseTable,
      fields,
      filteredItems,
      reload,
      toast,
    ]
  )

  const handleAttendanceChange = useCallback(
    async (status: EventAttendanceStatus) => {
      if (isEditing || !settings.allowAttendanceUpdates || !settings.showAttendanceControls) {
        return
      }
      const eventId = recordPanelState.recordId ?? selectedEventId
      if (!eventId || !currentUserId) {
        toast({
          title: "Sign in required",
          description: "You must be signed in to update attendance.",
        })
        return
      }

      try {
        await upsertAttendance(eventId, status)
        const labels: Record<EventAttendanceStatus, string> = {
          attending: "Marked as attending",
          maybe: "Marked as maybe",
          not_attending: "Marked as not attending",
          interested: "Marked as interested",
        }
        toast({ title: labels[status] })
        reload()
      } catch (e) {
        toast({
          title: "Could not update attendance",
          description: e instanceof Error ? e.message : "Try again",
          variant: "destructive",
        })
      }
    },
    [
      isEditing,
      settings.allowAttendanceUpdates,
      settings.showAttendanceControls,
      recordPanelState.recordId,
      selectedEventId,
      currentUserId,
      upsertAttendance,
      toast,
      reload,
    ]
  )

  const handleApproveEvent = useCallback(async () => {
    const eventId = recordPanelState.recordId ?? selectedEventId
    if (!eventId) return
    try {
      await updateEventStatus(eventId, workflow.approvedStatus)
      toast({ title: "Event approved", description: workflow.approvedStatus })
      setSelectedEventId(null)
      closeRecord()
    } catch (e) {
      toast({
        title: "Could not approve",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      })
    }
  }, [recordPanelState.recordId, selectedEventId, updateEventStatus, workflow.approvedStatus, toast, closeRecord])

  const handleRejectEvent = useCallback(async () => {
    const eventId = recordPanelState.recordId ?? selectedEventId
    if (!eventId) return
    try {
      await updateEventStatus(eventId, workflow.rejectedStatus)
      toast({ title: "Event rejected" })
      setSelectedEventId(null)
      closeRecord()
    } catch (e) {
      toast({
        title: "Could not reject",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      })
    }
  }, [recordPanelState.recordId, selectedEventId, updateEventStatus, workflow.rejectedStatus, toast, closeRecord])

  function makeEventContextual(event: MarketingEventItem): EventRecordContextualPayload {
    return {
      event,
      canEdit: canEdit && !externalMode,
      isExternalView: externalMode,
      showScheduleTab: settings.showScheduleTab,
      showResourcesTab: settings.showResourcesTab,
      showNotesTab: settings.showNotesTab,
      showAttendanceControls:
        settings.showAttendanceControls && settings.allowAttendanceUpdates && !isEditing,
      allowCalendarExport: settings.allowCalendarExport && !isEditing,
      attendanceStatus: event.currentUserAttendanceStatus ?? null,
      showApprovalActions:
        canEdit && !externalMode && !isEditing && !!event.isPendingApproval,
      onAttendanceChange: handleAttendanceChange,
      onManageAttendees:
        canEdit && settings.showAttendanceControls
          ? () => setRecordDrawerMode("edit")
          : undefined,
      onApprove: handleApproveEvent,
      onReject: handleRejectEvent,
    }
  }

  const onPrev = () => {
    if (viewMode === "week") setCursorDate((d) => subWeeks(d, 1))
    else setCursorDate((d) => subMonths(d, 1))
  }
  const onNext = () => {
    if (viewMode === "week") setCursorDate((d) => addWeeks(d, 1))
    else setCursorDate((d) => addMonths(d, 1))
  }
  const onToday = () => setCursorDate(new Date())

  const handleDownloadFilteredIcs = useCallback(() => {
    if (filteredItems.length === 0) {
      toast({ title: "No events", description: "Nothing to export for the current filters." })
      return
    }
    downloadCalendarIcs(filteredItems, "marketing-events.ics")
    toast({ title: "Download started", description: `${filteredItems.length} events exported.` })
  }, [filteredItems, toast])

  const handleCopyCalendarFeed = useCallback(() => {
    if (!config?.table_id) {
      toast({ title: "Feed unavailable", description: "Select a source table in block settings." })
      return
    }
    const scope = config.event_calendar_feed_scope === "attending" ? "attending" : "all"
    const external = externalMode ? "1" : "0"
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/api/calendar/events/feed?tableId=${encodeURIComponent(config.table_id)}&scope=${scope}&external=${external}`
    const webcal = url.replace(/^https:/, "webcal:").replace(/^http:/, "webcal:")
    void navigator.clipboard?.writeText(webcal)
    toast({
      title: "Calendar feed URL copied",
      description: "Paste into Google Calendar, Outlook, or Apple Calendar to subscribe.",
    })
  }, [config?.table_id, config?.event_calendar_feed_scope, externalMode, toast])

  const showAddButton = canCreateFromCalendar

  if (loading) {
    return (
      <div className={cn("flex flex-col gap-4", className)}>
        {settings.showPageHeader ? (
          <header>
            <div className="h-8 w-48 bg-muted/40 rounded animate-pulse mb-2" />
            <div className="h-4 w-72 bg-muted/30 rounded animate-pulse" />
          </header>
        ) : null}
        <CalendarSkeleton compact={settings.density === "compact"} />
        {settings.showMetrics ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[76px] bg-muted/30 rounded-card animate-pulse" />
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  if (demoState.showEmptyState && !demoState.useDemoData) {
    return (
      <div className={cn("py-12 text-center", className)}>
        <DashboardEmpty
          title="Event calendar not configured"
          description={demoState.bannerMessage}
          variant="default"
        />
      </div>
    )
  }

  const showEmpty = filteredItems.length === 0

  return (
    <div
      className={cn(
        "flex flex-col gap-4 md:gap-5 min-h-0 min-w-0 w-full h-full",
        settings.density === "compact" && "gap-3 md:gap-4",
        className
      )}
      data-event-calendar-core
      data-block-selectable
      data-editing={isEditing ? "true" : undefined}
    >
      {demoState.showDemoBanner ? (
        <MarketingDemoDataBanner message={demoState.bannerMessage} />
      ) : null}

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between shrink-0">
        <div className="min-w-0">
          <h1 className="text-page-title text-foreground">{settings.title}</h1>
          {settings.subtitle ? (
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">{settings.subtitle}</p>
          ) : null}
        </div>
        {settings.showActions ? (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {settings.allowCalendarExport && !isEditing ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" className="gap-2 h-9 text-sm">
                    <Calendar className="h-4 w-4" aria-hidden />
                    Export / Sync
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleDownloadFilteredIcs}>
                    Download filtered events (.ics)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCopyCalendarFeed}>
                    Get calendar feed URL
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            {showAddButton ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" className="gap-2 h-9">
                    <Plus className="h-4 w-4" aria-hidden />
                    Add event
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleAddEvent()}>
                    {canEdit ? "Create full event" : "Submit event for approval"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            {settings.showSearch ? (
              <div className="relative">
                <Search
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  placeholder="Search events..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 w-[200px] pl-8 text-sm"
                  aria-label="Search events"
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </header>

      {settings.showToolbar ? (
        <EventCalendarToolbar
          title={undefined}
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
          onClearFilters={() => {
            setFilterEventType("all")
            setFilterLocation("all")
            setFilterStatus("all")
            setFilterOwner("all")
            setSearch("")
          }}
          showFilters={settings.showFilters}
        />
      ) : null}

      {showEmpty ? (
        <EventEmptyState
          onAddEvent={showAddButton ? () => handleAddEvent() : undefined}
          canEdit={showAddButton}
        />
      ) : (
        <div className="flex flex-col lg:flex-row gap-0 lg:gap-4 min-h-0 min-w-0 flex-1">
          <div className="flex-1 min-w-0 min-h-0 flex flex-col">
            <EventCalendarView
              events={calendarEvents}
              items={filteredItems}
              viewMode={viewMode}
              cursorDate={cursorDate}
              selectedId={selectedEventId}
              onEventClick={handleEventClick}
              onDateClick={showAddButton ? handleCalendarDateClick : undefined}
              onEventDateChange={calendarEditable ? handleEventDateChange : undefined}
              editable={calendarEditable}
              onDatesChange={setCursorDate}
              compact={settings.density === "compact"}
              isEditing={isEditing}
              fillContainer={!embeddedInBlock}
            />
          </div>

        </div>
      )}

      {!showEmpty && settings.showMetrics ? (
        <EventMetricStrip
          upcoming={metrics.upcoming}
          teamAttending={metrics.teamAttending}
          countries={metrics.countries}
          thisMonth={metrics.thisMonth}
          onExport={handleDownloadFilteredIcs}
        />
      ) : null}

      {config?.event_calendar_show_sync_banner && !showEmpty && settings.allowCalendarExport ? (
        <div className="rounded-lg border border-accent-link/20 bg-accent-link/5 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
          <p className="text-sm text-foreground">Stay up to date — subscribe to the event calendar feed.</p>
          <Button type="button" variant="secondary" size="sm" onClick={handleCopyCalendarFeed}>
            Get calendar feed
          </Button>
        </div>
      ) : null}

      {!showEmpty && settings.showLegend ? (
        <div className="flex flex-wrap items-center gap-4 pt-1 shrink-0">
          {EVENT_TYPE_LEGEND.map(({ label, color }) => (
            <span key={label} className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[#6b7280]">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
              {label}
            </span>
          ))}
        </div>
      ) : null}

      {fields && tableIds?.contentSupabaseTable ? (
        <EventMemberSubmissionSheet
          open={memberSubmitOpen}
          onClose={() => {
            setMemberSubmitOpen(false)
            setMemberSubmitDate(null)
          }}
          supabaseTable={tableIds.contentSupabaseTable}
          fields={fields}
          workflow={workflow}
          initialStartDate={memberSubmitDate}
          onSubmitted={() => {
            reload()
            toast({ title: "Event submitted", description: "Pending approval." })
          }}
        />
      ) : null}
    </div>
  )
}

export function EventCalendarFromConfig({
  config,
  canEdit,
  isEditing = false,
  interfaceMode = "view",
  embeddedInBlock = true,
  className,
}: {
  config?: BlockConfig
  canEdit?: boolean
  isEditing?: boolean
  interfaceMode?: "view" | "edit"
  embeddedInBlock?: boolean
  className?: string
}) {
  const settings = useMemo(
    () => eventCalendarSettingsFromConfig(config as Record<string, unknown>),
    [config]
  )
  return (
    <EventCalendarCore
      settings={settings}
      config={config}
      canEdit={canEdit}
      isEditing={isEditing}
      interfaceMode={interfaceMode}
      embeddedInBlock={embeddedInBlock}
      className={className}
    />
  )
}

export default EventCalendarCore
