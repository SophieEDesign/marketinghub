"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  isMarketingMockEnabled,
  overridePair,
  resolveMarketingTable,
} from "@/lib/marketing/block-config-resolver"
import {
  buildContentThemeItems,
  resolveThemeFields,
} from "@/lib/marketing/content-theme-data"
import {
  findQuarterlyThemesTable,
  type MarketingTableRow,
} from "@/lib/marketing/marketing-tables"
import type { ContentThemeItem } from "@/lib/interface/content-theme-mock-data"
import type { BlockConfig } from "@/lib/interface/types"

export interface UseContentThemeDataResult {
  loading: boolean
  error: string | null
  fromLiveData: boolean
  hasTable: boolean
  themes: ContentThemeItem[]
  reload: () => void
}

export function useContentThemeData(options?: {
  config?: BlockConfig
}): UseContentThemeDataResult {
  const config = options?.config
  const forceMock = isMarketingMockEnabled(config, "content_theme_use_mock")

  const [loading, setLoading] = useState(!forceMock)
  const [error, setError] = useState<string | null>(null)
  const [fromLiveData, setFromLiveData] = useState(false)
  const [hasTable, setHasTable] = useState(false)
  const [themes, setThemes] = useState<ContentThemeItem[]>([])
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    if (forceMock) {
      setLoading(false)
      setFromLiveData(false)
      setHasTable(false)
      setThemes([])
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
        const themesTable = resolveMarketingTable(
          registry,
          config?.table_id,
          findQuarterlyThemesTable
        )

        if (!themesTable?.supabase_table) {
          setHasTable(false)
          throw new Error("Quarterly Themes table not found — select a source table in block settings")
        }

        setHasTable(true)

        const { data: fieldRows, error: fieldsErr } = await supabase
          .from("table_fields")
          .select("id, name, type")
          .eq("table_id", themesTable.id)

        if (fieldsErr) throw new Error(fieldsErr.message)

        const fieldMap = resolveThemeFields(fieldRows || [], {
          name: overridePair(config, "content_theme_name_field_id"),
          quarter: overridePair(config, "content_theme_quarter_field_id"),
          year: overridePair(config, "content_theme_year_field_id"),
          color: overridePair(config, "content_theme_colour_field_id"),
          divisions: overridePair(config, "content_theme_divisions_field_id"),
        })

        const { data: rows, error: rowsErr } = await supabase
          .from(themesTable.supabase_table)
          .select("*")
          .order("created_at", { ascending: true })

        if (rowsErr) throw new Error(rowsErr.message)

        const selectedYear = config?.content_theme_year ?? new Date().getFullYear()
        const selectedQuarter = config?.content_theme_quarter || "Q2"

        const items = buildContentThemeItems(
          (rows || []) as Record<string, unknown>[],
          fieldMap,
          { selectedQuarter, selectedYear }
        )

        if (cancelled) return
        setThemes(items)
        setFromLiveData(true)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load themes")
          setThemes([])
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

  return { loading, error, fromLiveData, hasTable, themes, reload }
}
