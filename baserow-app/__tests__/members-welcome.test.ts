import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import {
  filterMembersWelcomeEvents,
  filterMembersWelcomeResources,
  attendanceDisplayLabel,
  countAttendingEvents,
  membersWelcomeCopy,
  membersWelcomeGreeting,
  isUpcomingEvent,
  MEMBERS_WELCOME_DEFAULT_COPY,
  MEMBERS_WELCOME_LEGACY_TITLE,
} from "@/lib/marketing/members-welcome"
import type { MarketingEventItem } from "@/lib/marketing/events"
import { BLOCK_REGISTRY } from "@/lib/interface/registry"
import { BLOCK_CONFIG_UNION_TYPES, validateBlockConfig } from "@/lib/interface/block-config-types"
import { assertBlockConfig } from "@/lib/interface/assertBlockConfig"

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
    expect(attendanceDisplayLabel("not_attending")).toBe("Can't go")
    expect(attendanceDisplayLabel(null)).toBe("Not responded")
  })

  it("builds time-of-day greeting", () => {
    expect(membersWelcomeGreeting("Sarah", new Date("2026-06-19T09:00:00"))).toBe(
      "Good morning, Sarah"
    )
  })

  it("counts attending events", () => {
    expect(
      countAttendingEvents([
        sampleEvent({ id: "1", eventName: "A", currentUserAttendanceStatus: "attending" }),
        sampleEvent({ id: "2", eventName: "B", currentUserAttendanceStatus: "maybe" }),
      ])
    ).toBe(1)
  })
})

describe("members_welcome registry and config parity", () => {
  it("is in BLOCK_REGISTRY and BLOCK_CONFIG_UNION_TYPES", () => {
    expect(BLOCK_REGISTRY.members_welcome).toBeDefined()
    expect(BLOCK_CONFIG_UNION_TYPES).toContain("members_welcome")
  })

  it("default config passes assertBlockConfig and validateBlockConfig", () => {
    const config = BLOCK_REGISTRY.members_welcome.defaultConfig
    expect(assertBlockConfig("members_welcome", config).valid).toBe(true)
    expect(validateBlockConfig("members_welcome", config).valid).toBe(true)
  })

  it("renders via BlockRenderer switch case", () => {
    const src = readFileSync(
      join(process.cwd(), "components/interface/BlockRenderer.tsx"),
      "utf8"
    )
    expect(src).toContain('case "members_welcome"')
    expect(src).toContain("MembersWelcomeBlock")
  })
})

describe("membersWelcomeCopy", () => {
  it("uses defaults when config is empty", () => {
    expect(membersWelcomeCopy({})).toEqual({
      title: MEMBERS_WELCOME_DEFAULT_COPY.title,
      subtitle: MEMBERS_WELCOME_DEFAULT_COPY.subtitle,
      body: MEMBERS_WELCOME_DEFAULT_COPY.body,
      showQuickActions: true,
    })
  })

  it("treats legacy provisioning title as default hero copy", () => {
    expect(membersWelcomeCopy({ title: MEMBERS_WELCOME_LEGACY_TITLE }).title).toBe(
      MEMBERS_WELCOME_DEFAULT_COPY.title
    )
  })

  it("respects custom title, subtitle, body, and quick action toggle", () => {
    expect(
      membersWelcomeCopy({
        title: "Custom heading",
        subtitle: "Custom subtitle",
        members_welcome_body: "Custom body",
        members_welcome_show_quick_actions: false,
      })
    ).toEqual({
      title: "Custom heading",
      subtitle: "Custom subtitle",
      body: "Custom body",
      showQuickActions: false,
    })
  })
})
