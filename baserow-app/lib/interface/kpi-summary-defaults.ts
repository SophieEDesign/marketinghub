/**
 * Default mock KPI cards for KPI Summary block.
 *
 * TODO: Connect KPI metrics to Supabase/data tables.
 * TODO: Add permissions.
 */

export type KpiSummaryAccent = "purple" | "blue" | "red"

export type KpiSummaryTrendDirection = "up" | "down" | "neutral"

export interface KpiSummaryCardConfig {
  id: string
  label: string
  value: string
  trend: string
  trend_direction: KpiSummaryTrendDirection
  icon: string
  accent: KpiSummaryAccent
}

export const DEFAULT_KPI_SUMMARY_CARDS: KpiSummaryCardConfig[] = [
  {
    id: "active-campaigns",
    label: "Active Campaigns",
    value: "12",
    trend: "↑ 20% vs last 7 days",
    trend_direction: "up",
    icon: "rocket",
    accent: "purple",
  },
  {
    id: "content-scheduled",
    label: "Content Scheduled",
    value: "48",
    trend: "↑ 16% vs last 7 days",
    trend_direction: "up",
    icon: "calendar",
    accent: "blue",
  },
  {
    id: "engagement",
    label: "Engagement",
    value: "8.3K",
    trend: "↑ 12% vs last 7 days",
    trend_direction: "up",
    icon: "barchart",
    accent: "purple",
  },
  {
    id: "events-month",
    label: "Events This Month",
    value: "5",
    trend: "↓ 10% vs last month",
    trend_direction: "down",
    icon: "calendardays",
    accent: "red",
  },
]
