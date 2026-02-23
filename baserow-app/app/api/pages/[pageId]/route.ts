import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ViewConfig {
  settings?: {
    access?: string
    layout?: { cols: number; rowHeight: number; margin: [number, number] }
    primary_table_id?: string | null
    layout_template?: string | null
    icon?: string | null
  }
}

interface ViewData {
  id: string
  name: string
  description?: string | null
  config?: ViewConfig
  access_level?: string
  table_id?: string | null
  created_at: string
  updated_at: string
  owner_id: string
  is_admin_only?: boolean
  group_id?: string | null
  default_view?: string | null
  hide_view_switcher?: boolean
}

interface Page {
  id: string
  name: string
  description?: string
  settings: {
    access: string
    layout: { cols: number; rowHeight: number; margin: [number, number] }
    primary_table_id: string | null
    layout_template: string | null
    icon: string | null
  }
  created_at: string
  updated_at: string
  created_by: string
  is_admin_only: boolean
  group_id: string | null
  default_view: string | null
  hide_view_switcher: boolean
}

const DEFAULT_LAYOUT = { cols: 12, rowHeight: 30, margin: [10, 10] as [number, number] }
const DEFAULT_ACCESS = 'authenticated'

/**
 * Convert a view record to Page format
 */
function convertViewToPage(data: ViewData): Page {
  const configSettings = data.config?.settings || {}
  
  return {
    id: data.id,
    name: data.name,
    description: data.description || undefined,
    settings: {
      ...configSettings,
      access: configSettings.access || data.access_level || DEFAULT_ACCESS,
      layout: configSettings.layout || DEFAULT_LAYOUT,
      primary_table_id: configSettings.primary_table_id ?? data.table_id ?? null,
      layout_template: configSettings.layout_template ?? null,
      icon: configSettings.icon ?? null,
    },
    created_at: data.created_at,
    updated_at: data.updated_at,
    created_by: data.owner_id,
    is_admin_only: data.is_admin_only ?? true,
    group_id: data.group_id ?? null,
    default_view: data.default_view ?? null,
    hide_view_switcher: data.hide_view_switcher ?? false,
  }
}

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

    const page = convertViewToPage(data as ViewData)
    return NextResponse.json({ page })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load page'
    return NextResponse.json(
      { error: message },
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
    const { 
      name, 
      description, 
      settings, 
      is_admin_only, 
      group_id, 
      default_view, 
      hide_view_switcher 
    } = body

    // Get existing view to preserve config
    const { data: existing } = await supabase
      .from('views')
      .select('config')
      .eq('id', params.pageId)
      .eq('type', 'interface')
      .single()

    const updates: Record<string, unknown> = {
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
      // IMPORTANT: Preserve ALL existing config properties (blocks, calendar config, etc.)
      // Only update the settings object, don't overwrite other config properties
      const existingConfig = (existing?.config as any) || {}
      updates.config = {
        ...existingConfig, // Preserve all existing config (blocks, calendar_date_field, etc.)
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

    const page = convertViewToPage(data as ViewData)
    return NextResponse.json({ page })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update page'
    return NextResponse.json(
      { error: message },
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

    // Clear default_interface_id if this page is the default
    // This is a best-effort operation - database constraints will handle cleanup
    try {
      const { data: workspaceSettings } = await supabase
        .from('workspace_settings')
        .select('id, default_interface_id')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (workspaceSettings?.default_interface_id === params.pageId) {
        await supabase
          .from('workspace_settings')
          .update({ default_interface_id: null })
          .eq('id', workspaceSettings.id)
      }
    } catch (settingsError) {
      // Silently ignore errors - column might not exist or RLS might block
      // The ON DELETE SET NULL constraint will handle it anyway
      const errorCode = (settingsError as { code?: string })?.code
      if (errorCode !== 'PGRST116' && errorCode !== '42P01') {
        console.warn('Could not clear default_interface_id:', settingsError)
      }
    }

    const { error } = await supabase
      .from('views')
      .update({
        is_archived: true,
        archived_at: new Date().toISOString(),
      })
      .eq('id', params.pageId)
      .eq('type', 'interface')

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete page'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
