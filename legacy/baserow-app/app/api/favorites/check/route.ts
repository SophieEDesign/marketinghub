import { NextRequest, NextResponse } from 'next/server'
import { isFavorited } from '@/lib/recents/recents'

/**
 * GET /api/favorites/check - Check if an item is favorited
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const entity_type = searchParams.get('entity_type')
    const entity_id = searchParams.get('entity_id')

    if (!entity_type || !entity_id) {
      return NextResponse.json(
        { error: 'Missing required query params: entity_type, entity_id' },
        { status: 400 }
      )
    }

    const favorited = await isFavorited(entity_type as any, entity_id)
    return NextResponse.json({ favorited })
  } catch (error: any) {
    console.error('Error checking favorite:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check favorite' },
      { status: 500 }
    )
  }
}

