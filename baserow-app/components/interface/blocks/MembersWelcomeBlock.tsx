"use client"

import { useCallback, useMemo } from "react"
import Link from "next/link"
import {
  CalendarDays,
  UserCheck,
  FolderOpen,
  PlusCircle,
  Users,
  HelpCircle,
  ArrowRight,
  Megaphone,
  Ship,
} from "lucide-react"
import type { PageBlock } from "@/lib/interface/types"
import { useEventCalendarData } from "@/hooks/useEventCalendarData"
import { useResourceHubData } from "@/hooks/useResourceHubData"
import { useMembersWelcomePageLinks } from "@/hooks/useMembersWelcomePageLinks"
import { useRecordModal } from "@/contexts/RecordModalContext"
import {
  filterMembersWelcomeEvents,
  filterMembersWelcomeResources,
  membersWelcomeLimits,
  pagePath,
  attendanceDisplayLabel,
  attendanceBadgeClass,
} from "@/lib/marketing/members-welcome"
import { categoryLabel, getFileTypeBadgeClasses } from "@/components/interface/blocks/internal-resource-hub/types"
import DashboardEmpty from "@/components/interface/primitives/DashboardEmpty"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface MembersWelcomeBlockProps {
  block: PageBlock
  isEditing?: boolean
  interfaceMode?: "view" | "edit"
}

type QuickAction = {
  id: string
  title: string
  description: string
  actionLabel: string
  href: string | null
  icon: typeof CalendarDays
}

function QuickActionCard({ action }: { action: QuickAction }) {
  const Icon = action.icon
  const body = (
    <article className="flex h-full flex-col rounded-2xl border border-[#E6E6EF] bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#F3F0FF] text-[#6D4AFF]">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <h3 className="text-base font-semibold text-[#111827]">{action.title}</h3>
      <p className="mt-2 flex-1 text-sm text-[#6B7280]">{action.description}</p>
      <span
        className={cn(
          "mt-4 inline-flex items-center gap-1 text-sm font-semibold",
          action.href ? "text-[#6D4AFF]" : "text-[#9CA3AF]"
        )}
      >
        {action.actionLabel}
        {action.href ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
      </span>
    </article>
  )

  if (!action.href) {
    return body
  }

  return (
    <Link href={action.href} className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6D4AFF]/40 rounded-2xl">
      {body}
    </Link>
  )
}

