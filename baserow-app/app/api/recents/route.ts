import { NextRequest, NextResponse } from 'next/server'
import { recordRecentItem, getRecentItems } from '@/lib/recents/recents'
import { createErrorResponse } from '@/lib/api/error-handling'
import { cachedJsonResponse, CACHE_DURATIONS } from '@/lib/api/cache-headers'

/**
 * POST /api/recents - Record a recent item
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { entity_type, entity_id } = body

    if (!entity_type || !entity_id) {
      return NextResponse.json(
        { error: 'Missing required fields: entity_type, entity_id' },
        { status: 400 }
      )
    }

    await recordRecentItem(entity_type, entity_id)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const errorResponse = createErrorResponse(error, 'Failed to record recent item', 500)
    return NextResponse.json(errorResponse, { status: 500 })
  }
}

/**
 * GET /api/recents - Get recent items
 * Cached for 30 seconds (recents change frequently)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10
    const entity_type = searchParams.get('entity_type')

    const items = await getRecentItems(limit, entity_type)
    // Cache recents for 30 seconds (they change frequently)
    return cachedJsonResponse(
      { items },
      CACHE_DURATIONS.SHORT,
      CACHE_DURATIONS.SHORT
    )
  } catch (error: unknown) {
    const errorResponse = createErrorResponse(error, 'Failed to get recent items', 500)
    return NextResponse.json(errorResponse, { status: 500 })
  }
}

