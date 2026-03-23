"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

/**
 * Subscribe to realtime postgres_changes for view_blocks affecting a page.
 * Blocks can be keyed by page_id OR view_id (legacy), so we subscribe to both.
 * On any INSERT/UPDATE/DELETE, calls onRefresh to reload blocks from API.
 */
export function useRealtimeViewBlocks(pageId: string | null, onRefresh: () => void) {
  const supabase = createClient()
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    if (!pageId || typeof window === "undefined") return

    const channelName = `view_blocks:${pageId}`
    const channel = supabase.channel(channelName)

    const handlePayload = () => {
      onRefreshRef.current()
    }

    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "view_blocks",
          filter: `page_id=eq.${pageId}`,
        },
        handlePayload
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "view_blocks",
          filter: `view_id=eq.${pageId}`,
        },
        handlePayload
      )
      .subscribe((status) => {
        if (process.env.NODE_ENV === "development" && status === "SUBSCRIBED") {
          console.log(`[Realtime] view_blocks subscribed for page ${pageId}`)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [pageId])
}
