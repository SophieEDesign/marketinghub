/**
 * Shared field-resolution helpers for marketing dashboards.
 */

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
