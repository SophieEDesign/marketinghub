/**
 * Shared field-resolution helpers for marketing dashboards.
 */

import type { FieldOptions } from "@/types/fields"

type FieldWithOptions = { name: string; type?: string; options?: FieldOptions }

export function pickFieldName(
  fields: Array<{ name: string }>,
  patterns: RegExp[],
  fallback: string | null = null
): string | null {
  for (const pattern of patterns) {
    const hit = fields.find((f) => pattern.test(f.name))
    if (hit) return hit.name
  }
  return fallback
}

export function formatDisplayValue(value: unknown): string | null {
  if (value == null || value === "") return null
  if (typeof value === "string") return value.trim() || null
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) {
    const parts = value.map((v) => formatDisplayValue(v)).filter(Boolean) as string[]
    return parts.length ? parts.join(", ") : null
  }
  if (typeof value === "object" && value !== null && "label" in value) {
    return formatDisplayValue((value as { label?: unknown }).label)
  }
  return String(value)
}

/** Labels from single_select / multi_select field options (table schema). */
export function choiceLabelsFromField(field: FieldWithOptions | undefined): string[] {
  if (!field?.options) return []
  const opts = field.options as FieldOptions
  const selectOptions = opts.selectOptions
  if (Array.isArray(selectOptions) && selectOptions.length > 0) {
    return selectOptions
      .map((o) => o.label?.trim() ?? "")
      .filter(Boolean)
  }
  const choices = opts.choices
  if (!Array.isArray(choices)) return []
  return choices.map((c) => String(c).trim()).filter(Boolean)
}

export function choiceLabelsForFieldNames(
  fields: FieldWithOptions[],
  fieldNames: Array<string | null | undefined>
): string[] {
  const labels = new Set<string>()
  for (const name of fieldNames) {
    if (!name) continue
    const field = fields.find((f) => f.name === name)
    for (const label of choiceLabelsFromField(field)) {
      labels.add(label)
    }
  }
  return Array.from(labels).sort((a, b) => a.localeCompare(b))
}

/** Merge live row values with schema choices (deduped, sorted). */
export function mergeFilterOptionLists(live: string[], fromSchema: string[]): string[] {
  const set = new Set<string>()
  for (const v of [...fromSchema, ...live]) {
    const t = v.trim()
    if (t) set.add(t)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}
