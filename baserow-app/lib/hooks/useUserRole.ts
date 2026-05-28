import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isAbortError } from '@/lib/api/error-handling'

export type ClientUserRole = 'admin' | 'member'

/**
 * Client-side role loader from canonical `profiles.role`.
 * Defaults to 'member' for safety.
 * 
 * Note: Abort errors during rapid navigation/unmount are expected and silently ignored.
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

        if (cancelled) return

        if (!user) {
          if (!cancelled) setRole('member')
          return
        }

        // Canonical role source: profiles.role
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle()

        if (cancelled) return

        if (!profileError && profile?.role) {
          if (!cancelled) setRole(profile.role === 'admin' ? 'admin' : 'member')
          return
        }

        if (!cancelled) setRole('member')
      } catch (e) {
        // Only log non-abort errors (abort errors are expected during rapid navigation/unmount)
        if (!isAbortError(e)) {
          console.error('[useUserRole] Failed to load role:', e)
        }
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

