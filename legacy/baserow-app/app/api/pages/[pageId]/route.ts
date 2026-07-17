import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { forbiddenResponse, isPermissionDeniedError, requireAdmin } from '@/lib/api/authz'
import {
  buildClearLandingDefaultsUpdate,
  LANDING_DEFAULT_COLUMNS,
} from '@/lib/workspace-defaults'

interface PageConfigShape {
  settings?: {
    access?: string
    layout?: { cols: number; rowHeight: number; margin: [number, number] }
    primary_table_id?: string | null
    layout_template?: string | null
    icon?: string | null
  }
}

interface InterfacePageRow {
  id: string
  name: string
  description?: string | null
  config?: PageConfigShape
  base_table?: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  is_admin_only?: boolean
  group_id?: string | null
  is_hidden?: boolean
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
  is_hidden: boolean
}

const DEFAULT_LAYOUT = { cols: 12, rowHeight: 30, margin: [10, 10] as [number, number] }
const DEFAULT_ACCESS = 'authenticated'

/**
 * Convert interface_pages row to legacy Page payload shape.
 */
function convertRowToPage(data: InterfacePageRow): Page {
  const configSettings = data.config?.settings || {}
  
  return {
    id: data.id,
    name: data.name,
    description: data.description || undefined,
    settings: {
      ...configSettings,
      access: configSettings.access || DEFAULT_ACCESS,
      layout: configSettings.layout || DEFAULT_LAYOUT,
      primary_table_id: configSettings.primary_table_id ?? data.base_table ?? null,
      layout_template: configSettings.layout_template ?? null,
      icon: configSettings.icon ?? null,
    },
    created_at: data.created_at,
    updated_at: data.updated_at,
    created_by: data.created_by || '',
    is_admin_only: data.is_admin_only ?? true,
    group_id: data.group_id ?? null,
    default_view: null,
    hide_view_switcher: false,
    is_hidden: data.is_hidden ?? false,
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
      .from('interface_pages')
      .select('id, name, description, config, base_table, created_at, updated_at, created_by, is_admin_only, group_id, is_hidden')
      .eq('id', params.pageId)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      )
    }

    const page = convertRowToPage(data as InterfacePageRow)
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
    const { admin, response } = await requireAdmin()
    if (!admin && response) return response

    const supabase = await createClient()
    const body = await request.json()
    const {
      name, 
      description, 
      settings, 
      is_admin_only, 
      group_id, 
      is_hidden,
    } = body

    // Get existing interface page to preserve non-settings config
    const { data: existing, error: existingError } = await supabase
      .from('interface_pages')
      .select('config')
      .eq('id', params.pageId)
      .maybeSingle()

    if (existingError) {
      if (isPermissionDeniedError(existingError)) return forbiddenResponse()
      return NextResponse.json(
        { error: existingError.message || 'Failed to load page' },
        { status: 500 }
      )
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (is_admin_only !== undefined) updates.is_admin_only = is_admin_only
    if (group_id !== undefined) updates.group_id = group_id || null
    if (is_hidden !== undefined) updates.is_hidden = is_hidden
    
    if (settings !== undefined) {
      // Merge settings into existing config
      // IMPORTANT: Preserve ALL existing config properties (blocks, calendar config, etc.)
      // Only update the settings object, don't overwrite other config properties
      const existingConfig = (existing?.config as Record<string, unknown>) || {}
      updates.config = {
        ...existingConfig, // Preserve all existing config (blocks, calendar_date_field, etc.)
        settings: {
          ...(existingConfig.settings as Record<string, unknown> | undefined),
          ...settings,
        },
      }
    }

    const { data, error } = await supabase
      .from('interface_pages')
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

    const page = convertRowToPage(data as InterfacePageRow)
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
    const { admin, response } = await requireAdmin()
    if (!admin && response) return response

    // Clear default_interface_id if this page is the default
    // This is a best-effort operation - database constraints will handle cleanup
    try {
      const { data: workspaceSettings } = await supabase
        .from('workspace_settings')
        .select(`id, ${LANDING_DEFAULT_COLUMNS}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const clearUpdate = workspaceSettings
        ? buildClearLandingDefaultsUpdate(params.pageId, workspaceSettings)
        : null
      if (clearUpdate) {
        await supabase
          .from('workspace_settings')
          .update(clearUpdate)
          .eq('id', workspaceSettings!.id)
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
      .from('interface_pages')
      .update({
        is_archived: true,
        archived_at: new Date().toISOString(),
      })
      .eq('id', params.pageId)

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
