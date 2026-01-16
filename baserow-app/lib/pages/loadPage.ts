import { createClient } from '@/lib/supabase/server'
import type { Page, PageBlock } from '@/lib/interface/types'

export async function loadPage(pageId: string, supabase?: any): Promise<Page | null> {
  const client = supabase ?? (await createClient())

  // Load from views table where type='interface'
  const { data, error } = await client
    .from('views')
    // Avoid over-fetching large configs / columns we never use during render.
    .select(
      [
        'id',
        'name',
        'description',
        'config',
        'access_level',
        'created_at',
        'updated_at',
        'owner_id',
        'is_admin_only',
        'group_id',
        'default_view',
        'hide_view_switcher',
        'type',
      ].join(',')
    )
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
    is_admin_only: data.is_admin_only ?? true,
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
 * 
 * CRITICAL: Mirrors the logic in GET /api/pages/[pageId]/blocks
 * - Checks if pageId belongs to interface_pages (uses page_id)
 * - Otherwise assumes views.id (uses view_id)
 * - Ensures save/load symmetry
 */
export async function loadPageBlocks(pageId: string, supabase?: any): Promise<PageBlock[]> {
  const client = supabase ?? (await createClient())

  // Mirror GET /api/pages/[pageId]/blocks: match either page_id OR view_id.
  // This avoids an extra roundtrip (interface_pages probe) on every page load.
  const query = client
    .from('view_blocks')
    .select(
      [
        'id',
        'page_id',
        'view_id',
        'type',
        'position_x',
        'position_y',
        'width',
        'height',
        'config',
        'order_index',
        'created_at',
        'updated_at',
      ].join(',')
    )
    .or(`page_id.eq.${pageId},view_id.eq.${pageId}`)
    .eq('is_archived', false) // CRITICAL: Only exclude archived blocks, not by status

  // CRITICAL: Order by order_index, then position_y, then position_x
  // This ensures consistent ordering for public and edit view
  const { data, error } = await query
    .order('order_index', { ascending: true })
    .order('position_y', { ascending: true })
    .order('position_x', { ascending: true })

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
    page_id: block.page_id || block.view_id, // Use page_id if available, fallback to view_id
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
  // Reuse one Supabase client (cookies read + client creation are non-trivial).
  const supabase = await createClient()
  const [page, blocks] = await Promise.all([
    loadPage(pageId, supabase),
    loadPageBlocks(pageId, supabase),
  ])

  return { page, blocks }
}
