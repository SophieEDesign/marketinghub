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
