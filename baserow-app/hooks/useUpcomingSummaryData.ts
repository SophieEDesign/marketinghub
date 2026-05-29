"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { fetchProfileLabelById } from "@/lib/users/profile-labels"
import {
  buildThemeMaps,
  resolveContentPlanningFields,
} from "@/lib/marketing/content-planning"
import { buildUpcomingSummaryData, type UpcomingSummaryBuiltData } from "@/lib/marketing/upcoming-summary-data"
import {
  fieldNameFromConfig,
  isMarketingMockEnabled,
  resolveMarketingTable,
  upcomingSummaryOverridesFromConfig,
} from "@/lib/marketing/block-config-resolver"
import {
  findCampaignsTable,
  findContentTable,
  findMediaTable,
  findQuarterlyThemesTable,
  type MarketingTableRow,
} from "@/lib/marketing/marketing-tables"
import type { ContentPlanningTableIds } from "@/lib/marketing/content-planning"
import type { BlockConfig } from "@/lib/interface/types"
import type { FieldOptions } from "@/types/fields"

type FieldRow = { name: string; type?: string; options?: FieldOptions }

function mapFieldRow(row: { name: string; type?: string; options?: unknown }): FieldRow {
  return {
    name: row.name,
    type: row.type,
    options: row.options as FieldOptions | undefined,
  }
}

const EMPTY_DATA: UpcomingSummaryBuiltData = {
  deadlines: [],
  campaigns: [],
  events: [],
  approval: [],
  blockers: [],
  published: [],
}

export interface UseUpcomingSummaryDataResult {
  loading: boolean
  error: string | null
  fromLiveData: boolean
  hasTable: boolean
  tableIds: ContentPlanningTableIds | null
  data: UpcomingSummaryBuiltData
  reload: () => void
}

export function useUpcomingSummaryData(options?: {
  config?: BlockConfig
}): UseUpcomingSummaryDataResult {
  const config = options?.config
  const forceMock = isMarketingMockEnabled(config, "upcoming_summary_use_mock")
  const [loading, setLoading] = useState(!forceMock)
  const [hasTable, setHasTable] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fromLiveData, setFromLiveData] = useState(false)
  const [tableIds, setTableIds] = useState<ContentPlanningTableIds | null>(null)
  const [data, setData] = useState<UpcomingSummaryBuiltData>(EMPTY_DATA)
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    if (forceMock) {
      setLoading(false)
      setFromLiveData(false)
      setHasTable(false)
      setData(EMPTY_DATA)
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
        const content = resolveMarketingTable(
          registry,
          config?.upcoming_summary_content_table_id || config?.table_id,
          findContentTable
        )
        const campaigns = config?.upcoming_summary_campaigns_table_id
          ? registry.find((t) => t.id === config.upcoming_summary_campaigns_table_id)
          : findCampaignsTable(registry)
        const themes = findQuarterlyThemesTable(registry)

        if (!content?.supabase_table) {
          setHasTable(false)
          throw new Error("Content table not found — configure a content source table")
        }
        setHasTable(true)

        const ids: ContentPlanningTableIds = {
          contentTableId: content.id,
          contentSupabaseTable: content.supabase_table,
          campaignsTableId: campaigns?.id ?? content.id,
          campaignsSupabaseTable: campaigns?.supabase_table ?? content.supabase_table,
          themesTableId: themes?.id ?? content.id,
          themesSupabaseTable: themes?.supabase_table ?? content.supabase_table,
        }

        const tableIdList = [content.id, campaigns?.id, themes?.id].filter(Boolean) as string[]

        const { data: fieldRows, error: fieldsErr } = await supabase
          .from("table_fields")
          .select("id, table_id, name, type, options")
          .in("table_id", tableIdList)

        if (fieldsErr) throw new Error(fieldsErr.message)

        const contentFieldRows = (fieldRows?.filter((f) => f.table_id === content.id) || []).map(
          mapFieldRow
        )
        const campaignFieldRows = (fieldRows?.filter((f) => f.table_id === campaigns?.id) || []).map(
          mapFieldRow
        )
        const themeFieldRows = (fieldRows?.filter((f) => f.table_id === themes?.id) || []).map(
          mapFieldRow
        )

        const contentFieldIds = (fieldRows?.filter((f) => f.table_id === content.id) || []).map(
          (f) => ({ id: f.id, name: f.name })
        )

        const fieldMap = resolveContentPlanningFields(
          contentFieldRows,
          campaignFieldRows,
          themeFieldRows,
          upcomingSummaryOverridesFromConfig(config),
          contentFieldIds
        )

        const priorityField =
          fieldNameFromConfig(
            contentFieldIds,
            config?.upcoming_summary_priority_field_id,
            config?.upcoming_summary_priority_field
          ) || contentFieldRows.find((f) => /priority/i.test(f.name))?.name

        const [contentRes, themesRes, campaignsRes] = await Promise.all([
          supabase
            .from(content.supabase_table)
            .select("*")
            .order("created_at", { ascending: true }),
          themes?.supabase_table
            ? supabase.from(themes.supabase_table).select("*").order("created_at", { ascending: true })
            : Promise.resolve({ data: [], error: null }),
          campaigns?.supabase_table
            ? supabase.from(campaigns.supabase_table).select("*").order("created_at", { ascending: true })
            : Promise.resolve({ data: [], error: null }),
        ])

        if (contentRes.error) throw new Error(contentRes.error.message)

        const contentRows = (contentRes.data || []) as Record<string, unknown>[]
        const themeRows = (themesRes.data || []) as Record<string, unknown>[]
        const campaignRows = (campaignsRes.data || []) as Record<string, unknown>[]

        const { labelById: themeLabelById } = buildThemeMaps(themeRows, fieldMap)
        const profileLabelById = await fetchProfileLabelById(supabase)

        const built = buildUpcomingSummaryData({
          contentRows,
          campaignRows,
          fields: fieldMap,
          contentFields: contentFieldRows,
          campaignFieldRows,
          themeLabelById,
          profileLabelById,
          contentTableId: content.id,
          contentSupabaseTable: content.supabase_table,
          campaignsTableId: ids.campaignsTableId,
          campaignsSupabaseTable: ids.campaignsSupabaseTable,
          priorityField: priorityField ?? null,
        })

        if (cancelled) return
        setTableIds(ids)
        setData(built)
        setFromLiveData(true)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load upcoming summary")
          setData(EMPTY_DATA)
          setFromLiveData(false)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [reloadToken, config, forceMock])

  return { loading, error, fromLiveData, hasTable, tableIds, data, reload }
}
