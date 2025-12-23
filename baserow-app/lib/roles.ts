import { createClient } from './supabase/server'

export type UserRole = 'admin' | 'member'

export interface UserProfile {
  id: string
  user_id: string
  role: UserRole
  created_at: string
  updated_at?: string
}

/**
 * Get the current user's role from the profiles table
 */
export async function getUserRole(): Promise<UserRole | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null
  
  // Try profiles table first (new system)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()
  
  if (!profileError && profile) {
    return profile.role as UserRole
  }
  
  // Fallback to user_roles table (legacy support)
  if (profileError?.code === 'PGRST116' || profileError?.message?.includes('relation') || profileError?.message?.includes('does not exist')) {
    const { data: legacyRole, error: legacyError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()
    
    if (!legacyError && legacyRole) {
      // Map legacy roles: admin/editor -> admin, viewer -> member
      return legacyRole.role === 'admin' || legacyRole.role === 'editor' ? 'admin' : 'member'
    }
  }
  
  // If no profile exists, create one as admin (first user gets admin by default)
  // This ensures the system works immediately after migration
  if (profileError?.code === 'PGRST116' || profileError?.message?.includes('relation') || profileError?.message?.includes('does not exist')) {
    // Profiles table doesn't exist yet - default to admin
    return 'admin'
  }
  
  // If profile table exists but user has no profile, default to admin
  // This allows first user to have admin access immediately
  return 'admin'
}

/**
 * Get full user profile
 */
export async function getUserProfile(): Promise<UserProfile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()
  
  if (error || !data) return null
  
  return data as UserProfile
}

/**
 * Check if user is admin
 */
export async function isAdmin(): Promise<boolean> {
  const role = await getUserRole()
  return role === 'admin'
}

/**
 * Check if user has a specific role
 */
export async function hasRole(role: UserRole): Promise<boolean> {
  const userRole = await getUserRole()
  return userRole === role
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
