import type { TableField } from "@/types/fields"
import { formatFieldNameForDisplay } from "@/lib/fields/validation"

/**
 * Prefer the human-friendly `label` if present, otherwise fall back to a readable
 * transformation of the internal `name` (snake_case -> Title Case).
 */
export function getFieldDisplayName(field: Pick<TableField, "name" | "label">): string {
  const label = typeof field.label === "string" ? field.label.trim() : ""
  if (label) return label
  return formatFieldNameForDisplay(field.name || "")
}

