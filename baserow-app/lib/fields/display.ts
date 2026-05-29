import type { TableField } from "@/types/fields"
import { formatFieldNameForDisplay } from "@/lib/fields/validation"

/**
 * Prefer the human-friendly `label` if present, otherwise fall back to a readable
 * transformation of the internal `name` (snake_case -> Title Case).
 * Centralised null safety: prevents crashes everywhere when field metadata is missing.
 */
export function getFieldDisplayName(
  field?: Pick<TableField, "name" | "label"> | null
): string {
  if (!field) return ""

  if (field.label?.trim()) return field.label

  if (field.name?.trim()) {
    return formatFieldNameForDisplay(field.name)
  }

  return ""
}

