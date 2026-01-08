import { createClient } from '@/lib/supabase/server'
import type { PageBlock, LayoutItem } from '@/lib/interface/types'
import { layoutItemToDbUpdate } from '@/lib/interface/layout-mapping'
import { debugLog, debugError } from '@/lib/interface/debug-flags'


/**
 * Saves block layout positions to Supabase
 * 
 * Persists block positions (x, y, w, h) to the view_blocks table.
 * 
 * Database columns:
 * - position_x: Block's X position in grid (from LayoutItem.x)
 * - position_y: Block's Y position in grid (from LayoutItem.y)
 * - width: Block width in grid units (from LayoutItem.w)
 * - height: Block height in grid units (from LayoutItem.h)
 * - order_index: Display order (from array index)
 * 
 * Called by: /api/pages/[pageId]/blocks PATCH endpoint
 * Triggered by: User drag/resize in edit mode (debounced) or "Done" button click
 */
export async function saveBlockLayout(
  pageId: string,
  layout: LayoutItem[]
): Promise<void> {
  const supabase = await createClient()

  // Check if this is an interface_pages.id or views.id
  const { data: page } = await supabase
    .from('interface_pages')
    .select('id')
    .eq('id', pageId)
    .maybeSingle()

  const isInterfacePage = !!page

  // Update each block's position and size
  // Convert LayoutItem format (x, y, w, h) to view_blocks format (position_x, position_y, width, height)
  const updates = layout.map((item, index) => ({
    id: item.i,
    position_x: item.x,
    position_y: item.y,
    width: item.w,
    height: item.h,
    order_index: index,
  }))

  // Batch update using Promise.all
  // Filter blocks by page_id or view_id to ensure we only update blocks for this page
  await Promise.all(
    updates.map(async (update) => {
      // DEBUG_LAYOUT: Log before DB update
      debugLog('LAYOUT', 'Block BEFORE DB UPDATE', {
        blockId: update.id,
        position_x: update.position_x,
        position_y: update.position_y,
        width: update.width,
        height: update.height,
        order_index: update.order_index,
      })

      let query = supabase
        .from('view_blocks')
        .update({
          position_x: update.position_x,
          position_y: update.position_y,
          width: update.width,
          height: update.height,
          order_index: update.order_index,
          updated_at: new Date().toISOString(),
        })
        .eq('id', update.id)
        .select('id, position_x, position_y, width, height') // Select to verify update succeeded

      // Ensure we're only updating blocks that belong to this page
      if (isInterfacePage) {
        query = query.eq('page_id', pageId)
      } else {
        query = query.eq('view_id', pageId)
      }

      // Execute the query and check for errors and verify update succeeded
      const { data, error } = await query
      if (error) {
        throw new Error(`Failed to update block ${update.id}: ${error.message}`)
      }
      // Verify the update actually happened (RLS might silently fail)
      if (!data || data.length === 0) {
        throw new Error(`Failed to update block ${update.id}: Update was blocked or block not found. Check RLS policies and block ownership.`)
      }

      // DEBUG_LAYOUT: Verify DB actually persisted the values
      const persisted = data[0]
      const matches = 
        persisted.position_x === update.position_x &&
        persisted.position_y === update.position_y &&
        persisted.width === update.width &&
        persisted.height === update.height

      debugLog('LAYOUT', 'Block AFTER DB UPDATE', {
        blockId: update.id,
        sent: {
          position_x: update.position_x,
          position_y: update.position_y,
          width: update.width,
          height: update.height,
        },
        persisted: {
          position_x: persisted.position_x,
          position_y: persisted.position_y,
          width: persisted.width,
          height: persisted.height,
        },
        matches,
        timestamp: new Date().toISOString(),
      })

      if (!matches) {
        debugError('LAYOUT', `Block ${update.id}: ❌ MISMATCH - DB persisted different values than sent!`, {
          blockId: update.id,
          sent: update,
          persisted,
        })
        throw new Error(`Layout save mismatch for block ${update.id}`)
      }
    })
  )
}

export async function saveBlockConfig(
  blockId: string,
  config: Partial<PageBlock['config']>
): Promise<void> {
  const supabase = await createClient()

  // Get current block
  const { data: block } = await supabase
    .from('view_blocks')
    .select('config')
    .eq('id', blockId)
    .single()

  if (!block) {
    throw new Error('Block not found')
  }

  // Merge config
  const updatedConfig = {
    ...(block.config || {}),
    ...config,
  }

  // Execute the update query and check for errors
  const { error } = await supabase
    .from('view_blocks')
    .update({
      config: updatedConfig,
      updated_at: new Date().toISOString(),
    })
    .eq('id', blockId)
  
  if (error) {
    throw new Error(`Failed to update block config: ${error.message}`)
  }
}

export async function createBlock(
  pageId: string,
  type: PageBlock['type'],
  x: number,
  y: number,
  w: number,
  h: number,
  config: PageBlock['config'] = {}
): Promise<PageBlock> {
  const supabase = await createClient()

  // Check if this is an interface_pages.id or views.id
  const { data: page } = await supabase
    .from('interface_pages')
    .select('id')
    .eq('id', pageId)
    .maybeSingle()

  const isInterfacePage = !!page

  // Get max order_index
  let blocksQuery
  if (isInterfacePage) {
    blocksQuery = supabase
      .from('view_blocks')
      .select('order_index')
      .eq('page_id', pageId)
  } else {
    blocksQuery = supabase
      .from('view_blocks')
      .select('order_index')
      .eq('view_id', pageId)
  }

  const { data: blocks } = await blocksQuery
    .order('order_index', { ascending: false })
    .limit(1)

  const orderIndex = blocks && blocks.length > 0 ? (blocks[0].order_index || 0) + 1 : 0

  // Insert block with appropriate reference
  const insertData: any = {
    type,
    position_x: x,
    position_y: y,
    width: w,
    height: h,
    config,
    order_index: orderIndex,
  }

  if (isInterfacePage) {
    insertData.page_id = pageId
    insertData.view_id = null
  } else {
    insertData.view_id = pageId
    insertData.page_id = null
  }

  const { data, error } = await supabase
    .from('view_blocks')
    .insert([insertData])
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create block: ${error.message}`)
  }

  // Convert view_block to PageBlock format
  return {
    id: data.id,
    page_id: data.page_id || data.view_id, // Use page_id if available, fallback to view_id
    type: data.type,
    x: data.position_x,
    y: data.position_y,
    w: data.width,
    h: data.height,
    config: data.config || {},
    order_index: data.order_index,
    created_at: data.created_at,
    updated_at: data.updated_at,
  } as PageBlock
}

export async function deleteBlock(blockId: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('view_blocks')
    .delete()
    .eq('id', blockId)

  if (error) {
    throw new Error(`Failed to delete block: ${error.message}`)
  }
}
