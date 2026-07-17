import { describe, it, expect } from "vitest"
import {
  RECORD_VIEW_SETTINGS_TAB_IDS,
  resolveListPanelFieldName,
  resolveListPanelFieldNames,
  getListPanelDensity,
  hasExplicitListCardConfig,
} from "@/lib/interface/record-view-list-panel-helpers"
import {
  getListShowSearch,
  getListSearchPlaceholder,
  getListShowAddButton,
  getListAddButtonLabel,
  getListShowGroupCounts,
  getListShowBadges,
  getListDensity,
  getListEmptyTitle,
  getListNoResultsTitle,
  resolveListTitleField,
  resolveListSubtitleFields,
  resolveListBadgeFields,
  detectMissingLeftPanelFields,
  patchLeftPanelConfig,
} from "@/lib/interface/record-view-left-panel-config"
import type { TableField } from "@/types/fields"
import type { PageConfig } from "@/lib/interface/page-config"

const fields: TableField[] = [
  { id: "id-name", name: "name", type: "text", table_id: "t1", position: 0 } as TableField,
  { id: "id-type", name: "type", type: "single_select", table_id: "t1", position: 1 } as TableField,
  { id: "id-co", name: "company", type: "text", table_id: "t1", position: 2 } as TableField,
]

describe("record view left panel settings", () => {
  it("includes Left Panel tab in settings tab ids", () => {
    expect(RECORD_VIEW_SETTINGS_TAB_IDS).toContain("left_panel")
    expect(RECORD_VIEW_SETTINGS_TAB_IDS).toContain("detail_panel")
  })

  it("list_show_search hides search when false", () => {
    const config: PageConfig = { left_panel: { list_show_search: false } }
    expect(getListShowSearch(config)).toBe(false)
    expect(getListShowSearch({ left_panel: { show_search: false } })).toBe(false)
  })

  it("list_search_placeholder changes placeholder", () => {
    expect(getListSearchPlaceholder({ left_panel: { list_search_placeholder: "Find…" } })).toBe(
      "Find…"
    )
  })

  it("list_show_add_button hides add button", () => {
    expect(getListShowAddButton({ left_panel: { list_show_add_button: false } })).toBe(false)
  })

  it("list_add_button_label updates label", () => {
    expect(getListAddButtonLabel({ left_panel: { list_add_button_label: "Add contact" } })).toBe(
      "Add contact"
    )
  })

  it("list_title_field controls record title resolution", () => {
    const title = resolveListTitleField(
      { left_panel: { list_title_field: "name" }, title_field: "company" },
      fields
    )
    expect(title?.name).toBe("name")
  })

  it("list_subtitle_field controls subtitle fields", () => {
    const subs = resolveListSubtitleFields(
      { left_panel: { list_subtitle_field: "company", list_secondary_subtitle_field: "type" } },
      fields
    )
    expect(subs.map((f) => f.name)).toEqual(["company", "type"])
  })

  it("list_badge_fields resolve for shared pill rendering", () => {
    const badges = resolveListBadgeFields(
      { left_panel: { list_badge_fields: ["type"] } },
      fields
    )
    expect(badges[0]?.type).toBe("single_select")
  })

  it("list_show_group_counts defaults true and can be false", () => {
    expect(getListShowGroupCounts({})).toBe(true)
    expect(getListShowGroupCounts({ left_panel: { list_show_group_counts: false } })).toBe(false)
  })

  it("list_sort_field stored via patch mirrors sort_by", () => {
    const next = patchLeftPanelConfig(
      {},
      { list_sort_field: "name", sort_by: [{ field: "name", direction: "asc" }] }
    )
    expect(next.sort_by?.[0]?.field).toBe("name")
  })

  it("list_density changes density", () => {
    expect(getListDensity({ left_panel: { list_density: "compact" } })).toBe("compact")
    expect(getListPanelDensity({ list_density: "compact" })).toBe("compact")
  })

  it("missing list field warning is non-blocking", () => {
    const missing = detectMissingLeftPanelFields(
      { left_panel: { list_title_field: "gone", list_badge_fields: ["type", "missing"] } },
      fields
    )
    expect(missing.some((m) => m.key === "title")).toBe(true)
    expect(missing.some((m) => m.label.includes("missing"))).toBe(true)
  })

  it("list_show_badges can be disabled", () => {
    expect(getListShowBadges({ left_panel: { list_show_badges: false } })).toBe(false)
  })

  it("empty state copy from list_* keys", () => {
    expect(getListEmptyTitle({ left_panel: { list_empty_title: "Nothing here" } })).toBe(
      "Nothing here"
    )
    expect(getListNoResultsTitle({ left_panel: { list_no_results_title: "No hits" } })).toBe(
      "No hits"
    )
  })

  it("resolves field id before name", () => {
    expect(resolveListPanelFieldName("id-name", "company", fields)).toBe("name")
  })

  it("patchLeftPanelConfig mirrors list_* to legacy keys", () => {
    const next = patchLeftPanelConfig({}, { list_show_search: false })
    expect(next.show_search).toBe(false)
    expect(next.list_show_search).toBe(false)
  })

  it("detail_fields precedence remains on record block helper path", async () => {
    const { resolveRecordBlockFields } = await import(
      "@/lib/interface/record-block-field-resolution"
    )
    const result = resolveRecordBlockFields({ detail_fields: ["name"] }, fields)
    expect(result.fieldNames).toEqual(["name"])
  })
})