export default function MembersWelcomeBlock({
  block,
  isEditing = false,
  interfaceMode = "view",
}: MembersWelcomeBlockProps) {
  const { config } = block
  const { openRecordModal } = useRecordModal()
  const { links, loading: linksLoading } = useMembersWelcomePageLinks(config)
  const limits = membersWelcomeLimits(config)

  const eventConfig = useMemo(
    () => ({
      ...config,
      event_calendar_external_mode: true,
      table_id: config.table_id || config.members_welcome_events_table_id,
    }),
    [config]
  )

  const resourceConfig = useMemo(
    () => ({
      ...config,
      table_id: config.table_id || config.members_welcome_resources_table_id,
      resource_hub_max_items: limits.maxResources,
      record_limit: limits.maxResources,
    }),
    [config, limits.maxResources]
  )

  const {
    loading: eventsLoading,
    allItems: eventItems,
    tableIds: eventTableIds,
    reload: reloadEvents,
  } = useEventCalendarData({ config: eventConfig })

  const {
    loading: resourcesLoading,
    resources: liveResources,
    fromLiveData: resourcesLive,
    hasTable: resourcesHasTable,
    error: resourcesError,
  } = useResourceHubData({ config: resourceConfig })

  const upcomingEvents = useMemo(
    () => filterMembersWelcomeEvents(eventItems, limits.maxEvents),
    [eventItems, limits.maxEvents]
  )

  const featuredResources = useMemo(
    () => filterMembersWelcomeResources(liveResources).slice(0, limits.maxResources),
    [liveResources, limits.maxResources]
  )

  const quickActions = useMemo((): QuickAction[] => {
    const actions: QuickAction[] = [
      {
        id: "events",
        title: "View Events",
        description: "See upcoming boat shows, industry events and member activities.",
        actionLabel: "Open event calendar",
        href: pagePath(links.events),
        icon: CalendarDays,
      },
      {
        id: "attendance",
        title: "My Attendance",
        description: "Check which events you are attending and update your response.",
        actionLabel: "View my events",
        href: pagePath(links.events),
        icon: UserCheck,
      },
      {
        id: "resources",
        title: "Resource Hub",
        description: "Access approved logos, presentations, documents and shared media.",
        actionLabel: "Open resources",
        href: pagePath(links.resources),
        icon: FolderOpen,
      },
    ]

    if (limits.allowSubmitEvent && links.events) {
      actions.push({
        id: "submit",
        title: "Submit an Event",
        description: "Suggest an event for review by the Peters & May team.",
        actionLabel: "Submit event",
        href: pagePath(links.events),
        icon: PlusCircle,
      })
    }

    if (links.contacts) {
      actions.push({
        id: "contacts",
        title: "Useful Contacts",
        description: "Find relevant Peters & May contacts for events and collaboration.",
        actionLabel: "View contacts",
        href: pagePath(links.contacts),
        icon: Users,
      })
    }

    if (links.help) {
      actions.push({
        id: "help",
        title: "Help & Guidance",
        description: "Learn how to use the hub or contact the team for support.",
        actionLabel: "Get help",
        href: pagePath(links.help),
        icon: HelpCircle,
      })
    }

    return actions
  }, [links, limits.allowSubmitEvent])

  const openEvent = useCallback(
    (id: string) => {
      if (isEditing || !eventTableIds?.contentTableId) return
      openRecordModal({
        tableId: eventTableIds.contentTableId,
        recordId: id,
        supabaseTableName: eventTableIds.contentSupabaseTable,
        interfaceMode,
        recordLayoutType: "event",
        initialDrawerMode: "view",
        onRecordUpdated: () => reloadEvents(),
      })
    },
    [isEditing, eventTableIds, openRecordModal, interfaceMode, reloadEvents]
  )

  const openResource = useCallback((url?: string) => {
    if (!url) return
    window.open(url, "_blank", "noopener,noreferrer")
  }, [])

  return (
    <div
      data-block-selectable
      data-block-type="members_welcome"
      className="mx-auto w-full max-w-6xl space-y-8 px-1 py-2 pb-8"
    >
      {/* Hero */}
      <section className="overflow-hidden rounded-2xl border border-[#E6E6EF] bg-gradient-to-br from-[#F7F4FF] to-white">
        <div className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:p-8">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-[#111827] md:text-3xl">
              Welcome to the Peters &amp; May Marketing Hub
            </h1>
            <p className="mt-2 text-sm text-[#374151] md:text-base">
              Access shared events, useful resources and collaboration tools in one place.
            </p>
            <p className="mt-3 text-sm text-[#6B7280]">
              Use this space to view upcoming events, manage your attendance, access approved
              documents and stay aligned with relevant activity.
            </p>
          </div>
          <div
            className="hidden shrink-0 md:flex h-28 w-40 items-center justify-center rounded-xl border border-[#E6E6EF]/80 bg-white/70 text-[#6D4AFF]"
            aria-hidden
          >
            <Ship className="h-16 w-16 opacity-80" strokeWidth={1.25} />
          </div>
        </div>
      </section>

      {/* Quick actions */}
      <section>
        <h2 className="text-lg font-semibold text-[#111827]">Quick actions</h2>
        <p className="mt-1 text-sm text-[#6B7280]">
          Open the areas you can use most often.
        </p>
        {linksLoading ? (
          <div className="mt-4 flex justify-center py-8">
            <LoadingSpinner size="sm" text="Loading links…" />
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {quickActions.map((action) => (
              <QuickActionCard key={action.id} action={action} />
            ))}
          </div>
        )}
      </section>

      {/* Snapshots */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Events */}
        <section className="flex min-h-[320px] flex-col rounded-2xl border border-[#E6E6EF] bg-white shadow-sm">
          <header className="flex items-start justify-between gap-3 border-b border-[#E6E6EF] px-4 py-4">
            <div>
              <h2 className="text-base font-semibold text-[#111827]">Upcoming Events</h2>
              <p className="text-xs text-[#6B7280]">Your next {limits.maxEvents} visible events</p>
            </div>
            {links.events ? (
              <Link
                href={pagePath(links.events)!}
                className="shrink-0 text-xs font-semibold text-[#6D4AFF] hover:underline"
              >
                View all events
              </Link>
            ) : null}
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {eventsLoading ? (
              <div className="flex h-40 items-center justify-center">
                <LoadingSpinner size="sm" text="Loading events…" />
              </div>
            ) : upcomingEvents.length === 0 ? (
              <DashboardEmpty
                title="No upcoming events are available yet."
                description="Check back soon or open the event calendar."
                variant="compact"
                className="py-8"
              />
            ) : (
              <ul className="space-y-2">
                {upcomingEvents.map((event) => (
                  <li
                    key={event.id}
                    className="flex items-center gap-3 rounded-xl border border-[#E6E6EF] bg-[#FAFAFC] p-3"
                  >
                    <div
                      className="h-12 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: event.accentColor || "#6D4AFF" }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#111827]">
                        {event.eventName}
                      </p>
                      <p className="truncate text-xs text-[#6B7280]">
                        {event.dateRangeLabel}
                        {event.locationLabel ? ` · ${event.locationLabel}` : ""}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        {event.eventType ? (
                          <span className="text-[10px] font-medium text-[#6B7280]">
                            {event.eventType}
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                            attendanceBadgeClass(event.currentUserAttendanceStatus)
                          )}
                        >
                          {attendanceDisplayLabel(event.currentUserAttendanceStatus)}
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 h-8 text-xs"
                      disabled={isEditing}
                      onClick={() => openEvent(event.id)}
                    >
                      View
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Resources */}
        <section className="flex min-h-[320px] flex-col rounded-2xl border border-[#E6E6EF] bg-white shadow-sm">
          <header className="flex items-start justify-between gap-3 border-b border-[#E6E6EF] px-4 py-4">
            <div>
              <h2 className="text-base font-semibold text-[#111827]">Featured Resources</h2>
              <p className="text-xs text-[#6B7280]">Approved files and guidance for members</p>
            </div>
            {links.resources ? (
              <Link
                href={pagePath(links.resources)!}
                className="shrink-0 text-xs font-semibold text-[#6D4AFF] hover:underline"
              >
                View all resources
              </Link>
            ) : null}
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {resourcesLoading ? (
              <div className="flex h-40 items-center justify-center">
                <LoadingSpinner size="sm" text="Loading resources…" />
              </div>
            ) : featuredResources.length === 0 ? (
              <DashboardEmpty
                title="No resources have been shared yet."
                description={
                  resourcesHasTable
                    ? "Approved resources will appear here when published."
                    : "Connect a media table in block settings."
                }
                variant="compact"
                className="py-8"
              />
            ) : (
              <ul className="divide-y divide-[#E6E6EF]">
                {featuredResources.map((resource) => (
                  <li key={resource.id} className="flex items-center gap-3 px-4 py-3">
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold uppercase",
                        getFileTypeBadgeClasses(resource.fileType)
                      )}
                    >
                      {resource.fileType.length <= 4
                        ? resource.fileType
                        : resource.fileType.slice(0, 3)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#111827]">
                        {resource.title}
                      </p>
                      <p className="text-xs text-[#6B7280]">
                        {categoryLabel(resource.category)}
                        {resource.updatedAt ? ` · ${resource.updatedAt}` : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 h-8 text-xs"
                      disabled={!resource.url}
                      onClick={() => openResource(resource.url)}
                    >
                      Open
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {resourcesError && !resourcesLive ? (
              <p className="px-4 pb-3 text-xs text-amber-700">{resourcesError}</p>
            ) : null}
          </div>
        </section>
      </div>

      {/* Guidance */}
      <section className="rounded-2xl border border-[#E6E6EF] bg-[#F7F4FF] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EDE9FE] text-[#6D4AFF]">
              <Megaphone className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#111827]">How to use this space</h2>
              <p className="mt-1 max-w-2xl text-sm text-[#6B7280]">
                Use the Events area to view upcoming activity and update your attendance. Use the
                Resource Hub to access approved documents and shared media. If you have an event to
                suggest or need any help, get in touch.
              </p>
            </div>
          </div>
          {links.help ? (
            <Link
              href={pagePath(links.help)!}
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[#6D4AFF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5a3de6]"
            >
              Contact the team
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  )
}
