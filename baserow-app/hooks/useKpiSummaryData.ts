"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { ComparisonResult } from "@/lib/dashboard/aggregations"
import type { AggregateRequest } from "@/lib/dashboard/useAggregateData"
import {
  isMarketingMockEnabled,
  marketingDemoState,
} from "@/lib/marketing/block-config-resolver"
import {
  DEFAULT_KPI_SUMMARY_CARDS,
  type KpiSummaryCardConfig,
  type KpiSummaryTrendDirection,
} from "@/lib/interface/kpi-summary-defaults"
import {
  displayValueFromAggregateResult,
  formatKpiSummaryTrend,
  formatKpiSummaryValue,
  resolveKpiSummaryCards,
  type FieldLike,
} from "@/lib/marketing/kpi-summary"
import type { MarketingTableRow } from "@/lib/marketing/marketing-tables"
import type { BlockConfig } from "@/lib/interface/types"

/** Backfill data-source fields for cards saved before live KPI wiring. */
export function enrichKpiSummaryCards(cards: KpiSummaryCardConfig[]): KpiSummaryCardConfig[] {
  const defaultsById = new Map(DEFAULT_KPI_SUMMARY_CARDS.map((c) => [c.id, c]))
  return cards.map((card) => {
    if (card.table_id?.trim() || card.table_source) return card
    const def = defaultsById.get(card.id)
    if (!def) return card
    return {
      ...def,
      ...card,
      table_source: def.table_source,
      kpi_aggregate: card.kpi_aggregate ?? def.kpi_aggregate,
      comparison_preset: card.comparison_preset ?? def.comparison_preset,
      number_format: card.number_format ?? def.number_format,
    }
  })
}

export interface KpiSummaryDisplayCard {
  id: string
  label: string
  value: string
  trend: string
  trend_direction: KpiSummaryTrendDirection
  icon: string
  accent: KpiSummaryCardConfig["accent"]
}

export interface UseKpiSummaryDataResult {
  loading: boolean
  error: string | null
  fromLiveData: boolean
  showDemoBanner: boolean
  bannerMessage: string
  cards: KpiSummaryDisplayCard[]
}

async function batchAggregateFetcher(requests: AggregateRequest[]): Promise<unknown[]> {
  if (requests.length === 0) return []
  const response = await fetch("/api/dashboard/aggregate-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Failed to aggregate data" }))
    throw new Error(err.error || "Failed to aggregate data")
  }
  const data = await response.json()
  return data.results || []
}

function staticCardDisplay(card: KpiSummaryCardConfig): KpiSummaryDisplayCard {
  return {
    id: card.id,
    label: card.label,
    value: card.value ?? "—",
    trend: card.trend ?? "",
    trend_direction: card.trend_direction ?? "neutral",
    icon: card.icon,
    accent: card.accent,
  }
}

