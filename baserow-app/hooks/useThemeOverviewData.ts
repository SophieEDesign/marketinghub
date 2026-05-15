"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { enrichThemeRowsForDisplay } from "@/lib/marketing/enrich-theme-rows"
import {
  buildThemeCards,
  collectAvailableYears,
  getCurrentQuarter,
  resolveThemeOverviewFields,
  type MarketingTableIds,
  type ThemeOverviewCard,
  type ThemeOverviewFieldMap,
} from "@/lib/marketing/theme-overview"

interface UseThemeOverviewDataResult {
  loading: boolean
  error: string | null
  tableIds: MarketingTableIds | null
  fields: ThemeOverviewFieldMap | null
  themeFields: { name: string; type?: string }[]
  cards: ThemeOverviewCard[]
  activeCard: ThemeOverviewCard | null
  availableYears: number[]
  selectedYear: number
  setSelectedYear: (year: number) => void
  currentQuarter: ReturnType<typeof getCurrentQuarter>
  reload: () => void
}

export function useThemeOverviewData(): UseThemeOverviewDataResult {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tableIds, setTableIds] = useState<MarketingTableIds | null>(null)
  const [fields, setFields] = useState<ThemeOverviewFieldMap | null>(null)
  const [themeFields, setThemeFields] = useState<{ name: string; type?: string }[]>([])
  const [themeRows, setThemeRows] = useState<Record<string, unknown>[]>([])
  const [contentRows, setContentRows] = useState<Record<string, unknown>[]>([])
  const [reloadToken, setReloadToken] = useState(0)
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear())

  const currentQuarter = getCurrentQuarter()

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
        const content = tables.find(
          (t) =>
            /^content$/i.test(String(t.name).trim()) ||
            (/content/i.test(t.name) &&
              !/calendar/i.test(t.name) &&
              !/briefing/i.test(t.name))
        )

        if (!quarterlyThemes?.supabase_table || !content?.supabase_table) {
          throw new Error("Quarterly Themes or Content table not found")
        }

        const ids: MarketingTableIds = {
          quarterlyThemesTableId: quarterlyThemes.id,
          quarterlyThemesSupabaseTable: quarterlyThemes.supabase_table,
          contentTableId: content.id,
          contentSupabaseTable: content.supabase_table,
        }

        const { data: fieldRows, error: fieldsErr } = await supabase
          .from("table_fields")
          .select("id, table_id, name, type, options")
          .in("table_id", [quarterlyThemes.id, content.id])

        if (fieldsErr) throw new Error(fieldsErr.message)

        const themeFieldRows =
          fieldRows?.filter((f) => f.table_id === quarterlyThemes.id) || []
        const contentFieldRows = fieldRows?.filter((f) => f.table_id === content.id) || []
        const fieldMap = resolveThemeOverviewFields(themeFieldRows, contentFieldRows)

        const [themesRes, contentRes] = await Promise.all([
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
        ])

        if (themesRes.error) throw new Error(themesRes.error.message)
        if (contentRes.error) throw new Error(contentRes.error.message)

        const themeData = [...((themesRes.data || []) as Record<string, unknown>[])]
        await enrichThemeRowsForDisplay(
          quarterlyThemes.id,
          quarterlyThemes.supabase_table,
          themeFieldRows,
          themeData
        )

        if (cancelled) return

        setTableIds(ids)
        setFields(fieldMap)
        setThemeFields(themeFieldRows)
        setThemeRows(themeData)
        setContentRows((contentRes.data || []) as Record<string, unknown>[])
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load theme overview")
          setTableIds(null)
          setFields(null)
          setThemeRows([])
          setContentRows([])
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

  const availableYears = useMemo(() => {
    if (!fields) return [new Date().getFullYear()]
    return collectAvailableYears(themeRows, fields)
  }, [themeRows, fields])

  useEffect(() => {
    if (availableYears.length && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0])
    }
  }, [availableYears, selectedYear])

  const cards = useMemo(() => {
    if (!fields) return []
    return buildThemeCards({
      themeRows,
      contentRows,
      fields,
      themeFields,
      selectedYear,
      currentQuarter,
    })
  }, [themeRows, contentRows, fields, themeFields, selectedYear, currentQuarter])

  const activeCard = useMemo(
    () => cards.find((c) => c.isCurrentQuarter) ?? null,
    [cards]
  )

  return {
    loading,
    error,
    tableIds,
    fields,
    themeFields,
    cards,
    activeCard,
    availableYears,
    selectedYear,
    setSelectedYear,
    currentQuarter,
    reload,
  }
}
