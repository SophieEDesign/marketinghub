/**
 * Helpers for Record View left list panel config and runtime.
 */

import type { PageConfig } from "@/lib/interface/page-config"
import type { TableField } from "@/types/fields"

export type ListPanelDensity = "compact" | "comfortable" | "detailed"

export function resolveListPanelFieldName(
  fieldId: string | undefined,
  fieldName: string | undefined,
  fields: TableField[]
): string | null {
  if (fieldId) {
    const byId = fields.find((f) => f.id === fieldId)
    if (byId?.name) return byId.name
  }
  if (fieldName) {
    const byName = fields.find((f) => f.name === fieldName)
    if (byName?.name) return byName.name
  }
  return fieldName || null
}

export function resolveListPanelFieldNames(
  names: string[] | undefined,
  ids: string[] | undefined,
  fields: TableField[]
): { resolved: string[]; missing: string[] } {
  const configured = names?.length ? names : []
  const idList = ids?.length ? ids : []
  const keys = configured.length > 0 ? configured : idList
  const resolved: string[] = []
  const missing: string[] = []
  const seen = new Set<string>()

  for (let i = 0; i < keys.length; i++) {
    const name = configured[i]
    const id = idList[i]
    const resolvedName = resolveListPanelFieldName(id, name, fields)
    if (!resolvedName || !fields.some((f) => f.name === resolvedName)) {
      missing.push(name || id || keys[i])
      continue
    }
    if (!seen.has(resolvedName)) {
      seen.add(resolvedName)
      resolved.push(resolvedName)
    }
  }

  return { resolved, missing }
}

export function shouldShowListSearch(leftPanel: PageConfig["left_panel"]): boolean {
  if (leftPanel?.list_show_search === false || leftPanel?.show_search === false) return false
  return true
}

export function shouldShowListAddButton(
  leftPanel: PageConfig["left_panel"],
  _pageConfig: PageConfig
): boolean {
  if (leftPanel?.list_show_add_button === false || leftPanel?.show_add_button === false) return false
  if (leftPanel?.user_actions?.add_records === false) return false
  return true
}

export function getListPanelDensity(leftPanel: PageConfig["left_panel"]): ListPanelDensity {
  const d = leftPanel?.list_density || leftPanel?.density
  if (d === "compact" || d === "detailed") return d
  return "comfortable"
}

export function hasExplicitListCardConfig(leftPanel: PageConfig["left_panel"] | undefined): boolean {
  if (!leftPanel) return false
  return Boolean(
    leftPanel.list_title_field ||
      leftPanel.list_title_field_id ||
      leftPanel.title_field ||
      leftPanel.title_field_id ||
      leftPanel.list_subtitle_field ||
      leftPanel.list_subtitle_field_id ||
      leftPanel.field_1 ||
      leftPanel.field_1_id ||
      leftPanel.list_secondary_subtitle_field ||
      leftPanel.list_secondary_subtitle_field_id ||
      leftPanel.field_2 ||
      leftPanel.field_2_id ||
      (leftPanel.list_badge_fields && leftPanel.list_badge_fields.length > 0) ||
      (leftPanel.list_badge_field_ids && leftPanel.list_badge_field_ids.length > 0) ||
      (leftPanel.pill_fields && leftPanel.pill_fields.length > 0) ||
      (leftPanel.pill_field_ids && leftPanel.pill_field_ids.length > 0)
  )
}

export const RECORD_VIEW_SETTINGS_TAB_IDS = [
  "data",
  "left_panel",
  "detail_panel",
  "permissions",
  "layout",
] as const

/** @deprecated Use left_panel */
export const RECORD_VIEW_SETTINGS_TAB_ID_LIST_PANEL = "left_panel" as const
