import { NextRequest, NextResponse } from 'next/server'
import { recordRecentItem, getRecentItems } from '@/lib/recents/recents'

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
  } catch (error: any) {
    console.error('Error recording recent item:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to record recent item' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/recents - Get recent items
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10
    const entity_type = searchParams.get('entity_type') as any

    const items = await getRecentItems(limit, entity_type)
    return NextResponse.json({ items })
  } catch (error: any) {
    console.error('Error getting recent items:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get recent items' },
      { status: 500 }
    )
  }
}

