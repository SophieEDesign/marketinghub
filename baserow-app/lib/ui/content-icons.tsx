import type { LucideIcon } from "lucide-react"
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Image,
  LayoutTemplate,
  Link2,
  Presentation,
} from "lucide-react"

export const TYPE_ICON_MAP: Record<string, LucideIcon> = {
  document: FileText,
  presentation: Presentation,
  template: LayoutTemplate,
  guide: BookOpen,
  asset: Image,
  link: Link2,
}

export const STATUS_ICON_MAP: Record<string, LucideIcon> = {
  "in progress": Clock3,
  approved: CheckCircle2,
  scheduled: CalendarDays,
}

const TYPE_KEYS = ["type", "content_type", "contentType", "item_type", "itemType"] as const
const STATUS_KEYS = ["status", "state", "stage"] as const
const CATEGORY_KEYS = ["category", "content_category", "contentCategory"] as const
const TYPE_KEYWORDS = ["type", "format", "kind"]
const STATUS_KEYWORDS = ["status", "state", "stage", "progress"]
const CATEGORY_KEYWORDS = ["category", "topic", "group"]

function normalizeValue(value: unknown): string | null {
  if (value == null) return null
  if (Array.isArray(value)) {
    const first = value[0]
    if (first == null) return null
    return normalizeValue(first)
  }
  if (typeof value === "object") {
    const objectValue = value as Record<string, unknown>
    const fallback = objectValue.name ?? objectValue.label ?? objectValue.value ?? null
    return normalizeValue(fallback)
  }
  const normalized = String(value).trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

function normalizeKey(key: string): string {
  return String(key).trim().toLowerCase().replace(/[\s-]+/g, "_")
}

function getKeywordKeys(row: Record<string, any>, keywords: readonly string[]): string[] {
  const rowKeys = Object.keys(row || {})
  return rowKeys.filter((rawKey) => {
    const key = normalizeKey(rawKey)
    return keywords.some((keyword) => key.includes(keyword))
  })
}

function getMappedIcon(
  row: Record<string, any>,
  keys: readonly string[],
  iconMap: Record<string, LucideIcon>
): LucideIcon | null {
  for (const key of keys) {
    const icon = iconMap[normalizeValue(row?.[key]) || ""]
    if (icon) return icon
  }
  return null
}

export function resolveContentIcon(row: Record<string, any>): LucideIcon | null {
  if (!row || typeof row !== "object") return null

  const typeIcon = getMappedIcon(row, [...TYPE_KEYS, ...getKeywordKeys(row, TYPE_KEYWORDS)], TYPE_ICON_MAP)
  if (typeIcon) return typeIcon

  const statusIcon = getMappedIcon(row, [...STATUS_KEYS, ...getKeywordKeys(row, STATUS_KEYWORDS)], STATUS_ICON_MAP)
  if (statusIcon) return statusIcon

  return getMappedIcon(row, [...CATEGORY_KEYS, ...getKeywordKeys(row, CATEGORY_KEYWORDS)], TYPE_ICON_MAP)
}

export function resolveKpiIcon(iconName: unknown): LucideIcon | null {
  const normalized = normalizeValue(iconName)
  if (!normalized) return null
  return TYPE_ICON_MAP[normalized] || STATUS_ICON_MAP[normalized] || null
}
