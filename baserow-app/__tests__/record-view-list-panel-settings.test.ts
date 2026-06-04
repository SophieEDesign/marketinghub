import { describe, it, expect } from "vitest"
import {
  RECORD_VIEW_SETTINGS_TAB_IDS,
  resolveListPanelFieldName,
  resolveListPanelFieldNames,
  shouldShowListSearch,
  shouldShowListAddButton,
  getListPanelDensity,
  hasExplicitListCardConfig,
} from "@/lib/interface/record-view-list-panel-helpers"
import type { TableField } from "@/types/fields"
import type { PageConfig } from "@/lib/interface/page-config"

const fields: TableField[] = [
  { id: "id-name", name: "name", type: "text", table_id: "t1", position: 0 } as TableField,
  { id: "id-type", name: "type", type: "single_select", table_id: "t1", position: 1 } as TableField,
]

describe("record view list panel helpers", () => {
  it("exports List panel tab in settings tab ids", () => {
    expect(RECORD_VIEW_SETTINGS_TAB_IDS).toContain("list_panel")
    expect(RECORD_VIEW_SETTINGS_TAB_IDS).toContain("detail_panel")
  })

  it("resolves title field by id first", () => {
    expect(resolveListPanelFieldName("id-name", "wrong", fields)).toBe("name")
  })

  it("resolves title field by name fallback", () => {
    expect(resolveListPanelFieldName(undefined, "name", fields)).toBe("name")
  })

  it("lists missing pill fields", () => {
    const { resolved, missing } = resolveListPanelFieldNames(
      ["type", "gone"],
      undefined,
      fields
    )
    expect(resolved).toEqual(["type"])
    expect(missing).toContain("gone")
  })

  it("show search defaults to true", () => {
    expect(shouldShowListSearch({})).toBe(true)
    expect(shouldShowListSearch({ show_search: false })).toBe(false)
  })

  it("show add button respects show_add_button and user_actions", () => {
    const page: PageConfig = {}
    expect(shouldShowListAddButton({}, page)).toBe(true)
    expect(shouldShowListAddButton({ show_add_button: false }, page)).toBe(false)
    expect(
      shouldShowListAddButton({ user_actions: { add_records: false } }, page)
    ).toBe(false)
  })

  it("density defaults to comfortable", () => {
    expect(getListPanelDensity({})).toBe("comfortable")
    expect(getListPanelDensity({ density: "compact" })).toBe("compact")
  })

  it("detects explicit list card config", () => {
    expect(hasExplicitListCardConfig({ title_field: "name" })).toBe(true)
    expect(hasExplicitListCardConfig({ pill_fields: ["type"] })).toBe(true)
    expect(hasExplicitListCardConfig({})).toBe(false)
  })

  it("pill_fields config roundtrip shape", () => {
    const leftPanel: PageConfig["left_panel"] = {
      pill_fields: ["type", "name"],
      show_search: true,
      search_placeholder: "Search contacts...",
    }
    expect(leftPanel.pill_fields).toHaveLength(2)
    expect(leftPanel.search_placeholder).toBe("Search contacts...")
  })
})
