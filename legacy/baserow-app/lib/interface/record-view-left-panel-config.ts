/**
 * Normalized left-panel config for Record View pages.
 * Canonical keys use list_* prefix; legacy left_panel keys remain supported on read.
 */

import type { PageConfig } from "@/lib/interface/page-config"
import type { FilterTree } from "@/lib/filters/canonical-model"
import type { GroupRule } from "@/lib/grouping/types"
import type { TableField } from "@/types/fields"
import {
  resolveListPanelFieldName,
  resolveListPanelFieldNames,
  type ListPanelDensity,
} from "@/lib/interface/record-view-list-panel-helpers"

export type LeftPanelConfig = NonNullable<PageConfig["left_panel"]>

function lp(config: PageConfig | undefined): LeftPanelConfig {
  return (config?.left_panel || {}) as LeftPanelConfig
}

/** Read boolean with list_* then legacy key. */
function readBool(
  panel: LeftPanelConfig,
  listKey: keyof LeftPanelConfig,
  legacyKey: keyof LeftPanelConfig,
  defaultValue: boolean
): boolean {
  const listVal = panel[listKey]
  if (listVal === true || listVal === false) return listVal
  const legacyVal = panel[legacyKey]
  if (legacyVal === true || legacyVal === false) return legacyVal
  return defaultValue
}

export function getLeftPanelFromPage(config: PageConfig | undefined): LeftPanelConfig {
  return lp(config)
}

export function getListShowSearch(config: PageConfig | undefined): boolean {
  const panel = lp(config)
  return readBool(panel, "list_show_search" as keyof LeftPanelConfig, "show_search", true)
}

export function getListSearchPlaceholder(config: PageConfig | undefined): string {
  const panel = lp(config)
  return (
    (panel.list_search_placeholder as string | undefined) ||
    panel.search_placeholder ||
    "Search records..."
  )
}

export function getListSearchFields(config: PageConfig | undefined): string[] | undefined {
  const panel = lp(config)
  const fields =
    (panel.list_search_fields as string[] | undefined) ||
    (panel.list_search_field_ids as string[] | undefined) ||
    panel.search_fields
  return fields?.length ? fields : undefined
}

export function getListShowAddButton(config: PageConfig | undefined): boolean {
  const panel = lp(config)
  if (readBool(panel, "list_show_add_button" as keyof LeftPanelConfig, "show_add_button", true) === false) {
    return false
  }
  if (panel.user_actions?.add_records === false) return false
  return true
}

export function getListAddButtonLabel(config: PageConfig | undefined): string {
  const panel = lp(config)
  return (
    (panel.list_add_button_label as string | undefined) ||
    panel.add_button_label ||
    "Add record"
  )
}

export function getListDensity(config: PageConfig | undefined): ListPanelDensity {
  const panel = lp(config)
  const d = (panel.list_density as ListPanelDensity | undefined) || panel.density
  if (d === "compact" || d === "detailed") return d
  return "comfortable"
}

export function getListShowBadges(config: PageConfig | undefined): boolean {
  const panel = lp(config)
  return readBool(panel, "list_show_badges" as keyof LeftPanelConfig, "show_badges" as keyof LeftPanelConfig, true)
}

export function getListShowMetadata(config: PageConfig | undefined): boolean {
  const panel = lp(config)
  return readBool(
    panel,
    "list_show_metadata" as keyof LeftPanelConfig,
    "show_metadata" as keyof LeftPanelConfig,
    true
  )
}

export function getListShowAvatar(config: PageConfig | undefined): boolean {
  const panel = lp(config)
  return readBool(panel, "list_show_avatar" as keyof LeftPanelConfig, "show_avatar" as keyof LeftPanelConfig, true)
}

export function getListShowGroupCounts(config: PageConfig | undefined): boolean {
  const panel = lp(config)
  return readBool(
    panel,
    "list_show_group_counts" as keyof LeftPanelConfig,
    "show_group_counts",
    true
  )
}

