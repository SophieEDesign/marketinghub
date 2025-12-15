import { createServerSupabaseClient } from './supabase'
import type { AccessLevel, View } from '@/types/database'

export async function checkViewAccess(view: View, publicShareId?: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Check public sharing
  if (publicShareId && view.public_share_id === publicShareId) {
    return true
  }

  switch (view.access_level) {
    case 'public':
      return true
    case 'authenticated':
      return !!user
    case 'owner':
      if (!user) return false
      // Check if user is owner
      if (view.owner_id === user.id) return true
      // Check if user has required role
      if (view.allowed_roles && view.allowed_roles.length > 0) {
        const userRoles = await getUserRoles(user.id)
        return view.allowed_roles.some((role) => userRoles.includes(role))
      }
      return false
    default:
      return false
  }
}

export async function getUserRoles(userId: string): Promise<string[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)

  if (error || !data) {
    return []
  }

  return data.map((r) => r.role)
}

export async function getUser() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

// Legacy function for backward compatibility - checks table access via views
export async function checkTableAccess(
  accessLevel: AccessLevel | null | undefined,
  ownerId?: string | null
): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!accessLevel) {
    return !!user // Default to authenticated if not specified
  }

  switch (accessLevel) {
    case 'public':
      return true
    case 'authenticated':
      return !!user
    case 'owner':
      return !!user && user.id === ownerId
    default:
      return false
  }
}
