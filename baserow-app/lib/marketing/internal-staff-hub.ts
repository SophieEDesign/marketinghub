/**
 * Internal Staff Hub — resource library field resolution, categories, filtering.
 */

import { formatDistanceToNow, parseISO, isValid } from "date-fns"
import { pickFieldName, formatDisplayValue } from "@/lib/marketing/theme-overview"
import { buildDriveFolderOpenUrl, parseDriveLink } from "@/lib/marketing/drive-link"
import type { FieldOptions } from "@/types/fields"

type FieldRow = { name: string; type?: string; options?: FieldOptions }

export type HubCategoryId =
  | "brand"
  | "presentations"
  | "graphics"
  | "templates"
  | "documents"
  | "other"

export interface HubCategoryDef {
  id: HubCategoryId
  label: string
  accentClass: string
  accentBg: string
  matchPatterns: RegExp[]
}

export const HUB_CATEGORIES: HubCategoryDef[] = [
  {
    id: "brand",
    label: "Brand Assets",
    accentClass: "text-violet-700",
    accentBg: "bg-violet-500/10",
    matchPatterns: [/brand/i, /logo/i, /guideline/i, /identity/i],
  },
  {
    id: "presentations",
    label: "Presentations",
    accentClass: "text-blue-700",
    accentBg: "bg-blue-500/10",
    matchPatterns: [/presentation/i, /deck/i, /slide/i, /pitch/i],
  },
  {
    id: "graphics",
    label: "Graphics & Media",
    accentClass: "text-emerald-700",
    accentBg: "bg-emerald-500/10",
    matchPatterns: [/graphic/i, /media/i, /image/i, /photo/i, /video/i, /visual/i],
  },
  {
    id: "templates",
    label: "Templates",
    accentClass: "text-amber-700",
    accentBg: "bg-amber-500/10",
    matchPatterns: [/template/i, /email/i, /social/i, /newsletter/i],
  },
  {
    id: "documents",
    label: "Documents",
    accentClass: "text-rose-700",
    accentBg: "bg-rose-500/10",
    matchPatterns: [/document/i, /pdf/i, /doc/i, /report/i, /brief/i],
  },
]

/** Peters & May marketing photography — Drive folder (subfolders: Catamaran, Commercial, Racing, etc.). */
export const GENERAL_GALLERY_FOLDER = {
  folderId: "1-pHl-DXNlOPC4LuWneYmHB-fzHscofyS",
  title: "General Gallery",
  description:
    "High-res photography and video — Catamaran, Commercial, Racing, Superyacht, Liner and more.",
  url: buildDriveFolderOpenUrl("1-pHl-DXNlOPC4LuWneYmHB-fzHscofyS"),
} as const

export const QUICK_ACCESS_DEFS = [
  {
    id: "general-gallery",
    label: GENERAL_GALLERY_FOLDER.title,
    patterns: [/general\s*gallery/i, /photo\s*gallery/i, /image\s*library/i],
    fallbackUrl: GENERAL_GALLERY_FOLDER.url,
    category: "graphics" as HubCategoryId,
    description: GENERAL_GALLERY_FOLDER.description,
  },
  { id: "brand-guidelines", label: "Brand Guidelines", patterns: [/brand\s*guideline/i, /^brand\s*guide/i] },
  { id: "logo-pack", label: "Logo Pack", patterns: [/logo\s*pack/i, /logo\s*kit/i, /logos?$/i] },
  { id: "company-presentation", label: "Company Presentation", patterns: [/company\s*present/i, /corporate\s*deck/i] },
  { id: "email-templates", label: "Email Templates", patterns: [/email\s*template/i] },
  { id: "social-templates", label: "Social Templates", patterns: [/social\s*template/i, /social\s*pack/i] },
] as const

export interface InternalStaffFieldMap {
  title: string
  type: string | null
  category: string | null
  link: string | null
  description: string | null
  owner: string | null
  status: string | null
  updatedAt: string | null
  tags: string | null
  thumbnail: string | null
  isArchived: string | null
  deletedAt: string | null
}

export interface InternalStaffTableIds {
  resourcesTableId: string
  resourcesSupabaseTable: string
}

export interface StaffHubAsset {
  id: string
  title: string
  description: string | null
  type: string | null
  category: HubCategoryId
  categoryLabel: string
  tags: string[]
  link: ParsedDriveLink | null
  updatedAt: Date | null
  updatedLabel: string | null
  owner: string | null
  ownerInitials: string
  previewUrl: string | null
}

export interface StaffHubFilters {
  search: string
  category: HubCategoryId | "all"
  type: string | "all"
  tag: string | "all"
}

