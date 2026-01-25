import { createClient } from './supabase/server'

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
