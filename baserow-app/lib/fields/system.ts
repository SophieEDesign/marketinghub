import type { TableField } from "@/types/fields"

export const SYSTEM_FIELD_NAMES = new Set([
  "created_at",
  "created_by",
  "updated_at",
  "updated_by",
])

export function isSystemFieldName(name?: string | null): boolean {
  return SYSTEM_FIELD_NAMES.has(String(name || "").toLowerCase())
}

export function isSystemField(field?: TableField | null): boolean {
  if (!field) return false
  return isSystemFieldName(field.name) || !!field.options?.system
}
