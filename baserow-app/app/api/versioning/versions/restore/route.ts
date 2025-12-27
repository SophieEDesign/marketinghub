import { NextRequest, NextResponse } from 'next/server'
import { restoreVersion } from '@/lib/versioning/versioning'

/**
 * POST /api/versioning/versions/restore - Restore an entity to a specific version
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { entity_type, entity_id, version_number } = body

    if (!entity_type || !entity_id || version_number === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: entity_type, entity_id, version_number' },
        { status: 400 }
      )
    }

    const version = await restoreVersion(entity_type, entity_id, version_number)
    return NextResponse.json(version)
  } catch (error: any) {
    console.error('Error restoring version:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to restore version' },
      { status: 500 }
    )
  }
}

