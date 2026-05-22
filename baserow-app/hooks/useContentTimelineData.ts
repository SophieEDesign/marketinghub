"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { fetchProfileLabelById } from "@/lib/users/profile-labels"
import {
  buildContentItems,
  buildContentTimelineItems,
  resolveContentPlanningFields,
} from "@/lib/marketing/content-timeline-data"
import {
  findCampaignsTable,
  findContentTable,
  findQuarterlyThemesTable,
  type MarketingTableRow,
} from "@/lib/marketing/marketing-tables"
import type { ContentPlanningTableIds } from "@/lib/marketing/content-planning"
import type { ContentTimelineItem } from "@/lib/marketing/content-timeline"
import { formatDisplayValue } from "@/lib/marketing/field-utils"
import { buildThemeMaps } from "@/lib/marketing/content-planning"
import type { FieldOptions } from "@/types/fields"

type FieldRow = { name: string; type?: string; options?: FieldOptions }

function mapFieldRow(row: { name: string; type?: string; options?: unknown }): FieldRow {
  return {
    name: row.name,
    type: row.type,
    options: row.options as FieldOptions | undefined,
  }
}

export interface UseContentTimelineDataResult {
  loading: boolean
  error: string | null
  fromLiveData: boolean
  tableIds: ContentPlanningTableIds | null
  items: ContentTimelineItem[]
  reload: () => void
}

export function useContentTimelineData(options?: {
  excludeEventTypes?: boolean
}): UseContentTimelineDataResult {
  const excludeEventTypes = options?.excludeEventTypes !== false
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fromLiveData, setFromLiveData] = useState(false)
  const [tableIds, setTableIds] = useState<ContentPlanningTableIds | null>(null)
  const [items, setItems] = useState<ContentTimelineItem[]>([])
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
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
        const content = findContentTable(registry)
        const campaigns = findCampaignsTable(registry)
        const themes = findQuarterlyThemesTable(registry)

        if (!content?.supabase_table) {
          throw new Error("Content table not found")
        }

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

        const fieldMap = resolveContentPlanningFields(
          contentFieldRows,
          campaignFieldRows,
          themeFieldRows
        )

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

        const campaignLabelById = new Map<string, string>()
        for (const row of campaignRows) {
          campaignLabelById.set(
            String(row.id),
            formatDisplayValue(row[fieldMap.campaignName]) || "Campaign"
          )
        }

        const profileLabelById = await fetchProfileLabelById(supabase)

        const planningItems = buildContentItems({
          contentRows,
          fields: fieldMap,
          contentFields: contentFieldRows,
          themeLabelById,
          themeColorById: new Map(),
        })

        const timelineItems = buildContentTimelineItems({
          contentRows,
          fields: fieldMap,
          contentFields: contentFieldRows,
          planningItems,
          campaignLabelById,
          profileLabelById,
          contentTableId: content.id,
          contentSupabaseTable: content.supabase_table,
          excludeEventTypes,
        })

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
  }, [reloadToken, excludeEventTypes])

  return { loading, error, fromLiveData, tableIds, items, reload }
}
