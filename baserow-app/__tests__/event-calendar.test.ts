import { describe, it, expect } from "vitest"
import { format } from "date-fns"
import { readFileSync } from "fs"
import { join } from "path"
import { BLOCK_REGISTRY, getAllBlockTypes } from "@/lib/interface/registry"
import {
  isEventCalendarPage,
  isEventContentRecord,
  buildEventCalendarEvents,
  formatEventDateRange,
  computeEventMetrics,
  filterEventItems,
  eventCalendarSettingsFromConfig,
  DEFAULT_EVENT_CALENDAR_BLOCK_CONFIG,
  resolveContentEventFields,
  buildEventTimelineRange,
  positionEventOnTimeline,
  type MarketingEventItem,
} from "@/lib/marketing/events"
import { buildCalendarIcs, buildEventIcs } from "@/lib/marketing/event-calendar-ics"
import {
  filterEventsByAudience,
  normalizeEventVisibility,
} from "@/lib/marketing/event-calendar-visibility"
import {
  eventCalendarOverridesFromConfig,
  eventCalendarWorkflowFromConfig,
  isPendingApprovalStatus,
} from "@/lib/marketing/event-calendar-config"
import {
  attendeeIdsForLegacyColumn,
  mergeAttendanceIntoEventItems,
} from "@/lib/marketing/event-attendance"

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
    currentUserAttendanceStatus: null,
    visibility: "public",
    venueLabel: null,
    scheduleItems: [],
    resources: [],
    accentColor: "#3B82F6",
    backgroundColor: "#3B82F61A",
    dateRangeLabel: "23–26 Sep 2026",
    isPendingApproval: false,
    ...overrides,
  }
}

describe("event_calendar block registration", () => {
  it("is registered in BLOCK_REGISTRY with full-page defaults", () => {
    const def = BLOCK_REGISTRY.event_calendar
    expect(def).toBeDefined()
    expect(def?.type).toBe("event_calendar")
    expect(def?.label).toBe("Event Calendar")
    expect(def?.defaultWidth).toBe(12)
    expect(def?.supportsFullPage).toBe(true)
    expect(def?.defaultFullPage).toBe(true)
  })

  it("is included in getAllBlockTypes", () => {
    expect(getAllBlockTypes()).toContain("event_calendar")
  })
})

describe("eventCalendarSettingsFromConfig", () => {
  it("parses block config defaults", () => {
    const settings = eventCalendarSettingsFromConfig({
      ...DEFAULT_EVENT_CALENDAR_BLOCK_CONFIG,
      title: "My Calendar",
      event_calendar_default_view: "week",
      event_calendar_density: "compact",
    })
    expect(settings.title).toBe("My Calendar")
    expect(settings.defaultView).toBe("week")
    expect(settings.density).toBe("compact")
    expect(settings.showToolbar).toBe(true)
  })
})

describe("isEventCalendarPage", () => {
  it("detects by page name only (not layout_style)", () => {
    expect(
      isEventCalendarPage({ name: "Foo", config: { layout_style: "event_calendar" } })
    ).toBe(false)
    expect(isEventCalendarPage({ name: "Event Calendar", config: {} })).toBe(true)
  })

  it("returns false for unrelated pages", () => {
    expect(isEventCalendarPage({ name: "Content Planning", config: {} })).toBe(false)
  })
})

