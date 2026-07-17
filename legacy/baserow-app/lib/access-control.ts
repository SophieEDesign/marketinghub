import { createClient } from './supabase/server'
import type { AccessControl } from '@/types/database'

export async function checkAccess(
  accessControl: AccessControl,
  ownerId?: string | null
): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  switch (accessControl) {
    case 'public':
      return true
    case 'authenticated':
      return !!user
    case 'owner':
      return !!user && user.id === ownerId
    case 'role-based':
      // For now, treat role-based as authenticated
      // Can be extended to check specific roles
      return !!user
    default:
      return false
  }
}

export async function getUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}
