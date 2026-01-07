import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { saveBlockLayout, createBlock, deleteBlock } from '@/lib/pages/saveBlocks'
import { normalizeBlockConfig } from '@/lib/interface/block-validator'
import { validateBlockConfig } from '@/lib/interface/block-config-types'
import type { LayoutItem, PageBlock, BlockType } from '@/lib/interface/types'

/**
 * GET /api/pages/[pageId]/blocks - Load blocks for a page
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { pageId } = await params
    const supabase = await createClient()

    // Check if this is an interface_pages.id or views.id
    // Try interface_pages first (new system)
    const { data: page } = await supabase
      .from('interface_pages')
      .select('id')
      .eq('id', pageId)
      .maybeSingle()

    let query
    if (page) {
      // This is an interface_pages.id - use page_id
      query = supabase
        .from('view_blocks')
        .select('*')
        .eq('page_id', pageId)
    } else {
      // This is a views.id - use view_id (backward compatibility)
      query = supabase
        .from('view_blocks')
        .select('*')
        .eq('view_id', pageId)
    }

    const { data, error } = await query.order('order_index', { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    // Convert view_blocks to PageBlock format
    const blocks = (data || []).map((block: any) => ({
      id: block.id,
      page_id: block.page_id || block.view_id, // Use page_id if available, fallback to view_id
      type: block.type,
      x: block.position_x,
      y: block.position_y,
      w: block.width,
      h: block.height,
      config: block.config || {},
      order_index: block.order_index,
      created_at: block.created_at,
      updated_at: block.updated_at,
    }))

    return NextResponse.json({ blocks })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to load blocks' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/pages/[pageId]/blocks - Save layout or update blocks
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { pageId } = await params
    const body = await request.json()
    const { layout, blockUpdates } = body

    // Save layout if provided
    if (layout && Array.isArray(layout)) {
      await saveBlockLayout(pageId, layout as LayoutItem[])
    }

    // Update individual blocks if provided
    if (blockUpdates && Array.isArray(blockUpdates)) {
      const supabase = await createClient()
      
      await Promise.all(
        blockUpdates.map(async (update: { id: string; config?: any }) => {
          // Get current block to determine type
          const { data: currentBlock } = await supabase
            .from('view_blocks')
            .select('type, config')
            .eq('id', update.id)
            .single()

          if (!currentBlock) {
            throw new Error(`Block ${update.id} not found`)
          }

          // Use the provided config - SettingsPanel always passes full config
          // Merge with existing to handle any edge cases, but new config takes precedence
          const configToNormalize = {
            ...(currentBlock.config || {}),
            ...(update.config || {}),
          }

          // Validate and normalize config
          const normalizedConfig = normalizeBlockConfig(
            currentBlock.type as BlockType,
            configToNormalize
          )

          // Validate config (warn but don't fail - use normalized config)
          const validation = validateBlockConfig(currentBlock.type as BlockType, normalizedConfig)
          if (!validation.valid) {
            console.warn(`Block ${update.id} config validation warnings:`, validation.errors)
          }

          return supabase
            .from('view_blocks')
            .update({
              config: normalizedConfig,
              updated_at: new Date().toISOString(),
            })
            .eq('id', update.id)
        })
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to save blocks' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/pages/[pageId]/blocks - Create a new block
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { pageId } = await params
    const body = await request.json()
    const { type, x, y, w, h, config } = body

    if (!type) {
      return NextResponse.json(
        { error: 'Block type is required' },
        { status: 400 }
      )
    }

    // Validate and normalize config before creating block
    const normalizedConfig = normalizeBlockConfig(type as BlockType, config || {})
    
    const block = await createBlock(
      pageId,
      type,
      x || 0,
      y || 0,
      w || 4,
      h || 4,
      normalizedConfig
    )

    if (!block || !block.id) {
      return NextResponse.json(
        { error: 'Failed to create block: No block returned' },
        { status: 500 }
      )
    }

    // createBlock already returns a PageBlock, so we can return it directly
    return NextResponse.json({ block })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create block' },
      { status: 500 }
    )
  }
}
