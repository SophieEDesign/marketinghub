/**
 * Field resolution for generic Record blocks (type: "record").
 * Precedence: detail_fields > visible_fields > modal_fields > field_layout > all fields.
 */

import type { BlockConfig } from "@/lib/interface/types"
import type { TableField } from "@/types/fields"
import type { FieldLayoutItem } from "@/lib/interface/field-layout-utils"
import { getVisibleFieldsForCanvas } from "@/lib/interface/field-layout-helpers"

export interface RecordBlockFieldResolution {
  fieldNames: string[]
  missingFieldNames: string[]
  fieldLayout: FieldLayoutItem[] | null
}

function buildFieldLookup(tableFields: TableField[]): Map<string, TableField> {
  const map = new Map<string, TableField>()
  for (const field of tableFields) {
    if (field?.name) map.set(field.name, field)
    if (field?.id) map.set(field.id, field)
  }
  return map
}

function resolveConfiguredNames(
  configured: string[],
  lookup: Map<string, TableField>
): { fieldNames: string[]; missingFieldNames: string[] } {
  const fieldNames: string[] = []
  const missingFieldNames: string[] = []
  const seen = new Set<string>()

  for (const key of configured) {
    if (!key || typeof key !== "string") continue
    const field = lookup.get(key)
    if (!field?.name) {
      missingFieldNames.push(key)
      continue
    }
    if (!seen.has(field.name)) {
      seen.add(field.name)
      fieldNames.push(field.name)
    }
  }

  return { fieldNames, missingFieldNames }
}

function nonEmptyStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const filtered = value.filter((v): v is string => typeof v === "string" && v.length > 0)
  return filtered.length > 0 ? filtered : null
}

/**
 * Resolve which field names a Record block should display.
 */
export function resolveRecordBlockFields(
  config: BlockConfig | Record<string, unknown> | undefined,
  tableFields: TableField[]
): RecordBlockFieldResolution {
  const cfg = (config || {}) as BlockConfig & Record<string, unknown>
  const lookup = buildFieldLookup(tableFields)
  const fieldLayout = Array.isArray(cfg.field_layout) && cfg.field_layout.length > 0
    ? (cfg.field_layout as FieldLayoutItem[])
    : null

  const detailFields = nonEmptyStringArray(cfg.detail_fields)
  if (detailFields) {
    const { fieldNames, missingFieldNames } = resolveConfiguredNames(detailFields, lookup)
    return { fieldNames, missingFieldNames, fieldLayout }
  }

  const visibleFields = nonEmptyStringArray(cfg.visible_fields)
  if (visibleFields) {
    const { fieldNames, missingFieldNames } = resolveConfiguredNames(visibleFields, lookup)
    return { fieldNames, missingFieldNames, fieldLayout }
  }

  const modalFields = nonEmptyStringArray((cfg as any).modal_fields)
  if (modalFields) {
    const { fieldNames, missingFieldNames } = resolveConfiguredNames(modalFields, lookup)
    return { fieldNames, missingFieldNames, fieldLayout }
  }

  if (fieldLayout) {
    const canvasFields = getVisibleFieldsForCanvas(fieldLayout, tableFields)
    const fieldNames = canvasFields.map((f) => f.name).filter(Boolean)
    const layoutKeys = fieldLayout.flatMap((item) =>
      [item.field_id, item.field_name].filter((k): k is string => typeof k === "string" && k.length > 0)
    )
    const { missingFieldNames } = resolveConfiguredNames(layoutKeys, lookup)
    return { fieldNames, missingFieldNames, fieldLayout }
  }

  const fieldNames = tableFields
    .filter((f) => f?.name && !(f.options as { system?: boolean } | undefined)?.system)
    .map((f) => f.name)

  return { fieldNames, missingFieldNames: [], fieldLayout: null }
}

/**
 * Block-level editability: page + config + layout edit mode.
 */
export function resolveRecordBlockEditability(
  config: BlockConfig | Record<string, unknown> | undefined,
  pageEditable: boolean,
  isLayoutEditing: boolean
): boolean {
  if (isLayoutEditing) return false
  if (pageEditable === false) return false
  const cfg = (config || {}) as BlockConfig
  if (cfg.allow_editing === false) return false
  const permissions = cfg.permissions
  if (permissions?.mode === "view") return false
  return true
}
