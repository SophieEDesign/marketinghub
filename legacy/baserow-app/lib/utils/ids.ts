// Shared ID helpers
//
// In a few places (especially block-backed views) we may receive composite IDs like:
//   "<uuid>:<index>"
// Supabase/PostgREST expects strict UUIDs for uuid-typed columns, so we must sanitize
// before sending them to `.eq('id', ...)` / `.eq('view_id', ...)` filters.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function extractLikelyIdFromObject(value: unknown): string | null {
  if (!value || typeof value !== "object") return null
  const v: any = value

  // Common shapes from select components / API payloads.
  const candidate =
    (typeof v.id === "string" && v.id) ||
    (typeof v.value === "string" && v.value) ||
    (typeof v.uuid === "string" && v.uuid) ||
    (typeof v.key === "string" && v.key) ||
    null

  return candidate ? String(candidate) : null
}

export function normalizeCompositeId(value: unknown): string {
  // Accept unknown because configs/URL params can accidentally pass objects
  // (which would otherwise become "[object Object]" and break UUID filters).
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return ""
    // Keep only the first segment to strip suffixes like ":1"
    return trimmed.split(":")[0]?.trim() || ""
  }

  const fromObj = extractLikelyIdFromObject(value)
  if (fromObj) return normalizeCompositeId(fromObj)

  return ""
}

export function isUuid(value: unknown): boolean {
  if (typeof value !== "string") return false
  return UUID_RE.test(value.trim())
}

/**
 * Returns a safe UUID string or null.
 * - Strips composite suffixes like `:1`
 * - Validates UUID format
 */
export function normalizeUuid(value: unknown): string | null {
  const base = normalizeCompositeId(value)
  return isUuid(base) ? base : null
}

