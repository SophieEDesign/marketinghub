import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadPage } from '@/lib/pages/loadPage'

/**
 * GET /api/pages/[pageId] - Get a page
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { pageId: string } }
) {
  try {
    const page = await loadPage(params.pageId)

    if (!page) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ page })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to load page' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/pages/[pageId] - Update page
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { pageId: string } }
) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { name, description, settings } = body

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (settings !== undefined) updates.settings = settings

    const { data, error } = await supabase
      .from('pages')
      .update(updates)
      .eq('id', params.pageId)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ page: data })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update page' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/pages/[pageId] - Delete page
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { pageId: string } }
) {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('pages')
      .delete()
      .eq('id', params.pageId)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete page' },
      { status: 500 }
    )
  }
}
