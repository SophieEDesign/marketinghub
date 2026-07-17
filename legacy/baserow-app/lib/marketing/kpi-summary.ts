/**
 * KPI Summary block — table resolution, aggregate requests, and display formatting.
 */

import type { AggregateRequest } from "@/lib/dashboard/useAggregateData"
import type { ComparisonResult } from "@/lib/dashboard/aggregations"
import type { FilterConfig } from "@/lib/interface/filters"
import type {
  KpiSummaryCardConfig,
  KpiSummaryComparisonPreset,
  KpiSummaryTableSource,
  KpiSummaryTrendDirection,
} from "@/lib/interface/kpi-summary-defaults"
import {
  findCampaignsTable,
  findContentTable,
  findMediaTable,
  findSocialPostsTable,
  type MarketingTableRow,
} from "@/lib/marketing/marketing-tables"
import { fieldNameFromConfig } from "@/lib/marketing/block-config-resolver"

export type FieldLike = { id: string; name: string; type?: string }

export interface KpiSummaryResolvedCard {
  card: KpiSummaryCardConfig
  tableId: string | null
  request: AggregateRequest | null
  comparisonPreset: KpiSummaryComparisonPreset | null
}

export function findEventsTable(tables: MarketingTableRow[]): MarketingTableRow | undefined {
  return tables.find((t) => {
    const n = String(t.name).trim().toLowerCase()
    if (n === "events" || n === "event") return true
    return /event/.test(n) && !/content|calendar|attendance|social/.test(n)
  })
}

export function resolveKpiSummaryTableSource(
  registry: MarketingTableRow[],
  source?: KpiSummaryTableSource
): MarketingTableRow | undefined {
  if (!source) return undefined
  switch (source) {
    case "campaigns":
      return findCampaignsTable(registry)
    case "content":
      return findContentTable(registry)
    case "social_posts":
      return findSocialPostsTable(registry)
    case "events":
      return findEventsTable(registry) ?? findContentTable(registry)
    case "media":
      return findMediaTable(registry)
    default:
      return undefined
  }
}

export function resolveKpiSummaryCardTable(
  registry: MarketingTableRow[],
  card: KpiSummaryCardConfig
): MarketingTableRow | undefined {
  const explicitId = card.table_id?.trim()
  if (explicitId) {
    return registry.find((t) => t.id === explicitId)
  }
  return resolveKpiSummaryTableSource(registry, card.table_source)
}

