"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
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
  Mail,
  Check,
  X,
  FileText,
  Presentation,
  HardDrive,
  type LucideIcon,
} from "lucide-react"
import type { PageBlock } from "@/lib/interface/types"
import { useEventCalendarData } from "@/hooks/useEventCalendarData"
import { useResourceHubData } from "@/hooks/useResourceHubData"
import { useMembersWelcomePageLinks } from "@/hooks/useMembersWelcomePageLinks"
import { useRecordModal } from "@/contexts/RecordModalContext"
import { createClient } from "@/lib/supabase/client"
import type { EventAttendanceStatus } from "@/lib/marketing/events"
import {
  filterMembersWelcomeEvents,
  filterMembersWelcomeResources,
  membersWelcomeCopy,
  membersWelcomeLimits,
  membersWelcomeGreeting,
  countAttendingEvents,
  eventDateParts,
  renderMembersWelcomeHeroTitle,
  resourceSourceLabel,
  resourceBadgeColors,
  attendanceBadgeStyle,
  MEMBERS_WELCOME_HERO_IMAGE,
  MEMBERS_WELCOME_QUICK_ACTIONS,
  type MembersWelcomeQuickActionId,
  pagePath,
} from "@/lib/marketing/members-welcome"
import {
  categoryLabel,
} from "@/components/interface/blocks/internal-resource-hub/types"
import type { MockResource } from "@/components/interface/blocks/internal-resource-hub/types"
import DashboardEmpty from "@/components/interface/primitives/DashboardEmpty"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface MembersWelcomeBlockProps {
  block: PageBlock
  isEditing?: boolean
  interfaceMode?: "view" | "edit"
}

const QUICK_ACTION_ICONS: Record<MembersWelcomeQuickActionId, LucideIcon> = {
  events: CalendarDays,
  attendance: UserCheck,
  resources: FolderOpen,
  submit: PlusCircle,
  contacts: Users,
  help: HelpCircle,
}

const RSVP_OPTIONS: {
  value: EventAttendanceStatus
  label: string
  icon: LucideIcon
}[] = [
  { value: "attending", label: "Going", icon: Check },
  { value: "maybe", label: "Maybe", icon: HelpCircle },
  { value: "not_attending", label: "Can't", icon: X },
]

function rsvpButtonStyle(value: EventAttendanceStatus, active: boolean) {
  if (!active) {
    return {
      bg: "#fff",
      border: "#e4e7ec",
      fg: "#6b7280",
    }
  }
  if (value === "attending") {
    return { bg: "#e7f3ee", border: "#bfe3cf", fg: "#1b7a52" }
  }
  if (value === "maybe") {
    return { bg: "#e3f0fa", border: "#bcdcf2", fg: "#0a6bb0" }
  }
  return { bg: "#f3f4f6", border: "#e2e5ea", fg: "#6b7280" }
}

function resourceTileContent(resource: MockResource) {
  if (resource.thumbnailUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resource.thumbnailUrl}
        alt=""
        className="h-full w-full object-cover"
      />
    )
  }
  if (resource.fileType === "PPTX") {
    return <Presentation className="h-5 w-5" style={{ color: resourceBadgeColors(resource.fileType).fg }} aria-hidden />
  }
  return <FileText className="h-5 w-5" style={{ color: resourceBadgeColors(resource.fileType).fg }} aria-hidden />
}

