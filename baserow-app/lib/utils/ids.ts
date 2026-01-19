// Shared ID helpers
//
// In a few places (especially block-backed views) we may receive composite IDs like:
//   "<uuid>:<index>"
// Supabase/PostgREST expects strict UUIDs for uuid-typed columns, so we must sanitize
// before sending them to `.eq('id', ...)` / `.eq('view_id', ...)` filters.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function normalizeCompositeId(value: string | null | undefined): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  // Keep only the first segment to strip suffixes like ":1"
  return trimmed.split(':')[0]?.trim() || ''
}

export function isUuid(value: string | null | undefined): boolean {
  if (typeof value !== 'string') return false
  return UUID_RE.test(value.trim())
}

/**
 * Returns a safe UUID string or null.
 * - Strips composite suffixes like `:1`
 * - Validates UUID format
 */
export function normalizeUuid(value: string | null | undefined): string | null {
  const base = normalizeCompositeId(value)
  return isUuid(base) ? base : null
}

