"use client"

import { useEffect, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import {
  X,
  MapPin,
  Calendar,
  ExternalLink,
  Users,
  Pencil,
  Share2,
  ChevronRight,
  Download,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { EventAvatarStack } from "@/components/interface/events/EventAvatarStack"
import type { EventAttendanceStatus, MarketingEventItem } from "@/lib/marketing/events"
import { statusAccentColor } from "@/lib/marketing/events"
import {
  downloadEventIcs,
  googleCalendarAddUrl,
  outlookCalendarAddUrl,
} from "@/lib/marketing/event-calendar-ics"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"

const ATTENDANCE_OPTIONS: { value: EventAttendanceStatus; label: string }[] = [
  { value: "attending", label: "Attending" },
  { value: "maybe", label: "Maybe" },
  { value: "not_attending", label: "Not attending" },
  { value: "interested", label: "Interested" },
]

export interface EventDetailContentProps {
  event: MarketingEventItem
  onClose: () => void
  canEdit: boolean
  isExternalView?: boolean
  onEdit: () => void
  onViewRecord?: () => void
  onAttendanceChange?: (status: EventAttendanceStatus) => void
  onManageAttendees?: () => void
  showScheduleTab?: boolean
  showResourcesTab?: boolean
  showNotesTab?: boolean
  showAttendanceControls?: boolean
  allowCalendarExport?: boolean
  attendanceStatus?: EventAttendanceStatus | null
  isEditingBlock?: boolean
  onApprove?: () => void
  onReject?: () => void
  showApprovalActions?: boolean
  /** Drawer/modal: natural height; inline panel: fill available column height */
  fitContent?: boolean
}

export function EventDetailContent({
  event,
  onClose,
  canEdit,
  isExternalView = false,
  onEdit,
  onViewRecord,
  onAttendanceChange,
  onManageAttendees,
  showScheduleTab = true,
  showResourcesTab = true,
  showNotesTab = true,
  showAttendanceControls = true,
  allowCalendarExport = true,
  attendanceStatus = null,
  isEditingBlock = false,
  onApprove,
  onReject,
  showApprovalActions = false,
  fitContent = false,
}: EventDetailContentProps) {
  const { toast } = useToast()
  const statusColor = statusAccentColor(event.status)
  const resolvedAttendance =
    attendanceStatus ?? event.currentUserAttendanceStatus ?? (event.currentUserAttending ? "attending" : null)
  const showInternalNotes = showNotesTab && !isExternalView && canEdit
  const showBudget = !isExternalView && canEdit && !!event.budget

  const share = () => {
    const url = typeof window !== "undefined" ? window.location.href : ""
    void navigator.clipboard?.writeText(url)
    toast({ title: "Link copied", description: "Event page link copied to clipboard." })
  }

  const handleAttendance = (status: EventAttendanceStatus) => {
    if (isEditingBlock) return
    onAttendanceChange?.(status)
  }

  return (
    <div className={cn("flex flex-col min-h-0", fitContent ? "h-auto" : "h-full")}>
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex flex-wrap gap-1 justify-end">
          {event.eventType ? (
            <Badge
              variant="secondary"
              className="text-[10px] font-medium"
              style={{
                backgroundColor: event.backgroundColor,
                color: event.accentColor,
              }}
            >
              {event.eventType}
            </Badge>
          ) : null}
          {event.status ? (
            <span
              className="inline-flex text-[10px] font-medium rounded-full px-2 py-0.5"
              style={{
                backgroundColor: `${statusColor}22`,
                color: statusColor,
              }}
            >
              {event.status}
            </span>
          ) : null}
        </div>
      </div>

      <div className="px-4 pb-3 shrink-0">
        <h2 className="text-lg font-semibold text-foreground leading-tight">{event.eventName}</h2>
      </div>

      <div className="px-4 space-y-2 text-sm text-muted-foreground shrink-0">
        <p className="flex items-center gap-2">
          <Calendar className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
          {event.dateRangeLabel}
        </p>
        {event.locationLabel ? (
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
            {event.locationLabel}
          </p>
        ) : null}
        {event.country && !event.locationLabel?.includes(event.country) ? (
          <p className="text-xs pl-6">{event.country}</p>
        ) : null}
        {event.venueLabel ? (
          <p className="text-xs pl-6 text-muted-foreground/90">Venue: {event.venueLabel}</p>
        ) : null}
        {event.websiteUrl ? (
          <a
            href={event.websiteUrl.startsWith("http") ? event.websiteUrl : `https://${event.websiteUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-accent-link hover:underline"
          >
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
            {event.websiteUrl.replace(/^https?:\/\//, "")}
          </a>
        ) : null}
      </div>

      {event.description ? (
        <p className="px-4 py-2 text-sm text-muted-foreground leading-relaxed shrink-0 line-clamp-4">
          {event.description}
        </p>
      ) : null}

      {event.heroImageUrl ? (
        <div className="px-4 py-3 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.heroImageUrl}
            alt=""
            className="w-full h-36 object-cover rounded-lg border border-border/30"
          />
        </div>
      ) : null}

      <Tabs
        defaultValue="overview"
        className={cn("flex flex-col px-4", fitContent ? "pb-2" : "flex-1 min-h-0")}
      >
        <TabsList
          className={cn(
            "w-full h-8 shrink-0",
            showScheduleTab && showResourcesTab && showInternalNotes
              ? "grid grid-cols-4"
              : showScheduleTab && (showResourcesTab || showInternalNotes)
                ? "grid grid-cols-3"
                : showScheduleTab || showResourcesTab || showInternalNotes
                  ? "grid grid-cols-2"
                  : "grid grid-cols-1"
          )}
        >
          <TabsTrigger value="overview" className="text-xs">
            Overview
          </TabsTrigger>
          {showScheduleTab ? (
            <TabsTrigger value="schedule" className="text-xs">
              Schedule
            </TabsTrigger>
          ) : null}
          {showResourcesTab ? (
            <TabsTrigger value="resources" className="text-xs">
              Resources
            </TabsTrigger>
          ) : null}
          {showInternalNotes ? (
            <TabsTrigger value="notes" className="text-xs">
              Notes
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent
          value="overview"
          className={cn("mt-3 space-y-4 text-sm", fitContent ? "" : "flex-1 overflow-y-auto")}
        >
          <dl className="space-y-3 text-xs">
            {event.eventType ? (
              <div>
                <dt className="text-muted-foreground">Event type</dt>
                <dd className="mt-0.5 font-medium text-foreground">{event.eventType}</dd>
              </div>
            ) : null}
            {event.status ? (
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="mt-0.5 font-medium text-foreground">{event.status}</dd>
              </div>
            ) : null}
            {!isExternalView && event.visibility ? (
              <div>
                <dt className="text-muted-foreground">Visibility</dt>
                <dd className="mt-0.5 font-medium text-foreground">{event.visibility}</dd>
              </div>
            ) : null}
            {event.campaignLabel ? (
              <div>
                <dt className="text-muted-foreground">Linked campaign</dt>
                <dd className="mt-0.5 font-medium text-accent-link">{event.campaignLabel}</dd>
              </div>
            ) : null}
            {event.ownerLabel ? (
              <div>
                <dt className="text-muted-foreground">Organiser</dt>
                <dd className="mt-0.5 font-medium text-foreground">{event.ownerLabel}</dd>
              </div>
            ) : null}
            {showBudget ? (
              <div>
                <dt className="text-muted-foreground">Budget</dt>
                <dd className="mt-0.5 font-medium text-foreground">{event.budget}</dd>
              </div>
            ) : null}
          </dl>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> Attendees ({event.attendeeCount})
              </span>
              {canEdit && onManageAttendees ? (
                <button
                  type="button"
                  className="text-xs text-accent-link hover:underline"
                  onClick={onManageAttendees}
                >
                  Manage
                </button>
              ) : null}
            </div>
            <EventAvatarStack labels={event.attendeeLabels} max={8} />
          </div>
        </TabsContent>

        {showScheduleTab ? (
          <TabsContent
            value="schedule"
            className={cn("mt-3", fitContent ? "" : "flex-1 overflow-y-auto")}
          >
            {event.scheduleItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">No schedule items yet.</p>
            ) : (
              <ul className="space-y-2">
                {event.scheduleItems.map((item, i) => (
                  <li key={`${item.label}-${i}`} className="text-xs border-l-2 pl-2 border-border/50">
                    <p className="font-medium text-foreground">{item.label}</p>
                    <p className="text-muted-foreground">
                      {item.date}
                      {item.time ? ` · ${item.time}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        ) : null}

        {showResourcesTab ? (
          <TabsContent
            value="resources"
            className={cn("mt-3", fitContent ? "" : "flex-1 overflow-y-auto")}
          >
            {event.resources.length === 0 ? (
              <p className="text-xs text-muted-foreground">No resources linked.</p>
            ) : (
              <ul className="space-y-2">
                {event.resources.map((r, i) => (
                  <li key={`${r.label}-${i}`}>
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent-link hover:underline"
                      >
                        {r.label}
                      </a>
                    ) : (
                      <span className="text-xs text-foreground">{r.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        ) : null}

        {showInternalNotes ? (
          <TabsContent
            value="notes"
            className={cn("mt-3", fitContent ? "" : "flex-1 overflow-y-auto")}
          >
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
              {event.notes || "No internal notes."}
            </p>
          </TabsContent>
        ) : null}
      </Tabs>

      {showAttendanceControls && !isEditingBlock ? (
        <div className="shrink-0 px-4 py-3 border-t border-border/30">
          <p className="text-xs font-medium text-muted-foreground mb-2">Your attendance</p>
          <div className="flex flex-wrap gap-1.5">
            {ATTENDANCE_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                type="button"
                size="sm"
                variant={resolvedAttendance === opt.value ? "default" : "outline"}
                className="h-8 text-xs"
                onClick={() => handleAttendance(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {allowCalendarExport && !isEditingBlock ? (
        <div className="shrink-0 px-4 pb-2">
          <p className="text-xs font-medium text-muted-foreground mb-2">Add to calendar</p>
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" asChild>
              <a href={googleCalendarAddUrl(event)} target="_blank" rel="noopener noreferrer">
                Google
              </a>
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" asChild>
              <a href={outlookCalendarAddUrl(event)} target="_blank" rel="noopener noreferrer">
                Outlook
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => downloadEventIcs(event)}
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              .ics
            </Button>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "shrink-0 border-t border-border/40 p-4 flex flex-col gap-2",
          fitContent ? "" : "mt-auto"
        )}
      >
        {showApprovalActions && onApprove ? (
          <div className="flex flex-col gap-2 pb-2">
            <Button type="button" className="w-full" onClick={onApprove}>
              Approve event
            </Button>
            {onReject ? (
              <Button type="button" variant="outline" className="w-full" onClick={onReject}>
                Reject
              </Button>
            ) : null}
          </div>
        ) : null}
        {onViewRecord ? (
          <Button type="button" className="w-full gap-2" onClick={onViewRecord}>
            View details
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        ) : null}
        {canEdit ? (
          <Button type="button" variant={onViewRecord ? "outline" : "default"} className="w-full gap-2" onClick={onEdit}>
            <Pencil className="h-4 w-4" aria-hidden />
            Edit event
          </Button>
        ) : null}
        <Button type="button" variant="outline" className="w-full gap-2 text-xs" onClick={share}>
          <Share2 className="h-3.5 w-3.5" aria-hidden />
          Share event
        </Button>
      </div>
    </div>
  )
}

/** Portaled drawer chrome — full viewport overlay + content-height panel (REG-004). */
export function EventDetailFloatingShell({
  children,
  onClose,
  ariaLabel,
}: {
  children: ReactNode
  onClose: () => void
  ariaLabel: string
}) {
  return (
    <>
      <div
        className="fixed inset-0 md:left-64 bg-black/25 z-[80]"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="fixed z-[90] right-0 top-0 w-full max-w-md h-auto max-h-[100dvh] overflow-y-auto overscroll-contain bg-background border-l border-border/40 shadow-xl md:right-4 md:top-4 md:max-h-[calc(100dvh-2rem)] md:w-[min(100%,24rem)] md:rounded-xl md:border"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        {children}
      </aside>
    </>
  )
}

function EventDetailPortaledOverlay({
  event,
  onClose,
  contentProps,
}: {
  event: MarketingEventItem
  onClose: () => void
  contentProps: Omit<EventDetailContentProps, "event" | "onClose">
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return createPortal(
    <EventDetailFloatingShell onClose={onClose} ariaLabel={`Event: ${event.eventName}`}>
      <EventDetailContent event={event} onClose={onClose} fitContent {...contentProps} />
    </EventDetailFloatingShell>,
    document.body
  )
}

interface EventDetailPanelProps {
  event: MarketingEventItem | null
  open: boolean
  onClose: () => void
  contentProps: Omit<EventDetailContentProps, "event" | "onClose">
}

export default function EventDetailPanel({ event, open, onClose, contentProps }: EventDetailPanelProps) {
  if (!event || !open) return null

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col w-[360px] shrink-0 border-l border-border/40 bg-card/80 backdrop-blur-sm",
        "max-h-[min(78vh,720px)] rounded-l-xl shadow-sm overflow-hidden"
      )}
    >
      <EventDetailContent event={event} onClose={onClose} {...contentProps} />
    </aside>
  )
}

export function EventDetailPanelOverlay({
  event,
  open,
  onClose,
  contentProps,
}: EventDetailPanelProps) {
  if (!event || !open) return null
  return (
    <EventDetailPortaledOverlay event={event} onClose={onClose} contentProps={contentProps} />
  )
}

/** Modal variant for event_calendar_detail_mode = modal */
export function EventDetailModal({
  event,
  open,
  onClose,
  contentProps,
}: EventDetailPanelProps) {
  return (
    <Sheet open={open && !!event} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        {event ? (
          <EventDetailContent event={event} onClose={onClose} fitContent {...contentProps} />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
