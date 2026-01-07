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
    is_admin_only: data.is_admin_only || false,
    group_id: data.group_id || null,
    default_view: data.default_view || null,
    hide_view_switcher: data.hide_view_switcher || false,
  } as Page & { group_id?: string | null; default_view?: string | null; hide_view_switcher?: boolean }
}

/**
 * Loads blocks with their saved layout positions from Supabase
 * 
 * Restores block positions from view_blocks table:
 * - position_x → x (grid X position)
 * - position_y → y (grid Y position)
 * - width → w (grid width)
 * - height → h (grid height)
 * 
 * These positions are used to hydrate react-grid-layout on page load.
 * Called by: Interface page component on initial render
 */
export async function loadPageBlocks(pageId: string): Promise<PageBlock[]> {
  const supabase = await createClient()

  // Load from view_blocks table - ordered by order_index to maintain display order
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
  // Maps database columns (position_x, position_y, width, height) to PageBlock (x, y, w, h)
  // CRITICAL: Use saved values from database, only fallback to defaults if null/undefined
  // This ensures saved layout is the single source of truth
  return (data || []).map((block: any) => ({
    id: block.id,
    page_id: block.view_id, // Map view_id to page_id for compatibility
    type: block.type,
    x: block.position_x ?? 0, // Restore saved X position, default to 0 if null
    y: block.position_y ?? 0, // Restore saved Y position, default to 0 if null
    w: block.width ?? 4,      // Restore saved width, default to 4 if null (matches DB default)
    h: block.height ?? 4,      // Restore saved height, default to 4 if null (matches DB default)
    config: block.config || {},
    order_index: block.order_index ?? 0,
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
