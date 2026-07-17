import { NextRequest, NextResponse } from 'next/server'
import { createVersion, getVersions } from '@/lib/versioning/versioning'

/**
 * POST /api/versioning/versions - Create a new version
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { entity_type, entity_id, snapshot, reason } = body

    if (!entity_type || !entity_id || !snapshot) {
      return NextResponse.json(
        { error: 'Missing required fields: entity_type, entity_id, snapshot' },
        { status: 400 }
      )
    }

    const version = await createVersion(entity_type, entity_id, snapshot, reason)
    return NextResponse.json(version)
  } catch (error: any) {
    console.error('Error creating version:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create version' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/versioning/versions - Get versions for an entity
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const entity_type = searchParams.get('entity_type')
    const entity_id = searchParams.get('entity_id')
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined

    if (!entity_type || !entity_id) {
      return NextResponse.json(
        { error: 'Missing required query params: entity_type, entity_id' },
        { status: 400 }
      )
    }

    const versions = await getVersions(entity_type as any, entity_id, limit)
    return NextResponse.json(versions)
  } catch (error: any) {
    console.error('Error getting versions:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get versions' },
      { status: 500 }
    )
  }
}

