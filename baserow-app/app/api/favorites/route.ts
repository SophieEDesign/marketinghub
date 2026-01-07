import { NextRequest, NextResponse } from 'next/server'
import { addFavorite, removeFavorite, getFavorites } from '@/lib/recents/recents'
import { createErrorResponse } from '@/lib/api/error-handling'
import { cachedJsonResponse, CACHE_DURATIONS } from '@/lib/api/cache-headers'

/**
 * POST /api/favorites - Add a favorite
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

    const favorite = await addFavorite(entity_type, entity_id)
    return NextResponse.json(favorite)
  } catch (error: any) {
    const errorResponse = createErrorResponse(error, 'Failed to add favorite', 500)
    return NextResponse.json(errorResponse, { status: 500 })
  }
}

/**
 * DELETE /api/favorites - Remove a favorite
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { entity_type, entity_id } = body

    if (!entity_type || !entity_id) {
      return NextResponse.json(
        { error: 'Missing required fields: entity_type, entity_id' },
        { status: 400 }
      )
    }

    await removeFavorite(entity_type, entity_id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    const errorResponse = createErrorResponse(error, 'Failed to remove favorite', 500)
    return NextResponse.json(errorResponse, { status: 500 })
  }
}

/**
 * GET /api/favorites - Get favorites
 * Cached for 1 minute with stale-while-revalidate
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50
    const entity_type = searchParams.get('entity_type') as any

    const items = await getFavorites(limit, entity_type)
    // Cache favorites for 1 minute (they change infrequently)
    return cachedJsonResponse(
      { items },
      CACHE_DURATIONS.SHORT,
      CACHE_DURATIONS.SHORT
    )
  } catch (error: any) {
    const errorResponse = createErrorResponse(error, 'Failed to get favorites', 500)
    return NextResponse.json(errorResponse, { status: 500 })
  }
}

