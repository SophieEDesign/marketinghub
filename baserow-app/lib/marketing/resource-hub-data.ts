/**
 * Map Media Links Resources table → Internal Resource Hub cards.
 */

import { format } from "date-fns"
import {
  applyFieldOverrides,
  type FieldOverridePair,
} from "@/lib/marketing/block-config-resolver"
import { formatDisplayValue } from "@/lib/marketing/field-utils"
import {
  categoryLabel,
  HUB_CATEGORY_OPTIONS,
  type MockResource,
  type ResourceCategory,
  type ResourceFileType,
} from "@/components/interface/blocks/internal-resource-hub/types"

export interface MediaFieldMap {
  name: string
  notes: string | null
  hubCategory: string | null
  status: string | null
  documentLink: string | null
  assignee: string | null
  updatedAt: string | null
}

/** Sidebar labels stored in hub_category single_select (record values use labels). */
export const HUB_CATEGORY_SELECT_LABELS: string[] = HUB_CATEGORY_OPTIONS.filter(
  (o) => o.id !== "all"
).map((o) => o.label)

const CATEGORY_ID_SET = new Set<ResourceCategory>(
  HUB_CATEGORY_OPTIONS.map((o) => o.id).filter((id): id is ResourceCategory => id !== "all")
)

function slugifyCategoryToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
}

const CATEGORY_LOOKUP: Map<string, ResourceCategory> = (() => {
  const map = new Map<string, ResourceCategory>()
  for (const opt of HUB_CATEGORY_OPTIONS) {
    if (opt.id === "all") continue
    const id = opt.id as ResourceCategory
    map.set(id, id)
    map.set(slugifyCategoryToken(id), id)
    map.set(slugifyCategoryToken(opt.label), id)
    map.set(opt.label.trim().toLowerCase(), id)
  }
  return map
})()

/** Parse hub_category cell value (id, label, or legacy alias) → sidebar category id. */
export function parseHubCategory(raw: string | null | undefined): ResourceCategory | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  const direct = CATEGORY_LOOKUP.get(trimmed.toLowerCase())
  if (direct) return direct

  const slug = slugifyCategoryToken(trimmed)
  return CATEGORY_LOOKUP.get(slug) ?? null
}

function categoryFromLegacyStatusAndFileType(
  status: string | null,
  fileType: ResourceFileType
): ResourceCategory {
  const s = (status ?? "").toLowerCase()
  if (/logo/i.test(s)) return "logos"
  if (/brand|guideline/i.test(s)) return "brand-guidelines"
  if (/template/i.test(s)) return "templates"
  if (/video/i.test(s)) return "videos"
  if (fileType === "PPTX") return "presentations"
  if (fileType === "PNG" || fileType === "JPG" || fileType === "SVG") return "images"
  return "documents"
}

/** Resolve category: explicit hub_category field → legacy status heuristics → file type. */
export function resolveResourceCategory(
  hubCategory: string | null,
  legacyStatus: string | null,
  fileType: ResourceFileType
): ResourceCategory {
  const explicit = parseHubCategory(hubCategory)
  if (explicit && CATEGORY_ID_SET.has(explicit)) return explicit
  return categoryFromLegacyStatusAndFileType(legacyStatus, fileType)
}

export function resolveMediaFields(
  fields: Array<{ id?: string; name: string }>,
  overrides?: Partial<Record<keyof MediaFieldMap, FieldOverridePair>>
): MediaFieldMap {
  const pick = (patterns: RegExp[], fallback: string | null = null) => {
    for (const p of patterns) {
      const hit = fields.find((f) => p.test(f.name))
      if (hit) return hit.name
    }
    return fallback
  }
  const base: MediaFieldMap = {
    name: pick([/^name$/i, /title/i], "name")!,
    notes: pick([/^notes$/i, /description/i], null),
    hubCategory: pick([/^hub_category$/i, /resource.?hub.?category/i], "hub_category"),
    status: pick([/^status$/i], null),
    documentLink: pick([/document_link/i, /file_url/i, /link/i, /url/i], "document_link"),
    assignee: pick([/assignee/i, /owned_by/i, /owner/i, /uploaded_by/i], null),
    updatedAt: pick([/^updated_at$/i], "updated_at"),
  }
  if (!overrides || Object.keys(overrides).length === 0) return base
  const fieldIds = fields.map((f) => ({ id: f.id || f.name, name: f.name }))
  return applyFieldOverrides(base, overrides, fieldIds)
}

function fileTypeFromUrl(url: string | null): ResourceFileType {
  if (!url) return "PDF"
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? ""
  switch (ext) {
    case "png":
      return "PNG"
    case "jpg":
    case "jpeg":
      return "JPG"
    case "svg":
      return "SVG"
    case "docx":
    case "doc":
      return "DOCX"
    case "pptx":
    case "ppt":
      return "PPTX"
    case "xlsx":
    case "xls":
      return "XLSX"
    case "mp4":
    case "mov":
      return "MP4"
    case "zip":
      return "ZIP"
    default:
      return "PDF"
  }
}

export function buildResourceHubItems(
  rows: Record<string, unknown>[],
  fields: MediaFieldMap,
  mediaTableId: string
): MockResource[] {
  const items: MockResource[] = []
  for (const row of rows) {
    const title = formatDisplayValue(row[fields.name])
    if (!title?.trim()) continue
    const url = fields.documentLink ? formatDisplayValue(row[fields.documentLink]) : null
    const fileType = fileTypeFromUrl(url)
    const hubCategoryRaw = fields.hubCategory
      ? formatDisplayValue(row[fields.hubCategory])
      : null
    const legacyStatus = fields.status ? formatDisplayValue(row[fields.status]) : null
    const category = resolveResourceCategory(hubCategoryRaw, legacyStatus, fileType)
    const updatedRaw = fields.updatedAt ? row[fields.updatedAt] : row.updated_at
    let updatedAt: string | undefined
    if (updatedRaw) {
      const d = new Date(String(updatedRaw))
      if (!isNaN(d.getTime())) updatedAt = format(d, "d MMM yyyy")
    }

    const tagLabel = hubCategoryRaw?.trim()
      ? categoryLabel(category)
      : legacyStatus?.trim() || undefined

    items.push({
      id: String(row.id),
      title,
      category,
      fileType,
      url: url ?? undefined,
      description: fields.notes ? formatDisplayValue(row[fields.notes]) ?? undefined : undefined,
      updatedAt,
      owner: fields.assignee ? formatDisplayValue(row[fields.assignee]) ?? undefined : undefined,
      isInternalOnly: true,
      tags: tagLabel ? [tagLabel] : undefined,
      usage: `table:${mediaTableId}`,
    })
  }
  return items
}
