// Utilities for building safe PostgREST `select` and `order` clauses.
//
// PostgREST expects a comma-separated list of column identifiers (no SQL quoting).
// In practice, passing quoted identifiers (e.g. `"id"`) through supabase-js can
// yield 400 responses because the quotes become part of the URL-encoded select.
//
// Our dynamic data tables generate safe snake_case identifiers, so we validate
// and only emit unquoted identifiers.

const POSTGREST_IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

export function toPostgrestColumn(name: string): string | null {
  const trimmed = String(name ?? '').trim()
  if (!trimmed) return null
  return POSTGREST_IDENT_RE.test(trimmed) ? trimmed : null
}

export function buildSelectClause(
  columns: string[],
  opts?: { includeId?: boolean | string; fallback?: string }
): string {
  const includeId = opts?.includeId !== false
  const idColumn = typeof opts?.includeId === 'string' ? opts.includeId : 'id'
  const fallback = opts?.fallback ?? '*'

  const safeCols = (columns || [])
    .map(toPostgrestColumn)
    .filter(Boolean) as string[]

  const unique = Array.from(new Set(safeCols))
  if (unique.length === 0) return fallback

  const withId = includeId ? [idColumn, ...unique] : unique
  return Array.from(new Set(withId)).join(',')
}

