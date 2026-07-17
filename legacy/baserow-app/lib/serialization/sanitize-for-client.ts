export function containsBigInt(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === "bigint") return true
  if (value == null) return false
  if (typeof value !== "object") return false
  const obj = value as object
  if (seen.has(obj)) return false
  seen.add(obj)
  if (Array.isArray(value)) {
    return value.some((entry) => containsBigInt(entry, seen))
  }
  return Object.values(value as Record<string, unknown>).some((entry) =>
    containsBigInt(entry, seen)
  )
}

export function sanitizeForClient<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, current) =>
      typeof current === "bigint" ? current.toString() : current
    )
  ) as T
}

/**
 * Ensure a value is safe to pass from Server Components to client children (RSC payload).
 * Always round-trips through JSON to strip bigint and other non-serializable values.
 */
export function prepareForRscPayload<T>(value: T): T {
  try {
    return sanitizeForClient(value)
  } catch (error) {
    console.error("[prepareForRscPayload] Serialization failed:", error)
    return sanitizeForClient(null) as T
  }
}

/** Returns true if value can be JSON.stringify'd for SSR handoff. */
export function assertJsonSerializable(value: unknown, label: string): boolean {
  try {
    JSON.stringify(value)
    return true
  } catch (error) {
    console.error(`[assertJsonSerializable] ${label} failed:`, error)
    return false
  }
}