export function getListGroupsDefaultCollapsed(config: PageConfig | undefined): boolean {
  const panel = lp(config)
  return readBool(
    panel,
    "list_groups_default_collapsed" as keyof LeftPanelConfig,
    "groups_default_collapsed",
    false
  )
}

export function getListHideEmptyGroups(config: PageConfig | undefined): boolean {
  const panel = lp(config)
  return readBool(
    panel,
    "list_hide_empty_groups" as keyof LeftPanelConfig,
    "hide_empty_groups" as keyof LeftPanelConfig,
    false
  )
}

export function getListEmptyTitle(config: PageConfig | undefined): string {
  const panel = lp(config)
  return (panel.list_empty_title as string | undefined) || panel.empty_title || "No records found"
}

export function getListEmptyDescription(config: PageConfig | undefined): string | undefined {
  const panel = lp(config)
  return (panel.list_empty_description as string | undefined) || panel.empty_description
}

export function getListNoResultsTitle(config: PageConfig | undefined): string {
  const panel = lp(config)
  return (
    (panel.list_no_results_title as string | undefined) ||
    panel.empty_search_message ||
    "No records match your search"
  )
}

export function getListNoResultsDescription(config: PageConfig | undefined): string | undefined {
  return lp(config).list_no_results_description as string | undefined
}

export function resolveListTitleField(config: PageConfig | undefined, fields: TableField[]): TableField | null {
  const panel = lp(config)
  const name = resolveListPanelFieldName(
    (panel.list_title_field_id as string | undefined) || panel.title_field_id,
    (panel.list_title_field as string | undefined) ||
      panel.title_field ||
      config?.title_field,
    fields
  )
  return name ? fields.find((f) => f.name === name) ?? null : null
}

export function resolveListSubtitleFields(config: PageConfig | undefined, fields: TableField[]): TableField[] {
  const panel = lp(config)
  const sub1 = resolveListPanelFieldName(
    (panel.list_subtitle_field_id as string | undefined) || panel.field_1_id,
    (panel.list_subtitle_field as string | undefined) || panel.field_1,
    fields
  )
  const sub2 = resolveListPanelFieldName(
    (panel.list_secondary_subtitle_field_id as string | undefined) || panel.field_2_id,
    (panel.list_secondary_subtitle_field as string | undefined) || panel.field_2,
    fields
  )
  return [sub1, sub2]
    .filter(Boolean)
    .map((n) => fields.find((f) => f.name === n))
    .filter((f): f is TableField => f != null)
}

export function resolveListImageFieldName(config: PageConfig | undefined, fields: TableField[]): string | null {
  const panel = lp(config)
  return resolveListPanelFieldName(
    (panel.list_image_field_id as string | undefined) || panel.image_field_id,
    (panel.list_image_field as string | undefined) || panel.image_field,
    fields
  )
}

export function resolveListBadgeFields(config: PageConfig | undefined, fields: TableField[]): TableField[] {
  const panel = lp(config)
  const { resolved } = resolveListPanelFieldNames(
    (panel.list_badge_fields as string[] | undefined) || panel.pill_fields,
    (panel.list_badge_field_ids as string[] | undefined) || panel.pill_field_ids,
    fields
  )
  return resolved.map((n) => fields.find((f) => f.name === n)).filter((f): f is TableField => f != null)
}

export function resolveListMetadataFields(config: PageConfig | undefined, fields: TableField[]): TableField[] {
  const panel = lp(config)
  const { resolved } = resolveListPanelFieldNames(
    panel.list_metadata_fields as string[] | undefined,
    panel.list_metadata_field_ids as string[] | undefined,
    fields
  )
  return resolved.map((n) => fields.find((f) => f.name === n)).filter((f): f is TableField => f != null)
}

export interface MissingLeftPanelField {
  key: string
  label: string
}

