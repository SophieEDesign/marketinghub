import { createClient } from './supabase/server'

/** Readable default for the fixed white Marketing Hub sidebar */
export const DEFAULT_LIGHT_SIDEBAR_TEXT_COLOR = '#4b5563'

function relativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

function luminanceFromHex(hex: string): number | null {
  const raw = hex.replace(/^#/, '').trim()
  if (raw.length === 3) {
    const r = parseInt(raw[0] + raw[0], 16)
    const g = parseInt(raw[1] + raw[1], 16)
    const b = parseInt(raw[2] + raw[2], 16)
    if ([r, g, b].some((n) => Number.isNaN(n))) return null
    return relativeLuminance(r, g, b)
  }
  if (raw.length === 6) {
    const r = parseInt(raw.slice(0, 2), 16)
    const g = parseInt(raw.slice(2, 4), 16)
    const b = parseInt(raw.slice(4, 6), 16)
    if ([r, g, b].some((n) => Number.isNaN(n))) return null
    return relativeLuminance(r, g, b)
  }
  return null
}

function luminanceFromCssColor(color: string): number | null {
  const trimmed = color.trim().toLowerCase()
  if (trimmed === 'white') return 1
  if (trimmed.startsWith('#')) return luminanceFromHex(trimmed)
  const rgb = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (rgb) {
    return relativeLuminance(Number(rgb[1]), Number(rgb[2]), Number(rgb[3]))
  }
  return null
}

/** Ensures sidebar link text stays readable on the white sidebar (ignores light branding values). */
export function normalizeSidebarTextColor(color: string | null | undefined): string {
  if (!color) return DEFAULT_LIGHT_SIDEBAR_TEXT_COLOR
  const luminance = luminanceFromCssColor(color)
  if (luminance == null) return color
  return luminance > 0.55 ? DEFAULT_LIGHT_SIDEBAR_TEXT_COLOR : color
}

export interface WorkspaceSettings {
  id: string
  workspace_id: string | null
  brand_name: string | null
  logo_url: string | null
  primary_color: string | null
  accent_color: string | null
  sidebar_color: string | null
  sidebar_text_color: string | null
  default_interface_id?: string | null
  created_at: string
  updated_at?: string
}

/**
 * Get workspace settings (branding)
 */
export async function getWorkspaceSettings(): Promise<WorkspaceSettings | null> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('workspace_settings')
    .select('*')
    // Single-workspace app: avoid maybeSingle() failure when multiple rows exist
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  
  // If table doesn't exist, return null (graceful degradation)
  if (error) {
    if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
      return null
    }
    console.warn('Error loading workspace settings:', error)
    return null
  }
  
  return data as WorkspaceSettings | null
}

/**
 * Update workspace settings (admin only - check on server side)
 */
export async function updateWorkspaceSettings(settings: Partial<WorkspaceSettings>): Promise<WorkspaceSettings | null> {
  const supabase = await createClient()
  
  // Get or create workspace ID
  // First, try to get existing workspace
  let workspaceId: string | null = null
  
  // Check workspace_id type by trying to get a workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  
  if (workspace) {
    workspaceId = workspace.id
  } else {
    // Create default workspace if it doesn't exist
    // Don't specify id - let database generate it (works for both text and UUID)
    const { data: newWorkspace, error: createError } = await supabase
      .from('workspaces')
      .insert([{ name: 'Marketing Hub' }])
      .select('id')
      .single()
    
    if (!createError && newWorkspace) {
      workspaceId = newWorkspace.id
    } else {
      // If creation failed, try to get any existing workspace
      const { data: anyWorkspace } = await supabase
        .from('workspaces')
        .select('id')
        .limit(1)
        .maybeSingle()
      
      if (anyWorkspace) {
        workspaceId = anyWorkspace.id
      } else {
        // Last resort: try creating with 'default' id (only works if id is text type)
        const { data: defaultWorkspace } = await supabase
          .from('workspaces')
          .insert([{ id: 'default', name: 'Marketing Hub' }])
          .select('id')
          .single()
        
        if (defaultWorkspace) {
          workspaceId = defaultWorkspace.id
        }
      }
    }
  }
  
  if (!workspaceId) {
    throw new Error('No workspace found. Please create a workspace first.')
  }
  
  // Check if settings exist
  const { data: existing } = await supabase
    .from('workspace_settings')
    .select('id, workspace_id')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  
  if (existing) {
    // Update existing - ensure workspace_id is set
    const { data, error } = await supabase
      .from('workspace_settings')
      .update({
        ...settings,
        workspace_id: workspaceId, // Ensure workspace_id is set
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()
    
    if (error) throw error
    return data as WorkspaceSettings
  } else {
    // Create new - include workspace_id
    const { data, error } = await supabase
      .from('workspace_settings')
      .insert([{
        ...settings,
        workspace_id: workspaceId, // Required field
      }])
      .select()
      .single()
    
    if (error) throw error
    return data as WorkspaceSettings
  }
}