describe("InterfacePageClient routing", () => {
  it("does not use the bespoke Event Calendar dashboard bypass", () => {
    const src = readFileSync(
      join(process.cwd(), "components/interface/InterfacePageClient.tsx"),
      "utf8"
    )
    expect(src).not.toContain("showEventCalendar")
    expect(src).not.toContain("EventCalendarDashboard")
    expect(src).not.toContain("MarketingDashboardLayout")
    expect(src).not.toContain("isEventCalendarPage")
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

describe("eventCalendarSettingsFromConfig behaviour", () => {
  it("defaults to open_detail drawer and export enabled", () => {
    const settings = eventCalendarSettingsFromConfig(DEFAULT_EVENT_CALENDAR_BLOCK_CONFIG)
    expect(settings.clickAction).toBe("open_detail")
    expect(settings.detailMode).toBe("drawer")
    expect(settings.allowCalendarExport).toBe(true)
    expect(settings.allowMemberSubmissions).toBe(false)
    expect(settings.externalMode).toBe(false)
  })

  it("respects external mode and click action overrides", () => {
    const settings = eventCalendarSettingsFromConfig({
      event_calendar_external_mode: true,
      event_calendar_click_action: "none",
      event_calendar_allow_attendance_updates: false,
    })
    expect(settings.externalMode).toBe(true)
    expect(settings.clickAction).toBe("none")
    expect(settings.allowAttendanceUpdates).toBe(false)
  })
})

describe("resolveContentEventFields content dates", () => {
  it("prefers date and date_to columns on Content-shaped schemas", () => {
    const fields = [
      { name: "content_name" },
      { name: "content_type" },
      { name: "date" },
      { name: "date_to" },
      { name: "status" },
    ]
    const resolved = resolveContentEventFields(fields)
    expect(resolved.eventName).toBe("content_name")
    expect(resolved.startDate).toBe("date")
    expect(resolved.endDate).toBe("date_to")
    expect(resolved.contentType).toBe("content_type")
  })
})

describe("event calendar field mapping config keys", () => {
  it("includes table_id and field_id overrides in resolver", () => {
    const overrides = eventCalendarOverridesFromConfig({
      table_id: "tbl-1",
      event_calendar_title_field_id: "f-title",
      event_calendar_visibility_field_id: "f-vis",
      event_calendar_venue_field_id: "f-venue",
      event_calendar_location_link_field_id: "f-loc-link",
      event_calendar_owner_field_id: "f-owner",
    })
    expect(overrides.eventName?.fieldId).toBe("f-title")
    expect(overrides.visibility?.fieldId).toBe("f-vis")
    expect(overrides.venue?.fieldId).toBe("f-venue")
    expect(overrides.location?.fieldId).toBe("f-loc-link")
    expect(overrides.owner?.fieldId).toBe("f-owner")
  })
})

describe("visibility filtering", () => {
  it("hides internal-only events in external mode", () => {
    const items = [
      sampleItem({ id: "a", visibility: "public" }),
      sampleItem({ id: "b", visibility: "internal_only", eventName: "Staff only" }),
    ]
    const filtered = filterEventsByAudience(items, { externalMode: true, isAdminView: false })
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe("a")
  })

  it("normalizes visibility labels", () => {
    expect(normalizeEventVisibility("Members Only")).toBe("members_only")
    expect(normalizeEventVisibility("internal")).toBe("internal_only")
  })
})

describe("eventCalendarWorkflowFromConfig", () => {
  it("parses workflow status values", () => {
    const w = eventCalendarWorkflowFromConfig({
      event_calendar_submitted_status_value: "Submitted",
      event_calendar_approved_status_value: "Published",
    })
    expect(w.submittedStatus).toBe("Submitted")
    expect(w.approvedStatus).toBe("Published")
  })
})

describe("isPendingApprovalStatus", () => {
  it("detects submitted statuses", () => {
    expect(isPendingApprovalStatus("Submitted")).toBe(true)
    expect(isPendingApprovalStatus("Published")).toBe(false)
  })
})

describe("mergeAttendanceIntoEventItems", () => {
  it("merges attending rows and current user status", () => {
    const item = sampleItem({ id: "e1", attendeeIds: [], currentUserAttending: false })
    const merged = mergeAttendanceIntoEventItems(
      [item],
      [{ event_id: "e1", user_id: "u1", attendance_status: "maybe" }],
      "u1"
    )
    expect(merged[0].currentUserAttendanceStatus).toBe("maybe")
    expect(merged[0].currentUserAttending).toBe(false)
  })

  it("syncs legacy attendee_user_ids when attending", () => {
    const rows: { event_id: string; user_id: string; attendance_status: "attending" | "maybe" }[] =
      []
    const ids = attendeeIdsForLegacyColumn("e1", rows, ["legacy-u"], "u1", "attending")
    expect(ids).toContain("u1")
  })

  it("removes user from legacy array on non-attending status", () => {
    const rows = [{ event_id: "e1", user_id: "u1", attendance_status: "attending" as const }]
    const ids = attendeeIdsForLegacyColumn("e1", rows, ["u1", "u2"], "u1", "maybe")
    expect(ids).not.toContain("u1")
  })

  it("counts attending users from event_attendance table", () => {
    const item = sampleItem({ id: "e1" })
    const merged = mergeAttendanceIntoEventItems(
      [item],
      [
        { event_id: "e1", user_id: "u1", attendance_status: "attending" },
        { event_id: "e1", user_id: "u2", attendance_status: "attending" },
      ],
      null
    )
    expect(merged[0].attendeeCount).toBe(2)
  })
})

describe("buildCalendarIcs", () => {
  it("includes multiple VEVENT blocks", () => {
    const ics = buildCalendarIcs([sampleItem(), sampleItem({ id: "e2", eventName: "Other" })])
    const count = (ics.match(/BEGIN:VEVENT/g) || []).length
    expect(count).toBe(2)
  })
})

describe("buildEventIcs", () => {
  it("returns valid VCALENDAR with VEVENT", () => {
    const ics = buildEventIcs(sampleItem())
    expect(ics).toContain("BEGIN:VCALENDAR")
    expect(ics).toContain("BEGIN:VEVENT")
    expect(ics).toContain("SUMMARY:Monaco Yacht Show")
    expect(ics).toContain("END:VEVENT")
    expect(ics).toContain("END:VCALENDAR")
  })
})

describe("EventCalendarCore edit vs view click", () => {
  it("documents edit-mode guard in source", () => {
    const src = readFileSync(
      join(process.cwd(), "components/interface/EventCalendarCore.tsx"),
      "utf8"
    )
    expect(src).toContain("if (isEditing) return")
    expect(src).toContain("settings.clickAction")
    expect(src).toContain("EventDetailDrawer")
  })
})

describe("event timeline range", () => {
  it("spans all event dates, not only the cursor month", () => {
    const items = [
      sampleItem({
        id: "e1",
        startDate: new Date("2025-11-28"),
        endDate: new Date("2025-11-28"),
      }),
      sampleItem({
        id: "e2",
        startDate: new Date("2026-01-14"),
        endDate: new Date("2026-01-18"),
      }),
    ]
    const range = buildEventTimelineRange(items, new Date("2026-06-01"))
    expect(format(range.months[0], "yyyy-MM")).toBe("2025-10")
    expect(range.months[range.months.length - 1].getFullYear()).toBe(2026)

    const pos1 = positionEventOnTimeline(items[0], range)
    const pos2 = positionEventOnTimeline(items[1], range)
    expect(pos1).not.toBeNull()
    expect(pos2).not.toBeNull()
    expect(pos1!.leftPct).toBeLessThan(pos2!.leftPct)
    expect(pos2!.widthPct).toBeGreaterThan(1)
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

  it("filters by status (mapped status field values)", () => {
    const filtered = filterEventItems(
      [
        sampleItem({ id: "e1", status: "Confirmed" }),
        sampleItem({ id: "e2", status: "draft", eventName: "Draft event" }),
        sampleItem({ id: "e3", status: null, eventName: "No status" }),
      ],
      {
        search: "",
        eventTypes: [],
        locations: [],
        statuses: ["draft"],
        owners: [],
        attendeeFilter: "all",
      },
      null
    )
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe("e2")
  })
})
