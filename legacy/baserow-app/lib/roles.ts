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
  
  // Canonical role source: profiles.role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()
  
  if (!profileError && profile?.role) {
    return profile.role as UserRole
  }
  
  // If no profile exists, default to member for security
  // Admin role must be explicitly assigned through user management
  // This prevents privilege escalation attacks
  // If profile table exists but user has no profile, default to member
  // Admin role must be explicitly assigned
  return 'member'
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
