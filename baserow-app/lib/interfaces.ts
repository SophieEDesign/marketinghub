import { createClient } from './supabase/server'
import { getUserRole, isAdmin } from './roles'

export interface InterfaceCategory {
  id: string
  name: string
  icon: string | null
  position: number
  created_at: string
  updated_at?: string
}

export interface Interface {
  id: string
  name: string
  description: string | null
  category_id: string | null
  icon: string | null
  is_default: boolean
  created_at: string
  updated_at?: string
}

export interface InterfaceView {
  id: string
  interface_id: string
  view_id: string
  position: number
  created_at: string
}

export interface InterfacePermission {
  id: string
  interface_id: string
  role: 'admin' | 'staff' | 'member'
  created_at: string
}

/**
 * Get all interface categories
 */
export async function getInterfaceCategories(): Promise<InterfaceCategory[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('interface_categories')
    .select('*')
    .order('position', { ascending: true })
  
  if (error) {
    // If table doesn't exist, return empty array (graceful degradation)
    if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
      return []
    }
    console.error('Error loading interface categories:', error)
    return []
  }
  
  return (data || []) as InterfaceCategory[]
}

/**
 * Get all interfaces with permissions filtering
 */
export async function getInterfaces(): Promise<Interface[]> {
  const supabase = await createClient()
  const userRole = await getUserRole()
  const userIsAdmin = await isAdmin()
  
  let query = supabase
    .from('interfaces')
    .select('*')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })
  
  // If not admin, filter by permissions
  if (!userIsAdmin) {
    // Get interfaces that have 'member' or 'staff' permission, or no permissions (public)
    const { data: allowedInterfaces } = await supabase
      .from('interface_permissions')
      .select('interface_id')
      .in('role', ['member', 'staff'])
    
    const allowedIds = allowedInterfaces?.map(p => p.interface_id) || []
    
    // Also get interfaces with no permissions (public)
    const { data: allInterfaces } = await supabase
      .from('interfaces')
      .select('id')
    
    const allIds = allInterfaces?.map(i => i.id) || []
    const publicIds = allIds.filter(id => !allowedInterfaces?.some(p => p.interface_id === id))
    
    const visibleIds = [...allowedIds, ...publicIds]
    
    if (visibleIds.length > 0) {
      query = query.in('id', visibleIds)
    } else {
      // No accessible interfaces
      return []
    }
  }
  
  const { data, error } = await query
  
  if (error) {
    // If table doesn't exist, fall back to views table
    if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
      return await getInterfacesFromViews()
    }
    console.error('Error loading interfaces:', error)
    return []
  }
  
  return (data || []) as Interface[]
}

/**
 * Fallback: Get interfaces from views table (backward compatibility)
 */
async function getInterfacesFromViews(): Promise<Interface[]> {
  const supabase = await createClient()
  const userIsAdmin = await isAdmin()
  
  let query = supabase
    .from('views')
    .select('id, name, description, group_id, is_admin_only, is_default, created_at, updated_at')
    .eq('type', 'interface')
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: false })
  
  if (!userIsAdmin) {
    query = query.or('is_admin_only.is.null,is_admin_only.eq.false')
  }
  
  const { data, error } = await query
  
  if (error || !data) {
    return []
  }
  
  // Map views to interfaces format
  return data.map(view => ({
    id: view.id,
    name: view.name,
    description: view.description || null,
    category_id: view.group_id || null,
    icon: null,
    is_default: view.is_default || false,
    created_at: view.created_at,
    updated_at: view.updated_at || view.created_at,
  }))
}

/**
 * Get default interface (for redirect on login)
 */
