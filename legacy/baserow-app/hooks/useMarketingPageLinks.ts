"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  pickPageId,
  marketingPagePath,
  type InterfacePageRow,
} from "@/lib/marketing/marketing-page-links"

export function useMarketingPageLinks() {
  const [rows, setRows] = useState<InterfacePageRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("interface_pages")
          .select("id, name")
          .eq("is_archived", false)
          .eq("is_hidden", false)

        if (!cancelled && !error && data) {
          setRows(data as InterfacePageRow[])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const resolvePath = useCallback(
    (names: readonly string[], overrideId?: string | null) => {
      const pageId = pickPageId(rows, names, overrideId)
      return marketingPagePath(pageId)
    },
    [rows]
  )

  return { rows, loading, resolvePath }
}
