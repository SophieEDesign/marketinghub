import { createClient } from '@/lib/supabase/server'
import type { PageBlock, LayoutItem } from '@/lib/interface/types'

export async function saveBlockLayout(
  pageId: string,
  layout: LayoutItem[]
): Promise<void> {
  const supabase = await createClient()

  // Update each block's position and size
  const updates = layout.map((item, index) => ({
    id: item.i,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    order_index: index,
  }))

  // Batch update using Promise.all
  await Promise.all(
    updates.map((update) =>
      supabase
        .from('page_blocks')
        .update({
          x: update.x,
          y: update.y,
          w: update.w,
          h: update.h,
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
    .from('page_blocks')
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
    .from('page_blocks')
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
    .from('page_blocks')
    .select('order_index')
    .eq('page_id', pageId)
    .order('order_index', { ascending: false })
    .limit(1)

  const orderIndex = blocks && blocks.length > 0 ? (blocks[0].order_index || 0) + 1 : 0

  const { data, error } = await supabase
    .from('page_blocks')
    .insert([
      {
        page_id: pageId,
        type,
        x,
        y,
        w,
        h,
        config,
        order_index: orderIndex,
      },
    ])
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create block: ${error.message}`)
  }

  return data as PageBlock
}

export async function deleteBlock(blockId: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('page_blocks')
    .delete()
    .eq('id', blockId)

  if (error) {
    throw new Error(`Failed to delete block: ${error.message}`)
  }
}
