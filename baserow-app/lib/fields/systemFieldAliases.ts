/**
 * Some "system" fields are presented in the UI under friendly names that don't
 * necessarily match the physical Supabase column names on dynamic tables.
 *
 * When blocks (e.g. FieldBlock) query `.select(field.name)` for these fields,
 * PostgREST can return 400 if the column doesn't exist.
 *
 * This helper provides a conservative alias mapping so blocks can fall back to
 * real audit columns without breaking existing user fields.
 */
const SYSTEM_FIELD_ALIASES: Record<string, string> = {
  // Common aliases seen in UI/content models
  created: "created_at",
  last_modified: "updated_at",
  last_modified_at: "updated_at",
  updated: "updated_at",
  modified: "updated_at",
  last_modified_by: "updated_by",
  updated_by: "updated_by",
  created_by: "created_by",
}

export function resolveSystemFieldAlias(fieldName: string | null | undefined): string | null {
  if (!fieldName || typeof fieldName !== "string") return null
  const raw = fieldName.trim()
  if (!raw) return null
  const lower = raw.toLowerCase()
  const mapped = SYSTEM_FIELD_ALIASES[lower]
  if (!mapped) return null
  // Only return if it's actually different (avoid pointless indirection)
  return mapped !== raw ? mapped : null
}

