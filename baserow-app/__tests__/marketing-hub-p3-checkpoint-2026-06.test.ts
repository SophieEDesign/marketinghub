import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

const ROOT = join(__dirname, "..")

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("P3 checkpoint — Content Theme records", () => {
  it("wires add theme, add idea, and open theme via RecordPanel", () => {
    const src = readSource("components/interface/blocks/ContentThemeBlock.tsx")
    expect(src).toContain("openRecordModal({")
    expect(src).toContain("handleAddTheme")
    expect(src).toContain("handleAddIdea")
    expect(src).toContain("handleOpenTheme")
    expect(src).not.toContain("TODO: Add")
  })

  it("exposes theme and content table ids from hook", () => {
    const src = readSource("hooks/useContentThemeData.ts")
    expect(src).toContain("ContentThemeTableIds")
    expect(src).toContain("findContentTable")
  })
})

describe("P3 checkpoint — calendar keyboard", () => {
  it("mounts keyboard handlers on FullCalendar events", () => {
    expect(readSource("lib/a11y/calendar-event-keyboard.ts")).toContain('role", "button"')
    expect(readSource("components/interface/EventCalendarView.tsx")).toContain("eventDidMount")
    expect(readSource("components/interface/SocialMediaCalendarView.tsx")).toContain("eventDidMount")
  })

  it("labels event list and timeline controls", () => {
    expect(readSource("components/interface/events/EventListView.tsx")).toContain("Open event:")
    expect(readSource("components/interface/events/EventTimelineView.tsx")).toContain("Open event:")
  })
})

describe("P3 checkpoint — jsx-a11y lint scope", () => {
  it("enables jsx-a11y for interface components", () => {
    const config = JSON.parse(readFileSync(join(ROOT, ".eslintrc.json"), "utf8"))
    expect(JSON.stringify(config)).toContain("jsx-a11y")
    expect(JSON.stringify(config.overrides)).toContain("components/interface")
  })
})
