"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  isMarketingMockEnabled,
  resolveMarketingTable,
  resourceHubOverridesFromConfig,
} from "@/lib/marketing/block-config-resolver"
import {
  buildResourceHubItems,
  resolveMediaFields,
} from "@/lib/marketing/resource-hub-data"
import { applyMarketingBlockDataQuery } from "@/lib/marketing/block-data-query"
import { findMediaTable, type MarketingTableRow } from "@/lib/marketing/marketing-tables"
import type { MockResource } from "@/components/interface/blocks/internal-resource-hub/types"
import type { BlockConfig } from "@/lib/interface/types"
import { useTablesRegistry } from "@/hooks/useTablesRegistry"

export interface ResourceHubTableIds {
  mediaTableId: string
  mediaSupabaseTable: string
}

export interface UseResourceHubDataResult {
  loading: boolean
  error: string | null
  fromLiveData: boolean
  hasTable: boolean
  tableIds: ResourceHubTableIds | null
  resources: MockResource[]
  reload: () => void
}

export function useResourceHubData(options?: {
  config?: BlockConfig
}): UseResourceHubDataResult {
  const config = options?.config
  const forceMock = isMarketingMockEnabled(
    config,
    "resource_hub_use_mock",
    "resource_hub_use_dashboard_mock"
  )
  const {
    tables: registryTables,
    loading: registryLoading,
    error: registryError,
  } = useTablesRegistry()

  const [loading, setLoading] = useState(!forceMock)
  const [error, setError] = useState<string | null>(null)
  const [fromLiveData, setFromLiveData] = useState(false)
  const [hasTable, setHasTable] = useState(false)
  const [tableIds, setTableIds] = useState<ResourceHubTableIds | null>(null)
  const [resources, setResources] = useState<MockResource[]>([])
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    if (forceMock) {
      setLoading(false)
      setError(null)
      setFromLiveData(false)
      setHasTable(false)
      setResources([])
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
        const media = resolveMarketingTable(
          registryTables,
          config?.table_id,
          findMediaTable
        )
        if (!media?.supabase_table) {
          setHasTable(false)
          throw new Error("Media / Resource table not found — select a source table in block settings")
        }

        setHasTable(true)

        const { data: fieldRows, error: fieldsErr } = await supabase
          .from("table_fields")
          .select("id, name, type")
          .eq("table_id", media.id)

        if (fieldsErr) throw new Error(fieldsErr.message)

        const fieldMap = resolveMediaFields(
          fieldRows || [],
          resourceHubOverridesFromConfig(config)
        )

        const loadRows = async () => {
          const withSoftDeleteFilter = await applyMarketingBlockDataQuery(
            supabase
              .from(media.supabase_table)
              .select("*")
              .is("deleted_at", null),
            config,
            fieldRows || [],
            "updated_at"
          ).order("updated_at", { ascending: false })

          // Some legacy tables may not yet have deleted_at.
          if (
            withSoftDeleteFilter.error &&
            /deleted_at|column .* does not exist/i.test(withSoftDeleteFilter.error.message)
          ) {
            return await applyMarketingBlockDataQuery(
              supabase.from(media.supabase_table).select("*"),
              config,
              fieldRows || [],
              "updated_at"
            ).order("updated_at", { ascending: false })
          }

          return withSoftDeleteFilter
        }

        const { data: rows, error: rowsErr } = await loadRows()

        if (rowsErr) throw new Error(rowsErr.message)

        const built = buildResourceHubItems(
          (rows || []) as Record<string, unknown>[],
          fieldMap,
          media.id
        )

        if (cancelled) return
        setTableIds({
          mediaTableId: media.id,
          mediaSupabaseTable: media.supabase_table,
        })
        setResources(built)
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
  }, [reloadToken, config, forceMock, registryTables, registryLoading, registryError])

  return { loading, error, fromLiveData, hasTable, tableIds, resources, reload }
}
