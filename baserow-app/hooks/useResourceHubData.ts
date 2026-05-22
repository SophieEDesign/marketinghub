"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { MockResource } from "@/components/interface/blocks/internal-resource-hub/types"
import {
  buildResourceHubItems,
  resolveMediaFields,
} from "@/lib/marketing/resource-hub-data"
import { findMediaTable, type MarketingTableRow } from "@/lib/marketing/marketing-tables"

export interface ResourceHubTableIds {
  mediaTableId: string
  mediaSupabaseTable: string
}

export interface UseResourceHubDataResult {
  loading: boolean
  error: string | null
  fromLiveData: boolean
  tableIds: ResourceHubTableIds | null
  resources: MockResource[]
  reload: () => void
}

export function useResourceHubData(): UseResourceHubDataResult {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fromLiveData, setFromLiveData] = useState(false)
  const [tableIds, setTableIds] = useState<ResourceHubTableIds | null>(null)
  const [resources, setResources] = useState<MockResource[]>([])
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

        const media = findMediaTable(tables as MarketingTableRow[])
        if (!media?.supabase_table) {
          throw new Error("Media / Resource table not found")
        }

        const { data: fieldRows, error: fieldsErr } = await supabase
          .from("table_fields")
          .select("name, type")
          .eq("table_id", media.id)

        if (fieldsErr) throw new Error(fieldsErr.message)

        const fieldMap = resolveMediaFields(fieldRows || [])

        const { data: rows, error: rowsErr } = await supabase
          .from(media.supabase_table)
          .select("*")
          .order("updated_at", { ascending: false })

        if (rowsErr) throw new Error(rowsErr.message)

        const resources = buildResourceHubItems(
          (rows || []) as Record<string, unknown>[],
          fieldMap,
          media.id
        )

        if (cancelled) return
        setTableIds({
          mediaTableId: media.id,
          mediaSupabaseTable: media.supabase_table,
        })
        setResources(resources)
        setFromLiveData(true)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load resources")
          setResources([])
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

  return { loading, error, fromLiveData, tableIds, resources, reload }
}