export function detectMissingLeftPanelFields(
  config: PageConfig | undefined,
  fields: TableField[]
): MissingLeftPanelField[] {
  const panel = lp(config)
  const missing: MissingLeftPanelField[] = []

  const checkSingle = (
    key: string,
    label: string,
    id: string | undefined,
    name: string | undefined
  ) => {
    if (!id && !name) return
    const resolved = resolveListPanelFieldName(id, name, fields)
    if (!resolved || !fields.some((f) => f.name === resolved)) {
      missing.push({ key, label: `${label}: ${name || id}` })
    }
  }

  checkSingle(
    "title",
    "Title field",
    (panel.list_title_field_id as string | undefined) || panel.title_field_id,
    (panel.list_title_field as string | undefined) || panel.title_field
  )
  checkSingle(
    "subtitle",
    "Subtitle field",
    (panel.list_subtitle_field_id as string | undefined) || panel.field_1_id,
    (panel.list_subtitle_field as string | undefined) || panel.field_1
  )
  checkSingle(
    "subtitle2",
    "Secondary subtitle",
    (panel.list_secondary_subtitle_field_id as string | undefined) || panel.field_2_id,
    (panel.list_secondary_subtitle_field as string | undefined) || panel.field_2
  )
  checkSingle(
    "image",
    "Image field",
    (panel.list_image_field_id as string | undefined) || panel.image_field_id,
    (panel.list_image_field as string | undefined) || panel.image_field
  )

  const badgeMissing = resolveListPanelFieldNames(
    (panel.list_badge_fields as string[] | undefined) || panel.pill_fields,
    (panel.list_badge_field_ids as string[] | undefined) || panel.pill_field_ids,
    fields
  ).missing
  badgeMissing.forEach((m) => missing.push({ key: "badge", label: `Badge field: ${m}` }))

  const metaMissing = resolveListPanelFieldNames(
    panel.list_metadata_fields as string[] | undefined,
    panel.list_metadata_field_ids as string[] | undefined,
    fields
  ).missing
  metaMissing.forEach((m) => missing.push({ key: "metadata", label: `Metadata field: ${m}` }))

  const searchMissing = resolveListPanelFieldNames(
    panel.list_search_fields as string[] | undefined,
    panel.list_search_field_ids as string[] | undefined,
    fields
  ).missing
  searchMissing.forEach((m) => missing.push({ key: "search", label: `Search field: ${m}` }))

  return missing
}

/** Merge patch into left_panel with list_* + legacy mirrors for persistence. */
export function patchLeftPanelConfig(
  current: PageConfig | undefined,
  patch: Partial<LeftPanelConfig> & Record<string, unknown>
): LeftPanelConfig {
  const prev = lp(current)
  const next = { ...prev, ...patch } as LeftPanelConfig

  if ("list_show_search" in patch) {
    next.show_search = patch.list_show_search as boolean
  }
  if ("show_search" in patch && !("list_show_search" in patch)) {
    next.list_show_search = patch.show_search as boolean
  }
  if ("list_search_placeholder" in patch) {
    next.search_placeholder = patch.list_search_placeholder as string
  }
  if ("list_show_add_button" in patch) {
    next.show_add_button = patch.list_show_add_button as boolean
  }
  if ("list_add_button_label" in patch) {
    next.add_button_label = patch.list_add_button_label as string
  }
  if ("list_density" in patch) {
    next.density = patch.list_density as ListPanelDensity
  }
  if ("list_title_field" in patch) {
    next.title_field = patch.list_title_field as string
  }
  if ("list_subtitle_field" in patch) {
    next.field_1 = patch.list_subtitle_field as string
  }
  if ("list_secondary_subtitle_field" in patch) {
    next.field_2 = patch.list_secondary_subtitle_field as string
  }
  if ("list_image_field" in patch) {
    next.image_field = patch.list_image_field as string
  }
  if ("list_badge_fields" in patch) {
    next.pill_fields = patch.list_badge_fields as string[]
  }
  if ("list_empty_title" in patch) {
    next.empty_title = patch.list_empty_title as string
  }
  if ("list_no_results_title" in patch) {
    next.empty_search_message = patch.list_no_results_title as string
  }

  return next
}

export type { FilterTree, GroupRule }
