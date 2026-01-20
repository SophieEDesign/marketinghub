import { createClient } from '../supabase/server'
import type { ViewBlock } from '@/types/database'
import { normalizeUuid } from '@/lib/utils/ids'

export async function getViewBlocks(viewId: string) {
  const viewUuid = normalizeUuid(viewId)
  if (!viewUuid) {
    throw new Error(`Invalid viewId (expected UUID): ${String(viewId)}`)
  }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('view_blocks')
    .select('*')
    .eq('view_id', viewUuid)
    .order('order_index', { ascending: true })
  
  if (error) throw error
  return data as ViewBlock[]
}

export async function createViewBlock(block: Omit<ViewBlock, 'id' | 'created_at' | 'updated_at'>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('view_blocks')
    .insert([block])
    .select()
    .single()
  
  if (error) throw error
  return data as ViewBlock
}

export async function updateViewBlock(id: string, updates: Partial<ViewBlock>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('view_blocks')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data as ViewBlock
}

export async function deleteViewBlock(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('view_blocks')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}
