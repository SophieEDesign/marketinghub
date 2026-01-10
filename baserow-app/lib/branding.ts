import { createClient } from './supabase/server'

export interface WorkspaceSettings {
  id: string
  workspace_id: string | null
  brand_name: string | null
  logo_url: string | null
  primary_color: string | null
  accent_color: string | null
  sidebar_color: string | null
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
  
  // Check if settings exist
  const { data: existing } = await supabase
    .from('workspace_settings')
    .select('id')
    .maybeSingle()
  
  if (existing) {
    // Update existing
    const { data, error } = await supabase
      .from('workspace_settings')
      .update({
        ...settings,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()
    
    if (error) throw error
    return data as WorkspaceSettings
  } else {
    // Create new
    const { data, error } = await supabase
      .from('workspace_settings')
      .insert([settings])
      .select()
      .single()
    
    if (error) throw error
    return data as WorkspaceSettings
  }
}