function QuickActionCard({
  title,
  description,
  actionLabel,
  iconTint,
  iconColor,
  icon: Icon,
  href,
  isEditing = false,
}: {
  title: string
  description: string
  actionLabel: string
  iconTint: string
  iconColor: string
  icon: LucideIcon
  href: string | null
  isEditing?: boolean
}) {
  const body = (
    <article
      className={cn(
        "group flex h-full flex-col rounded-2xl border border-[#e4e7ec] bg-white p-[18px] shadow-[0_1px_3px_rgba(31,42,68,0.05)] transition-all duration-200",
        href && !isEditing && "cursor-pointer hover:-translate-y-0.5 hover:border-[#cfd5dd] hover:shadow-[0_12px_28px_rgba(31,42,68,0.12)]"
      )}
    >
      <div
        className="mb-3.5 flex h-[42px] w-[42px] items-center justify-center rounded-[11px]"
        style={{ backgroundColor: iconTint, color: iconColor }}
      >
        <Icon className="h-[21px] w-[21px]" aria-hidden />
      </div>
      <h3 className="text-[15px] font-semibold leading-snug text-[#1f2a44]">{title}</h3>
      <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-[#6b7280]">{description}</p>
      <span
        className={cn(
          "mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold",
          href ? "text-[#005b8f]" : "text-[#9ca3af]"
        )}
      >
        {actionLabel}
        {href ? <ArrowRight className="h-[15px] w-[15px]" aria-hidden /> : null}
      </span>
    </article>
  )

  if (!href || isEditing) {
    return <div className="block h-full">{body}</div>
  }

  return (
    <Link
      href={href}
      className="block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005b8f]/40"
    >
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
  const { toast } = useToast()
  const { openRecordModal } = useRecordModal()
  const { links, loading: linksLoading } = useMembersWelcomePageLinks(config)
  const limits = membersWelcomeLimits(config)
  const copy = membersWelcomeCopy(config)
  const heroTitle = renderMembersWelcomeHeroTitle(copy.title)
  const [userFirstName, setUserFirstName] = useState<string | null>(null)
  const [rsvpBusyId, setRsvpBusyId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const loadUserName = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase.auth.getUser()
        const user = data?.user
        if (!user || cancelled) return

        const md = (user.user_metadata || {}) as Record<string, unknown>
        const full =
          (typeof md.full_name === "string" && md.full_name.trim()) ||
          (typeof md.name === "string" && md.name.trim()) ||
          (typeof md.display_name === "string" && md.display_name.trim()) ||
          ""
        const first =
          (typeof md.first_name === "string" && md.first_name.trim()) ||
          (full ? full.split(" ")[0] : "")

        if (!cancelled) setUserFirstName(first || null)
      } catch {
        if (!cancelled) setUserFirstName(null)
      }
    }
    void loadUserName()
    return () => {
      cancelled = true
    }
  }, [])

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
    currentUserId,
    reload: reloadEvents,
    upsertAttendance,
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

  const attendingCount = useMemo(
    () => countAttendingEvents(upcomingEvents),
    [upcomingEvents]
  )

  const featuredResources = useMemo(
    () => filterMembersWelcomeResources(liveResources).slice(0, limits.maxResources),
    [liveResources, limits.maxResources]
  )

  const quickActionHrefs = useMemo(
    (): Record<MembersWelcomeQuickActionId, string | null> => ({
      events: pagePath(links.events),
      attendance: pagePath(links.events),
      resources: pagePath(links.resources),
      submit: limits.allowSubmitEvent ? pagePath(links.events) : null,
      contacts: pagePath(links.contacts),
      help: pagePath(links.help),
    }),
    [links, limits.allowSubmitEvent]
  )

  const visibleQuickActions = useMemo(() => {
    return MEMBERS_WELCOME_QUICK_ACTIONS.filter((action) => {
      if (action.id === "submit" && !limits.allowSubmitEvent) return false
      if (action.id === "contacts" && !links.contacts) return false
      if (action.id === "help" && !links.help) return false
      return true
    })
  }, [limits.allowSubmitEvent, links.contacts, links.help])

  const handleRsvp = useCallback(
    async (eventId: string, status: EventAttendanceStatus, current: EventAttendanceStatus | null) => {
      if (isEditing) return
      if (!currentUserId) {
        toast({
          title: "Sign in required",
          description: "You must be signed in to update attendance.",
        })
        return
      }

      setRsvpBusyId(eventId)
      try {
        if (current === status) {
          const supabase = createClient()
          const { error } = await supabase
            .from("event_attendance")
            .delete()
            .eq("event_id", eventId)
            .eq("user_id", currentUserId)
          if (error) throw new Error(error.message)
        } else {
          await upsertAttendance(eventId, status)
        }
        reloadEvents()
      } catch (e) {
        toast({
          title: "Could not update attendance",
          description: e instanceof Error ? e.message : "Try again",
          variant: "destructive",
        })
      } finally {
        setRsvpBusyId(null)
      }
    },
    [isEditing, currentUserId, upsertAttendance, reloadEvents, toast]
  )

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

  const openResource = useCallback(
    (url?: string) => {
      if (isEditing || !url) return
      window.open(url, "_blank", "noopener,noreferrer")
    },
    [isEditing]
  )

  return (
    <div
      data-block-selectable
      data-block-type="members_welcome"
      className="mx-auto w-full max-w-6xl space-y-7 px-1 py-2 pb-8"
    >
      {/* Hero */}
      <section className="relative flex min-h-[248px] items-end overflow-hidden rounded-[20px]">
        <Image
          src={MEMBERS_WELCOME_HERO_IMAGE}
          alt=""
          fill
          priority
          className="object-cover object-[center_40%]"
          sizes="(max-width: 1152px) 100vw, 1152px"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(108deg, rgba(15,28,43,0.9) 0%, rgba(15,28,43,0.6) 48%, rgba(15,28,43,0.25) 100%)",
          }}
          aria-hidden
        />
        <div className="relative w-full p-6 md:p-8">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[#d9c49a]">
            {membersWelcomeGreeting(userFirstName)}
          </p>
          <h1 className="max-w-[560px] text-[30px] font-light leading-[1.12] tracking-[-0.02em] text-white">
            {heroTitle.before}
            {heroTitle.highlight ? (
              <span className="font-semibold">{heroTitle.highlight}</span>
            ) : null}
            {heroTitle.after}
          </h1>
          <p className="mt-2 max-w-[500px] text-[14.5px] leading-relaxed text-[#d3dbe6]">
            {copy.subtitle}
          </p>
          <div className="mt-[18px] flex flex-wrap gap-2.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3.5 py-2 backdrop-blur-md">
              <CalendarDays className="h-[15px] w-[15px] text-white" aria-hidden />
              <span className="text-[12.5px] font-semibold text-white">
                {upcomingEvents.length} upcoming event{upcomingEvents.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3.5 py-2 backdrop-blur-md">
              <UserCheck className="h-[15px] w-[15px] text-white" aria-hidden />
              <span className="text-[12.5px] font-semibold text-white">
                {attendingCount} you&apos;re attending
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Quick actions */}
      {copy.showQuickActions ? (
        <section>
          <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-[#1f2a44]">
              Quick actions
            </h2>
            <span className="text-[13px] text-[#9aa1ab]">Open the areas you use most</span>
          </div>
          {linksLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="sm" text="Loading links…" />
            </div>
          ) : (
            <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
              {visibleQuickActions.map((action) => (
                <QuickActionCard
                  key={action.id}
                  title={action.title}
                  description={action.description}
                  actionLabel={action.actionLabel}
                  iconTint={action.iconTint}
                  iconColor={action.iconColor}
                  icon={QUICK_ACTION_ICONS[action.id]}
                  href={quickActionHrefs[action.id]}
                  isEditing={isEditing}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* Snapshots */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Events */}
        <section className="flex min-h-[320px] flex-col overflow-hidden rounded-[18px] border border-[#e4e7ec] bg-white">
          <header className="flex items-start justify-between gap-3 border-b border-[#eef1f4] px-[18px] py-[17px]">
            <div>
              <h2 className="text-[15px] font-semibold text-[#1f2a44]">Upcoming events</h2>
              <p className="mt-1 text-xs text-[#9aa1ab]">
                Your next {limits.maxEvents} visible events
              </p>
            </div>
            {links.events && !isEditing ? (
              <Link
                href={pagePath(links.events)!}
                className="shrink-0 text-xs font-semibold text-[#005b8f] hover:underline"
              >
                View all
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
              <ul className="space-y-2.5">
                {upcomingEvents.map((event) => {
                  const dateParts = eventDateParts(event.startDate)
                  const badge = attendanceBadgeStyle(event.currentUserAttendanceStatus)
                  const busy = rsvpBusyId === event.id

                  return (
                    <li
                      key={event.id}
                      className="rounded-[13px] border border-[#eef1f4] bg-[#fafbfc] p-[13px]"
                    >
                      <div className="flex items-start gap-3">
                        {dateParts ? (
                          <div className="w-[46px] shrink-0 overflow-hidden rounded-[9px] border border-[#e4e7ec] bg-white text-center">
                            <div
                              className="px-0 py-1 text-[9px] font-bold tracking-[0.06em] text-white"
                              style={{ backgroundColor: event.accentColor || "#005b8f" }}
                            >
                              {dateParts.month}
                            </div>
                            <div className="py-1.5 text-[17px] font-bold leading-none text-[#1f2a44]">
                              {dateParts.day}
                            </div>
                          </div>
                        ) : (
                          <div
                            className="mt-1 h-12 w-1 shrink-0 rounded-full"
                            style={{ backgroundColor: event.accentColor || "#005b8f" }}
                            aria-hidden
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            className="text-left"
                            disabled={isEditing}
                            onClick={() => openEvent(event.id)}
                          >
                            <p className="text-[13.5px] font-semibold leading-snug text-[#1f2a44]">
                              {event.eventName}
                            </p>
                          </button>
                          <p className="mt-0.5 text-xs leading-snug text-[#9aa1ab]">
                            {event.dateRangeLabel}
                            {event.locationLabel ? ` · ${event.locationLabel}` : ""}
                          </p>
                          <div
                            className="mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold"
                            style={{
                              backgroundColor: badge.bg,
                              borderColor: badge.border,
                              color: badge.fg,
                            }}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: badge.dot }}
                              aria-hidden
                            />
                            {badge.label}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2.5 flex gap-1.5">
                        {RSVP_OPTIONS.map((opt) => {
                          const active = event.currentUserAttendanceStatus === opt.value
                          const style = rsvpButtonStyle(opt.value, active)
                          const Icon = opt.icon
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              disabled={isEditing || busy}
                              className="flex flex-1 items-center justify-center gap-1 rounded-lg px-1 py-[7px] text-[11.5px] font-semibold transition-colors disabled:opacity-60"
                              style={{
                                backgroundColor: style.bg,
                                border: `1px solid ${style.border}`,
                                color: style.fg,
                              }}
                              onClick={() =>
                                void handleRsvp(
                                  event.id,
                                  opt.value,
                                  event.currentUserAttendanceStatus
                                )
                              }
                            >
                              <Icon className="h-[13px] w-[13px]" aria-hidden />
                              {opt.label}
                            </button>
                          )
                        })}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Resources */}
        <section className="flex min-h-[320px] flex-col overflow-hidden rounded-[18px] border border-[#e4e7ec] bg-white">
          <header className="flex items-start justify-between gap-3 border-b border-[#eef1f4] px-[18px] py-[17px]">
            <div>
              <h2 className="text-[15px] font-semibold text-[#1f2a44]">Featured resources</h2>
              <p className="mt-1 text-xs text-[#9aa1ab]">Approved files &amp; guidance</p>
            </div>
            {links.resources && !isEditing ? (
              <Link
                href={pagePath(links.resources)!}
                className="shrink-0 text-xs font-semibold text-[#005b8f] hover:underline"
              >
                View all
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
              <ul>
                {featuredResources.map((resource) => {
                  const badge = resourceBadgeColors(resource.fileType)
                  const source = resourceSourceLabel(resource.source)
                  const tileBg = resource.thumbnailUrl
                    ? "#eef1f4"
                    : resource.fileType === "PNG" || resource.fileType === "SVG"
                      ? "#fff"
                      : badge.bg

                  return (
                    <li key={resource.id}>
                      <button
                        type="button"
                        disabled={isEditing || !resource.url}
                        className="flex w-full items-center gap-3 border-b border-[#f3f5f8] px-[18px] py-[13px] text-left transition-colors hover:bg-[#f7f9fb] disabled:cursor-default disabled:hover:bg-transparent"
                        onClick={() => openResource(resource.url)}
                      >
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[10px]"
                          style={{ backgroundColor: tileBg }}
                        >
                          {resourceTileContent(resource)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-semibold text-[#1f2a44]">
                            {resource.title}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="text-[11.5px] text-[#9aa1ab]">
                              {categoryLabel(resource.category)}
                              {resource.updatedAt ? ` · ${resource.updatedAt}` : ""}
                            </span>
                            {source ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#b08d52]">
                                <HardDrive className="h-[11px] w-[11px]" aria-hidden />
                                {source}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <span
                          className="shrink-0 rounded-md px-[7px] py-[5px] text-[9px] font-extrabold tracking-[0.04em]"
                          style={{ backgroundColor: badge.bg, color: badge.fg }}
                        >
                          {resource.fileType.length <= 4
                            ? resource.fileType
                            : resource.fileType.slice(0, 4)}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            {resourcesError && !resourcesLive ? (
              <p className="px-[18px] pb-3 text-xs text-amber-700">{resourcesError}</p>
            ) : null}
          </div>
        </section>
      </div>

      {/* Guidance */}
      <section
        className="rounded-[18px] border border-[#ece3cf] p-6"
        style={{ background: "linear-gradient(120deg, #f7f4ec, #fbf9f3)" }}
      >
        <div className="flex flex-col flex-wrap items-center gap-[18px] sm:flex-row">
          <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl bg-[#f0e7d3] text-[#b08d52]">
            <Megaphone className="h-[22px] w-[22px]" aria-hidden />
          </div>
          <div className="min-w-[240px] flex-1">
            <h2 className="text-base font-semibold text-[#1f2a44]">How to use this space</h2>
            <p className="mt-1 max-w-[640px] text-[13px] leading-relaxed text-[#7d6a45]">
              {copy.body}
            </p>
          </div>
          {links.help && !isEditing ? (
            <Link
              href={pagePath(links.help)!}
              className="inline-flex shrink-0 items-center gap-2 rounded-[10px] bg-gradient-to-r from-[#c4a574] to-[#b08d52] px-5 py-3 text-[13px] font-semibold text-white shadow-[0_6px_16px_rgba(176,141,82,0.3)] hover:from-[#b89866] hover:to-[#9f7d49]"
            >
              <Mail className="h-4 w-4" aria-hidden />
              Contact the team
            </Link>
          ) : links.help && isEditing ? (
            <span className="inline-flex shrink-0 items-center gap-2 rounded-[10px] bg-gradient-to-r from-[#c4a574]/80 to-[#b08d52]/80 px-5 py-3 text-[13px] font-semibold text-white">
              <Mail className="h-4 w-4" aria-hidden />
              Contact the team
            </span>
          ) : null}
        </div>
      </section>
    </div>
  )
}
