import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import { resolveRecordLayout } from "@/lib/records/record-layout-resolver"
import { isUserField } from "@/lib/users/userDisplay"
import type { TableField } from "@/types/fields"

function readSource(filePath: string) {
  return readFileSync(join(process.cwd(), filePath), "utf8")
}

function field(id: string, name: string, type = "text"): TableField {
  return {
    id,
    name,
    type,
    table_id: "tbl-1",
  } as TableField
}

const CUSTOM_DRAWER_SOURCES = [
  "components/records/RecordEditor.tsx",
  "components/records/EventRecordContextualView.tsx",
  "components/interface/EventDetailPanel.tsx",
  "components/interface/things-to-do/ThingsToDoRecordSidePanel.tsx",
]

describe("custom block modal field contract", () => {
  it("CampaignsOverviewBlock uses shared Select components instead of native select", () => {
    const src = readSource("components/interface/blocks/CampaignsOverviewBlock.tsx")
    expect(src).toContain('from "@/components/ui/select"')
    expect(src).toContain("<SelectTrigger")
    expect(src).toContain("<SelectContent")
    expect(src).not.toContain("<select")
  })

  it("campaign/status/type/priority badges use shared ChoicePill path", () => {
    const src = readSource("components/interface/blocks/CampaignsOverviewBlock.tsx")
    expect(src).toContain('from "@/components/fields/ChoicePill"')
    expect(src).toContain("<ChoicePill")
    expect(src).toContain("CampaignValuePill")
    expect(src).not.toContain("function toneForValue")
    expect(src).not.toContain("function Badge(")
  })

  it("UpcomingSummaryBlock and SocialStatusPill use shared ChoicePill for status display", () => {
    const upcoming = readSource("components/interface/blocks/UpcomingSummaryBlock.tsx")
    const social = readSource("components/interface/social/SocialStatusPill.tsx")
    expect(upcoming).toContain('from "@/components/fields/ChoicePill"')
    expect(upcoming).toContain("<ChoicePill")
    expect(social).toContain('from "@/components/fields/ChoicePill"')
    expect(social).toContain("<ChoicePill")
    expect(social).not.toContain("getMarketingStatusPillClassNames")
  })

  it("RecordEditor custom layout header uses ChoicePill for status display", () => {
    const src = readSource("components/records/RecordEditor.tsx")
    expect(src).toContain('from "@/components/fields/ChoicePill"')
    expect(src).toContain("fieldOptions={customLayout.statusField?.options}")
    expect(src).not.toContain('from "@/components/ui/badge"')
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

  it("custom layout fields render through InlineFieldEditor (shared RecordFields stack)", () => {
    const src = readSource("components/records/RecordEditor.tsx")
    expect(src).toContain("if (useCustomLayout)")
    expect(src).toContain("renderCustomSectionFields")
    expect(src).toContain("<InlineFieldEditor")
    expect(src).not.toMatch(/displayValue\s*=\s*assetUserNamesById/)
    expect(src).not.toMatch(/assetUserNamesById/)
  })

  it("FieldEditor select fields use shared InlineSelectDropdown", () => {
    const src = readSource("components/fields/FieldEditor.tsx")
    expect(src).toContain("InlineSelectDropdown")
    expect(src).not.toContain("<SelectItem")
    expect(src).not.toContain("<select")
  })

  it("FieldEditor resolves user-reference columns via shared userDisplay helpers", () => {
    const src = readSource("components/fields/FieldEditor.tsx")
    expect(src).toContain('from "@/lib/users/userDisplay"')
    expect(src).toContain("getUserDisplayName")
    expect(src).toContain("isUserField")
  })

  it("unknown fields still route to More fields", () => {
    const result = resolveRecordLayout(
      [
        field("f1", "title"),
        field("f2", "status", "single_select"),
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
        field("f2", "status", "single_select"),
        field("f3", "campaign"),
        field("f4", "other_unmatched_field"),
      ],
      "social_post"
    )
    const renderedIds = result.sections.flatMap((section) => section.fields.map((item) => item.id))
    expect(new Set(renderedIds).size).toBe(renderedIds.length)
  })

  it("asset layout includes select and user columns without bespoke UUID rewriting", () => {
    const result = resolveRecordLayout(
      [
        field("f1", "title"),
        field("f2", "hub_category", "single_select"),
        field("f3", "updated_by"),
        field("f4", "attachments", "attachment"),
      ],
      "asset"
    )
    const names = result.sections.flatMap((s) => s.fields.map((f) => f.name))
    expect(names).toContain("hub_category")
    expect(names).toContain("updated_by")
  })

  it("event layout resolves status as single_select field type when typed", () => {
    const result = resolveRecordLayout(
      [
        field("f1", "title"),
        field("f2", "status", "single_select"),
        field("f3", "start_date", "date"),
      ],
      "event"
    )
    const statusField = result.sections.flatMap((s) => s.fields).find((f) => f.name === "status")
    expect(statusField?.type).toBe("single_select")
  })

  it("task layout resolves priority/status fields", () => {
    const result = resolveRecordLayout(
      [
        field("f1", "title"),
        field("f2", "status", "single_select"),
        field("f3", "priority", "single_select"),
      ],
      "task"
    )
    const names = result.sections.flatMap((s) => s.fields.map((f) => f.name))
    expect(names).toContain("status")
    expect(names).toContain("priority")
  })

  it("campaign layout resolves campaign type and status fields", () => {
    const result = resolveRecordLayout(
      [
        field("f1", "campaign_name"),
        field("f2", "status", "single_select"),
        field("f3", "campaign_type", "single_select"),
      ],
      "campaign"
    )
    const names = result.sections.flatMap((s) => s.fields.map((f) => f.name))
    expect(names).toContain("status")
    expect(names).toContain("campaign_type")
  })

  it("isUserField detects audit columns by metadata name, not display labels", () => {
    expect(isUserField("created_by")).toBe(true)
    expect(isUserField("updated_by")).toBe(true)
    expect(isUserField("assignee")).toBe(true)
    expect(isUserField("uploaded_by")).toBe(true)
    expect(isUserField("Owned by")).toBe(false)
    expect(isUserField("Updated By")).toBe(false)
  })

  it("custom drawer sources do not pre-transform field values before shared editors", () => {
    for (const path of CUSTOM_DRAWER_SOURCES) {
      const src = readSource(path)
      expect(src).not.toMatch(/displayValue\s*=\s*assetUserNamesById/)
      expect(src).not.toMatch(/assetTableNamesById/)
    }
  })

  it("custom drawer sources do not use native select for field rows", () => {
    const recordEditor = readSource("components/records/RecordEditor.tsx")
    expect(recordEditor).not.toMatch(/<select\b/)
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
