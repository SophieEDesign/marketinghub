/**
 * PHASE 4.1: Dev-only API endpoint to reset layout heights
 * 
 * This is a temporary dev utility to clear stale database heights.
 * Sets height to NULL for all blocks on a page, keeping x/y/w.
 * 
 * Usage: POST /api/pages/[pageId]/blocks/reset-heights
 * 
 * This clears:
 * - Stale DB heights
 * - Historic autofit artifacts
 * - Broken resize remnants
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development' },
      { status: 403 }
    )
  }

  try {
    const { pageId } = await params
    const supabase = await createClient()

    // Check if this is an interface_pages.id or views.id
    const { data: page } = await supabase
      .from('interface_pages')
      .select('id')
      .eq('id', pageId)
      .maybeSingle()

    const isInterfacePage = !!page

    // Build query to update all blocks for this page
    let query = supabase
      .from('view_blocks')
      .update({
        height: null, // Clear height - content will re-measure
        updated_at: new Date().toISOString(),
      })
      .select('id, position_x, position_y, width, height')

    // Filter by page_id or view_id
    if (isInterfacePage) {
      query = query.eq('page_id', pageId)
    } else {
      query = query.eq('view_id', pageId)
    }

    // Execute the update
    const { data, error } = await query

    if (error) {
      console.error('[reset-heights] Error:', error)
      return NextResponse.json(
        { error: `Failed to reset heights: ${error.message}` },
        { status: 500 }
      )
    }

    console.log(`[reset-heights] Reset heights for ${data?.length || 0} blocks on page ${pageId}`)

    return NextResponse.json({
      success: true,
      pageId,
      blocksUpdated: data?.length || 0,
      message: 'Heights reset. Blocks will re-measure from content.',
    })
  } catch (error: any) {
    console.error('[reset-heights] Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'Unexpected error' },
      { status: 500 }
    )
  }
}
