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
  type ResourceAttachmentVariant,
  type ResourceCategory,
  type ResourceFileType,
} from "@/components/interface/blocks/internal-resource-hub/types"
import { attachmentVariantKey } from "@/components/interface/blocks/internal-resource-hub/utils"

export interface MediaFieldMap {
  name: string
  notes: string | null
  hubCategory: string | null
  status: string | null
  documentLink: string | null
  editLink: string | null
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
    documentLink: pick([/document_link/i, /file_url/i, /^link$/i, /^url$/i], "document_link"),
    editLink: pick([/edit[_\s-]?link/i], "edit_link"),
    attachments: pick([/^attachments?$/i, /^images?$/i, /media/i, /attachment/i], "attachments"),
    assignee: pick([/assignee/i, /owned_by/i, /owner/i, /uploaded_by/i], null),
    updatedAt: pick([/^updated_at$/i], "updated_at"),
  }
  if (!overrides || Object.keys(overrides).length === 0) return base
  const fieldIds = fields.map((f) => ({ id: f.id || f.name, name: f.name }))
  return applyFieldOverrides(base, overrides, fieldIds)
}

export interface ParsedAttachment {
  url: string
  name?: string
  type?: string | null
}

function fileTypeFromExtension(ext: string): ResourceFileType | null {
  switch (ext.toLowerCase()) {
    case "png":
      return "PNG"
    case "jpg":
    case "jpeg":
      return "JPG"
    case "svg":
      return "SVG"
    case "pdf":
      return "PDF"
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
      return null
  }
}

function fileTypeFromMime(type: string | null | undefined): ResourceFileType | null {
  if (!type?.trim()) return null
  const mime = type.trim().toLowerCase()
  if (mime.includes("pdf")) return "PDF"
  if (mime.includes("word") || mime.includes("msword") || mime.includes("document")) return "DOCX"
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "PPTX"
  if (mime.includes("spreadsheet") || mime.includes("excel")) return "XLSX"
  if (mime.startsWith("image/png")) return "PNG"
  if (mime.startsWith("image/jpeg") || mime.startsWith("image/jpg")) return "JPG"
  if (mime.includes("svg")) return "SVG"
  if (mime.startsWith("video/")) return "MP4"
  if (mime.includes("zip")) return "ZIP"
  return null
}

function fileTypeFromUrl(url: string | null): ResourceFileType {
  if (!url) return "LINK"
  const normalized = url.trim()
  if (!normalized) return "LINK"
  const ext = normalized.split("?")[0].split(".").pop()?.toLowerCase() ?? ""
  const fromExt = fileTypeFromExtension(ext)
  if (fromExt) return fromExt

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

function resolveResourceFileType(
  url: string | null,
  attachment?: ParsedAttachment | null
): ResourceFileType {
  const fromUrl = fileTypeFromUrl(url)
  if (fromUrl !== "LINK") return fromUrl

  if (attachment?.name) {
    const ext = attachment.name.split(".").pop() ?? ""
    const fromName = fileTypeFromExtension(ext)
    if (fromName) return fromName
  }

  const fromMime = fileTypeFromMime(attachment?.type)
  if (fromMime) return fromMime

  // Uploaded storage files should not present as external web links.
  if (
    attachment?.url &&
    (attachment.url.includes("/storage/v1/object/public/attachments/") ||
      attachment.url.includes("/storage/v1/object/sign/attachments/"))
  ) {
    return "DOCX"
  }

  return "LINK"
}

function parseAttachmentItem(item: unknown): ParsedAttachment | null {
  if (typeof item === "string") {
    const trimmed = item.trim()
    if (!trimmed) return null
    if (trimmed.startsWith("http") || trimmed.startsWith("/") || trimmed.startsWith("data:")) {
      return { url: trimmed }
    }
    return null
  }
  if (!item || typeof item !== "object") return null
  const obj = item as Record<string, unknown>
  const rawUrl = obj.url ?? obj.src ?? obj.href ?? obj.thumbnail ?? obj.file_url
  if (typeof rawUrl !== "string" || !rawUrl.trim()) return null
  const url = rawUrl.trim()
  if (!url.startsWith("http") && !url.startsWith("/") && !url.startsWith("data:")) return null
  return {
    url,
    name: typeof obj.name === "string" ? obj.name : undefined,
    type: typeof obj.type === "string" ? obj.type : null,
  }
}

/** Extract Google Drive / Docs file id from common share URL shapes. */
export function extractGoogleDriveFileId(url: string): string | null {
  try {
    const parsed = new URL(url.trim())
    const host = parsed.hostname.toLowerCase()
    if (!host.includes("google.com")) return null
    const pathMatch = parsed.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/)
    if (pathMatch?.[1]) return pathMatch[1]
    const idParam = parsed.searchParams.get("id")
    if (idParam) return idParam
    return null
  } catch {
    return null
  }
}

