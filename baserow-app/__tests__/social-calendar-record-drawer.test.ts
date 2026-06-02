import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import { resolveRecordLayout } from "@/lib/records/record-layout-resolver"
import type { TableField } from "@/types/fields"

function read(filePath: string) {
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

describe("social calendar one-drawer record behaviour", () => {
  it("opens posts via openRecordModal with social_post layout (not openRecord)", () => {
    const src = read("components/interface/SocialMediaCalendarCore.tsx")
    expect(src).toContain("openRecordModal")
    expect(src).not.toMatch(/openRecord\s*\(/)
    expect(src).toContain('recordLayoutType: "social_post"')
    expect(src).toContain("initialDrawerMode")
    expect(src).toContain("openPost(id")
  })

  it("does not open record drawer while page layout edit selects the block", () => {
    const src = read("components/interface/SocialMediaCalendarCore.tsx")
    expect(src).toContain("if (isEditing) return")
  })

  it("uses contextual tabs and edit/discard footer in RecordEditor", () => {
    const src = read("components/records/RecordEditor.tsx")
    expect(src).toContain("Edit post")
    expect(src).toContain("Discard changes")
    expect(src).toContain("setRecordDrawerMode")
    expect(src).toContain("<Tabs")
  })

  it("keeps RecordPanel overlay clear of sidebar on desktop", () => {
    const src = read("components/records/RecordPanel.tsx")
    expect(src).toContain("md:left-sidebar")
  })

  it("maps social_post fields into Overview/Caption/More fields tabs", () => {
    const fields = [
      field("f1", "Content Name"),
      field("f2", "Caption"),
      field("f3", "custom_metric"),
    ]
    const result = resolveRecordLayout(fields, "social_post")
    expect(result.isCustom).toBe(true)
    expect(result.sections.some((s) => s.label === "Overview")).toBe(true)
    expect(result.sections.some((s) => s.label === "Caption")).toBe(true)
    expect(result.sections.some((s) => s.label === "More fields")).toBe(true)
    const more = result.sections.find((s) => s.label === "More fields")
    expect(more?.fields.map((f) => f.id)).toEqual(["f3"])
  })

  it("SocialPostQuickView does not offer a second full-record drawer", () => {
    const src = read("components/interface/social/SocialPostQuickView.tsx")
    expect(src).not.toContain("Open full record")
    expect(src).not.toContain("onOpenFullRecord")
  })
})
