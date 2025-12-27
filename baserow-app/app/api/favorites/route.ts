import { NextRequest, NextResponse } from 'next/server'
import { addFavorite, removeFavorite, getFavorites, isFavorited } from '@/lib/recents/recents'

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
    console.error('Error adding favorite:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to add favorite' },
      { status: 500 }
    )
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
    console.error('Error removing favorite:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to remove favorite' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/favorites - Get favorites
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50
    const entity_type = searchParams.get('entity_type') as any

    const items = await getFavorites(limit, entity_type)
    return NextResponse.json({ items })
  } catch (error: any) {
    console.error('Error getting favorites:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get favorites' },
      { status: 500 }
    )
  }
}

