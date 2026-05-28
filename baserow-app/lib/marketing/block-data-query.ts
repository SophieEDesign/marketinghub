import { applyFiltersToQuery } from "@/lib/interface/filters"
import type { BlockConfig } from "@/lib/interface/types"

type QueryLike = {
  order: (column: string, options?: { ascending?: boolean }) => QueryLike
}

type FieldLike = { id?: string; name: string; type?: string; options?: unknown }

export function applyMarketingBlockDataQuery(
  query: any,
  config: BlockConfig | undefined,
  tableFields: FieldLike[],
  fallbackSortField = "created_at"
): QueryLike {
  const safeConfig = config || {}
  const filterTree = (safeConfig as { filter_tree?: unknown }).filter_tree
  const flatFilters = Array.isArray(safeConfig.filters) ? safeConfig.filters : []
  const activeFilters = filterTree ?? flatFilters

  let nextQuery = applyFiltersToQuery(query, activeFilters as any, tableFields as any) as QueryLike

  const sorts = Array.isArray(safeConfig.sorts) ? safeConfig.sorts : []
  let sortApplied = false

  for (const sort of sorts) {
    const field = typeof sort?.field === "string" ? sort.field.trim() : ""
    if (!field) continue
    nextQuery = nextQuery.order(field, { ascending: sort.direction !== "desc" })
    sortApplied = true
  }

  if (!sortApplied) {
    nextQuery = nextQuery.order(fallbackSortField, { ascending: true })
  }

  return nextQuery
}
