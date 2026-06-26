"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { fetchProfileLabelById } from "@/lib/users/profile-labels"
import {
  contentTimelineExtraOverridesFromConfig,
  contentTimelineOverridesFromConfig,
  isMarketingMockEnabled,
  resolveContentTimelineExtraFields,
} from "@/lib/marketing/block-config-resolver"
import { applyMarketingBlockDataQuery } from "@/lib/marketing/block-data-query"
import {
  buildContentItems,
  buildContentTimelineItems,
  resolveContentPlanningFields,
} from "@/lib/marketing/content-timeline-data"
import {
  findCampaignsTable,
  findQuarterlyThemesTable,
  findSocialPostsTable,
  resolveContentTimelineSourceTables,
  type MarketingTableRow,
} from "@/lib/marketing/marketing-tables"
import type { ContentPlanningTableIds } from "@/lib/marketing/content-planning"
import type { ContentTimelineItem } from "@/lib/marketing/content-timeline"
import { formatDisplayValue } from "@/lib/marketing/field-utils"
import { buildThemeMaps } from "@/lib/marketing/content-planning"
import type { BlockConfig } from "@/lib/interface/types"
import type { FieldOptions } from "@/types/fields"
import { useTablesRegistry } from "@/hooks/useTablesRegistry"

type FieldRow = { id?: string; name: string; type?: string; options?: FieldOptions }

function mapFieldRow(row: {
  id?: string
  name: string
  type?: string
  options?: unknown
}): FieldRow {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    options: row.options as FieldOptions | undefined,
  }
}

export interface UseContentTimelineDataResult {
  loading: boolean
  error: string | null
  fromLiveData: boolean
  hasTable: boolean
  tableIds: ContentPlanningTableIds | null
  items: ContentTimelineItem[]
  reload: () => void
}

