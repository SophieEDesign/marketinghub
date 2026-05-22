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
import type { FieldOptions } from "@/types/fields"

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
  tableIds: ContentPlanningTableIds | null
  fields: ContentPlanningFieldMap | null
  contentFields: PlanningFieldRow[]
  contentRows: Record<string, unknown>[]
  allItems: ContentPlanningItem[]
  campaignRows: Record<string, unknown>[]
  reload: () => void
}

export function useSocialMediaCalendarData(): UseSocialMediaCalendarDataResult {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tableIds, setTableIds] = useState<ContentPlanningTableIds | null>(null)
  const [fields, setFields] = useState<ContentPlanningFieldMap | null>(null)
  const [contentFields, setContentFields] = useState<PlanningFieldRow[]>([])
  const [contentRows, setContentRows] = useState<Record<string, unknown>[]>([])
  const [campaignRows, setCampaignRows] = useState<Record<string, unknown>[]>([])
  const [themeRows, setThemeRows] = useState<Record<string, unknown>[]>([])
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => {
    setReloadToken((n) => n + 1)
  }, [])

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

        const quarterlyThemes = tables.find(
          (t) => /quarterly/i.test(t.name) && /theme/i.test(t.name)
        )
        const campaigns = tables.find(
          (t) => /campaign/i.test(t.name) && !/content/i.test(t.name)
        )
        const content = tables.find(
          (t) =>
            /^content$/i.test(String(t.name).trim()) ||
            (/content/i.test(t.name) &&
              !/calendar/i.test(t.name) &&
              !/briefing/i.test(t.name))
        )

        if (!quarterlyThemes?.supabase_table || !content?.supabase_table || !campaigns?.supabase_table) {
          throw new Error("Content, Campaigns, or Quarterly Themes table not found")
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
        const fieldMap = resolveContentPlanningFields(
          contentFieldRows,
          campaignFieldRows,
          themeFieldRows
        )

        const [themesRes, contentRes, campaignsRes] = await Promise.all([
          supabase
            .from(quarterlyThemes.supabase_table)
            .select("*")
            .is("deleted_at", null)
            .order("created_at", { ascending: true }),
          supabase
            .from(content.supabase_table)
            .select("*")
            .is("deleted_at", null)
            .order("created_at", { ascending: true }),
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
        setFields(fieldMap)
        setContentFields(contentFieldRows)
        setThemeRows((themesRes.data || []) as Record<string, unknown>[])
        setContentRows((contentRes.data || []) as Record<string, unknown>[])
        setCampaignRows((campaignsRes.data || []) as Record<string, unknown>[])
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load social calendar data")
          setTableIds(null)
          setFields(null)
          setContentRows([])
          setThemeRows([])
          setCampaignRows([])
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
    tableIds,
    fields,
    contentFields,
    contentRows,
    allItems,
    campaignRows,
    reload,
  }
}
