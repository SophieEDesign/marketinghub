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
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('views')
      .select('*')
      .eq('id', params.pageId)
      .eq('type', 'interface')
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      )
    }

    // Convert view to Page format with all fields
    const page = {
      id: data.id,
      name: data.name,
      description: data.description || undefined,
      settings: (data.config as any)?.settings || {
        access: data.access_level || 'authenticated',
        layout: { cols: 12, rowHeight: 30, margin: [10, 10] },
      },
      created_at: data.created_at,
      updated_at: data.updated_at,
      created_by: data.owner_id,
      is_admin_only: data.is_admin_only || false,
      group_id: data.group_id || null,
      default_view: data.default_view || null,
      hide_view_switcher: data.hide_view_switcher || false,
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
    const { name, description, settings, is_admin_only, group_id, default_view, hide_view_switcher } = body

    // Get existing view to preserve config
    const { data: existing } = await supabase
      .from('views')
      .select('config')
      .eq('id', params.pageId)
      .eq('type', 'interface')
      .single()

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (is_admin_only !== undefined) updates.is_admin_only = is_admin_only
    if (group_id !== undefined) updates.group_id = group_id || null
    if (default_view !== undefined) updates.default_view = default_view || null
    if (hide_view_switcher !== undefined) updates.hide_view_switcher = hide_view_switcher
    if (settings !== undefined) {
      // Merge settings into existing config
      const existingConfig = (existing?.config as any) || {}
      updates.config = {
        ...existingConfig,
        settings: {
          ...existingConfig.settings,
          ...settings,
        },
      }
    }

    const { data, error } = await supabase
      .from('views')
      .update(updates)
      .eq('id', params.pageId)
      .eq('type', 'interface')
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    // Convert view to Page format
    const page = {
      id: data.id,
      name: data.name,
      description: data.description || undefined,
      settings: (data.config as any)?.settings || {
        access: data.access_level || 'authenticated',
        layout: { cols: 12, rowHeight: 30, margin: [10, 10] },
      },
      created_at: data.created_at,
      updated_at: data.updated_at,
      created_by: data.owner_id,
      is_admin_only: data.is_admin_only || false,
      group_id: data.group_id || null,
      default_view: data.default_view || null,
      hide_view_switcher: data.hide_view_switcher || false,
    }

    return NextResponse.json({ page })
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
      .from('views')
      .delete()
      .eq('id', params.pageId)
      .eq('type', 'interface')

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
