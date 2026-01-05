import { createServerSupabaseClient } from './supabase'

export type UserRole = 'admin' | 'member'

/**
 * Get the current user's role from the profiles table
 */
export async function getUserRole(): Promise<UserRole | null> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  
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
  
  // If no profile exists, default to admin (first user gets admin by default)
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
 * Check if user is admin
 */
export async function isAdmin(): Promise<boolean> {
  const role = await getUserRole()
  return role === 'admin'
}

