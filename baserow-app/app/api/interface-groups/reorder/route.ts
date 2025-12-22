import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/interface-groups/reorder - Reorder interface groups
 */
export async function POST(request: NextRequest) {
  try {
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

    await Promise.all(
      updates.map(({ id, order_index }) =>
        supabase
          .from('interface_groups')
          .update({ order_index })
          .eq('id', id)
      )
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to reorder interface groups' },
      { status: 500 }
    )
  }
}
