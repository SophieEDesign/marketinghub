import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/roles'
import { updateWorkspaceSettings } from '@/lib/branding'

/**
 * GET /api/workspace-settings - Get workspace settings
 * Public endpoint - allows unauthenticated access for login page branding
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: settings, error } = await supabase
      .from('workspace_settings')
      .select('brand_name, logo_url, primary_color, accent_color, sidebar_color, sidebar_text_color')
      .maybeSingle()

    if (error) {
      // If table doesn't exist, return null (graceful degradation)
      if (error.code === 'PGRST116' || 
          error.message?.includes('relation') || 
          error.message?.includes('does not exist')) {
        return NextResponse.json({ settings: null })
      }
      // If RLS blocks access, return null (user needs to run migration)
      if (error.code === '42501' || error.message?.includes('permission denied')) {
        console.warn('RLS policy may need update. Run migration: allow_anonymous_branding_read.sql')
        return NextResponse.json({ settings: null })
      }
      console.warn('Error loading workspace settings:', error)
      return NextResponse.json({ settings: null })
    }

    return NextResponse.json({ settings })
  } catch (error: any) {
    console.error('Error loading workspace settings:', error)
    // Return null instead of error for graceful degradation
    return NextResponse.json({ settings: null })
  }
}

/**
 * POST /api/workspace-settings - Update workspace settings (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Security check: Only admins can update settings
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { brand_name, logo_url, primary_color, accent_color, sidebar_color, sidebar_text_color } = body

    const settings = await updateWorkspaceSettings({
      brand_name: brand_name || null,
      logo_url: logo_url || null,
      primary_color: primary_color || null,
      accent_color: accent_color || null,
      sidebar_color: sidebar_color || null,
      sidebar_text_color: sidebar_text_color || null,
    })

    return NextResponse.json({ settings })
  } catch (error: any) {
    console.error('Error updating workspace settings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update workspace settings' },
      { status: 500 }
    )
  }
}
