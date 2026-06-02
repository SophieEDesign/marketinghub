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

describe("custom block modal field contract", () => {
  it("CampaignsOverviewBlock uses shared Select components instead of native select", () => {
    const src = readSource("components/interface/blocks/CampaignsOverviewBlock.tsx")
    expect(src).toContain('from "@/components/ui/select"')
    expect(src).toContain("<SelectTrigger")
    expect(src).toContain("<SelectContent")
    expect(src).not.toContain("<select")
  })

  it("campaign/status/type/priority badges use shared badge styling helper path", () => {
    const src = readSource("components/interface/blocks/CampaignsOverviewBlock.tsx")
    expect(src).toContain("function toneForValue")
    expect(src).toContain("function Badge")
    expect(src).toContain("toneForValue(value)")
    expect(src).toContain("<Badge value={item.type} />")
    expect(src).toContain("<Badge value={item.status} />")
    expect(src).toContain("<Badge value={item.priority} />")
  })

  it("ThingsToDoRecordSidePanel receives and passes interfaceMode", () => {
    const src = readSource("components/interface/things-to-do/ThingsToDoRecordSidePanel.tsx")
    expect(src).toContain('interfaceMode?: "view" | "edit"')
    expect(src).toContain('interfaceMode = "view"')
    expect(src).toContain("openRecordModal({")
    expect(src).toContain("interfaceMode,")
    expect(src).toContain("<RecordEditor")
    expect(src).toContain("interfaceMode={interfaceMode}")
  })

  it("custom layout rendering continues through RecordEditor and FieldEditor", () => {
    const src = readSource("components/records/RecordEditor.tsx")
    expect(src).toContain("if (useCustomLayout)")
    expect(src).toContain("customLayout.sections.map")
    expect(src).toContain("<FieldEditor")
    expect(src).not.toContain("<input")
  })

  it("unknown fields still route to More fields", () => {
    const result = resolveRecordLayout(
      [
        field("f1", "title"),
        field("f2", "status"),
        field("f3", "non_matching_custom_field"),
      ],
      "campaign"
    )
    expect(result.sections.some((section) => section.label === "More fields")).toBe(true)
  })

  it("custom layouts do not duplicate field rendering", () => {
    const result = resolveRecordLayout(
      [
        field("f1", "title"),
        field("f2", "status"),
        field("f3", "campaign"),
        field("f4", "other_unmatched_field"),
      ],
      "social_post"
    )
    const renderedIds = result.sections.flatMap((section) => section.fields.map((item) => item.id))
    expect(new Set(renderedIds).size).toBe(renderedIds.length)
  })

  it("overlay paths use md:left-sidebar and do not use md:left-64", () => {
    const recordPanel = readSource("components/records/RecordPanel.tsx")
    const eventDetail = readSource("components/interface/EventDetailPanel.tsx")
    expect(recordPanel).toContain("md:left-sidebar")
    expect(eventDetail).toContain("md:left-sidebar")
    expect(recordPanel).not.toMatch(/md:left-64\b/)
    expect(eventDetail).not.toMatch(/md:left-64\b/)
  })
})
