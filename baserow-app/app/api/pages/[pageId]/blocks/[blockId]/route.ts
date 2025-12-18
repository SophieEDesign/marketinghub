import { NextRequest, NextResponse } from 'next/server'
import { deleteBlock } from '@/lib/pages/saveBlocks'

/**
 * DELETE /api/pages/[pageId]/blocks/[blockId] - Delete a block
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { pageId: string; blockId: string } }
) {
  try {
    await deleteBlock(params.blockId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete block' },
      { status: 500 }
    )
  }
}
