/**
 * Campaigns Overview — KPI bucket config and counting.
 */

import type { BlockConfig } from "@/lib/interface/types"
import {
  normalizeText,
  type CampaignOverviewItem,
} from "@/lib/marketing/campaigns-overview"

export interface CampaignsKpiLabels {
  active: string
  planned: string
  completed: string
  contentItems: string
  openTasks: string
}

export interface CampaignsKpiStatusBuckets {
  active: string[]
  planned: string[]
  completed: string[]
}

export interface CampaignsKpiConfig {
  labels: CampaignsKpiLabels
  statusBuckets: CampaignsKpiStatusBuckets
}

export const DEFAULT_CAMPAIGNS_KPI_LABELS: CampaignsKpiLabels = {
  active: "Active campaigns",
  planned: "Planned campaigns",
  completed: "Completed campaigns",
  contentItems: "Content items",
  openTasks: "Open tasks",
}

export const DEFAULT_CAMPAIGNS_KPI_STATUS_BUCKETS: CampaignsKpiStatusBuckets = {
  active: ["active", "live", "in progress", "ongoing"],
  planned: ["planning", "planned", "draft", "upcoming"],
  completed: ["completed", "complete", "done", "closed"],
}

function parseStatusList(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    const parsed = value
      .map((v) => String(v).trim())
      .filter(Boolean)
    if (parsed.length) return parsed
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
    if (parsed.length) return parsed
  }
  return fallback
}

export function campaignsKpiConfigFromBlock(config?: BlockConfig): CampaignsKpiConfig {
  const c = config || {}
  return {
    labels: {
      active: c.campaigns_kpi_active_label?.trim() || DEFAULT_CAMPAIGNS_KPI_LABELS.active,
      planned: c.campaigns_kpi_planned_label?.trim() || DEFAULT_CAMPAIGNS_KPI_LABELS.planned,
      completed:
        c.campaigns_kpi_completed_label?.trim() || DEFAULT_CAMPAIGNS_KPI_LABELS.completed,
      contentItems:
        c.campaigns_kpi_content_label?.trim() || DEFAULT_CAMPAIGNS_KPI_LABELS.contentItems,
      openTasks: c.campaigns_kpi_tasks_label?.trim() || DEFAULT_CAMPAIGNS_KPI_LABELS.openTasks,
    },
    statusBuckets: {
      active: parseStatusList(
        c.campaigns_kpi_active_statuses,
        DEFAULT_CAMPAIGNS_KPI_STATUS_BUCKETS.active
      ),
      planned: parseStatusList(
        c.campaigns_kpi_planned_statuses,
        DEFAULT_CAMPAIGNS_KPI_STATUS_BUCKETS.planned
      ),
      completed: parseStatusList(
        c.campaigns_kpi_completed_statuses,
        DEFAULT_CAMPAIGNS_KPI_STATUS_BUCKETS.completed
      ),
    },
  }
}

export function statusMatchesBucket(status: unknown, bucket: string[]): boolean {
  const normalized = normalizeText(status)
  if (!normalized) return false
  return bucket.some((entry) => {
    const needle = normalizeText(entry)
    if (!needle) return false
    return normalized === needle || normalized.includes(needle) || needle.includes(normalized)
  })
}

export function computeCampaignKpis(
  items: CampaignOverviewItem[],
  kpiConfig?: CampaignsKpiConfig
): {
  active: number
  planned: number
  completed: number
  contentItems: number
  openTasks: number
  labels: CampaignsKpiLabels
} {
  const config = kpiConfig || campaignsKpiConfigFromBlock()
  const { statusBuckets, labels } = config

  return {
    active: items.filter((i) => statusMatchesBucket(i.status, statusBuckets.active)).length,
    planned: items.filter((i) => statusMatchesBucket(i.status, statusBuckets.planned)).length,
    completed: items.filter((i) => statusMatchesBucket(i.status, statusBuckets.completed)).length,
    contentItems: items.reduce((sum, i) => sum + i.linkedContentCount, 0),
    openTasks: items.reduce((sum, i) => sum + i.openTasksCount, 0),
    labels,
  }
}

export function formatCampaignsKpiStatuses(
  values: string[] | string | undefined,
  fallback: string[] = []
): string {
  if (Array.isArray(values) && values.length) return values.join(", ")
  if (typeof values === "string" && values.trim()) return values
  return fallback.join(", ")
}
