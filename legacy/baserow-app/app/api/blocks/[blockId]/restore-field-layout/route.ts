import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/blocks/[blockId]/restore-field-layout
 * Restore a previous field_layout version to the block
 * Body: { versionId: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ blockId: string }> }
) {
  try {
    const { blockId } = await params
    const body = await request.json()
    const { versionId } = body

    if (!versionId || typeof versionId !== 'string') {
      return NextResponse.json(
        { error: 'versionId is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Fetch the version
    const { data: version, error: versionError } = await supabase
      .from('field_layout_versions')
      .select('layout_json')
      .eq('id', versionId)
      .eq('entity_type', 'block')
      .eq('entity_id', blockId)
      .single()

    if (versionError || !version) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      )
    }

    // Get current block config
    const { data: block, error: blockError } = await supabase
      .from('view_blocks')
      .select('config')
      .eq('id', blockId)
      .single()

    if (blockError || !block) {
      return NextResponse.json(
        { error: 'Block not found' },
        { status: 404 }
      )
    }

    // Merge restored field_layout into config
    const updatedConfig = {
      ...(block.config || {}),
      field_layout: version.layout_json,
    }

    const { error: updateError } = await supabase
      .from('view_blocks')
      .update({
        config: updatedConfig,
        updated_at: new Date().toISOString(),
      })
      .eq('id', blockId)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      field_layout: version.layout_json,
    })
  } catch (error: unknown) {
    const message = (error as { message?: string })?.message || 'Failed to restore layout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
