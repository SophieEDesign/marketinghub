/**
 * Marketing workspace status pill colours (case-insensitive string match).
 * Used by GalleryView / ListView for status-like fields on the Marketing Dashboard.
 */

const STATUS_MAP: Array<{ keys: string[]; bg: string; text: string }> = [
  { keys: ["live", "published", "active", "go"], bg: "bg-emerald-100 dark:bg-emerald-950/50", text: "text-emerald-800 dark:text-emerald-200" },
  { keys: ["planning", "draft", "idea", "backlog"], bg: "bg-amber-100 dark:bg-amber-950/50", text: "text-amber-900 dark:text-amber-200" },
  { keys: ["upcoming", "scheduled", "queued"], bg: "bg-sky-100 dark:bg-sky-950/50", text: "text-sky-900 dark:text-sky-200" },
  { keys: ["delayed", "blocked", "overdue", "late"], bg: "bg-red-100 dark:bg-red-950/50", text: "text-red-900 dark:text-red-200" },
  { keys: ["in progress", "in-progress", "progress", "review"], bg: "bg-indigo-100 dark:bg-indigo-950/50", text: "text-indigo-900 dark:text-indigo-200" },
]

const DEFAULT_CLASSES = {
  bg: "bg-muted",
  text: "text-muted-foreground",
}

/**
 * Returns Tailwind class names for a status pill (bg + text).
 */
export function getMarketingStatusPillClassNames(value: unknown): { bg: string; text: string } {
  if (value === null || value === undefined) return DEFAULT_CLASSES
  const s = String(value).trim().toLowerCase()
  if (!s) return DEFAULT_CLASSES
  for (const row of STATUS_MAP) {
    if (row.keys.some((k) => s === k || s.includes(k))) {
      return { bg: row.bg, text: row.text }
    }
  }
  return DEFAULT_CLASSES
}

/**
 * True if field should use marketing status pills (status column / single_select named status).
 */
export function isMarketingStatusField(fieldName: string | undefined, fieldType?: string): boolean {
  if (!fieldName) return false
  const n = fieldName.toLowerCase()
  if (n === "status") return true
  if (fieldType === "single_select" && (n.includes("status") || n.includes("stage"))) return true
  return false
}
