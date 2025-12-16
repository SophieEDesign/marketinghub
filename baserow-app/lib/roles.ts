import { createClient } from './supabase/server'

export type UserRole = 'admin' | 'editor' | 'viewer'

export interface UserRoleData {
  user_id: string
  role: UserRole
}

/**
 * Get the current user's role from the user_roles table
 */
export async function getUserRole(): Promise<UserRole | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null
  
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()
  
  if (error || !data) {
    // Default to viewer if no role found
    return 'viewer'
  }
  
  return data.role as UserRole
}

/**
 * Check if user has a specific role or higher
 * Hierarchy: admin > editor > viewer
 */
export async function hasRole(minimumRole: UserRole): Promise<boolean> {
  const role = await getUserRole()
  if (!role) return false
  
  const hierarchy: Record<UserRole, number> = {
    viewer: 1,
    editor: 2,
    admin: 3,
  }
  
  return hierarchy[role] >= hierarchy[minimumRole]
}

/**
 * Check if user can access a resource based on access_level and allowed_roles
 */
export async function canAccessResource(
  accessLevel: string,
  allowedRoles?: string[]
): Promise<boolean> {
  const role = await getUserRole()
  
  // Public access
  if (accessLevel === 'public') return true
  
  // Authenticated access
  if (accessLevel === 'authenticated' && role) return true
  
  // Role-based access
  if (accessLevel === 'role-based' && role && allowedRoles) {
    return allowedRoles.includes(role)
  }
  
  return false
}
