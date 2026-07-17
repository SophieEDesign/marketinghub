"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

/**
 * Subscribe to realtime postgres_changes for a content table.
 * On INSERT/UPDATE/DELETE, calls onRefresh (e.g. mutate or refresh) to reload grid/list data.
 * 
 * Note: Realtime must be enabled for the table in Supabase Dashboard (Database → Replication).
 */
export function useRealtimeTable(
  tableName: string | null,
  onRefresh: () => void | Promise<void>
) {
  const supabase = createClient()
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    if (!tableName || typeof window === "undefined") return

    const channelName = `table:${tableName}`
    const channel = supabase.channel(channelName)

    const handlePayload = () => {
      const fn = onRefreshRef.current
      const result = fn()
      if (result instanceof Promise) {
        result.catch((err) => console.warn("[Realtime] Table refresh failed:", err))
      }
    }

    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: tableName,
        },
        handlePayload
      )
      .subscribe((status) => {
        if (process.env.NODE_ENV === "development" && status === "SUBSCRIBED") {
          console.log(`[Realtime] table "${tableName}" subscribed`)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tableName])
}
