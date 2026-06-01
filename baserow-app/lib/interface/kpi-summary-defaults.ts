/**
 * KPI Summary block — card defaults and types.
 */

import type { BlockFilter } from "@/lib/interface/types"

export type KpiSummaryAccent = "purple" | "blue" | "red"

export type KpiSummaryTrendDirection = "up" | "down" | "neutral"

export type KpiSummaryTableSource =
  | "campaigns"
  | "content"
  | "social_posts"
  | "events"
  | "media"

export type KpiSummaryComparisonPreset = "none" | "last_7_days" | "month_over_month"

export interface KpiSummaryCardConfig {
  id: string
  label: string
  icon: string
  accent: KpiSummaryAccent
  /** Static display when demo mode or live data unavailable */
  value?: string
  trend?: string
  trend_direction?: KpiSummaryTrendDirection
  /** Live data source */
  table_id?: string
  table_source?: KpiSummaryTableSource
  kpi_aggregate?: "count" | "sum" | "avg" | "min" | "max"
  kpi_field?: string
  kpi_field_id?: string
  filters?: BlockFilter[]
  comparison_preset?: KpiSummaryComparisonPreset
  comparison_date_field?: string
  comparison_date_field_id?: string
  number_format?: "standard" | "compact"
}

export const DEFAULT_KPI_SUMMARY_CARDS: KpiSummaryCardConfig[] = [
  {
    id: "active-campaigns",
    label: "Active Campaigns",
    value: "—",
    trend: "",
    trend_direction: "neutral",
    icon: "rocket",
    accent: "purple",
    table_source: "campaigns",
    kpi_aggregate: "count",
    comparison_preset: "last_7_days",
    number_format: "standard",
  },
  {
    id: "content-scheduled",
    label: "Content Scheduled",
    value: "—",
    trend: "",
    trend_direction: "neutral",
    icon: "calendar",
    accent: "blue",
    table_source: "content",
    kpi_aggregate: "count",
    comparison_preset: "last_7_days",
    number_format: "standard",
  },
  {
    id: "social-posts",
    label: "Social Posts",
    value: "—",
    trend: "",
    trend_direction: "neutral",
    icon: "barchart",
    accent: "purple",
    table_source: "social_posts",
    kpi_aggregate: "count",
    comparison_preset: "last_7_days",
    number_format: "compact",
  },
  {
    id: "events-month",
    label: "Events This Month",
    value: "—",
    trend: "",
    trend_direction: "neutral",
    icon: "calendardays",
    accent: "red",
    table_source: "events",
    kpi_aggregate: "count",
    comparison_preset: "month_over_month",
    number_format: "standard",
  },
]