function pickDateFieldName(fields: FieldLike[], card: KpiSummaryCardConfig): string | null {
  const fromConfig = fieldNameFromConfig(
    fields,
    card.comparison_date_field_id,
    card.comparison_date_field
  )
  if (fromConfig) return fromConfig

  const preferred = [
    "publish_date",
    "published_at",
    "scheduled_date",
    "start_date",
    "event_date",
    "date",
    "created_at",
    "updated_at",
  ]
  for (const name of preferred) {
    const hit = fields.find((f) => f.name.toLowerCase() === name)
    if (hit && (hit.type === "date" || hit.type === "datetime" || !hit.type)) return hit.name
  }
  const dateField = fields.find((f) => f.type === "date" || f.type === "datetime")
  return dateField?.name ?? null
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

function toIsoDate(d: Date): string {
  return d.toISOString()
}

export function dateRangesForComparisonPreset(
  preset: KpiSummaryComparisonPreset,
  now = new Date()
): {
  currentStart: string
  currentEnd: string
  previousStart: string
  previousEnd: string
} | null {
  if (preset === "none") return null

  const today = startOfDay(now)

  if (preset === "last_7_days") {
    const currentEnd = endOfDay(now)
    const currentStart = startOfDay(new Date(today))
    currentStart.setDate(currentStart.getDate() - 6)

    const previousEnd = endOfDay(new Date(today))
    previousEnd.setDate(previousEnd.getDate() - 7)
    const previousStart = startOfDay(new Date(previousEnd))
    previousStart.setDate(previousStart.getDate() - 6)

    return {
      currentStart: toIsoDate(currentStart),
      currentEnd: toIsoDate(currentEnd),
      previousStart: toIsoDate(previousStart),
      previousEnd: toIsoDate(previousEnd),
    }
  }

  if (preset === "month_over_month") {
    const currentStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const currentEnd = endOfDay(now)

    const previousStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const previousEnd = endOfDay(new Date(today.getFullYear(), today.getMonth(), 0))

    return {
      currentStart: toIsoDate(startOfDay(currentStart)),
      currentEnd: toIsoDate(currentEnd),
      previousStart: toIsoDate(startOfDay(previousStart)),
      previousEnd: toIsoDate(previousEnd),
    }
  }

  return null
}

export function buildKpiSummaryAggregateRequest(
  card: KpiSummaryCardConfig,
  tableId: string,
  fields: FieldLike[]
): AggregateRequest | null {
  const aggregate = card.kpi_aggregate || "count"
  const fieldName =
    aggregate === "count"
      ? undefined
      : fieldNameFromConfig(fields, card.kpi_field_id, card.kpi_field) || card.kpi_field

  if (aggregate !== "count" && !fieldName) {
    return null
  }

  const preset = card.comparison_preset ?? "none"
  const ranges = dateRangesForComparisonPreset(preset)
  const dateFieldName = ranges ? pickDateFieldName(fields, card) : null

  const comparison =
    ranges && dateFieldName
      ? {
          dateFieldName,
          currentStart: ranges.currentStart,
          currentEnd: ranges.currentEnd,
          previousStart: ranges.previousStart,
          previousEnd: ranges.previousEnd,
        }
      : undefined

  return {
    tableId,
    aggregate,
    fieldName,
    filters: (card.filters || []) as FilterConfig[],
    comparison,
  }
}

export function resolveKpiSummaryCards(
  registry: MarketingTableRow[],
  cards: KpiSummaryCardConfig[],
  fieldsByTableId: Record<string, FieldLike[]>
): KpiSummaryResolvedCard[] {
  return cards.map((card) => {
    const table = resolveKpiSummaryCardTable(registry, card)
    if (!table?.id) {
      return {
        card,
        tableId: null,
        request: null,
        comparisonPreset: card.comparison_preset ?? null,
      }
    }
    const tableFields = fieldsByTableId[table.id] || []
    const request = buildKpiSummaryAggregateRequest(card, table.id, tableFields)
    return {
      card,
      tableId: table.id,
      request,
      comparisonPreset: card.comparison_preset ?? null,
    }
  })
}

export function formatKpiSummaryValue(
  value: number | null | undefined,
  format: KpiSummaryCardConfig["number_format"] = "standard",
  aggregate = "count"
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—"
  if (format === "compact") {
    return new Intl.NumberFormat(undefined, {
      notation: "compact",
      maximumFractionDigits: aggregate === "avg" ? 1 : 0,
    }).format(value)
  }
  if (aggregate === "avg") {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(value)
  }
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)
}

export function formatKpiSummaryTrend(
  comparison: ComparisonResult | null | undefined,
  preset: KpiSummaryComparisonPreset | null
): { trend: string; trend_direction: KpiSummaryTrendDirection } {
  if (!comparison || comparison.changePercent === null) {
    return { trend: "No comparison", trend_direction: "neutral" }
  }

  const pct = comparison.changePercent
  const arrow = comparison.trend === "up" ? "↑" : comparison.trend === "down" ? "↓" : "→"
  const periodLabel =
    preset === "month_over_month"
      ? "vs last month"
      : preset === "last_7_days"
        ? "vs prior 7 days"
        : "vs prior period"

  return {
    trend: `${arrow} ${Math.abs(pct).toFixed(0)}% ${periodLabel}`,
    trend_direction: comparison.trend,
  }
}

export function displayValueFromAggregateResult(
  result: { value?: number | null; current?: number | null } | null | undefined,
  hasComparison: boolean
): number | null {
  if (!result) return null
  if (hasComparison && result.current !== undefined && result.current !== null) {
    return result.current
  }
  return result.value ?? null
}
