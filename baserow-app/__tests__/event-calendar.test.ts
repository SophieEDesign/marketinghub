import { describe, it, expect } from "vitest"
import {
  isEventCalendarPage,
  isEventContentRecord,
  buildEventCalendarEvents,
  formatEventDateRange,
  computeEventMetrics,
  filterEventItems,
  type MarketingEventItem,
} from "@/lib/marketing/events"

function sampleItem(overrides: Partial<MarketingEventItem> = {}): MarketingEventItem {
  return {
    id: "e1",
    eventName: "Monaco Yacht Show",
    eventType: "Boat Show",
    status: "Confirmed",
    startDate: new Date("2026-09-23"),
    endDate: new Date("2026-09-26"),
    allDay: true,
    startTime: null,
    endTime: null,
    timezone: null,
    locationName: "Monaco",
    city: "Monaco",
    country: "Monaco",
    locationLabel: "Monaco, Monaco",
    websiteUrl: null,
    description: null,
    heroImageUrl: null,
    themeLabel: null,
    campaignLabel: null,
    ownerLabel: null,
    ownerId: null,
    budget: null,
    notes: null,
    attendeeIds: ["u1", "u2"],
    attendeeLabels: ["Alice", "Bob"],
    attendeeCount: 2,
    currentUserAttending: false,
    scheduleItems: [],
    resources: [],
    accentColor: "#3B82F6",
    backgroundColor: "#3B82F61A",
    dateRangeLabel: "23–26 Sep 2026",
    ...overrides,
  }
}

describe("isEventCalendarPage", () => {
  it("detects by layout_style", () => {
    expect(
      isEventCalendarPage({ name: "Foo", config: { layout_style: "event_calendar" } })
    ).toBe(true)
  })

  it("detects by page name", () => {
    expect(isEventCalendarPage({ name: "Event Calendar", config: {} })).toBe(true)
  })

  it("returns false for unrelated pages", () => {
    expect(isEventCalendarPage({ name: "Content Planning", config: {} })).toBe(false)
  })
})

describe("isEventContentRecord", () => {
  it("matches content type Event", () => {
    expect(
      isEventContentRecord({ content_type: "Event" }, "content_type")
    ).toBe(true)
    expect(
      isEventContentRecord({ content_type: "Blog" }, "content_type")
    ).toBe(false)
  })

  it("matches events plural", () => {
    expect(isEventContentRecord({ type: "events" }, "type")).toBe(true)
  })
})

describe("buildEventCalendarEvents", () => {
  it("uses exclusive end for multi-day spans", () => {
    const events = buildEventCalendarEvents([sampleItem()])
    expect(events).toHaveLength(1)
    expect(events[0].start).toBe("2026-09-23")
    expect(events[0].end).toBe("2026-09-27")
  })

  it("omits end for single-day events", () => {
    const events = buildEventCalendarEvents([
      sampleItem({
        startDate: new Date("2026-05-27"),
        endDate: new Date("2026-05-27"),
      }),
    ])
    expect(events[0].end).toBeUndefined()
  })
})

describe("formatEventDateRange", () => {
  it("formats single day", () => {
    const label = formatEventDateRange(new Date("2026-05-27"), new Date("2026-05-27"))
    expect(label).toMatch(/27 May 2026/)
  })

  it("formats range within same year", () => {
    const label = formatEventDateRange(new Date("2026-09-23"), new Date("2026-09-26"))
    expect(label).toContain("23")
    expect(label).toContain("26 Sep 2026")
  })
})

describe("computeEventMetrics", () => {
  it("counts upcoming, attendees, countries, and this month", () => {
    const ref = new Date("2026-05-15")
    const metrics = computeEventMetrics(
      [
        sampleItem(),
        sampleItem({
          id: "e2",
          startDate: new Date("2026-05-20"),
          endDate: new Date("2026-05-22"),
          country: "France",
          attendeeIds: ["u3"],
        }),
      ],
      ref
    )
    expect(metrics.upcoming).toBeGreaterThanOrEqual(1)
    expect(metrics.teamAttending).toBe(3)
    expect(metrics.countries).toBe(2)
    expect(metrics.thisMonth).toBeGreaterThanOrEqual(1)
  })
})

describe("filterEventItems", () => {
  it("filters by search query", () => {
    const filtered = filterEventItems(
      [
        sampleItem(),
        sampleItem({
          id: "e2",
          eventName: "Paris Boat Expo",
          locationLabel: "Paris, France",
          country: "France",
        }),
      ],
      {
        search: "yacht show",
        eventTypes: [],
        locations: [],
        statuses: [],
        owners: [],
        attendeeFilter: "all",
      },
      null
    )
    expect(filtered).toHaveLength(1)
    expect(filtered[0].eventName).toContain("Monaco")
  })
})
