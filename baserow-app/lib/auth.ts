import { createClient } from './supabase/server'
import { getUserRole, type UserRole } from './roles'

export interface CurrentUser {
  id: string
  email?: string
  role: UserRole | null
}

/**
 * Get the current authenticated user with their role
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return null
  }
  
  const role = await getUserRole()
  
  return {
    id: user.id,
    email: user.email,
    role,
  }
}

/**
 * Get user role (re-exported from roles.ts for convenience)
 */
export { getUserRole } from './roles'
export type { UserRole } from './roles'