export function useContentTimelineData(options?: {
  config?: BlockConfig
  excludeEventTypes?: boolean
}): UseContentTimelineDataResult {
  const config = options?.config
  const excludeEventTypes = options?.excludeEventTypes !== false
  const forceMock = isMarketingMockEnabled(config, "content_timeline_use_mock")
  const {
    tables: registryTables,
    loading: registryLoading,
    error: registryError,
  } = useTablesRegistry()

  const [loading, setLoading] = useState(!forceMock)
  const [error, setError] = useState<string | null>(null)
  const [fromLiveData, setFromLiveData] = useState(false)
  const [hasTable, setHasTable] = useState(false)
  const [tableIds, setTableIds] = useState<ContentPlanningTableIds | null>(null)
  const [items, setItems] = useState<ContentTimelineItem[]>([])
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    if (forceMock) {
      setLoading(false)
      setError(null)
      setFromLiveData(false)
      setHasTable(false)
      setTableIds(null)
      setItems([])
      return
    }

    if (registryLoading) return

    if (registryError) {
      setLoading(false)
      setError(registryError)
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const supabase = createClient()
        const registry = registryTables
        const sourceTables = resolveContentTimelineSourceTables(registry, {
          tableId: config?.table_id,
          includeSocialPosts: config?.content_timeline_include_social_posts !== false,
        })
        const primary = sourceTables[0]
        const campaigns = findCampaignsTable(registry)
        const themes = findQuarterlyThemesTable(registry)

        if (!primary?.supabase_table) {
          setHasTable(false)
          throw new Error("Content table not found — select a source table in block settings")
        }

        setHasTable(true)

        const ids: ContentPlanningTableIds = {
          contentTableId: primary.id,
          contentSupabaseTable: primary.supabase_table,
          campaignsTableId: campaigns?.id ?? primary.id,
          campaignsSupabaseTable: campaigns?.supabase_table ?? primary.supabase_table,
          themesTableId: themes?.id ?? primary.id,
          themesSupabaseTable: themes?.supabase_table ?? primary.supabase_table,
        }

        const tableIdList = [
          ...new Set([
            ...sourceTables.map((t) => t.id),
            campaigns?.id,
            themes?.id,
          ].filter(Boolean)),
        ] as string[]

        const { data: fieldRows, error: fieldsErr } = await supabase
          .from("table_fields")
          .select("id, table_id, name, type, options")
          .in("table_id", tableIdList)

        if (fieldsErr) throw new Error(fieldsErr.message)

        const campaignFieldRows = (fieldRows?.filter((f) => f.table_id === campaigns?.id) || []).map(
          mapFieldRow
        )
        const themeFieldRows = (fieldRows?.filter((f) => f.table_id === themes?.id) || []).map(
          mapFieldRow
        )

        const [themesRes, campaignsRes] = await Promise.all([
          themes?.supabase_table
            ? supabase.from(themes.supabase_table).select("*").order("created_at", { ascending: true })
            : Promise.resolve({ data: [], error: null }),
          campaigns?.supabase_table
            ? supabase.from(campaigns.supabase_table).select("*").order("created_at", { ascending: true })
            : Promise.resolve({ data: [], error: null }),
        ])

        const themeRows = (themesRes.data || []) as Record<string, unknown>[]
        const campaignRows = (campaignsRes.data || []) as Record<string, unknown>[]

        const profileLabelById = await fetchProfileLabelById(supabase)

        const campaignLabelById = new Map<string, string>()
        const socialPostsTable = findSocialPostsTable(registry)
        const isSocialPostsTable = (tableId: string) =>
          socialPostsTable?.id === tableId

        const timelineItems: ContentTimelineItem[] = []

        for (const sourceTable of sourceTables) {
          const contentFieldRows = (fieldRows?.filter((f) => f.table_id === sourceTable.id) || []).map(
            mapFieldRow
          )
          const fieldIds = contentFieldRows.map((f) => ({
            id: f.id || f.name,
            name: f.name,
          }))

          const fieldMap = resolveContentPlanningFields(
            contentFieldRows,
            campaignFieldRows,
            themeFieldRows,
            contentTimelineOverridesFromConfig(config),
            fieldIds
          )

          const extraFieldMap = resolveContentTimelineExtraFields(
            fieldIds,
            contentTimelineExtraOverridesFromConfig(config)
          )

          const { labelById: themeLabelById } = buildThemeMaps(themeRows, fieldMap)

          for (const row of campaignRows) {
            campaignLabelById.set(
              String(row.id),
              formatDisplayValue(row[fieldMap.campaignName]) || "Campaign"
            )
          }

          const applyBlockFilters = sourceTable.id === primary.id
          const contentQuery = applyBlockFilters
            ? applyMarketingBlockDataQuery(
                supabase.from(sourceTable.supabase_table).select("*"),
                config,
                contentFieldRows
              )
            : supabase
                .from(sourceTable.supabase_table)
                .select("*")
                .order("created_at", { ascending: true })

          const contentRes = await contentQuery
          if (contentRes.error) throw new Error(contentRes.error.message)

          const contentRows = (contentRes.data || []) as Record<string, unknown>[]

          const planningItems = buildContentItems({
            contentRows,
            fields: fieldMap,
            contentFields: contentFieldRows,
            themeLabelById,
            themeColorById: new Map(),
          })

          const fromSocialTable = isSocialPostsTable(sourceTable.id)

          timelineItems.push(
            ...buildContentTimelineItems({
              contentRows,
              fields: fieldMap,
              contentFields: contentFieldRows,
              extraFields: extraFieldMap,
              planningItems,
              themeLabelById,
              campaignLabelById,
              profileLabelById,
              contentTableId: sourceTable.id,
              contentSupabaseTable: sourceTable.supabase_table,
              excludeEventTypes: fromSocialTable ? false : excludeEventTypes,
              defaultTimelineType: fromSocialTable ? "social" : undefined,
            })
          )
        }

        if (cancelled) return
        setTableIds(ids)
        setItems(timelineItems)
        setFromLiveData(true)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load timeline")
          setItems([])
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
  }, [reloadToken, excludeEventTypes, config, forceMock, registryTables, registryLoading, registryError])

  return { loading, error, fromLiveData, hasTable, tableIds, items, reload }
}
