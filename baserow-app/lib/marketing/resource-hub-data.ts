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
  attachments: string | null
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
  if (fileType === "LINK" && /presentation|deck|slides?/i.test(s)) return "presentations"
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
    attachments: pick([/^attachments?$/i, /^images?$/i, /media/i, /attachment/i], "attachments"),
    assignee: pick([/assignee/i, /owned_by/i, /owner/i, /uploaded_by/i], null),
    updatedAt: pick([/^updated_at$/i], "updated_at"),
  }
  if (!overrides || Object.keys(overrides).length === 0) return base
  const fieldIds = fields.map((f) => ({ id: f.id || f.name, name: f.name }))
  return applyFieldOverrides(base, overrides, fieldIds)
}

function fileTypeFromUrl(url: string | null): ResourceFileType {
  if (!url) return "LINK"
  const normalized = url.trim()
  if (!normalized) return "LINK"
  const ext = normalized.split("?")[0].split(".").pop()?.toLowerCase() ?? ""
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
      break
  }

  // URL heuristics for link-based resources without file extensions.
  try {
    const parsed = new URL(normalized)
    const host = parsed.hostname.toLowerCase()
    const path = parsed.pathname.toLowerCase()
    const query = parsed.search.toLowerCase()
    const full = `${host}${path}${query}`

    if (
      host.includes("docs.google.com") && path.includes("/presentation/") ||
      host.includes("slides.com") ||
      host.startsWith("present.") ||
      full.includes("presentation") ||
      full.includes("powerpoint") ||
      full.includes("deck")
    ) {
      return "PPTX"
    }
  } catch {
    // Keep generic link type on URL parse failures.
  }

  return "LINK"
}

function pushUrlLike(target: string[], value: unknown) {
  if (typeof value !== "string" || !value.trim()) return
  const trimmed = value.trim()
  if (trimmed.startsWith("http") || trimmed.startsWith("/") || trimmed.startsWith("data:")) {
    target.push(trimmed)
  }
}

function parseAttachmentUrls(input: unknown): string[] {
  const urls: string[] = []
  if (input == null || input === "") return urls

  if (typeof input === "string") {
    const s = input.trim()
    if (s.startsWith("[") || s.startsWith("{")) {
      try {
        return parseAttachmentUrls(JSON.parse(s))
      } catch {
        pushUrlLike(urls, s)
        return urls
      }
    }
    pushUrlLike(urls, s)
    return urls
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item === "string") {
        pushUrlLike(urls, item)
        continue
      }
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>
        pushUrlLike(urls, obj.url ?? obj.src ?? obj.href ?? obj.thumbnail ?? obj.file_url)
      }
    }
    return urls
  }

  if (typeof input === "object") {
    const obj = input as Record<string, unknown>
    pushUrlLike(urls, obj.url ?? obj.src ?? obj.href ?? obj.thumbnail ?? obj.file_url)
  }

  return urls
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
    const linkUrl = fields.documentLink ? formatDisplayValue(row[fields.documentLink]) : null
    const attachmentUrls = fields.attachments ? parseAttachmentUrls(row[fields.attachments]) : []
    const thumbnailUrl = attachmentUrls[0] ?? undefined
    const primaryAttachmentUrl = attachmentUrls[0] ?? null
    const url = primaryAttachmentUrl || linkUrl || null
    const referenceUrl = primaryAttachmentUrl && linkUrl ? linkUrl : undefined
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
      referenceUrl,
      thumbnailUrl,
      description: fields.notes ? formatDisplayValue(row[fields.notes]) ?? undefined : undefined,
      updatedAt,
      owner: fields.assignee ? formatDisplayValue(row[fields.assignee]) ?? undefined : undefined,
      isInternalOnly:
        /internal[\s_-]?only/i.test(legacyStatus ?? "") ||
        /internal[\s_-]?only/i.test(hubCategoryRaw ?? ""),
      tags: tagLabel ? [tagLabel] : undefined,
      usage: `table:${mediaTableId}`,
    })
  }
  return items
}
