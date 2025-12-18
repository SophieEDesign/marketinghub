import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { saveBlockLayout, createBlock, deleteBlock } from '@/lib/pages/saveBlocks'
import type { LayoutItem, PageBlock } from '@/lib/interface/types'

/**
 * GET /api/pages/[pageId]/blocks - Load blocks for a page
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { pageId: string } }
) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('page_blocks')
      .select('*')
      .eq('page_id', params.pageId)
      .order('order_index', { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ blocks: data || [] })
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
  { params }: { params: { pageId: string } }
) {
  try {
    const body = await request.json()
    const { layout, blockUpdates } = body

    // Save layout if provided
    if (layout && Array.isArray(layout)) {
      await saveBlockLayout(params.pageId, layout as LayoutItem[])
    }

    // Update individual blocks if provided
    if (blockUpdates && Array.isArray(blockUpdates)) {
      const supabase = await createClient()
      
      await Promise.all(
        blockUpdates.map((update: { id: string; config?: any }) =>
          supabase
            .from('page_blocks')
            .update({
              config: update.config,
              updated_at: new Date().toISOString(),
            })
            .eq('id', update.id)
        )
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
  { params }: { params: { pageId: string } }
) {
  try {
    const body = await request.json()
    const { type, x, y, w, h, config } = body

    if (!type) {
      return NextResponse.json(
        { error: 'Block type is required' },
        { status: 400 }
      )
    }

    const block = await createBlock(
      params.pageId,
      type,
      x || 0,
      y || 0,
      w || 4,
      h || 4,
      config || {}
    )

    return NextResponse.json({ block })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create block' },
      { status: 500 }
    )
  }
}

