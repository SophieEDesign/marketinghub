import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type ClientUserRole = 'admin' | 'member'

/**
 * Client-side role loader.
 * - Prefers `profiles.role` (new system)
 * - Falls back to `user_roles.role` (legacy)
 * - Defaults to 'member' for safety
 */
export function useUserRole() {
  const [role, setRole] = useState<ClientUserRole>('member')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          if (!cancelled) setRole('member')
          return
        }

        // Try profiles table first (new system)
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle()

        if (!profileError && profile?.role) {
          if (!cancelled) setRole(profile.role === 'admin' ? 'admin' : 'member')
          return
        }

        // Fallback to user_roles table (legacy support)
        if (
          profileError?.code === 'PGRST116' ||
          profileError?.message?.includes('relation') ||
          profileError?.message?.includes('does not exist')
        ) {
          const { data: legacyRole, error: legacyError } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .maybeSingle()

          if (!legacyError && legacyRole?.role) {
            // Map legacy roles: admin/editor -> admin, viewer -> member
            if (!cancelled)
              setRole(
                legacyRole.role === 'admin' || legacyRole.role === 'editor'
                  ? 'admin'
                  : 'member'
              )
            return
          }
        }

        if (!cancelled) setRole('member')
      } catch (e) {
        console.error('[useUserRole] Failed to load role:', e)
        if (!cancelled) setRole('member')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return { role, loading }
}

