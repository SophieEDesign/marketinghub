import { createServerSupabaseClient } from './supabase'
import type { ViewBlock } from '@/types/database'

export async function loadViewBlocks(viewId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('view_blocks')
    .select('*')
    .eq('view_id', viewId)

  if (error) throw error
  return (data || []) as ViewBlock[]
}

export async function createViewBlock(
  viewId: string,
  type: ViewBlock['type'],
  settings: Record<string, any> = {}
) {
  const supabase = await createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('view_blocks')
    .insert([
      {
        view_id: viewId,
        type,
        position: { x: 0, y: 0, w: 4, h: 4 },
        settings,
      },
    ])
    .select()
    .single()

  if (error) throw error
  return data as ViewBlock
}

export async function updateViewBlock(
  blockId: string,
  updates: Partial<ViewBlock>
) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('view_blocks')
    .update(updates)
    .eq('id', blockId)
    .select()
    .single()

  if (error) throw error
  return data as ViewBlock
}

export async function updateViewBlockLayout(
  blocks: Array<{ id: string; x: number; y: number; w: number; h: number }>
) {
  const supabase = await createServerSupabaseClient()
  
  const updates = blocks.map((block) =>
    supabase
      .from('view_blocks')
      .update({
        position: { x: block.x, y: block.y, w: block.w, h: block.h },
      })
      .eq('id', block.id)
  )

  await Promise.all(updates)
}

// Client-side version
export async function updateViewBlockLayoutClient(
  supabase: any,
  blocks: Array<{ id: string; x: number; y: number; w: number; h: number }>
) {
  const updates = blocks.map((block) =>
    supabase
      .from('view_blocks')
      .update({
        position: { x: block.x, y: block.y, w: block.w, h: block.h },
      })
      .eq('id', block.id)
  )

  await Promise.all(updates)
}

export async function deleteViewBlock(blockId: string) {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('view_blocks')
    .delete()
    .eq('id', blockId)

  if (error) throw error
}
