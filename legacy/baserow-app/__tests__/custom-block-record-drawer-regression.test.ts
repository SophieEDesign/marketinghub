import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import { resolveRecordLayout } from "@/lib/records/record-layout-resolver"
import type { TableField } from "@/types/fields"

function readSource(filePath: string) {
  return readFileSync(join(process.cwd(), filePath), "utf8")
}

function field(id: string, name: string): TableField {
  return {
    id,
    name,
    type: "text",
    table_id: "tbl-1",
  } as TableField
}

describe("custom block record drawer regression", () => {
  describe("recordLayoutType routing for custom blocks", () => {
    it.each([
      ["components/interface/EventCalendarCore.tsx", 'recordLayoutType: "event"'],
      ["components/interface/blocks/ThingsToDoBlock.tsx", 'recordLayoutType: "task"'],
      ["components/interface/blocks/CampaignsOverviewBlock.tsx", 'recordLayoutType: "campaign"'],
      ["components/interface/blocks/ContentTimelineBlock.tsx", 'recordLayoutType: "content"'],
    ])("maps %s to expected contextual type", (file, expected) => {
      const src = readSource(file)
      expect(src).toContain(expected)
    })

    it("keeps Social calendar on generic record panel (standard modal fields)", () => {
      const src = readSource("components/interface/SocialMediaCalendarCore.tsx")
      expect(src).toContain('recordLayoutType: "generic"')
      expect(src).not.toContain('recordLayoutType: "social_post"')
    })

    it("keeps resource hub primary click as file URL and manage action as asset drawer", () => {
      const src = readSource("components/interface/blocks/InternalResourceHubBlock.tsx")
      expect(src).toMatch(/window\.open\((url|displayResource\.url)/)
      expect(src).toContain('recordLayoutType: "asset"')
      expect(src).toContain("canManageSelectedResource")
    })
  })

  describe("generic fallback remains unchanged", () => {
    it("does not pass recordLayoutType from generic Grid/List/Calendar open paths", () => {
      const grid = readSource("components/views/GridView.tsx")
      const list = readSource("components/views/ListView.tsx")
      const calendar = readSource("components/views/CalendarView.tsx")
      expect(grid).not.toContain("recordLayoutType")
      expect(list).not.toContain("recordLayoutType")
      expect(calendar).not.toContain("recordLayoutType")
    })
  })

  describe("one-drawer pathway", () => {
    it("keeps custom block record opens on RecordPanel pathway", () => {
      const modalCtx = readSource("contexts/RecordModalContext.tsx")
      const eventCore = readSource("components/interface/EventCalendarCore.tsx")
      const panel = readSource("components/records/RecordPanel.tsx")

      expect(modalCtx).toContain("openRecord(")
      expect(modalCtx).toContain("openRecordForCreate(")
      expect(modalCtx).toContain("openState.recordLayoutType")
      expect(eventCore).toContain("setSelectedEventId(null)")
      expect(eventCore).toContain("initialDrawerMode")
      expect(panel).toContain("recordLayoutType={state.recordLayoutType}")
    })

    it("does not route custom blocks through legacy RecordDrawer shell", () => {
      const eventCore = readSource("components/interface/EventCalendarCore.tsx")
      const socialCore = readSource("components/interface/SocialMediaCalendarCore.tsx")
      const resourceHub = readSource("components/interface/blocks/InternalResourceHubBlock.tsx")
      expect(eventCore).not.toContain('import RecordDrawer')
      expect(socialCore).not.toContain("RecordDrawer")
      expect(resourceHub).not.toContain("RecordDrawer")
    })
  })

  describe("field grouping and accessibility", () => {
    it.each(["social_post", "event", "task", "campaign", "content", "asset"] as const)(
      "keeps fields unique and unmatched fields in More fields for %s",
      (layoutType) => {
        const fields = [
          field("f1", "title"),
          field("f2", "status"),
          field("f3", "unknown_field_for_more_fields"),
          field("f4", "description"),
        ]
        const result = resolveRecordLayout(fields, layoutType)
        const renderedIds = result.sections.flatMap((section) =>
          section.fields.map((item) => item.id)
        )
        expect(result.isCustom).toBe(true)
        expect(new Set(renderedIds).size).toBe(renderedIds.length)
        expect(result.sections.some((section) => section.label === "More fields")).toBe(true)
      }
    )

    it("keeps priority/summary sections ahead of More fields", () => {
      const fields = [
        field("f1", "title"),
        field("f2", "status"),
        field("f3", "unknown_metric"),
      ]
      const result = resolveRecordLayout(fields, "campaign")
      const moreIndex = result.sections.findIndex((section) => section.label === "More fields")
      expect(moreIndex).toBeGreaterThan(0)
    })
  })

  describe("functional preservation in RecordEditor", () => {
    it("keeps comments, activity, and draft warning paths", () => {
      const src = readSource("components/records/RecordEditor.tsx")
      expect(src).toContain("RecordComments")
      expect(src).toContain("RecordActivity")
      expect(src).toContain("You have an unsaved draft. Restore it?")
      expect(src).toContain("Restore draft")
      expect(src).toContain("Discard")
    })
  })

  describe("overlay/sidebar safety", () => {
    it("uses md:left-sidebar and does not use md:left-64 for record panel paths", () => {
      const panel = readSource("components/records/RecordPanel.tsx")
      const eventDetail = readSource("components/interface/EventDetailPanel.tsx")
      expect(panel).toContain("md:left-sidebar")
      expect(eventDetail).toContain("md:left-sidebar")
      expect(panel).not.toMatch(/md:left-64\b/)
      expect(eventDetail).not.toMatch(/md:left-64\b/)
    })
  })

  describe("edit mode safety", () => {
    it("keeps edit-mode click guards in custom block open handlers", () => {
      const eventCore = readSource("components/interface/EventCalendarCore.tsx")
      const things = readSource("components/interface/blocks/ThingsToDoBlock.tsx")
      const campaigns = readSource("components/interface/blocks/CampaignsOverviewBlock.tsx")
      const resourceHub = readSource("components/interface/blocks/InternalResourceHubBlock.tsx")
      const contentTimeline = readSource("components/interface/blocks/ContentTimelineBlock.tsx")
      const canvas = readSource("components/interface/Canvas.tsx")

      expect(eventCore).toContain("if (isEditing) return")
      expect(things).toContain("if (isEditing) return")
      expect(campaigns).toContain("if (isEditing || clickAction === \"none\") return")
      expect(resourceHub).toContain("!isEditing")
      expect(resourceHub).toMatch(/handleSelect[\s\S]*?if \(isEditing\) return/)
      expect(resourceHub).toMatch(/openResourceUrl[\s\S]*?if \(isEditing\) return/)
      expect(resourceHub).toMatch(/handleEditResourceDetails[\s\S]*?if \(isEditing/)
      expect(contentTimeline).toMatch(/handleSelectItem[\s\S]*?if \(isEditing\) return/)
      expect(contentTimeline).toMatch(/handleOpenRecord[\s\S]*?if \(isEditing\) return/)
      expect(canvas).toContain("onMouseDownCapture")
      expect(canvas).toContain("selectThisBlock")
    })
  })
})
