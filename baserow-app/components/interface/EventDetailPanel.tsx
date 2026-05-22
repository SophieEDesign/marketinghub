"use client"

import {
  X,
  MoreHorizontal,
  MapPin,
  Calendar,
  ExternalLink,
  Users,
  Pencil,
  Share2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { EventAvatarStack } from "@/components/interface/events/EventAvatarStack"
import type { MarketingEventItem } from "@/lib/marketing/events"
import { statusAccentColor } from "@/lib/marketing/events"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"

interface EventDetailPanelProps {
  event: MarketingEventItem | null
  open: boolean
  onClose: () => void
  canEdit: boolean
  onEdit: () => void
  onToggleAttending: () => void
  onManageAttendees?: () => void
  isMobile?: boolean
}

function PanelBody({
  event,
  canEdit,
  onClose,
  onEdit,
  onToggleAttending,
  onManageAttendees,
}: {
  event: MarketingEventItem
  canEdit: boolean
  onClose: () => void
  onEdit: () => void
  onToggleAttending: () => void
  onManageAttendees?: () => void
}) {
  const { toast } = useToast()
  const statusColor = statusAccentColor(event.status)

  const share = () => {
    const url = typeof window !== "undefined" ? window.location.href : ""
    void navigator.clipboard?.writeText(url)
    toast({ title: "Link copied", description: "Event page link copied to clipboard." })
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-muted"
          aria-label="More options"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      <div className="px-4 pb-3 shrink-0">
        {event.eventType ? (
          <Badge
            variant="secondary"
            className="mb-2 text-[10px] font-medium"
            style={{
              backgroundColor: event.backgroundColor,
              color: event.accentColor,
            }}
          >
            {event.eventType}
          </Badge>
        ) : null}
        <h2 className="text-lg font-semibold text-foreground leading-tight">{event.eventName}</h2>
        {event.status ? (
          <span
            className="inline-flex mt-2 text-[11px] font-medium rounded-full px-2 py-0.5"
            style={{
              backgroundColor: `${statusColor}22`,
              color: statusColor,
            }}
          >
            {event.status}
          </span>
        ) : null}
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

      <Tabs defaultValue="overview" className="flex flex-col flex-1 min-h-0 px-4">
        <TabsList className="w-full grid grid-cols-4 h-8 shrink-0">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="schedule" className="text-xs">Schedule</TabsTrigger>
          <TabsTrigger value="resources" className="text-xs">Resources</TabsTrigger>
          <TabsTrigger value="notes" className="text-xs">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex-1 overflow-y-auto mt-3 space-y-4 text-sm">
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
          <dl className="space-y-2 text-xs">
            {event.eventType ? (
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Event type</dt>
                <dd className="font-medium text-foreground">{event.eventType}</dd>
              </div>
            ) : null}
            {event.themeLabel ? (
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Theme</dt>
                <dd className="font-medium text-foreground">{event.themeLabel}</dd>
              </div>
            ) : null}
            {event.ownerLabel ? (
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Owner</dt>
                <dd className="font-medium text-foreground">{event.ownerLabel}</dd>
              </div>
            ) : null}
            {event.budget ? (
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Budget</dt>
                <dd className="font-medium text-foreground">{event.budget}</dd>
              </div>
            ) : null}
          </dl>
          {event.description ? (
            <p className="text-xs text-muted-foreground leading-relaxed">{event.description}</p>
          ) : null}
        </TabsContent>

        <TabsContent value="schedule" className="flex-1 overflow-y-auto mt-3">
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
                  {item.notes ? <p className="text-muted-foreground/80 mt-0.5">{item.notes}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="resources" className="flex-1 overflow-y-auto mt-3">
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

        <TabsContent value="notes" className="flex-1 overflow-y-auto mt-3">
          <p className="text-xs text-muted-foreground whitespace-pre-wrap">
            {event.notes || "No internal notes."}
          </p>
        </TabsContent>
      </Tabs>

      <div className="shrink-0 border-t border-border/40 p-4 flex flex-col gap-2 mt-auto">
        {canEdit ? (
          <Button type="button" className="w-full gap-2" onClick={onEdit}>
            <Pencil className="h-4 w-4" aria-hidden />
            Edit event
          </Button>
        ) : null}
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1 gap-2 text-xs" onClick={share}>
            <Share2 className="h-3.5 w-3.5" aria-hidden />
            Share event
          </Button>
          <Button
            type="button"
            variant={event.currentUserAttending ? "secondary" : "outline"}
            className="flex-1 text-xs"
            onClick={onToggleAttending}
          >
            {event.currentUserAttending ? "Attending" : "Mark attending"}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function EventDetailPanel({
  event,
  open,
  onClose,
  canEdit,
  onEdit,
  onToggleAttending,
  onManageAttendees,
  isMobile = false,
}: EventDetailPanelProps) {
  if (!event) return null

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <PanelBody
            event={event}
            canEdit={canEdit}
            onClose={onClose}
            onEdit={onEdit}
            onToggleAttending={onToggleAttending}
            onManageAttendees={onManageAttendees}
          />
        </SheetContent>
      </Sheet>
    )
  }

  if (!open) return null

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col w-[360px] shrink-0 border-l border-border/40 bg-card/80 backdrop-blur-sm",
        "max-h-[min(78vh,720px)] rounded-l-xl shadow-sm overflow-hidden"
      )}
    >
      <PanelBody
        event={event}
        canEdit={canEdit}
        onClose={onClose}
        onEdit={onEdit}
        onToggleAttending={onToggleAttending}
        onManageAttendees={onManageAttendees}
      />
    </aside>
  )
}

/** Tablet overlay panel */
export function EventDetailPanelOverlay({
  event,
  open,
  onClose,
  canEdit,
  onEdit,
  onToggleAttending,
  onManageAttendees,
}: EventDetailPanelProps) {
  if (!event || !open) return null

  return (
    <>
      <div
        className="fixed inset-0 md:left-sidebar bg-black/20 z-40 lg:hidden"
        onClick={onClose}
        aria-hidden
      />
      <aside className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-background border-l border-border/40 shadow-xl flex flex-col lg:hidden">
        <PanelBody
          event={event}
          canEdit={canEdit}
          onClose={onClose}
          onEdit={onEdit}
          onToggleAttending={onToggleAttending}
          onManageAttendees={onManageAttendees}
        />
      </aside>
    </>
  )
}
