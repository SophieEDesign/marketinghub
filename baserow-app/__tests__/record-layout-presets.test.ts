import { describe, expect, it } from "vitest"
import { resolveRecordLayout } from "@/lib/records/record-layout-resolver"
import type { TableField } from "@/types/fields"

function field(id: string, name: string): TableField {
  return {
    id,
    name,
    type: "text",
    table_id: "tbl-1",
  } as TableField
}

describe("record layout resolver", () => {
  it("returns generic no-op layout when missing type", () => {
    const result = resolveRecordLayout([field("f1", "title")])
    expect(result.isCustom).toBe(false)
    expect(result.type).toBe("generic")
    expect(result.sections).toHaveLength(0)
  })

  it("puts unmatched fields into More fields without duplication", () => {
    const fields = [
      field("f1", "title"),
      field("f2", "status"),
      field("f3", "unknown_custom_metric"),
    ]
    const result = resolveRecordLayout(fields, "social_post")
    const renderedIds = result.sections.flatMap((section) => section.fields.map((item) => item.id))
    expect(new Set(renderedIds).size).toBe(renderedIds.length)
    expect(renderedIds.sort()).toEqual(["f1", "f2", "f3"])
    expect(result.sections.some((section) => section.label === "More fields")).toBe(true)
  })

  it("exposes social_post tab sections including Overview and Channels", () => {
    const fields = [
      field("f1", "Content Name"),
      field("f2", "status"),
      field("f3", "Caption"),
      field("f4", "Instagram"),
      field("f5", "orphan_field"),
    ]
    const result = resolveRecordLayout(fields, "social_post")
    const labels = result.sections.map((s) => s.label)
    expect(labels).toContain("Overview")
    expect(labels).toContain("Caption")
    expect(labels).toContain("Channels")
    expect(labels).toContain("More fields")
  })

  it("prioritises summary fields in section ordering", () => {
    const fields = [
      field("f1", "status"),
      field("f2", "campaign"),
      field("f3", "title"),
    ]
    const result = resolveRecordLayout(fields, "campaign")
    const firstSection = result.sections[0]
    expect(firstSection.label).toBe("Campaign summary")
    expect(firstSection.fields.map((item) => item.name)).toContain("title")
    expect(firstSection.fields.map((item) => item.name)).toContain("status")
  })
})
