import type { FieldOptions, FieldType, TableField } from "@/types/fields"
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

export function isFieldValueError(value: unknown): boolean {
  if (typeof value !== "string") return false
  return value.trim().toUpperCase().startsWith("#ERROR")
}

interface InlineEditStateInput {
  editable?: boolean
  fieldType?: FieldType | string
  fieldOptions?: FieldOptions
  isVirtual?: boolean
  isReadOnlyOverride?: boolean
}

export function getInlineEditState({
  editable = true,
  fieldType,
  fieldOptions,
  isVirtual,
  isReadOnlyOverride,
}: InlineEditStateInput) {
  const resolvedVirtual = isVirtual ?? (fieldType === "formula" || fieldType === "lookup")
  const readOnlyByField = !!fieldOptions?.read_only || !!fieldOptions?.system
  const isReadOnly = isReadOnlyOverride !== undefined
    ? isReadOnlyOverride
    : resolvedVirtual || readOnlyByField
  const canEdit = !!editable && !isReadOnly

  return {
    canEdit,
    isReadOnly,
    isVirtual: resolvedVirtual,
  }
}

