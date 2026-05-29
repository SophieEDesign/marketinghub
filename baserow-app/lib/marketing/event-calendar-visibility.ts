/**
 * Event visibility normalization and audience filtering for internal vs member/external views.
 */

import type { MarketingEventItem } from "@/lib/marketing/events"

export type EventVisibility =
  | "internal_only"
  | "members_only"
  | "public"
  | "draft"
  | "hidden"
  | "unknown"

export function normalizeEventVisibility(raw: string | null | undefined): EventVisibility {
  if (!raw) return "unknown"
  const v = raw.trim().toLowerCase().replace(/\s+/g, "_")
  if (
    v === "internal" ||
    v === "internal_only" ||
    v === "staff" ||
    v === "internal-only"
  ) {
    return "internal_only"
  }
  if (v === "members" || v === "members_only" || v === "member" || v === "members-only") {
    return "members_only"
  }
  if (v === "public" || v === "published" || v === "live") {
    return "public"
  }
  if (
    v === "draft" ||
    v === "idea" ||
    v === "pending" ||
    v === "submitted" ||
    v === "pending_approval"
  ) {
    return "draft"
  }
  if (v === "hidden" || v === "archived" || v === "cancelled" || v === "canceled") {
    return "hidden"
  }
  return "unknown"
}

export function filterEventsByAudience(
  items: MarketingEventItem[],
  opts: { externalMode: boolean; isAdminView: boolean }
): MarketingEventItem[] {
  if (opts.isAdminView && !opts.externalMode) {
    return items.filter((item) => {
      const vis = normalizeEventVisibility(item.visibility)
      return vis !== "hidden"
    })
  }

  return items.filter((item) => {
    const vis = normalizeEventVisibility(item.visibility)
    if (vis === "internal_only" || vis === "hidden" || vis === "draft") return false
    if (vis === "members_only" || vis === "public" || vis === "unknown") return true
    return true
  })
}
