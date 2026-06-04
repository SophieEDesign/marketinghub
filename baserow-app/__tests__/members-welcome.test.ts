import { describe, it, expect } from "vitest"
import {
  filterMembersWelcomeEvents,
  filterMembersWelcomeResources,
  attendanceDisplayLabel,
  isUpcomingEvent,
} from "@/lib/marketing/members-welcome"
import type { MarketingEventItem } from "@/lib/marketing/events"

function sampleEvent(
  partial: Partial<MarketingEventItem> & { id: string; eventName: string }
): MarketingEventItem {
  return {
    id: partial.id,
    eventName: partial.eventName,
    startDate: partial.startDate ?? new Date("2026-05-01"),
    endDate: partial.endDate ?? partial.startDate ?? new Date("2026-05-01"),
    visibility: partial.visibility ?? "public",
    accentColor: "#6D4AFF",
    backgroundColor: "#F3F0FF",
    dateRangeLabel: "1 May 2026",
    locationLabel: "",
    eventType: "Boat show",
    status: "Published",
    attendeeLabels: [],
    currentUserAttendanceStatus: partial.currentUserAttendanceStatus ?? null,
  } as MarketingEventItem
}

describe("members-welcome helpers", () => {
  it("hides internal-only events from member welcome list", () => {
    const items = [
      sampleEvent({ id: "1", eventName: "Public show", visibility: "public" }),
      sampleEvent({ id: "2", eventName: "Staff only", visibility: "internal_only" }),
    ]
    const filtered = filterMembersWelcomeEvents(items, 5, new Date("2026-04-01"))
    expect(filtered.map((e) => e.id)).toEqual(["1"])
  })

  it("keeps only upcoming events", () => {
    const items = [
      sampleEvent({
        id: "past",
        eventName: "Past",
        startDate: new Date("2020-01-01"),
        endDate: new Date("2020-01-02"),
      }),
      sampleEvent({
        id: "future",
        eventName: "Future",
        startDate: new Date("2026-12-01"),
        endDate: new Date("2026-12-05"),
      }),
    ]
    expect(isUpcomingEvent(items[0], new Date("2026-06-01"))).toBe(false)
    const filtered = filterMembersWelcomeEvents(items, 5, new Date("2026-06-01"))
    expect(filtered.map((e) => e.id)).toEqual(["future"])
  })

  it("filters internal-only resources", () => {
    const filtered = filterMembersWelcomeResources([
      {
        id: "a",
        title: "Brand guide",
        category: "brand-guidelines",
        fileType: "PDF",
        isInternalOnly: false,
      },
      {
        id: "b",
        title: "Staff doc",
        category: "documents",
        fileType: "PDF",
        isInternalOnly: true,
      },
    ])
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe("a")
  })

  it("maps attendance labels for members", () => {
    expect(attendanceDisplayLabel("attending")).toBe("Attending")
    expect(attendanceDisplayLabel(null)).toBe("Not responded")
  })
})
