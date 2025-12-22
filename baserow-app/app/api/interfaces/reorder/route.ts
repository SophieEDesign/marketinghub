import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/interfaces/reorder - Reorder interfaces within or between groups
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { interfaceUpdates } = body // Array of { id, group_id, order_index }

    if (!Array.isArray(interfaceUpdates)) {
      return NextResponse.json(
        { error: 'interfaceUpdates must be an array' },
        { status: 400 }
      )
    }

    // Update each interface's group_id and order_index
    await Promise.all(
      interfaceUpdates.map((update: { id: string; group_id: string | null; order_index: number }) =>
        supabase
          .from('views')
          .update({
            group_id: update.group_id,
            order_index: update.order_index,
          })
          .eq('id', update.id)
          .eq('type', 'interface')
      )
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to reorder interfaces' },
      { status: 500 }
    )
  }
}
