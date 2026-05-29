/**
 * Demo events for Event Calendar when event_calendar_use_mock is enabled.
 */

import type { MarketingEventItem } from "@/lib/marketing/events"
import { accentBackground, eventTypeAccentColor, formatEventDateRange } from "@/lib/marketing/events"

function mockItem(partial: Partial<MarketingEventItem> & Pick<MarketingEventItem, "id" | "eventName" | "startDate">): MarketingEventItem {
  const eventType = partial.eventType ?? "Conference"
  const accent = eventTypeAccentColor(eventType)
  const start = partial.startDate!
  const end = partial.endDate ?? start
  return {
    id: partial.id,
    eventName: partial.eventName,
    eventType,
    status: partial.status ?? "Published",
    startDate: start,
    endDate: end,
    allDay: partial.allDay ?? true,
    startTime: null,
    endTime: null,
    timezone: null,
    locationName: partial.locationName ?? null,
    city: partial.city ?? null,
    country: partial.country ?? null,
    locationLabel: partial.locationLabel ?? null,
    websiteUrl: partial.websiteUrl ?? null,
    description: partial.description ?? null,
    heroImageUrl: null,
    themeLabel: null,
    campaignLabel: partial.campaignLabel ?? null,
    ownerLabel: partial.ownerLabel ?? "Peters & May Racing",
    ownerId: null,
    budget: null,
    notes: partial.notes ?? null,
    attendeeIds: partial.attendeeIds ?? [],
    attendeeLabels: partial.attendeeLabels ?? [],
    attendeeCount: partial.attendeeCount ?? partial.attendeeIds?.length ?? 0,
    currentUserAttending: partial.currentUserAttending ?? false,
    currentUserAttendanceStatus: partial.currentUserAttendanceStatus ?? null,
    visibility: partial.visibility ?? "public",
    venueLabel: partial.venueLabel ?? null,
    scheduleItems: partial.scheduleItems ?? [],
    resources: partial.resources ?? [],
    accentColor: accent,
    backgroundColor: accentBackground(accent),
    dateRangeLabel: formatEventDateRange(start, end),
    ...partial,
  }
}

export const EVENT_CALENDAR_MOCK_ITEMS: MarketingEventItem[] = [
  mockItem({
    id: "mock-1",
    eventName: "SailGP Europe",
    eventType: "Racing / Sport",
    startDate: new Date("2026-05-22"),
    endDate: new Date("2026-05-24"),
    locationLabel: "Valencia, Spain",
    city: "Valencia",
    country: "Spain",
    visibility: "public",
    status: "Published",
    campaignLabel: "SailGP 2026",
    description:
      "Peters & May Racing team presence at SailGP Europe — hospitality, media and partner activations.",
    websiteUrl: "https://sailgp.com",
    attendeeLabels: ["Alex", "Sam", "Jordan"],
    attendeeCount: 12,
    attendeeIds: [],
  }),
  mockItem({
    id: "mock-2",
    eventName: "BBK Conference",
    eventType: "Conference",
    startDate: new Date("2026-05-11"),
    endDate: new Date("2026-05-11"),
    locationLabel: "London, UK",
    visibility: "members_only",
    status: "Confirmed",
  }),
  mockItem({
    id: "mock-3",
    eventName: "Deadline for sponsorships",
    eventType: "Sponsorship",
    startDate: new Date("2026-05-01"),
    visibility: "internal_only",
    status: "Planning",
  }),
  mockItem({
    id: "mock-4",
    eventName: "2027 Rallies Briefing",
    eventType: "Hospitality",
    startDate: new Date("2026-05-16"),
    visibility: "internal_only",
  }),
]
