"use client"

import useSWR from "swr"
import { createClient } from "@/lib/supabase/client"
import type { MarketingTableRow } from "@/lib/marketing/marketing-tables"

export const TABLES_REGISTRY_SWR_KEY = "marketing-tables-registry"

async function fetchTablesRegistry(): Promise<MarketingTableRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("tables")
    .select("id, name, supabase_table")

  if (error) {
    throw new Error(error.message || "Could not load tables")
  }
  if (!data?.length) {
    throw new Error("Could not load tables")
  }
  return data as MarketingTableRow[]
}

/**
 * Shared SWR cache for the marketing tables registry.
 * Multiple marketing block hooks on one page share a single fetch.
 */
export function useTablesRegistry() {
  const { data, error, isLoading, mutate } = useSWR(
    TABLES_REGISTRY_SWR_KEY,
    fetchTablesRegistry,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10_000,
    }
  )

  return {
    tables: data ?? [],
    loading: isLoading,
    error: error
      ? error instanceof Error
        ? error.message
        : "Could not load tables"
      : null,
    reload: () => mutate(),
  }
}
