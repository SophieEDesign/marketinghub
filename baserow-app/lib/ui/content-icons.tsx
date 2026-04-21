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

function normalizeValue(value: unknown): string | null {
  if (value == null) return null
  const normalized = String(value).trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
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

  const typeIcon = getMappedIcon(row, TYPE_KEYS, TYPE_ICON_MAP)
  if (typeIcon) return typeIcon

  const statusIcon = getMappedIcon(row, STATUS_KEYS, STATUS_ICON_MAP)
  if (statusIcon) return statusIcon

  return getMappedIcon(row, CATEGORY_KEYS, TYPE_ICON_MAP)
}

export function resolveKpiIcon(iconName: unknown): LucideIcon | null {
  const normalized = normalizeValue(iconName)
  if (!normalized) return null
  return TYPE_ICON_MAP[normalized] || STATUS_ICON_MAP[normalized] || null
}
