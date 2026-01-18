export function isSchemaError(error: any): boolean {
  if (!error) return false
  const code = String(error.code || "")
  const message = String(error.message || "").toLowerCase()

  if (code === "42703" || code === "42P01" || code === "PGRST116") {
    return true
  }

  if (message.includes("schema cache")) return true
  if (message.includes("column") && message.includes("does not exist")) return true
  if (message.includes("relation") && message.includes("does not exist")) return true

  return false
}

export function getSchemaSafeMessage(error: any, fallback: string): string {
  if (!isSchemaError(error)) return fallback
  return "This data schema changed recently. Refresh the page and try again."
}

export function logSchemaWarning(context: string, error: any) {
  if (!isSchemaError(error)) return
  console.warn(`[Schema Warning] ${context}`, error)
}
