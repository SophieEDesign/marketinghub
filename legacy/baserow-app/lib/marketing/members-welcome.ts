import { format, startOfDay } from "date-fns"
import type { BlockConfig } from "@/lib/interface/types"
import type { MarketingEventItem, EventAttendanceStatus } from "@/lib/marketing/events"
import { filterEventsByAudience } from "@/lib/marketing/event-calendar-visibility"
import type {
  MockResource,
  ResourceFileType,
} from "@/components/interface/blocks/internal-resource-hub/types"

export const MEMBERS_WELCOME_PAGE_NAME = "Members Welcome"

/** Legacy provisioning title — treated as unset so hero copy defaults apply. */
export const MEMBERS_WELCOME_LEGACY_TITLE = "Members Welcome"

export const MEMBERS_WELCOME_HERO_IMAGE = "/marketing/members-welcome-hero.jpg"

export const MEMBERS_WELCOME_DEFAULT_COPY = {
  title: "Welcome to the Peters & May Marketing Hub",
  subtitle: "Your events, resources and collaboration tools — all in one place.",
  body:
    "View upcoming activity and update your attendance under Events. Find approved logos, documents and media in the Resource Hub. Got an event to suggest or need a hand? Get in touch with the team.",
} as const

export type MembersWelcomeQuickActionId =
  | "events"
  | "attendance"
  | "resources"
  | "submit"
  | "contacts"
  | "help"

export type MembersWelcomeQuickActionDef = {
  id: MembersWelcomeQuickActionId
  title: string
  description: string
  actionLabel: string
  iconTint: string
  iconColor: string
}

export const MEMBERS_WELCOME_QUICK_ACTIONS: MembersWelcomeQuickActionDef[] = [
  {
    id: "events",
    title: "View events",
    description: "See upcoming boat shows, industry events and member activities.",
    actionLabel: "Open event calendar",
    iconTint: "#e3f0fa",
    iconColor: "#0a6bb0",
  },
  {
    id: "attendance",
    title: "My attendance",
    description: "Check which events you are attending and update your response.",
    actionLabel: "View my events",
    iconTint: "#e7f3ee",
    iconColor: "#1b7a52",
  },
  {
    id: "resources",
    title: "Resource hub",
    description: "Access approved logos, presentations, documents and shared media.",
    actionLabel: "Open resources",
    iconTint: "#f0e7d3",
    iconColor: "#b08d52",
  },
  {
    id: "submit",
    title: "Submit an event",
    description: "Suggest an event for review by the Peters & May team.",
    actionLabel: "Submit event",
    iconTint: "#e8f1f7",
    iconColor: "#005b8f",
  },
  {
    id: "contacts",
    title: "Useful contacts",
    description: "Find relevant Peters & May contacts for events and collaboration.",
    actionLabel: "View contacts",
    iconTint: "#eef1f6",
    iconColor: "#3d4d63",
  },
  {
    id: "help",
    title: "Help & guidance",
    description: "Learn how to use the hub or contact the team for support.",
    actionLabel: "Get help",
    iconTint: "#fde8e8",
    iconColor: "#c0292f",
  },
]

export function membersWelcomeGreeting(firstName?: string | null, ref = new Date()): string {
  const hour = ref.getHours()
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
  const name = firstName?.trim()
  return name ? `${part}, ${name}` : part
}

export function countAttendingEvents(items: MarketingEventItem[]): number {
  return items.filter((item) => item.currentUserAttendanceStatus === "attending").length
}

export function eventDateParts(date: Date | null | undefined): { month: string; day: string } | null {
  if (!date) return null
  return {
    month: format(date, "MMM").toUpperCase(),
    day: format(date, "d"),
  }
}

export function renderMembersWelcomeHeroTitle(title: string): { before: string; highlight: string; after: string } {
  const marker = "Marketing Hub"
  const idx = title.indexOf(marker)
  if (idx === -1) {
    return { before: title, highlight: "", after: "" }
  }
  return {
    before: title.slice(0, idx),
    highlight: marker,
    after: title.slice(idx + marker.length),
  }
}

export function resourceSourceLabel(source?: string | null): string | null {
  if (!source) return null
  if (/google drive/i.test(source)) return "Drive"
  return source.replace(/\s+/g, " ").trim()
}

export function resourceBadgeColors(fileType: ResourceFileType): { bg: string; fg: string } {
  switch (fileType) {
    case "PNG":
    case "SVG":
      return { bg: "#e7f3ee", fg: "#1b7a52" }
    case "JPG":
      return { bg: "#e3f0fa", fg: "#0a6bb0" }
    case "PDF":
      return { bg: "#fde8e8", fg: "#c0292f" }
    case "PPTX":
      return { bg: "#fbeede", fg: "#b5651d" }
    default:
      return { bg: "#eef1f6", fg: "#3d4d63" }
  }
}

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
      return "Can't go"
    case "interested":
      return "Interested"
    default:
      return "Not responded"
  }
}

export type AttendanceBadgeStyle = {
  label: string
  bg: string
  border: string
  fg: string
  dot: string
}

export function attendanceBadgeStyle(
  status: EventAttendanceStatus | null | undefined
): AttendanceBadgeStyle {
  switch (status) {
    case "attending":
      return {
        label: attendanceDisplayLabel(status),
        bg: "#e7f3ee",
        border: "#bfe3cf",
        fg: "#1b7a52",
        dot: "#1b7a52",
      }
    case "maybe":
      return {
        label: attendanceDisplayLabel(status),
        bg: "#e3f0fa",
        border: "#bcdcf2",
        fg: "#0a6bb0",
        dot: "#0a6bb0",
      }
    case "interested":
      return {
        label: attendanceDisplayLabel(status),
        bg: "#ede9fe",
        border: "#ddd6fe",
        fg: "#6d28d9",
        dot: "#6d28d9",
      }
    case "not_attending":
      return {
        label: attendanceDisplayLabel(status),
        bg: "#f3f4f6",
        border: "#e2e5ea",
        fg: "#6b7280",
        dot: "#9aa1ab",
      }
    default:
      return {
        label: attendanceDisplayLabel(status),
        bg: "#f3f4f6",
        border: "#e2e5ea",
        fg: "#6b7280",
        dot: "#c7ccd4",
      }
  }
}

/** Tailwind classes for generic attendance badges outside the welcome layout. */
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
