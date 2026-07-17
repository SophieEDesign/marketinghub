import type { UpcomingSummarySectionId } from "@/lib/interface/types"

export type InterfacePageRow = { id: string; name: string }

export function pickPageId(
  rows: InterfacePageRow[],
  names: readonly string[],
  overrideId?: string | null
): string | null {
  if (overrideId?.trim()) return overrideId.trim()
  for (const name of names) {
    const hit = rows.find((row) => row.name === name)
    if (hit?.id) return hit.id
  }
  return null
}

export function marketingPagePath(pageId: string | null | undefined): string | null {
  if (!pageId) return null
  return `/pages/${pageId}`
}

/** Default Marketing Hub targets for Upcoming Summary “View all” links. */
export const UPCOMING_SUMMARY_SECTION_PAGE_NAMES: Record<
  UpcomingSummarySectionId,
  readonly string[]
> = {
  deadlines: ["Things To Do", "Content Planning"],
  campaigns: ["Campaigns"],
  events: ["Event Calendar"],
  approval: ["Content Planning", "Social Calendar", "Social Media Calendar"],
  blockers: ["Things To Do", "Content Planning"],
  published: ["Content Planning", "Social Calendar", "Social Media Calendar"],
}

export const UPCOMING_SUMMARY_ACTIVITY_PAGE_NAMES = [
  "Content Planning",
  "Things To Do",
] as const

export const CONTENT_TIMELINE_FOOTER_PAGE_NAMES = [
  "Content Planning",
  "Social Calendar",
  "Social Media Calendar",
] as const
