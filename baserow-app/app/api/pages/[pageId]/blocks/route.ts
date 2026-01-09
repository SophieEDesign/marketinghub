import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { saveBlockLayout, createBlock, deleteBlock } from '@/lib/pages/saveBlocks'
import { normalizeBlockConfig } from '@/lib/interface/block-validator'
import { validateBlockConfig } from '@/lib/interface/block-config-types'
import type { LayoutItem, PageBlock, BlockType } from '@/lib/interface/types'
import { dbBlockToPageBlock } from '@/lib/interface/layout-mapping'
import { debugLog, debugWarn } from '@/lib/interface/debug-flags'

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

    // CRITICAL FIX: Query blocks where EITHER page_id OR view_id matches
    // This handles:
    // 1. Blocks with page_id set (new interface_pages system)
    // 2. Blocks with view_id set (legacy views system)
    // 3. Blocks that might have been migrated or created in different contexts
    // 
    // CRITICAL: Do NOT filter by status - public and edit must load the same blocks
    // Only filter by:
    // - is_archived = false (exclude archived blocks)
    // - page_id = pageId OR view_id = pageId
    // Order by: order_index, then position_y, then position_x
    // 
    // We use .or() to match either column, preventing silent filtering failures
    const { data, error } = await supabase
      .from('view_blocks')
      .select('*')
      .or(`page_id.eq.${pageId},view_id.eq.${pageId}`)
      .eq('is_archived', false) // CRITICAL: Only exclude archived blocks, not by status
      .order('order_index', { ascending: true })
      .order('position_y', { ascending: true })
      .order('position_x', { ascending: true })

    // CRITICAL: Log query results for debugging
    console.log(`[API GET /blocks] pageId=${pageId}`, {
      queryType: 'page_id OR view_id (both checked)',
      dbRowCount: data?.length || 0,
      blockIds: data?.map((b: any) => b.id) || [],
      blocksWithPageId: data?.filter((b: any) => b.page_id === pageId).length || 0,
      blocksWithViewId: data?.filter((b: any) => b.view_id === pageId).length || 0,
      error: error?.message,
    })

    if (error) {
      console.error(`[API GET /blocks] ERROR: pageId=${pageId}`, {
        error: error.message,
        errorCode: error.code,
        queryType: 'page_id OR view_id',
      })
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    // Convert view_blocks to PageBlock format
    // CRITICAL: Use unified mapping function (no defaults, no guessing)
    const blocks = (data || []).map((block: any) => {
      // DEBUG_LAYOUT: Log loaded layout from DB (server-side, always logs in dev)
      if (process.env.NODE_ENV === 'development') {
        debugLog('LAYOUT', 'Block FROM DB', {
          blockId: block.id,
          fromDB: {
            position_x: block.position_x,
            position_y: block.position_y,
            width: block.width,
            height: block.height,
          },
        })
      }

      // CRITICAL: Use unified mapping - throws if corrupted, returns null if new block
      const layout = dbBlockToPageBlock({
        id: block.id,
        position_x: block.position_x,
        position_y: block.position_y,
        width: block.width,
        height: block.height,
      })

      // If layout is null (new block), use defaults BUT log warning
      if (!layout) {
        if (process.env.NODE_ENV === 'development') {
          debugWarn('LAYOUT', `Block ${block.id}: New block (no layout) - using defaults`, {
            blockId: block.id,
            defaults: { x: 0, y: 0, w: 4, h: 4 },
          })
        }
      }

      return {
        id: block.id,
        page_id: block.page_id || block.view_id,
        type: block.type,
        // CRITICAL: Use mapped layout if available, otherwise defaults (new block)
        x: layout?.x ?? 0,
        y: layout?.y ?? 0,
        w: layout?.w ?? 4,
        h: layout?.h ?? 4,
        config: block.config || {},
        order_index: block.order_index ?? 0,
        created_at: block.created_at,
        updated_at: block.updated_at,
      }
    })

    // CRITICAL: Log final response for debugging
    console.log(`[API GET /blocks] RESPONSE: pageId=${pageId}`, {
      queryType: 'page_id OR view_id (both checked)',
      dbRowCount: data?.length || 0,
      blocksCount: blocks.length,
      blockIds: blocks.map(b => b.id),
      blocks: blocks.length > 0 ? blocks : 'EMPTY ARRAY',
      responseBody: { blocks },
    })

    // CRITICAL: Disable caching to prevent stale data
    // Add cache-busting headers to ensure fresh data on every request
    return NextResponse.json(
      { blocks },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    )
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
      // DEBUG_LAYOUT: Log layout save (server-side, always logs in dev)
      if (process.env.NODE_ENV === 'development') {
        debugLog('LAYOUT', 'API RECEIVED', {
          pageId,
          layoutCount: layout.length,
          layoutItems: layout.map((item: LayoutItem) => ({
            id: item.i,
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
            // Map to DB columns
            position_x: item.x,
            position_y: item.y,
            width: item.w,
            height: item.h,
          })),
        })
      }

      await saveBlockLayout(pageId, layout as LayoutItem[])

      // DEBUG_LAYOUT: Verify save completed
      if (process.env.NODE_ENV === 'development') {
        debugLog('LAYOUT', 'API COMPLETED', {
          pageId,
          layoutCount: layout.length,
          timestamp: new Date().toISOString(),
        })
      }
    }

    // Update individual blocks if provided
    const updatedBlocks: PageBlock[] = []
    if (blockUpdates && Array.isArray(blockUpdates)) {
      const supabase = await createClient()
      
      await Promise.all(
        blockUpdates.map(async (update: { id: string; config?: any }) => {
          // Get current block to determine type
          const { data: currentBlock } = await supabase
            .from('view_blocks')
            .select('type, config, position_x, position_y, width, height, order_index, page_id, view_id, created_at, updated_at')
            .eq('id', update.id)
            .single()

          if (!currentBlock) {
            throw new Error(`Block ${update.id} not found`)
          }

          // DEBUG_TEXT: Log received content_json (server-side, always logs in dev)
          if (process.env.NODE_ENV === 'development' && update.config?.content_json) {
            // Note: DEBUG_TEXT flag is client-side only, but we log in dev mode
            console.log(`[DEBUG TEXT] Block ${update.id}: RECEIVED`, {
              blockId: update.id,
              receivedConfig: update.config,
              receivedContentJson: update.config.content_json,
              currentBlockConfig: currentBlock.config,
              currentContentJson: currentBlock.config?.content_json,
            })
          }

          // Use the provided config - SettingsPanel always passes full config
          // Merge with existing to handle any edge cases, but new config takes precedence
          // CRITICAL: This merge ensures partial updates (like content_json) are preserved
          const configToNormalize = {
            ...(currentBlock.config || {}),
            ...(update.config || {}),
          }

          // DEBUG_TEXT: Log before normalization
          if (process.env.NODE_ENV === 'development' && update.config?.content_json) {
            console.log(`[DEBUG TEXT] Block ${update.id}: BEFORE NORMALIZE`, {
              blockId: update.id,
              configToNormalize,
              contentJsonBeforeNormalize: configToNormalize.content_json,
            })
          }

          // Validate and normalize config
          // CRITICAL: normalizeBlockConfig now preserves content_json for text blocks
          const normalizedConfig = normalizeBlockConfig(
            currentBlock.type as BlockType,
            configToNormalize
          )

          // DEBUG_TEXT: Log after normalization
          if (process.env.NODE_ENV === 'development' && update.config?.content_json) {
            console.log(`[DEBUG TEXT] Block ${update.id}: AFTER NORMALIZE`, {
              blockId: update.id,
              normalizedConfig,
              contentJsonAfterNormalize: normalizedConfig.content_json,
              preserved: JSON.stringify(normalizedConfig.content_json) === JSON.stringify(configToNormalize.content_json),
            })
          }

          // Validate config (warn but don't fail - use normalized config)
          const validation = validateBlockConfig(currentBlock.type as BlockType, normalizedConfig)
          if (!validation.valid) {
            console.warn(`Block ${update.id} config validation warnings:`, validation.errors)
          }

          // CRITICAL: When updating block config, preserve layout columns (position_x, position_y, width, height)
          // Get current layout values to preserve them
          const { data: currentBlockData } = await supabase
            .from('view_blocks')
            .select('position_x, position_y, width, height')
            .eq('id', update.id)
            .single()
          
          // Execute the update query - preserve layout columns
          const { data: updatedBlock, error } = await supabase
            .from('view_blocks')
            .update({
              config: normalizedConfig,
              // CRITICAL: Preserve layout columns - don't overwrite with null
              position_x: currentBlockData?.position_x ?? undefined,
              position_y: currentBlockData?.position_y ?? undefined,
              width: currentBlockData?.width ?? undefined,
              height: currentBlockData?.height ?? undefined,
              updated_at: new Date().toISOString(),
            })
            .eq('id', update.id)
            .select('*')
            .single()
          
          if (error) {
            throw new Error(`Failed to update block ${update.id}: ${error.message}`)
          }

          if (!updatedBlock) {
            throw new Error(`Block ${update.id} update succeeded but no data returned`)
          }

          // DEBUG_TEXT: Log persisted data from DB
          if (process.env.NODE_ENV === 'development' && update.config?.content_json) {
            console.log(`[DEBUG TEXT] Block ${update.id}: PERSISTED`, {
              blockId: update.id,
              updatedBlockFromDB: updatedBlock,
              persistedConfig: updatedBlock.config,
              persistedContentJson: updatedBlock.config?.content_json,
              matchesSent: JSON.stringify(updatedBlock.config?.content_json) === JSON.stringify(update.config.content_json),
            })
          }

          // Convert to PageBlock format and add to results
          updatedBlocks.push({
            id: updatedBlock.id,
            page_id: updatedBlock.page_id || updatedBlock.view_id,
            type: updatedBlock.type,
            x: updatedBlock.position_x ?? 0,
            y: updatedBlock.position_y ?? 0,
            w: updatedBlock.width ?? 4,
            h: updatedBlock.height ?? 4,
            config: updatedBlock.config || {},
            order_index: updatedBlock.order_index ?? 0,
            created_at: updatedBlock.created_at,
            updated_at: updatedBlock.updated_at,
          })
        })
      )
    }

    return NextResponse.json({ 
      success: true,
      blocks: updatedBlocks.length > 0 ? updatedBlocks : undefined
    })
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
