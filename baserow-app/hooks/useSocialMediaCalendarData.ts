"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  buildContentItems,
  buildThemeMaps,
  resolveContentPlanningFields,
  type ContentPlanningFieldMap,
  type ContentPlanningItem,
  type ContentPlanningTableIds,
} from "@/lib/marketing/content-planning"
import {
  contentPlanningOverridesFromConfig,
  isMarketingMockEnabled,
  resolveMarketingTable,
} from "@/lib/marketing/block-config-resolver"
import { applyMarketingBlockDataQuery } from "@/lib/marketing/block-data-query"
import { findCampaignsTable, findContentTable, findQuarterlyThemesTable } from "@/lib/marketing/marketing-tables"
import { sanitizeSocialCalendarQueryConfig } from "@/lib/marketing/social-media-calendar"
import type { BlockConfig } from "@/lib/interface/types"
import type { FieldOptions, TableField } from "@/types/fields"

type PlanningFieldRow = { name: string; type?: string; options?: FieldOptions }

function mapToPlanningFieldRow(row: {
  name: string
  type?: string
  options?: unknown
}): PlanningFieldRow {
  return {
    name: row.name,
    type: row.type,
    options: row.options as FieldOptions | undefined,
  }
}

export interface UseSocialMediaCalendarDataResult {
  loading: boolean
  error: string | null
  fromLiveData: boolean
  hasTable: boolean
  tableIds: ContentPlanningTableIds | null
  fields: ContentPlanningFieldMap | null
  contentFields: PlanningFieldRow[]
  contentTableFields: TableField[]
  contentRows: Record<string, unknown>[]
  allItems: ContentPlanningItem[]
  campaignRows: Record<string, unknown>[]
  sourceTableName: string | null
  reload: () => void
}

export function useSocialMediaCalendarData(options?: {
  config?: BlockConfig
}): UseSocialMediaCalendarDataResult {
  const config = options?.config
  const forceMock = isMarketingMockEnabled(config, "social_media_calendar_use_mock")

  const [loading, setLoading] = useState(!forceMock)
  const [fromLiveData, setFromLiveData] = useState(false)
  const [hasTable, setHasTable] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tableIds, setTableIds] = useState<ContentPlanningTableIds | null>(null)
  const [fields, setFields] = useState<ContentPlanningFieldMap | null>(null)
  const [contentFields, setContentFields] = useState<PlanningFieldRow[]>([])
  const [contentTableFields, setContentTableFields] = useState<TableField[]>([])
  const [contentRows, setContentRows] = useState<Record<string, unknown>[]>([])
  const [campaignRows, setCampaignRows] = useState<Record<string, unknown>[]>([])
  const [themeRows, setThemeRows] = useState<Record<string, unknown>[]>([])
  const [sourceTableName, setSourceTableName] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => {
    setReloadToken((n) => n + 1)
  }, [])

  useEffect(() => {
    if (forceMock) {
      setLoading(false)
      setFromLiveData(false)
      setHasTable(false)
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

        const registry = tables as import("@/lib/marketing/marketing-tables").MarketingTableRow[]
        const quarterlyThemes = findQuarterlyThemesTable(registry)
        const campaigns = findCampaignsTable(registry)
        const content = resolveMarketingTable(registry, config?.table_id, findContentTable)

        if (!content?.supabase_table) {
          setHasTable(false)
          throw new Error("Content table not found — select a source table in block settings")
        }
        setHasTable(true)

        if (!quarterlyThemes?.supabase_table || !campaigns?.supabase_table) {
          throw new Error("Campaigns or Quarterly Themes table not found")
        }

        const ids: ContentPlanningTableIds = {
          contentTableId: content.id,
          contentSupabaseTable: content.supabase_table,
          campaignsTableId: campaigns.id,
          campaignsSupabaseTable: campaigns.supabase_table,
          themesTableId: quarterlyThemes.id,
          themesSupabaseTable: quarterlyThemes.supabase_table,
        }

        const { data: fieldRows, error: fieldsErr } = await supabase
          .from("table_fields")
          .select("id, table_id, name, type, options")
          .in("table_id", [content.id, campaigns.id, quarterlyThemes.id])

        if (fieldsErr) throw new Error(fieldsErr.message)

        const contentFieldRows = (fieldRows?.filter((f) => f.table_id === content.id) || []).map(
          mapToPlanningFieldRow
        )
        const campaignFieldRows = (fieldRows?.filter((f) => f.table_id === campaigns.id) || []).map(
          mapToPlanningFieldRow
        )
        const themeFieldRows = (fieldRows?.filter((f) => f.table_id === quarterlyThemes.id) || []).map(
          mapToPlanningFieldRow
        )
        const fieldIds = (fieldRows?.filter((f) => f.table_id === content.id) || []).map((f) => ({
          id: f.id,
          name: f.name,
        }))

        const fieldMap = resolveContentPlanningFields(
          contentFieldRows,
          campaignFieldRows,
          themeFieldRows,
          contentPlanningOverridesFromConfig(config, "social_media_calendar"),
          fieldIds
        )

        const contentTableFieldRows = (fieldRows?.filter((f) => f.table_id === content.id) ||
          []) as TableField[]

        const queryConfig = sanitizeSocialCalendarQueryConfig(
          config,
          contentTableFieldRows,
          content.name
        )

        const [themesRes, contentRes, campaignsRes] = await Promise.all([
          supabase
            .from(quarterlyThemes.supabase_table)
            .select("*")
            .is("deleted_at", null)
            .order("created_at", { ascending: true }),
          applyMarketingBlockDataQuery(
            supabase.from(content.supabase_table).select("*").is("deleted_at", null),
            queryConfig,
            contentTableFieldRows
          ),
          supabase
            .from(campaigns.supabase_table)
            .select("*")
            .is("deleted_at", null)
            .order("created_at", { ascending: true }),
        ])

        if (themesRes.error) throw new Error(themesRes.error.message)
        if (contentRes.error) throw new Error(contentRes.error.message)
        if (campaignsRes.error) throw new Error(campaignsRes.error.message)

        if (cancelled) return

        setTableIds(ids)
        setSourceTableName(content.name ?? null)
        setFields(fieldMap)
        setContentFields(contentFieldRows)
        setContentTableFields(
          contentTableFieldRows.map((f) => ({
            id: f.id,
            name: f.name,
            type: f.type,
            options: f.options,
            table_id: content.id,
          })) as TableField[]
        )
        setThemeRows((themesRes.data || []) as Record<string, unknown>[])
        setContentRows((contentRes.data || []) as Record<string, unknown>[])
        setCampaignRows((campaignsRes.data || []) as Record<string, unknown>[])
        setFromLiveData(true)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load social calendar data")
          setTableIds(null)
          setFields(null)
          setContentRows([])
          setContentTableFields([])
          setThemeRows([])
          setCampaignRows([])
          setSourceTableName(null)
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

  const { labelById, colorById } = useMemo(() => {
    if (!fields) return { labelById: new Map<string, string>(), colorById: new Map<string, string>() }
    return buildThemeMaps(themeRows, fields)
  }, [themeRows, fields])

  const allItems = useMemo(() => {
    if (!fields) return []
    return buildContentItems({
      contentRows,
      fields,
      contentFields,
      themeLabelById: labelById,
      themeColorById: colorById,
    })
  }, [contentRows, fields, contentFields, labelById, colorById])

  return {
    loading,
    error,
    fromLiveData,
    hasTable,
    tableIds,
    fields,
    contentFields,
    contentTableFields,
    contentRows,
    allItems,
    campaignRows,
    sourceTableName,
    reload,
  }
}
