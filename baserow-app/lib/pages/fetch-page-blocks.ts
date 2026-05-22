import { createClient } from "@/lib/supabase/server"
import { dbBlockToPageBlock } from "@/lib/interface/layout-mapping"
import type { PageBlock } from "@/lib/interface/types"

/**
 * Server-side load of blocks for an interface page (same logic as GET /api/pages/[pageId]/blocks).
 */
export async function fetchPageBlocksForPage(pageId: string): Promise<PageBlock[]> {
  const supabase = await createClient()

  const pageBlocksResult = await supabase
    .from("view_blocks")
    .select(
      [
        "id",
        "page_id",
        "view_id",
        "type",
        "position_x",
        "position_y",
        "width",
        "height",
        "config",
        "order_index",
        "created_at",
        "updated_at",
      ].join(",")
    )
    .eq("page_id", pageId)
    .eq("is_archived", false)
    .order("order_index", { ascending: true })
    .order("position_y", { ascending: true })
    .order("position_x", { ascending: true })

  let data = pageBlocksResult.data
  let error = pageBlocksResult.error

  if (!error && (!data || data.length === 0)) {
    const legacyBlocksResult = await supabase
      .from("view_blocks")
      .select(
        [
          "id",
          "page_id",
          "view_id",
          "type",
          "position_x",
          "position_y",
          "width",
          "height",
          "config",
          "order_index",
          "created_at",
          "updated_at",
        ].join(",")
      )
      .eq("view_id", pageId)
      .eq("is_archived", false)
      .order("order_index", { ascending: true })
      .order("position_y", { ascending: true })
      .order("position_x", { ascending: true })

    data = legacyBlocksResult.data
    error = legacyBlocksResult.error
  }

  if (error) {
    console.error("[fetchPageBlocksForPage] Query failed:", {
      pageId,
      message: error.message,
      code: error.code,
    })
    return []
  }

  const pageBlocks: PageBlock[] = []
  for (const block of data || []) {
    try {
      const layout = dbBlockToPageBlock({
        id: block.id,
        position_x: block.position_x,
        position_y: block.position_y,
        width: block.width,
        height: block.height,
      })

      pageBlocks.push({
        id: block.id,
        page_id: block.page_id || block.view_id || pageId,
        type: block.type,
        x: layout?.x ?? 0,
        y: layout?.y ?? 0,
        w: layout?.w ?? 4,
        h: layout?.h ?? 4,
        config: block.config || {},
        order_index: block.order_index ?? 0,
        created_at: block.created_at,
        updated_at: block.updated_at,
      } as PageBlock)
    } catch (layoutError) {
      console.warn("[fetchPageBlocksForPage] Skipping block with invalid layout:", {
        pageId,
        blockId: block.id,
        error: layoutError instanceof Error ? layoutError.message : layoutError,
      })
    }
  }

  return pageBlocks
}