export function buildGoogleDriveThumbnailUrl(fileId: string): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w600`
}

/** Parse link host → human-readable storage source label. */
export function resolveResourceSource(url: string | null | undefined): string | undefined {
  if (!url?.trim()) return undefined
  try {
    const host = new URL(url.trim()).hostname.toLowerCase()
    if (host.includes("drive.google.com") || host.includes("docs.google.com")) {
      return "Google Drive"
    }
    if (host.includes("sharepoint.com") || host.includes("onedrive")) {
      return "SharePoint"
    }
    return undefined
  } catch {
    return undefined
  }
}

function isDirectImageUrl(url: string): boolean {
  return /\.(png|jpe?g|svg|webp|gif)(\?|$)/i.test(url.split("?")[0] ?? "")
}

/** Prefer attachment image, then Drive thumbnail from document_link, then attachment URL. */
export function resolveResourceThumbnailUrl(
  linkUrl: string | null,
  primaryAttachmentUrl: string | null
): string | undefined {
  if (primaryAttachmentUrl && isDirectImageUrl(primaryAttachmentUrl)) {
    return primaryAttachmentUrl
  }

  for (const candidate of [linkUrl, primaryAttachmentUrl]) {
    if (!candidate) continue
    const fileId = extractGoogleDriveFileId(candidate)
    if (fileId) return buildGoogleDriveThumbnailUrl(fileId)
  }

  return primaryAttachmentUrl ?? undefined
}

export function parseAttachments(input: unknown): ParsedAttachment[] {
  if (input == null || input === "") return []

  if (typeof input === "string") {
    const s = input.trim()
    if (s.startsWith("[") || s.startsWith("{")) {
      try {
        return parseAttachments(JSON.parse(s))
      } catch {
        const single = parseAttachmentItem(s)
        return single ? [single] : []
      }
    }
    const single = parseAttachmentItem(s)
    return single ? [single] : []
  }

  if (Array.isArray(input)) {
    return input
      .map((item) => parseAttachmentItem(item))
      .filter((item): item is ParsedAttachment => item != null)
  }

  if (typeof input === "object") {
    const single = parseAttachmentItem(input)
    return single ? [single] : []
  }

  return []
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
    const parsedAttachments = fields.attachments
      ? parseAttachments(row[fields.attachments])
      : []
    const primaryAttachment = parsedAttachments[0] ?? null
    const primaryAttachmentUrl = primaryAttachment?.url ?? null
    const thumbnailUrl = resolveResourceThumbnailUrl(linkUrl, primaryAttachmentUrl)
    const source = resolveResourceSource(linkUrl ?? primaryAttachmentUrl)
    const url = primaryAttachmentUrl || linkUrl || null
    const referenceUrl = primaryAttachmentUrl && linkUrl ? linkUrl : undefined
    const editLinkRaw = fields.editLink ? formatDisplayValue(row[fields.editLink]) : null
    const editLink =
      editLinkRaw && /^https?:\/\//i.test(editLinkRaw.trim()) ? editLinkRaw.trim() : undefined
    const fileType = resolveResourceFileType(
      url,
      primaryAttachmentUrl ? primaryAttachment : null
    )
    const recordId = String(row.id)
    const attachmentVariants: ResourceAttachmentVariant[] = parsedAttachments.map((att, index) => ({
      key: attachmentVariantKey(recordId, index),
      url: att.url,
      name: att.name,
      fileType: resolveResourceFileType(att.url, att),
      thumbnailUrl:
        resolveResourceThumbnailUrl(linkUrl, att.url) ?? att.url,
    }))
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
      id: recordId,
      title,
      category,
      fileType,
      url: url ?? undefined,
      referenceUrl,
      editLink,
      thumbnailUrl,
      source,
      attachmentVariants: attachmentVariants.length > 1 ? attachmentVariants : undefined,
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
