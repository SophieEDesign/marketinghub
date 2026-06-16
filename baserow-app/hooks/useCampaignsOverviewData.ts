"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { fetchProfileLabelById } from "@/lib/users/profile-labels"
import { formatDisplayValue } from "@/lib/marketing/field-utils"
import type { BlockConfig } from "@/lib/interface/types"
import {
  isMarketingMockEnabled,
  marketingDemoState,
  MARKETING_DEMO_BANNER_DEFAULT,
  resolveMarketingTable,
} from "@/lib/marketing/block-config-resolver"
import { applyMarketingBlockDataQuery } from "@/lib/marketing/block-data-query"
import {
  campaignsOverviewMaxItems,
  campaignsOverviewOverridesFromConfig,
  resolveCampaignOverviewFields,
} from "@/lib/marketing/campaigns-overview-config"
import { findCampaignsTable, type MarketingTableRow } from "@/lib/marketing/marketing-tables"
import { applySoftDeleteFilter, fetchPhysicalColumns } from "@/lib/supabase/physical-columns"
import {
  CAMPAIGNS_OVERVIEW_MOCK,
  parseProgress,
  toCount,
  type CampaignOverviewItem,
} from "@/lib/marketing/campaigns-overview"

export interface UseCampaignsOverviewDataResult {
  loading: boolean
  hasTable: boolean
  fromLiveData: boolean
  error: string | null
  items: CampaignOverviewItem[]
  demoMessage: string
  showDemoBanner: boolean
  showEmptyState: boolean
  reload: () => void
}

export function useCampaignsOverviewData(config?: BlockConfig): UseCampaignsOverviewDataResult {
  const forceMock = isMarketingMockEnabled(
    config,
    "campaigns_overview_use_mock",
    "campaigns_use_mock"
  )
  const [loading, setLoading] = useState(!forceMock)
  const [hasTable, setHasTable] = useState(false)
  const [fromLiveData, setFromLiveData] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<CampaignOverviewItem[]>([])
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => setReloadToken((v) => v + 1), [])

  useEffect(() => {
    if (forceMock) {
      setLoading(false)
      setHasTable(false)
      setFromLiveData(false)
      setError(null)
      setItems(CAMPAIGNS_OVERVIEW_MOCK)
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

        const campaignsTable = resolveMarketingTable(
          tables as MarketingTableRow[],
          config?.table_id,
          findCampaignsTable
        )

        if (!campaignsTable?.id || !campaignsTable?.supabase_table) {
          setHasTable(false)
          throw new Error("Campaigns table not found - select a Campaigns table in block settings.")
        }

        setHasTable(true)

        const { data: fields, error: fieldsErr } = await supabase
          .from("table_fields")
          .select("id, name, type, options")
          .eq("table_id", campaignsTable.id)

        if (fieldsErr) throw new Error(fieldsErr.message)
        const tableFields = (fields || []) as Array<{
          id: string
          name: string
          type?: string
          options?: unknown
        }>

        const fieldMap = resolveCampaignOverviewFields(
          tableFields,
          campaignsOverviewOverridesFromConfig(config)
        )

        const physicalColumns = await fetchPhysicalColumns(supabase, campaignsTable.supabase_table)
        let query = supabase.from(campaignsTable.supabase_table).select("*")
        query = applySoftDeleteFilter(query, physicalColumns)
        query = applyMarketingBlockDataQuery(query, config, tableFields)
        query = query.limit(campaignsOverviewMaxItems(config))

        const { data: rows, error: rowsErr } = await query
        if (rowsErr) throw new Error(rowsErr.message)

        const profileLabelById = await fetchProfileLabelById(supabase)

        const mapped: CampaignOverviewItem[] = (rows || []).map((row: Record<string, unknown>) => {
          const id = String(row.id)
          const openTasksCount = fieldMap.linkedTasks ? toCount(row[fieldMap.linkedTasks]) : 0
          const linkedContentCount = fieldMap.linkedContent
            ? toCount(row[fieldMap.linkedContent])
            : 0
          const progress = fieldMap.progress ? parseProgress(row[fieldMap.progress]) : null
          const status = fieldMap.status ? String(row[fieldMap.status] ?? "") : ""
          const priority = fieldMap.priority ? String(row[fieldMap.priority] ?? "") : ""
          const needsAttention =
            openTasksCount > 0 ||
            status.toLowerCase() === "on hold" ||
            priority.toLowerCase() === "urgent" ||
            (progress != null && progress < 35)

          return {
            id,
            title: String(row[fieldMap.title] ?? "Untitled campaign"),
            thumbnailUrl: fieldMap.image
              ? String(row[fieldMap.image] ?? "") || undefined
              : undefined,
            type: fieldMap.type ? String(row[fieldMap.type] ?? "") : "",
            division: fieldMap.division ? String(row[fieldMap.division] ?? "") : "",
            status,
            priority,
            stage: fieldMap.stage ? String(row[fieldMap.stage] ?? "") : "",
            startDate: fieldMap.startDate ? String(row[fieldMap.startDate] ?? "") : "",
            endDate: fieldMap.endDate ? String(row[fieldMap.endDate] ?? "") : "",
            owner: fieldMap.owner
              ? (() => {
                  const raw = row[fieldMap.owner!]
                  const ownerId =
                    typeof raw === "string"
                      ? raw
                      : raw && typeof raw === "object" && "id" in (raw as object)
                        ? String((raw as { id: string }).id)
                        : null
                  if (ownerId && profileLabelById.has(ownerId)) {
                    return profileLabelById.get(ownerId) ?? ""
                  }
                  return formatDisplayValue(raw) ?? ""
                })()
              : "",
            progress,
            openTasksCount,
            linkedContentCount,
            needsAttention,
            recordTableId: campaignsTable.id,
            recordSupabaseTable: campaignsTable.supabase_table,
            notesSearchText: String(row.notes ?? row.objective ?? ""),
            linkedEventsText: fieldMap.linkedEvents
              ? String(row[fieldMap.linkedEvents] ?? "")
              : "",
          }
        })

        if (cancelled) return
        setItems(mapped)
        setFromLiveData(true)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Failed to load campaigns")
        setItems([])
        setFromLiveData(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [config, forceMock, reloadToken])

  const demoState = marketingDemoState({
    forceMock,
    fromLiveData,
    hasTable,
    error,
  })

  return {
    loading,
    hasTable,
    fromLiveData,
    error,
    items: demoState.useDemoData ? CAMPAIGNS_OVERVIEW_MOCK : items,
    demoMessage: demoState.showDemoBanner ? demoState.bannerMessage || MARKETING_DEMO_BANNER_DEFAULT : "",
    showDemoBanner: demoState.showDemoBanner,
    showEmptyState: demoState.showEmptyState && !demoState.useDemoData,
    reload,
  }
}