export function useKpiSummaryData(options?: {
  config?: BlockConfig
}): UseKpiSummaryDataResult {
  const config = options?.config
  const forceMock = isMarketingMockEnabled(config, "kpi_summary_use_mock")
  const sourceCards = enrichKpiSummaryCards(
    (config?.kpi_summary_cards?.length
      ? config.kpi_summary_cards
      : DEFAULT_KPI_SUMMARY_CARDS) as KpiSummaryCardConfig[]
  )

  const [loading, setLoading] = useState(!forceMock)
  const [error, setError] = useState<string | null>(null)
  const [fromLiveData, setFromLiveData] = useState(false)
  const [hasResolvableTable, setHasResolvableTable] = useState(false)
  const [cards, setCards] = useState<KpiSummaryDisplayCard[]>(() =>
    sourceCards.map(staticCardDisplay)
  )

  const cardsKey = useMemo(() => JSON.stringify(sourceCards), [sourceCards])

  useEffect(() => {
    if (forceMock) {
      setLoading(false)
      setError(null)
      setFromLiveData(false)
      setHasResolvableTable(false)
      setCards(sourceCards.map(staticCardDisplay))
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const supabase = createClient()
        const { data: tables, error: tablesErr } = await supabase
          .from("tables")
          .select("id, name, supabase_table")

        if (tablesErr || !tables?.length) {
          throw new Error(tablesErr?.message || "Could not load tables")
        }

        const registry = tables as MarketingTableRow[]
        const resolved = resolveKpiSummaryCards(registry, sourceCards, {})
        const tableIds = [
          ...new Set(resolved.map((r) => r.tableId).filter(Boolean)),
        ] as string[]

        setHasResolvableTable(tableIds.length > 0)

        if (tableIds.length === 0) {
          throw new Error("No source tables found — configure tables on KPI cards in block settings.")
        }

        const { data: fieldRows, error: fieldsErr } = await supabase
          .from("table_fields")
          .select("id, table_id, name, type")
          .in("table_id", tableIds)

        if (fieldsErr) throw new Error(fieldsErr.message)

        const fieldsByTableId: Record<string, FieldLike[]> = {}
        for (const row of fieldRows || []) {
          const tid = row.table_id as string
          if (!fieldsByTableId[tid]) fieldsByTableId[tid] = []
          fieldsByTableId[tid].push({
            id: row.id as string,
            name: row.name as string,
            type: row.type as string | undefined,
          })
        }

        const withRequests = resolveKpiSummaryCards(registry, sourceCards, fieldsByTableId)
        const requestEntries = withRequests
          .map((entry, index) => ({ entry, index }))
          .filter((x) => x.entry.request)

        const requests = requestEntries.map((x) => x.entry.request!)
        const results =
          requests.length > 0 ? await batchAggregateFetcher(requests) : []

        const displayCards: KpiSummaryDisplayCard[] = sourceCards.map((card, cardIndex) => {
          const resolvedEntry = withRequests[cardIndex]
          if (!resolvedEntry?.request) {
            return {
              ...staticCardDisplay(card),
              value: "—",
              trend: resolvedEntry?.tableId ? "Configure metric field" : "No table",
              trend_direction: "neutral",
            }
          }

          const reqIndex = requestEntries.findIndex((x) => x.index === cardIndex)
          const raw = reqIndex >= 0 ? (results[reqIndex] as Record<string, unknown>) : null
          if (raw && typeof raw.error === "string") {
            return {
              ...staticCardDisplay(card),
              value: "—",
              trend: raw.error,
              trend_direction: "neutral",
            }
          }

          const hasComparison = Boolean(resolvedEntry.request?.comparison)
          const numeric = displayValueFromAggregateResult(
            raw as { value?: number; current?: number },
            hasComparison
          )
          const formattedValue = formatKpiSummaryValue(
            numeric,
            card.number_format,
            card.kpi_aggregate || "count"
          )

          let trend = ""
          let trend_direction: KpiSummaryTrendDirection = "neutral"
          if (hasComparison && raw) {
            const trendInfo = formatKpiSummaryTrend(
              raw as ComparisonResult,
              resolvedEntry.comparisonPreset
            )
            trend = trendInfo.trend
            trend_direction = trendInfo.trend_direction
          }

          return {
            id: card.id,
            label: card.label,
            value: formattedValue,
            trend,
            trend_direction,
            icon: card.icon,
            accent: card.accent,
          }
        })

        if (cancelled) return
        setCards(displayCards)
        setFromLiveData(true)
        setError(null)
      } catch (e) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : "Failed to load KPI data"
          setError(message)
          setFromLiveData(false)
          setCards(sourceCards.map(staticCardDisplay))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [forceMock, cardsKey])

  const demo = marketingDemoState({
    forceMock,
    fromLiveData,
    hasTable: hasResolvableTable,
    error,
  })

  return {
    loading: forceMock ? false : loading,
    error: forceMock ? null : error,
    fromLiveData: demo.useLiveData,
    showDemoBanner: demo.showDemoBanner,
    bannerMessage: demo.bannerMessage,
    cards: forceMock ? sourceCards.map(staticCardDisplay) : cards,
  }
}
