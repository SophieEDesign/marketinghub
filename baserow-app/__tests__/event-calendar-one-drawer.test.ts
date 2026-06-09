import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

function read(filePath: string) {
  return readFileSync(join(process.cwd(), filePath), "utf8")
}

describe("Event Calendar one contextual drawer", () => {
  it("opens RecordPanel with event layout and view mode on event click", () => {
    const core = read("components/interface/EventCalendarCore.tsx")
    expect(core).toContain('recordLayoutType: "event"')
    expect(core).toContain("initialDrawerMode")
    expect(core).toContain('initialDrawerMode: "view"')
    expect(core).not.toContain("EventDetailDrawer")
  })

  it("does not render View details in event detail content", () => {
    const panel = read("components/interface/EventDetailPanel.tsx")
    expect(panel).not.toContain("View details")
    expect(panel).not.toContain("onViewRecord")
  })

  it("switches drawer mode via setRecordDrawerMode instead of reopening", () => {
    const core = read("components/interface/EventCalendarCore.tsx")
    expect(core).toContain("setRecordDrawerMode")
    expect(core).not.toContain("interfaceMode: \"edit\"")
  })

  it("RecordPanel passes recordDrawerMode and eventContextual to RecordEditor", () => {
    const panel = read("components/records/RecordPanel.tsx")
    expect(panel).toContain("recordDrawerMode={state.recordDrawerMode}")
    expect(panel).toContain("eventContextual={state.eventContextual")
  })

  it("RecordEditor renders EventRecordContextualView in event view mode", () => {
    const editor = read("components/records/RecordEditor.tsx")
    expect(editor).toContain("EventRecordContextualView")
    expect(editor).toContain("showEventContextualView")
    expect(editor).toContain("setRecordDrawerMode")
  })

  it("RecordEditor shows event contextual view before record-not-found gate", () => {
    const editor = read("components/records/RecordEditor.tsx")
    const contextualIdx = editor.indexOf("if (showEventContextualView && eventContextual)")
    const notFoundIdx = editor.indexOf("Record not found")
    expect(contextualIdx).toBeGreaterThan(-1)
    expect(notFoundIdx).toBeGreaterThan(-1)
    expect(contextualIdx).toBeLessThan(notFoundIdx)
  })

  it("RecordPanel overlay uses md:left-sidebar", () => {
    const panel = read("components/records/RecordPanel.tsx")
    expect(panel).toContain("md:left-sidebar")
  })
})
