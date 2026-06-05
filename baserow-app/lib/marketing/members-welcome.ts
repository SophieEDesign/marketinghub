import { startOfDay } from "date-fns"
import type { BlockConfig } from "@/lib/interface/types"
import type { MarketingEventItem, EventAttendanceStatus } from "@/lib/marketing/events"
import { filterEventsByAudience } from "@/lib/marketing/event-calendar-visibility"
import type { MockResource } from "@/components/interface/blocks/internal-resource-hub/types"

export const MEMBERS_WELCOME_PAGE_NAME = "Members Welcome"

/** Legacy provisioning title — treated as unset so hero copy defaults apply. */
export const MEMBERS_WELCOME_LEGACY_TITLE = "Members Welcome"

export const MEMBERS_WELCOME_DEFAULT_COPY = {
  title: "Welcome to the Peters & May Marketing Hub",
  subtitle:
    "Access shared events, useful resources and collaboration tools in one place.",
  body:
    "Use this space to view upcoming events, manage your attendance, access approved documents and stay aligned with relevant activity.",
} as const

export function membersWelcomeCopy(config?: BlockConfig): {
  title: string
  subtitle: string
  body: string
  showQuickActions: boolean
} {
  const rawTitle = config?.title?.trim()
  const title =
    !rawTitle || rawTitle === MEMBERS_WELCOME_LEGACY_TITLE
      ? MEMBERS_WELCOME_DEFAULT_COPY.title
      : rawTitle
  return {
    title,
    subtitle: config?.subtitle?.trim() || MEMBERS_WELCOME_DEFAULT_COPY.subtitle,
    body:
      config?.members_welcome_body?.trim() || MEMBERS_WELCOME_DEFAULT_COPY.body,
    showQuickActions: config?.members_welcome_show_quick_actions !== false,
  }
}

export const MEMBERS_WELCOME_PAGE_LINK_NAMES = {
  events: ["Event Calendar", "Events Calendar"],
  resources: ["Resource Hub", "Internal Staff Hub"],
  contacts: ["Contacts"],
  help: ["Help & Guidance", "Help and Guidance", "Help"],
} as const

export type MembersWelcomePageLinks = {
  events: string | null
  resources: string | null
  contacts: string | null
  help: string | null
}

export function pagePath(pageId: string | null | undefined): string | null {
  if (!pageId) return null
  return `/pages/${pageId}`
}

export function membersWelcomeLimits(config?: BlockConfig): {
  maxEvents: number
  maxResources: number
  allowSubmitEvent: boolean
} {
  const maxEvents =
    typeof config?.members_welcome_max_events === "number"
      ? config.members_welcome_max_events
      : 5
  const maxResources =
    typeof config?.members_welcome_max_resources === "number"
      ? config.members_welcome_max_resources
      : typeof config?.record_limit === "number"
        ? config.record_limit
        : 5
  return {
    maxEvents: Math.max(1, Math.min(maxEvents, 10)),
    maxResources: Math.max(1, Math.min(maxResources, 10)),
    allowSubmitEvent: config?.members_welcome_allow_submit_event !== false,
  }
}

export function isUpcomingEvent(item: MarketingEventItem, ref = new Date()): boolean {
  const end = item.endDate ?? item.startDate
  if (!end) return false
  return end >= startOfDay(ref)
}

export function filterMembersWelcomeEvents(
  items: MarketingEventItem[],
  maxItems: number,
  ref = new Date()
): MarketingEventItem[] {
  const visible = filterEventsByAudience(items, {
    externalMode: true,
    isAdminView: false,
  })
  return visible
    .filter((item) => isUpcomingEvent(item, ref))
    .sort((a, b) => {
      const ta = a.startDate?.getTime() ?? 0
      const tb = b.startDate?.getTime() ?? 0
      return ta - tb
    })
    .slice(0, maxItems)
}

export function filterMembersWelcomeResources(resources: MockResource[]): MockResource[] {
  return resources.filter((r) => {
    if (r.isInternalOnly) return false
    const tagHit = (r.tags ?? []).some((t) => /internal[\s_-]?only/i.test(t))
    if (tagHit) return false
    return true
  })
}

export function attendanceDisplayLabel(
  status: EventAttendanceStatus | null | undefined
): string {
  switch (status) {
    case "attending":
      return "Attending"
    case "maybe":
      return "Maybe"
    case "not_attending":
      return "Not attending"
    case "interested":
      return "Interested"
    default:
      return "Not responded"
  }
}

export function attendanceBadgeClass(
  status: EventAttendanceStatus | null | undefined
): string {
  switch (status) {
    case "attending":
      return "bg-emerald-50 text-emerald-700 border-emerald-200"
    case "maybe":
      return "bg-blue-50 text-blue-700 border-blue-200"
    case "interested":
      return "bg-violet-50 text-violet-700 border-violet-200"
    case "not_attending":
      return "bg-gray-50 text-gray-600 border-gray-200"
    default:
      return "bg-gray-50 text-gray-600 border-gray-200"
  }
}
