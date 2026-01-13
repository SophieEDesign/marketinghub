/**
 * Utility functions for authentication
 */

/**
 * Map Supabase auth errors to user-friendly messages
 */
export function getAuthErrorMessage(error: any): string {
  if (!error) return 'An unexpected error occurred'
  
  const message = error.message || ''
  const code = error.code || error.status || ''
  
  // Map common Supabase auth errors to user-friendly messages
  if (message.includes('Invalid login credentials') || 
      message.includes('Invalid credentials') ||
      message.includes('Email not confirmed')) {
    return 'Invalid email or password. Please check your credentials and try again.'
  }
  
  if (message.includes('Email rate limit exceeded')) {
    return 'Too many email requests. Please wait a few minutes before trying again.'
  }
  
  if (message.includes('User already registered') || 
      message.includes('already exists')) {
    return 'An account with this email already exists. Please sign in instead.'
  }
  
  if (message.includes('Password should be at least')) {
    return 'Password is too short. Please use a stronger password.'
  }
  
  if (message.includes('Invalid email')) {
    return 'Please enter a valid email address.'
  }
  
  if (message.includes('Email not confirmed')) {
    return 'Please check your email and confirm your account before signing in.'
  }
  
  if (message.includes('Token has expired') || 
      message.includes('expired')) {
    return 'Your session has expired. Please sign in again.'
  }
  
  // Generic fallback - don't expose internal error details
  return 'Unable to sign in. Please check your credentials and try again.'
}

/**
 * Get redirect URL after login
 */
export async function getRedirectUrl(
  nextParam: string | null,
  callbackUrlParam: string | null
): Promise<string> {
  // Use explicit redirect parameter if provided
  const explicitNext = nextParam || callbackUrlParam
  if (explicitNext && explicitNext !== '/' && explicitNext !== '/login') {
    return explicitNext
  }
  
  // Try to get first available page
  try {
    const response = await fetch('/api/interface-pages')
    if (response.ok) {
      const pages = await response.json()
      if (pages && pages.length > 0) {
        return `/pages/${pages[0].id}`
      }
    }
  } catch (error) {
    // Fallback on error
  }
  
  // Default fallback
  return '/settings?tab=pages'
}

/**
 * Validate email format
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || email.trim().length === 0) {
    return { valid: false, error: 'Email is required' }
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email.trim())) {
    return { valid: false, error: 'Please enter a valid email address' }
  }
  
  return { valid: true }
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { valid: boolean; error?: string; strength?: 'weak' | 'medium' | 'strong' } {
  if (!password || password.length === 0) {
    return { valid: false, error: 'Password is required' }
  }
  
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' }
  }
  
  // Check password strength
  let strength: 'weak' | 'medium' | 'strong' = 'weak'
  let hasUpper = false
  let hasLower = false
  let hasNumber = false
  let hasSpecial = false
  
  for (const char of password) {
    if (char >= 'A' && char <= 'Z') hasUpper = true
    if (char >= 'a' && char <= 'z') hasLower = true
    if (char >= '0' && char <= '9') hasNumber = true
    if (/[!@#$%^&*(),.?":{}|<>]/.test(char)) hasSpecial = true
  }
  
  const criteriaMet = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length
  
  if (criteriaMet >= 3 && password.length >= 12) {
    strength = 'strong'
  } else if (criteriaMet >= 2) {
    strength = 'medium'
  }
  
  // Require at least 2 criteria for basic security
  if (criteriaMet < 2) {
    return { 
      valid: false, 
      error: 'Password must include at least 2 of: uppercase, lowercase, numbers, or special characters',
      strength: 'weak'
    }
  }
  
  return { valid: true, strength }
}

/**
 * Wait for session to be established using auth state change listener
 * This is more reliable than polling and eliminates race conditions
 */
export async function waitForSession(
  supabase: any,
  timeoutMs: number = 5000
): Promise<{ user: any | null; error: string | null }> {
  return new Promise((resolve) => {
    let resolved = false
    let timeoutId: NodeJS.Timeout | null = null
    let subscription: { unsubscribe: () => void } | null = null

    // Cleanup function
    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      if (subscription) {
        subscription.unsubscribe()
        subscription = null
      }
    }

    // Set up timeout safeguard
    timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true
        cleanup()
        resolve({ user: null, error: 'Session establishment timed out. Please try again.' })
      }
    }, timeoutMs)

    // Listen for auth state changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (event: string, session: any) => {
        if (resolved) return

        // Check for SIGNED_IN event
        if (event === 'SIGNED_IN' && session?.user) {
          resolved = true
          cleanup()
          resolve({ user: session.user, error: null })
          return
        }

        // Also handle TOKEN_REFRESHED which might indicate session is ready
        if (event === 'TOKEN_REFRESHED' && session?.user) {
          resolved = true
          cleanup()
          resolve({ user: session.user, error: null })
          return
        }

        // Check for sign out (shouldn't happen during login, but handle gracefully)
        if (event === 'SIGNED_OUT') {
          // Don't resolve here - wait for timeout or SIGNED_IN
          // This handles edge cases where auth state might change unexpectedly
        }
      }
    )
    
    subscription = authSubscription

    // Also check current session immediately (in case session is already established)
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (resolved) return
      
      if (user) {
        resolved = true
        cleanup()
        resolve({ user, error: null })
      } else if (error && !error.message?.includes('session') && !error.message?.includes('JWT')) {
        // Only resolve with error if it's not a session/JWT-related error
        // (session errors might resolve when auth state changes)
        if (!resolved) {
          resolved = true
          cleanup()
          resolve({ user: null, error: error.message })
        }
      }
      // If error is session-related, wait for auth state change
    })
  })
}

/**
 * Centralized redirect function after authentication
 * Handles all redirect logic in one place to avoid duplication
 */
export async function performPostAuthRedirect(
  supabase: any,
  searchParams: URLSearchParams,
  options?: {
    checkPasswordSetup?: boolean
    onError?: (error: string) => void
  }
): Promise<void> {
  try {
    // Wait for session using auth state listener
    const { user, error: sessionError } = await waitForSession(supabase)
    
    if (sessionError || !user) {
      const errorMsg = sessionError || 'Session not established. Please try again.'
      if (options?.onError) {
        options.onError(errorMsg)
      }
      return
    }

    // Check if this is an invited user who needs to set up a password
    if (options?.checkPasswordSetup) {
      const userMetadata = user.user_metadata || {}
      const hasRole = !!userMetadata.role
      const passwordSetupComplete = !!userMetadata.password_setup_complete
      
      if (hasRole && !passwordSetupComplete) {
        const next = searchParams.get('next') || searchParams.get('callbackUrl')
        const setupUrl = next && next !== '/' 
          ? `/auth/setup-password?next=${encodeURIComponent(next)}`
          : '/auth/setup-password'
        window.location.href = setupUrl
        return
      }
    }

    // Get redirect URL using utility function
    const next = await getRedirectUrl(
      searchParams.get('next'),
      searchParams.get('callbackUrl')
    )
    
    // Use window.location for full page reload to ensure cookies are sent
    if (next && next !== '/login' && next !== '/') {
      window.location.href = next
    }
  } catch (error: any) {
    const errorMsg = error.message || 'Failed to redirect after authentication'
    if (options?.onError) {
      options.onError(errorMsg)
    }
  }
}
