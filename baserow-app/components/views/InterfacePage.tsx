"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import BlockRenderer from "@/components/blocks/BlockRenderer"
import type { ViewBlock } from "@/types/database"

interface InterfacePageProps {
  viewId: string
}

export default function InterfacePage({ viewId }: InterfacePageProps) {
  const [blocks, setBlocks] = useState<ViewBlock[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBlocks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewId])

  async function loadBlocks() {
    setLoading(true)
    const { data, error } = await supabase
      .from("view_blocks")
      .select("*")
      .eq("view_id", viewId)
      .order("order_index", { ascending: true })

    if (error) {
      console.error("Error loading blocks:", error)
    } else {
      setBlocks(data || [])
    }
    setLoading(false)
  }

  async function handleLayoutChange(layout: any) {
    // Update block positions based on layout changes
    for (const item of layout) {
      await supabase
        .from("view_blocks")
        .update({
          position_x: item.x,
          position_y: item.y,
          width: item.w,
          height: item.h,
        })
        .eq("id", item.i)
    }
  }

  if (loading) {
    return <div className="p-4">Loading...</div>
  }

  return (
    <div className="w-full p-6">
      <h1 className="text-2xl font-bold mb-6">Interface Page</h1>
      {blocks.length > 0 ? (
        <BlockRenderer blocks={blocks} onLayoutChange={handleLayoutChange} />
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          No blocks yet. Add blocks to build your interface.
        </div>
      )}
    </div>
  )
}
