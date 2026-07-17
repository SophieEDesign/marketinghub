import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH: Reorder fields by updating order_index
export async function PATCH(
  request: NextRequest,
  { params }: { params: { tableId: string } }
) {
  const supabase = await createClient()

  try {
    const body = await request.json()
    const { updates } = body

    if (!Array.isArray(updates)) {
      return NextResponse.json(
        { error: 'Updates must be an array' },
        { status: 400 }
      )
    }

    // Update each field's order_index
    for (const update of updates) {
      const { id, order_index } = update

      if (typeof id !== 'string' || typeof order_index !== 'number') {
        return NextResponse.json(
          { error: 'Each update must have id (string) and order_index (number)' },
          { status: 400 }
        )
      }

      const { error } = await supabase
        .from('table_fields')
        .update({ order_index })
        .eq('id', id)
        .eq('table_id', params.tableId)

      if (error) {
        console.error('Error updating field order:', error)
        return NextResponse.json(
          { error: `Failed to update field ${id}: ${error.message}` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error reordering fields:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to reorder fields' },
      { status: 500 }
    )
  }
}
