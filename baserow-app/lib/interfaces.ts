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
 * Validate that a page exists and user has access to it
 */
async function validatePageAccess(pageId: string, userIsAdmin: boolean): Promise<{ valid: boolean; reason?: string }> {
  const supabase = await createClient()
  
  // Try interface_pages table first (current system)
  const { data: page, error: pageError } = await supabase
    .from('interface_pages')
    .select('id, is_admin_only')
    .eq('id', pageId)
    .maybeSingle()
  
  if (!pageError && page) {
    // Check admin-only restriction
    if (!userIsAdmin && page.is_admin_only) {
      return { valid: false, reason: 'Page is admin-only and user is not admin' }
    }
    return { valid: true }
  }
  
  // Fallback: try views table (old system)
  const { data: view, error: viewError } = await supabase
    .from('views')
    .select('id, is_admin_only')
    .eq('id', pageId)
    .eq('type', 'interface')
    .maybeSingle()
  
  if (!viewError && view) {
    // Check admin-only restriction
    if (!userIsAdmin && view.is_admin_only) {
      return { valid: false, reason: 'Page is admin-only and user is not admin' }
    }
    return { valid: true }
  }
  
  // Page doesn't exist
  return { valid: false, reason: 'Page not found' }
}

/**
 * Get accessible interface pages (filtered by permissions)
 * Queries interface_pages table directly with proper permission filtering
 */
async function getAccessibleInterfacePages(): Promise<Interface[]> {
  const supabase = await createClient()
  const userIsAdmin = await isAdmin()
  
  // Query interface_pages table (current system)
  let pagesQuery = supabase
    .from('interface_pages')
    .select('id, name, group_id, created_at, updated_at, is_admin_only')
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: false })
  
  // Filter out admin-only pages for non-admin users
  if (!userIsAdmin) {
    pagesQuery = pagesQuery.or('is_admin_only.is.null,is_admin_only.eq.false')
  }
  
  const { data: pagesData, error: pagesError } = await pagesQuery
  
  if (!pagesError && pagesData && pagesData.length > 0) {
    return pagesData.map(page => ({
      id: page.id,
      name: page.name,
      description: null,
      category_id: page.group_id,
      icon: null,
      is_default: false,
      created_at: page.created_at,
      updated_at: page.updated_at || page.created_at,
    }))
  }
  
  // Fallback to getInterfaces() which handles views table and interfaces table
  return await getInterfaces()
}

/**
 * Resolve landing page with priority order:
 * 1. User default page (if exists and user has access)
 * 2. Workspace default page (if exists and user has access)
 * 3. First accessible interface page
 */
export async function resolveLandingPage(): Promise<{ pageId: string | null; reason: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { pageId: null, reason: 'User not authenticated' }
  }
  
  const userIsAdmin = await isAdmin()
  const isDev = process.env.NODE_ENV === 'development'
  
  // Priority 1: Check user default page (if field exists in profiles)
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('default_page_id')
      .eq('user_id', user.id)
      .maybeSingle()
    
    if (!profileError && profile && (profile as any).default_page_id) {
      const userDefaultPageId = (profile as any).default_page_id
      const validation = await validatePageAccess(userDefaultPageId, userIsAdmin)
      
      if (validation.valid) {
        if (isDev) {
          console.log('[Landing Page] Using user default page:', userDefaultPageId)
        }
        return { pageId: userDefaultPageId, reason: 'user_default' }
      } else {
        if (isDev) {
          console.warn('[Landing Page] User default page invalid:', userDefaultPageId, validation.reason)
        }
      }
    }
  } catch (error: any) {
    // Silently handle if column doesn't exist (expected if migration hasn't run)
    if (error?.code !== 'PGRST116' && error?.code !== '42P01' && error?.code !== '42703' && 
        !error?.message?.includes('column') && !error?.message?.includes('does not exist')) {
      if (isDev) {
        console.warn('[Landing Page] Error checking user default page:', error)
      }
    }
  }
  
  // Priority 2: Check workspace default page
  try {
    const { data: workspaceSettings, error: settingsError } = await supabase
      .from('workspace_settings')
      .select('default_interface_id')
      .maybeSingle()
    
    if (!settingsError && workspaceSettings?.default_interface_id) {
      const workspaceDefaultPageId = workspaceSettings.default_interface_id
      const validation = await validatePageAccess(workspaceDefaultPageId, userIsAdmin)
      
      if (validation.valid) {
        if (isDev) {
          console.log('[Landing Page] Using workspace default page:', workspaceDefaultPageId)
        }
        return { pageId: workspaceDefaultPageId, reason: 'workspace_default' }
      } else {
        if (isDev) {
          console.warn('[Landing Page] Workspace default page invalid:', workspaceDefaultPageId, validation.reason)
        }
      }
    }
  } catch (error: any) {
    // Silently handle if column doesn't exist
    if (error?.code !== 'PGRST116' && error?.code !== '42P01' && error?.code !== '42703' && 
        !error?.message?.includes('column') && !error?.message?.includes('does not exist')) {
      if (isDev) {
        console.warn('[Landing Page] Error checking workspace default page:', error)
      }
    }
  }
  
  // Priority 3: Get first accessible interface page
  const accessiblePages = await getAccessibleInterfacePages()
  if (accessiblePages.length > 0) {
    if (isDev) {
      console.log('[Landing Page] Using first accessible page:', accessiblePages[0].id, '(fallback)')
    }
    return { pageId: accessiblePages[0].id, reason: 'first_accessible' }
  }
  
  // Priority 4: Fallback to any page from interface_pages table (even if admin-only)
  // This ensures we always have a default page if any pages exist
  try {
    const { data: anyPages } = await supabase
      .from('interface_pages')
      .select('id')
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1)
    
    if (anyPages && anyPages.length > 0) {
      if (isDev) {
        console.log('[Landing Page] Using first page (any):', anyPages[0].id, '(final fallback)')
      }
      return { pageId: anyPages[0].id, reason: 'first_page_fallback' }
    }
  } catch (error: any) {
    if (isDev) {
      console.warn('[Landing Page] Error in final fallback:', error)
    }
  }
  
  if (isDev) {
    console.warn('[Landing Page] No accessible pages found')
  }
  return { pageId: null, reason: 'no_accessible_pages' }
}

/**
 * Get default interface (for redirect on login)
 * @deprecated Use resolveLandingPage() instead for better control and logging
 */
export async function getDefaultInterface(): Promise<Interface | null> {
  const supabase = await createClient()
  const userRole = await getUserRole()
  const userIsAdmin = await isAdmin()
  
  // Use new resolution logic
  const { pageId } = await resolveLandingPage()
  
  if (!pageId) {
    return null
  }
  
  // Convert pageId to Interface format
  // Try interface_pages table first (current system)
  const { data: defaultPage, error: pageError } = await supabase
    .from('interface_pages')
    .select('*')
    .eq('id', pageId)
    .maybeSingle()
  
  if (!pageError && defaultPage) {
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
  
  // Fallback: try views table (old system)
  const { data: defaultView, error: viewError } = await supabase
    .from('views')
    .select('*')
    .eq('id', pageId)
    .eq('type', 'interface')
    .maybeSingle()
  
  if (!viewError && defaultView) {
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
  
  // Fallback: try interfaces table (alternative new system)
  const { data: defaultInterface, error } = await supabase
    .from('interfaces')
    .select('*')
    .eq('id', pageId)
    .maybeSingle()
  
  if (!error && defaultInterface) {
    return defaultInterface as Interface
  }
  
  return null
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
