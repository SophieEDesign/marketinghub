import { applyFiltersToQuery } from "@/lib/interface/filters"
import type { BlockConfig } from "@/lib/interface/types"

type OrderableQuery = {
  order: (column: string, options?: { ascending?: boolean }) => OrderableQuery
}

type FieldLike = { id?: string; name: string; type?: string; options?: unknown }

export function applyMarketingBlockDataQuery<T extends OrderableQuery>(
  query: T,
  config: BlockConfig | undefined,
  tableFields: FieldLike[],
  fallbackSortField = "created_at"
): T {
  const safeConfig = config || {}
  const filterTree = (safeConfig as { filter_tree?: unknown }).filter_tree
  const flatFilters = Array.isArray(safeConfig.filters) ? safeConfig.filters : []
  const activeFilters = filterTree ?? flatFilters

  let nextQuery = applyFiltersToQuery(query, activeFilters as any, tableFields as any) as T

  const sorts = Array.isArray(safeConfig.sorts) ? safeConfig.sorts : []
  let sortApplied = false

  for (const sort of sorts) {
    const field = typeof sort?.field === "string" ? sort.field.trim() : ""
    if (!field) continue
    nextQuery = nextQuery.order(field, { ascending: sort.direction !== "desc" }) as T
    sortApplied = true
  }

  if (!sortApplied) {
    nextQuery = nextQuery.order(fallbackSortField, { ascending: true }) as T
  }

  return nextQuery
}
