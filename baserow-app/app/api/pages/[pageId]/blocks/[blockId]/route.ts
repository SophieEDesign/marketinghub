import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deleteBlock } from '@/lib/pages/saveBlocks'

/**
 * DELETE /api/pages/[pageId]/blocks/[blockId] - Delete a block
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string; blockId: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { blockId } = await params
    await deleteBlock(blockId)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const errorMessage = (error as { message?: string })?.message || 'Failed to delete block'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
