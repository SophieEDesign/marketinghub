"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  buildThemeMaps,
  resolveContentPlanningFields,
} from "@/lib/marketing/content-planning"
import { buildThingsToDoItems } from "@/lib/marketing/things-to-do-data"
import {
  findCampaignsTable,
  findContentTable,
  findQuarterlyThemesTable,
  type MarketingTableRow,
} from "@/lib/marketing/marketing-tables"
import type { ContentPlanningTableIds } from "@/lib/marketing/content-planning"
import type { ThingsToDoItem } from "@/lib/marketing/things-to-do"
import { formatDisplayValue } from "@/lib/marketing/field-utils"
import type { FieldOptions } from "@/types/fields"

type FieldRow = { name: string; type?: string; options?: FieldOptions }

function mapFieldRow(row: { name: string; type?: string; options?: unknown }): FieldRow {
  return {
    name: row.name,
    type: row.type,
    options: row.options as FieldOptions | undefined,
  }
}

export interface UseThingsToDoDataResult {
  loading: boolean
  error: string | null
  fromLiveData: boolean
  tableIds: ContentPlanningTableIds | null
  items: ThingsToDoItem[]
  reload: () => void
}

export function useThingsToDoData(): UseThingsToDoDataResult {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fromLiveData, setFromLiveData] = useState(false)
  const [tableIds, setTableIds] = useState<ContentPlanningTableIds | null>(null)
  const [items, setItems] = useState<ThingsToDoItem[]>([])
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

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")

        const profileLabelById = new Map<string, string>()
        for (const p of profiles || []) {
          const label =
            formatDisplayValue(p.full_name) ||
            formatDisplayValue(p.email) ||
            String(p.id).slice(0, 8)
          profileLabelById.set(String(p.id), label)
        }

        const todoItems = buildThingsToDoItems({
          contentRows,
          fields: fieldMap,
          profileLabelById,
          campaignLabelById,
          themeLabelById,
          contentTableId: content.id,
          contentSupabaseTable: content.supabase_table,
        })

        if (cancelled) return
        setTableIds(ids)
        setItems(todoItems)
        setFromLiveData(todoItems.length > 0)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load tasks")
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
  }, [reloadToken])

  return { loading, error, fromLiveData, tableIds, items, reload }
}