export function isInternalStaffHubPage(page: { name?: string; config?: unknown } | null): boolean {
  if (!page) return false
  const cfg = page.config as { layout_style?: string } | undefined
  const name = String(page.name || "").trim().toLowerCase()
  return cfg?.layout_style === "internal_staff_hub" || name === "internal staff hub"
}

export function resolveInternalStaffFields(fields: FieldRow[]): InternalStaffFieldMap {
  const title =
    pickFieldName(fields, [/^name$/i, /^title$/i, /document/i, /resource/i], "name") || "name"
  return {
    title,
    type: pickFieldName(fields, [/^type$/i, /format/i, /file_type/i], null),
    category: pickFieldName(fields, [/^category$/i, /segment/i, /group/i], null),
    link: pickFieldName(fields, [/url/i, /link/i, /document_link/i, /drive/i], null),
    description: pickFieldName(fields, [/description/i, /summary/i, /notes?/i], null),
    owner: pickFieldName(fields, [/owner/i, /assignee/i, /uploaded_by/i, /created_by/i], null),
    status: pickFieldName(fields, [/^status$/i, /state/i], null),
    updatedAt: pickFieldName(fields, [/^updated_at$/i, /last_updated/i, /modified/i, /updated/i], null),
    tags: pickFieldName(fields, [/tags?/i, /labels?/i], null),
    thumbnail: pickFieldName(fields, [/thumbnail/i, /preview/i, /image/i, /cover/i], null),
    isArchived: pickFieldName(fields, [/^is_archived$/i, /^archived$/i], null),
    deletedAt: pickFieldName(fields, [/^deleted_at$/i], null),
  }
}

function rowValue(row: Record<string, unknown>, field: string | null): unknown {
  if (!field) return null
  return row[field]
}

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean)
  if (typeof raw === "string" && raw.trim()) {
    return raw.split(/[,;|]/).map((s) => s.trim()).filter(Boolean)
  }
  return []
}

function resolveCategory(type: string | null, category: string | null, title: string): HubCategoryId {
  const haystack = [type, category, title].filter(Boolean).join(" ")
  for (const cat of HUB_CATEGORIES) {
    if (cat.matchPatterns.some((p) => p.test(haystack))) return cat.id
  }
  return "other"
}

function ownerInitials(name: string | null): string {
  if (!name?.trim()) return "?"
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?"
}

function parseDate(raw: unknown): Date | null {
  if (!raw) return null
  if (raw instanceof Date && isValid(raw)) return raw
  const d = typeof raw === "string" ? parseISO(raw) : new Date(String(raw))
  return isValid(d) ? d : null
}

function isActiveRow(
  row: Record<string, unknown>,
  fields: InternalStaffFieldMap
): boolean {
  if (fields.deletedAt && row[fields.deletedAt]) return false
  if (fields.isArchived) {
    const v = row[fields.isArchived]
    if (v === true || v === "true" || v === 1 || v === "1") return false
  }
  if (fields.status) {
    const s = String(row[fields.status] ?? "")
    if (/archived|deleted|inactive/i.test(s)) return false
  }
  return true
}

export function buildStaffHubAssets(
  rows: Record<string, unknown>[],
  fields: InternalStaffFieldMap
): StaffHubAsset[] {
  return rows
    .filter((row) => isActiveRow(row, fields))
    .map((row) => {
      const title = formatDisplayValue(rowValue(row, fields.title)) || "Untitled"
      const type = fields.type
        ? formatDisplayValue(rowValue(row, fields.type))
        : null
      const categoryRaw = fields.category
        ? formatDisplayValue(rowValue(row, fields.category))
        : null
      const categoryId = resolveCategory(type, categoryRaw, title)
      const categoryLabel =
        HUB_CATEGORIES.find((c) => c.id === categoryId)?.label ?? "Resources"
      const linkRaw = fields.link ? String(rowValue(row, fields.link) ?? "").trim() : ""
      const link = linkRaw ? parseDriveLink(linkRaw) : null
      const thumbField = fields.thumbnail
        ? String(rowValue(row, fields.thumbnail) ?? "").trim()
        : ""
      const previewUrl = thumbField || link?.thumbnailUrl || null
      const updatedAt = parseDate(rowValue(row, fields.updatedAt))
      const owner = fields.owner
        ? formatDisplayValue(rowValue(row, fields.owner))
        : null
      const description = fields.description
        ? formatDisplayValue(rowValue(row, fields.description))
        : null

      return {
        id: String(row.id ?? ""),
        title,
        description,
        type,
        category: categoryId,
        categoryLabel,
        tags: parseTags(rowValue(row, fields.tags)),
        link,
        updatedAt,
        updatedLabel: updatedAt
          ? formatDistanceToNow(updatedAt, { addSuffix: true })
          : null,
        owner,
        ownerInitials: ownerInitials(owner),
        previewUrl,
      }
    })
    .filter((a) => a.id && a.title)
}

