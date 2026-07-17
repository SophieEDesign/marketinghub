import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { forbiddenResponse, isPermissionDeniedError, requireAdmin } from '@/lib/api/authz'

/**
 * POST /api/interface-groups/reorder - Reorder interface groups
 */
export async function POST(request: NextRequest) {
  try {
    const { admin, response } = await requireAdmin()
    if (!admin && response) return response
    const supabase = await createClient()
    const body = await request.json()
    const { groupIds } = body // Array of group IDs in new order

    if (!Array.isArray(groupIds)) {
      return NextResponse.json(
        { error: 'groupIds must be an array' },
        { status: 400 }
      )
    }

    // Update order_index for each group
    const updates = groupIds.map((groupId, index) => ({
      id: groupId,
      order_index: index,
    }))

    const results = await Promise.all(
      updates.map(({ id, order_index }) =>
        supabase
          .from('interface_groups')
          .update({ order_index })
          .eq('id', id)
      )
    )

    const denied = results.find((result) => isPermissionDeniedError(result.error as any))
    if (denied) return forbiddenResponse()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to reorder interface groups' },
      { status: 500 }
    )
  }
}
