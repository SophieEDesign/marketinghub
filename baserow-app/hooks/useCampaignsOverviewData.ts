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
  fieldNameFromConfig,
} from "@/lib/marketing/block-config-resolver"
import { findCampaignsTable, type MarketingTableRow } from "@/lib/marketing/marketing-tables"
import {
  CAMPAIGNS_OVERVIEW_MOCK,
  parseProgress,
  toCount,
  type CampaignOverviewItem,
} from "@/lib/marketing/campaigns-overview"

function pickFieldName(
  fields: Array<{ id: string; name: string }>,
  exact: string[],
  includes: string[]
): string | null {
  for (const name of exact) {
    const hit = fields.find((f) => f.name.toLowerCase() === name)
    if (hit) return hit.name
  }
  for (const needle of includes) {
    const hit = fields.find((f) => f.name.toLowerCase().includes(needle))
    if (hit) return hit.name
  }
  return null
}

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
  const forceMock = isMarketingMockEnabled(config, "campaigns_use_mock")
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
          .select("id, name")
          .eq("table_id", campaignsTable.id)

        if (fieldsErr) throw new Error(fieldsErr.message)
        const tableFields = (fields || []) as Array<{ id: string; name: string }>

        const titleField =
          fieldNameFromConfig(tableFields, config?.title_field_id, config?.title_field) ||
          pickFieldName(tableFields, ["campaign_name", "name", "title"], ["campaign", "name"]) ||
          "name"
        const typeField =
          fieldNameFromConfig(tableFields, config?.type_field_id, config?.type_field) ||
          pickFieldName(tableFields, ["campaign_type", "type"], ["type"])
        const divisionField =
          fieldNameFromConfig(tableFields, config?.division_field_id, config?.division_field) ||
          pickFieldName(tableFields, ["division"], ["division"])
        const statusField =
          fieldNameFromConfig(tableFields, config?.status_field_id, config?.status_field) ||
          pickFieldName(tableFields, ["status", "campaign_status"], ["status", "state"])
        const priorityField =
          fieldNameFromConfig(tableFields, config?.priority_field_id, config?.priority_field) ||
          pickFieldName(tableFields, ["priority"], ["priority"])
        const stageField =
          fieldNameFromConfig(tableFields, config?.stage_field_id, config?.stage_field) ||
          pickFieldName(tableFields, ["campaign_stage", "stage"], ["stage"])
        const startDateField =
          fieldNameFromConfig(tableFields, config?.start_date_field_id, config?.start_date_field) ||
          pickFieldName(tableFields, ["start_date"], ["start"])
        const endDateField =
          fieldNameFromConfig(tableFields, config?.end_date_field_id, config?.end_date_field) ||
          pickFieldName(tableFields, ["end_date"], ["end"])
        const ownerField =
          fieldNameFromConfig(tableFields, config?.owner_field_id, config?.owner_field) ||
          pickFieldName(tableFields, ["owner"], ["owner"])
        const progressField =
          fieldNameFromConfig(tableFields, config?.progress_field_id, config?.progress_field) ||
          pickFieldName(tableFields, ["progress"], ["progress"])
        const imageField =
          fieldNameFromConfig(tableFields, config?.image_field_id, config?.image_field) ||
          pickFieldName(tableFields, ["image", "thumbnail"], ["image", "thumb"])
        const linkedContentField =
          fieldNameFromConfig(
            tableFields,
            config?.linked_content_field_id,
            config?.linked_content_field
          ) || pickFieldName(tableFields, ["linked_content"], ["content"])
        const linkedTasksField =
          fieldNameFromConfig(tableFields, config?.linked_tasks_field_id, config?.linked_tasks_field) ||
          pickFieldName(tableFields, ["linked_tasks", "things_to_do"], ["task"])
        const linkedEventsField =
          fieldNameFromConfig(tableFields, config?.linked_events_field_id, config?.linked_events_field) ||
          pickFieldName(tableFields, ["linked_events"], ["event"])

        const { data: rows, error: rowsErr } = await supabase
          .from(campaignsTable.supabase_table)
          .select("*")
          .limit(config?.campaigns_max_items ?? 200)
        if (rowsErr) throw new Error(rowsErr.message)

        const profileLabelById = await fetchProfileLabelById(supabase)

        const mapped: CampaignOverviewItem[] = (rows || []).map((row: Record<string, unknown>) => {
          const id = String(row.id)
          const openTasksCount = linkedTasksField ? toCount(row[linkedTasksField]) : 0
          const linkedContentCount = linkedContentField ? toCount(row[linkedContentField]) : 0
          const progress = progressField ? parseProgress(row[progressField]) : null
          const status = statusField ? String(row[statusField] ?? "") : ""
          const priority = priorityField ? String(row[priorityField] ?? "") : ""
          const needsAttention =
            openTasksCount > 0 ||
            status.toLowerCase() === "on hold" ||
            priority.toLowerCase() === "urgent" ||
            (progress != null && progress < 35)

          return {
            id,
            title: String(row[titleField] ?? "Untitled campaign"),
            thumbnailUrl: imageField ? String(row[imageField] ?? "") || undefined : undefined,
            type: typeField ? String(row[typeField] ?? "") : "",
            division: divisionField ? String(row[divisionField] ?? "") : "",
            status,
            priority,
            stage: stageField ? String(row[stageField] ?? "") : "",
            startDate: startDateField ? String(row[startDateField] ?? "") : "",
            endDate: endDateField ? String(row[endDateField] ?? "") : "",
            owner: ownerField
              ? (() => {
                  const raw = row[ownerField]
                  const id =
                    typeof raw === "string"
                      ? raw
                      : raw && typeof raw === "object" && "id" in (raw as object)
                        ? String((raw as { id: string }).id)
                        : null
                  if (id && profileLabelById.has(id)) {
                    return profileLabelById.get(id) ?? ""
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
            linkedEventsText: linkedEventsField ? String(row[linkedEventsField] ?? "") : "",
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