type QuickAccessDef = (typeof QUICK_ACCESS_DEFS)[number]

function findQuickAccessMatch(assets: StaffHubAsset[], def: QuickAccessDef): StaffHubAsset | undefined {
  const folderId =
    "fallbackUrl" in def && def.fallbackUrl
      ? parseDriveLink(def.fallbackUrl)?.fileId
      : null
  return assets.find(
    (a) =>
      def.patterns.some((p) => p.test(a.title)) ||
      (folderId != null && a.link?.fileId === folderId)
  )
}

function buildFeaturedQuickAccessAsset(def: QuickAccessDef): StaffHubAsset | null {
  if (!("fallbackUrl" in def) || !def.fallbackUrl) return null
  const link = parseDriveLink(def.fallbackUrl)
  if (!link) return null
  const category = ("category" in def && def.category) || "other"
  const categoryLabel =
    HUB_CATEGORIES.find((c) => c.id === category)?.label ?? "Quick access"
  return {
    id: `featured-${def.id}`,
    title: def.label,
    description: ("description" in def && def.description) || null,
    type: "Google Drive folder",
    category,
    categoryLabel,
    tags: ["gallery", "photography"],
    link,
    updatedAt: null,
    updatedLabel: null,
    owner: null,
    ownerInitials: "PM",
    previewUrl: null,
  }
}

export function buildGeneralGalleryAsset(): StaffHubAsset {
  const def = QUICK_ACCESS_DEFS[0]
  return (
    buildFeaturedQuickAccessAsset(def) ?? {
      id: "featured-general-gallery",
      title: GENERAL_GALLERY_FOLDER.title,
      description: GENERAL_GALLERY_FOLDER.description,
      type: "Google Drive folder",
      category: "graphics",
      categoryLabel: "Graphics & Media",
      tags: ["gallery"],
      link: parseDriveLink(GENERAL_GALLERY_FOLDER.url),
      updatedAt: null,
      updatedLabel: null,
      owner: null,
      ownerInitials: "PM",
      previewUrl: null,
    }
  )
}

export function resolveQuickAccessAssets(assets: StaffHubAsset[]): StaffHubAsset[] {
  const result: StaffHubAsset[] = []
  for (const def of QUICK_ACCESS_DEFS) {
    const hit = findQuickAccessMatch(assets, def)
    if (hit) result.push(hit)
    else {
      const featured = buildFeaturedQuickAccessAsset(def)
      if (featured) result.push(featured)
      else {
        result.push({
          id: `placeholder-${def.id}`,
          title: def.label,
          description: null,
          type: null,
          category: "other",
          categoryLabel: "Quick access",
          tags: [],
          link: null,
          updatedAt: null,
          updatedLabel: null,
          owner: null,
          ownerInitials: "?",
          previewUrl: null,
        })
      }
    }
  }
  return result
}

export function getRecentUploads(assets: StaffHubAsset[], limit = 8): StaffHubAsset[] {
  return [...assets]
    .sort((a, b) => {
      const ta = a.updatedAt?.getTime() ?? 0
      const tb = b.updatedAt?.getTime() ?? 0
      return tb - ta
    })
    .slice(0, limit)
}

export function countByCategory(assets: StaffHubAsset[]): Record<HubCategoryId, number> {
  const counts: Record<HubCategoryId, number> = {
    brand: 0,
    presentations: 0,
    graphics: 0,
    templates: 0,
    documents: 0,
    other: 0,
  }
  for (const a of assets) {
    counts[a.category] = (counts[a.category] ?? 0) + 1
  }
  return counts
}

export function collectFilterOptions(assets: StaffHubAsset[]): {
  types: string[]
  tags: string[]
} {
  const types = new Set<string>()
  const tags = new Set<string>()
  for (const a of assets) {
    if (a.type) types.add(a.type)
    for (const t of a.tags) tags.add(t)
  }
  return {
    types: [...types].sort((a, b) => a.localeCompare(b)),
    tags: [...tags].sort((a, b) => a.localeCompare(b)),
  }
}

export function filterStaffHubAssets(
  assets: StaffHubAsset[],
  filters: StaffHubFilters
): StaffHubAsset[] {
  const q = filters.search.trim().toLowerCase()
  return assets.filter((a) => {
    if (filters.category !== "all" && a.category !== filters.category) return false
    if (filters.type !== "all" && a.type !== filters.type) return false
    if (filters.tag !== "all" && !a.tags.includes(filters.tag)) return false
    if (!q) return true
    const hay = [a.title, a.description, a.type, a.categoryLabel, ...a.tags]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
    return hay.includes(q)
  })
}
