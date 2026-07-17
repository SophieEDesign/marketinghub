import { NextRequest, NextResponse } from 'next/server'
import { logActivity, getActivityLog } from '@/lib/versioning/versioning'

/**
 * POST /api/versioning/activity - Log an activity
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      entity_type,
      entity_id,
      action,
      metadata,
      related_entity_type,
      related_entity_id,
    } = body

    if (!entity_type || !entity_id || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: entity_type, entity_id, action' },
        { status: 400 }
      )
    }

    const activity = await logActivity(
      entity_type,
      entity_id,
      action,
      metadata || {},
      related_entity_type,
      related_entity_id
    )
    return NextResponse.json(activity)
  } catch (error: any) {
    console.error('Error logging activity:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to log activity' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/versioning/activity - Get activity log for an entity
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const entity_type = searchParams.get('entity_type')
    const entity_id = searchParams.get('entity_id')
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50

    if (!entity_type || !entity_id) {
      return NextResponse.json(
        { error: 'Missing required query params: entity_type, entity_id' },
        { status: 400 }
      )
    }

    const activities = await getActivityLog(entity_type as any, entity_id, limit)
    return NextResponse.json(activities)
  } catch (error: any) {
    console.error('Error getting activity log:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get activity log' },
      { status: 500 }
    )
  }
}