export async function getDefaultInterface(): Promise<Interface | null> {
  const supabase = await createClient()
  const userRole = await getUserRole()
  const userIsAdmin = await isAdmin()
  
  // First, try to get default interface from workspace_settings
  // Silently handle errors if column doesn't exist
  let workspaceSettings: { default_interface_id?: string | null } | null = null
  try {
    const { data, error: settingsError } = await supabase
      .from('workspace_settings')
      .select('default_interface_id')
      .maybeSingle()

    if (settingsError) {
      // Check for specific error codes that indicate column/table doesn't exist
      if (settingsError.code === 'PGRST116' || 
          settingsError.code === '42P01' || 
          settingsError.code === '42703' ||
          settingsError.message?.includes('column') ||
          settingsError.message?.includes('does not exist') ||
          settingsError.message?.includes('relation')) {
        // Column or table doesn't exist - this is fine, just skip
        workspaceSettings = null
      } else {
        // Other errors - log but don't fail
        console.warn('Error loading workspace settings:', settingsError)
      }
    } else {
      workspaceSettings = data
    }
  } catch (error: any) {
    // Ignore errors if column doesn't exist (PGRST116 = column not found, 42P01 = relation doesn't exist)
    // These are expected in some setups where the migration hasn't been run
    if (error?.code !== 'PGRST116' && error?.code !== '42P01' && error?.code !== '42703') {
      console.warn('Error loading workspace settings:', error)
    }
  }
  
  if (workspaceSettings?.default_interface_id) {
    // Try interface_pages table first (current system - matches foreign key)
    const { data: defaultPage, error: pageError } = await supabase
      .from('interface_pages')
      .select('*')
      .eq('id', workspaceSettings.default_interface_id)
      .maybeSingle()
    
    if (!pageError && defaultPage) {
      // Check admin-only restriction
      if (userIsAdmin || !defaultPage.is_admin_only) {
        return {
          id: defaultPage.id,
          name: defaultPage.name,
          description: null,
          category_id: defaultPage.group_id,
          icon: null,
          is_default: true,
          created_at: defaultPage.created_at,
          updated_at: defaultPage.updated_at || defaultPage.created_at,
        } as Interface
      }
    }
    
    // Fallback: try views table (old system)
    const { data: defaultView, error: viewError } = await supabase
      .from('views')
      .select('*')
      .eq('id', workspaceSettings.default_interface_id)
      .eq('type', 'interface')
      .maybeSingle()
    
    if (!viewError && defaultView) {
      // Check admin-only restriction
      if (userIsAdmin || !defaultView.is_admin_only) {
        return {
          id: defaultView.id,
          name: defaultView.name,
          description: null,
          category_id: defaultView.group_id,
          icon: defaultView.config?.settings?.icon || null,
          is_default: true,
          created_at: defaultView.created_at,
          updated_at: defaultView.updated_at || defaultView.created_at,
        } as Interface
      }
    }
    
    // Fallback: try interfaces table (alternative new system)
    const { data: defaultInterface, error } = await supabase
      .from('interfaces')
      .select('*')
      .eq('id', workspaceSettings.default_interface_id)
      .maybeSingle()
    
    if (!error && defaultInterface) {
      // Check if user can access it
      if (userIsAdmin || await canAccessInterface(defaultInterface.id)) {
        return defaultInterface as Interface
      }
    }
  }
  
  // Fallback: get first accessible interface
  const interfaces = await getInterfaces()
  return interfaces.length > 0 ? interfaces[0] : null
}

/**
 * Get interface by ID
 */
export async function getInterfaceById(interfaceId: string): Promise<Interface | null> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('interfaces')
    .select('*')
    .eq('id', interfaceId)
    .maybeSingle()
  
  if (error || !data) {
    // Fallback to views table
    const { data: viewData } = await supabase
      .from('views')
      .select('id, name, description, group_id, is_admin_only, is_default, created_at, updated_at')
      .eq('id', interfaceId)
      .eq('type', 'interface')
      .maybeSingle()
    
    if (!viewData) return null
    
    return {
      id: viewData.id,
      name: viewData.name,
      description: viewData.description || null,
      category_id: viewData.group_id || null,
      icon: null,
      is_default: viewData.is_default || false,
      created_at: viewData.created_at,
      updated_at: viewData.updated_at || viewData.created_at,
    }
  }
  
  return data as Interface
}

/**
 * Get views for an interface
 */
export async function getInterfaceViews(interfaceId: string): Promise<InterfaceView[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('interface_views')
    .select('*')
    .eq('interface_id', interfaceId)
    .order('position', { ascending: true })
  
  if (error) {
    // If table doesn't exist, return empty array
    if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
      return []
    }
    console.error('Error loading interface views:', error)
    return []
  }
  
  return (data || []) as InterfaceView[]
}

/**
 * Check if user can access an interface
 */
export async function canAccessInterface(interfaceId: string): Promise<boolean> {
  const userIsAdmin = await isAdmin()
  if (userIsAdmin) return true
  
  const supabase = await createClient()
  const userRole = await getUserRole()
  
  if (!userRole) return false
  
  // Check permissions
  const { data: permissions } = await supabase
    .from('interface_permissions')
    .select('role')
    .eq('interface_id', interfaceId)
  
  // If no permissions exist, it's public
  if (!permissions || permissions.length === 0) {
    return true
  }
  
  // Check if user role is in permissions
  return permissions.some(p => p.role === userRole || p.role === 'staff')
}
