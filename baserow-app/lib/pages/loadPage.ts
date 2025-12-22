import { createClient } from '@/lib/supabase/server'
import type { Page, PageBlock } from '@/lib/interface/types'

export async function loadPage(pageId: string): Promise<Page | null> {
  const supabase = await createClient()

  // Load from views table where type='interface'
  const { data, error } = await supabase
    .from('views')
    .select('*')
    .eq('id', pageId)
    .eq('type', 'interface')
    .single()

  if (error || !data) {
    return null
  }

  // Convert view to Page format
  return {
    id: data.id,
    name: data.name,
    description: data.description || undefined,
    settings: (data.config as any)?.settings || {
      access: data.access_level || 'authenticated',
      layout: { cols: 12, rowHeight: 30, margin: [10, 10] },
    },
    created_at: data.created_at,
    updated_at: data.updated_at,
    created_by: data.owner_id,
  } as Page
}

export async function loadPageBlocks(pageId: string): Promise<PageBlock[]> {
  const supabase = await createClient()

  // Load from view_blocks table
  const { data, error } = await supabase
    .from('view_blocks')
    .select('*')
    .eq('view_id', pageId)
    .order('order_index', { ascending: true })

  if (error) {
    console.error('Error loading page blocks:', error)
    return []
  }

  // Convert view_blocks to PageBlock format
  return (data || []).map((block: any) => ({
    id: block.id,
    page_id: block.view_id, // Map view_id to page_id for compatibility
    type: block.type,
    x: block.position_x,
    y: block.position_y,
    w: block.width,
    h: block.height,
    config: block.config || {},
    order_index: block.order_index,
    created_at: block.created_at,
    updated_at: block.updated_at,
  })) as PageBlock[]
}

export async function loadPageWithBlocks(pageId: string): Promise<{
  page: Page | null
  blocks: PageBlock[]
}> {
  const [page, blocks] = await Promise.all([
    loadPage(pageId),
    loadPageBlocks(pageId),
  ])

  return { page, blocks }
}
