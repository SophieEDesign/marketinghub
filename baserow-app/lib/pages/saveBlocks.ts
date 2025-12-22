import { createClient } from '@/lib/supabase/server'
import type { PageBlock, LayoutItem } from '@/lib/interface/types'

export async function saveBlockLayout(
  pageId: string,
  layout: LayoutItem[]
): Promise<void> {
  const supabase = await createClient()

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
  await Promise.all(
    updates.map((update) =>
      supabase
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
    )
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

  await supabase
    .from('view_blocks')
    .update({
      config: updatedConfig,
      updated_at: new Date().toISOString(),
    })
    .eq('id', blockId)
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

  // Get max order_index
  const { data: blocks } = await supabase
    .from('view_blocks')
    .select('order_index')
    .eq('view_id', pageId)
    .order('order_index', { ascending: false })
    .limit(1)

  const orderIndex = blocks && blocks.length > 0 ? (blocks[0].order_index || 0) + 1 : 0

  const { data, error } = await supabase
    .from('view_blocks')
    .insert([
      {
        view_id: pageId,
        type,
        position_x: x,
        position_y: y,
        width: w,
        height: h,
        config,
        order_index: orderIndex,
      },
    ])
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create block: ${error.message}`)
  }

  // Convert view_block to PageBlock format
  return {
    id: data.id,
    page_id: data.view_id,
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
