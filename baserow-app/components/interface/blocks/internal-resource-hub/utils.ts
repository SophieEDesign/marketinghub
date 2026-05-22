import type { CategoryFilter, MockResource } from "./types"
import { HUB_CATEGORY_OPTIONS } from "./types"

export function countByCategory(
  resources: MockResource[]
): Record<CategoryFilter, number> {
  const counts: Record<string, number> = { all: resources.length }
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
  searchQuery: string
): MockResource[] {
  const q = searchQuery.trim().toLowerCase()
  return resources.filter((r) => {
    if (category !== "all" && r.category !== category) return false
    if (!q) return true
    const haystack = [
      r.title,
      r.category,
      r.fileType,
      r.description ?? "",
      ...(r.tags ?? []),
    ]
      .join(" ")
      .toLowerCase()
    return haystack.includes(q)
  })
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

export function getVariants(
  resources: MockResource[],
  resource: MockResource
): MockResource[] {
  if (resource.variantGroup) {
    return resources.filter(
      (r) => r.variantGroup === resource.variantGroup
    )
  }
  return resources
    .filter((r) => r.id !== resource.id && r.category === resource.category)
    .slice(0, 4)
}

export function parseDefaultCategory(value: string | undefined): CategoryFilter {
  const valid: CategoryFilter[] = [
    "all",
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
