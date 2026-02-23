import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/blocks/[blockId]/field-layout-versions
 * List previous field_layout versions for a block (for restore UI)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ blockId: string }> }
) {
  try {
    const { blockId } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('field_layout_versions')
      .select('id, layout_json, created_at, created_by')
      .eq('entity_type', 'block')
      .eq('entity_id', blockId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ versions: data ?? [] })
  } catch (error: unknown) {
    const message = (error as { message?: string })?.message || 'Failed to load versions'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
