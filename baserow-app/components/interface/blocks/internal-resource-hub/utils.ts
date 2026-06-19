import type {
  CategoryFilter,
  MockResource,
  ResourceAttachmentVariant,
} from "./types"
import { HUB_CATEGORY_OPTIONS } from "./types"

export const ATTACHMENT_VARIANT_SEP = "::att::"

export function attachmentVariantKey(recordId: string, index: number): string {
  return `${recordId}${ATTACHMENT_VARIANT_SEP}${index}`
}

export function parseAttachmentVariantKey(
  id: string
): { recordId: string; index: number } | null {
  const sepIndex = id.indexOf(ATTACHMENT_VARIANT_SEP)
  if (sepIndex === -1) return null
  const recordId = id.slice(0, sepIndex)
  const index = Number.parseInt(id.slice(sepIndex + ATTACHMENT_VARIANT_SEP.length), 10)
  if (!recordId || Number.isNaN(index)) return null
  return { recordId, index }
}

export function variantResourceFromAttachment(
  base: MockResource,
  attachment: ResourceAttachmentVariant
): MockResource {
  return {
    ...base,
    id: attachment.key,
    url: attachment.url,
    thumbnailUrl: attachment.thumbnailUrl ?? attachment.url,
    fileType: attachment.fileType,
  }
}

export function countByCategory(
  resources: MockResource[],
  favouriteIds?: Set<string>
): Record<CategoryFilter, number> {
  const counts: Record<string, number> = {
    all: resources.length,
    favourites: favouriteIds
      ? resources.filter((r) => favouriteIds.has(r.id)).length
      : 0,
  }
  for (const r of resources) {
    counts[r.category] = (counts[r.category] ?? 0) + 1
  }
  for (const opt of HUB_CATEGORY_OPTIONS) {
    if (counts[opt.id] === undefined) counts[opt.id] = 0
  }
  return counts as Record<CategoryFilter, number>
}

export function filterResources(
  resources: MockResource[],
  category: CategoryFilter,
  searchQuery: string,
  favouriteIds?: Set<string>
): MockResource[] {
  const q = searchQuery.trim().toLowerCase()
  return resources.filter((r) => {
    if (category === "favourites") {
      if (!favouriteIds?.has(r.id)) return false
    } else if (category !== "all" && r.category !== category) {
      return false
    }
    if (!q) return true
    const haystack = [
      r.title,
      r.category,
      r.fileType,
      r.description ?? "",
      r.source ?? "",
      ...(r.tags ?? []),
    ]
      .join(" ")
      .toLowerCase()
    return haystack.includes(q)
  })
}

export type ResourceSortMode = "recent" | "az"

export function sortResources(
  resources: MockResource[],
  mode: ResourceSortMode
): MockResource[] {
  const copy = [...resources]
  if (mode === "az") {
    return copy.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }))
  }
  return copy.sort((a, b) => {
    const aKey = a.updatedAt ?? a.addedAt ?? ""
    const bKey = b.updatedAt ?? b.addedAt ?? ""
    return bKey.localeCompare(aKey)
  })
}

export function getFeatured(resources: MockResource[], limit = 4): MockResource[] {
  const featured = resources.filter((r) => r.isFeatured)
  if (featured.length >= limit) return featured.slice(0, limit)
  const rest = resources.filter((r) => !r.isFeatured)
  return [...featured, ...rest].slice(0, limit)
}

export function hasActiveFilters(
  category: CategoryFilter,
  searchQuery: string
): boolean {
  return category !== "all" || searchQuery.trim().length > 0
}

export function getRecent(resources: MockResource[], limit = 3): MockResource[] {
  return [...resources]
    .sort((a, b) => {
      const order = ["2 days ago", "4 days ago", "5 days ago", "6 days ago", "1 week ago"]
      const ai = order.indexOf(a.addedAt ?? "")
      const bi = order.indexOf(b.addedAt ?? "")
      if (ai === -1 && bi === -1) return 0
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
    .slice(0, limit)
}

/** Related files for thumbnail strip: explicit variant group or multiple attachments on one record. */
export function getVariants(
  resources: MockResource[],
  resource: MockResource
): MockResource[] {
  if (resource.variantGroup) {
    const group = resources.filter((r) => r.variantGroup === resource.variantGroup)
    if (group.length > 1) return group
  }
  if (resource.attachmentVariants && resource.attachmentVariants.length > 1) {
    return resource.attachmentVariants.map((attachment) =>
      variantResourceFromAttachment(resource, attachment)
    )
  }
  return []
}

export function resolveDisplayResource(
  resources: MockResource[],
  selected: MockResource | null,
  selectedId: string | null,
  attachmentIndex: number
): MockResource | null {
  if (!selected) return null
  const variants = getVariants(resources, selected)
  if (variants.length <= 1) return selected

  if (selected.variantGroup && selectedId) {
    return variants.find((v) => v.id === selectedId) ?? selected
  }

  return variants[attachmentIndex] ?? variants[0] ?? selected
}

export function parseDefaultCategory(value: string | undefined): CategoryFilter {
  const valid: CategoryFilter[] = [
    "all",
    "favourites",
    "logos",
    "brand-guidelines",
    "images",
    "templates",
    "documents",
    "videos",
    "presentations",
  ]
  if (value && valid.includes(value as CategoryFilter)) {
    return value as CategoryFilter
  }
  return "all"
}

export function isImageType(fileType: MockResource["fileType"]): boolean {
  return fileType === "PNG" || fileType === "JPG" || fileType === "SVG"
}
