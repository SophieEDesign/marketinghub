/**
 * Utility functions for authentication
 */

/**
 * Log auth error details in development mode only
 * Never logs to console in production to avoid exposing sensitive information
 */
function logAuthError(error: any, context?: string): void {
  if (process.env.NODE_ENV === 'development') {
    const contextMsg = context ? `[${context}] ` : ''
    console.error(`${contextMsg}Auth error details:`, {
      message: error?.message,
      code: error?.code,
      status: error?.status,
      name: error?.name,
      fullError: error,
    })
  }
  // In production, errors should be logged to server logs if needed
  // but never exposed to users or client console
}

/**
 * Map Supabase auth errors to user-friendly messages
 * 
 * This function maps common Supabase authentication error codes and messages
 * to user-friendly strings. Full error details are logged in development mode only.
 * 
 * @param error - The error object from Supabase auth operations
 * @param context - Optional context string for logging (e.g., 'signIn', 'signUp')
 * @returns User-friendly error message string
 */
export function authErrorToMessage(error: any, context?: string): string {
  // Log full error details in development mode
  logAuthError(error, context)
  
  if (!error) {
    return 'An unexpected error occurred. Please try again.'
  }
  
  const message = error.message || ''
  const code = error.code || error.status || ''
  const errorString = String(message).toLowerCase()
  
  // Map specific Supabase auth error codes first (most reliable)
  // Check error code if available
  if (code === 'invalid_login_credentials' || 
      errorString.includes('invalid_login_credentials') ||
      errorString.includes('invalid login credentials') ||
      errorString.includes('invalid credentials')) {
    return 'Email or password is incorrect.'
  }
  
  if (code === 'user_already_registered' ||
      errorString.includes('user_already_registered') ||
      errorString.includes('user already registered') ||
      errorString.includes('already registered') ||
      (errorString.includes('already exists') && errorString.includes('email'))) {
    return 'An account already exists for this email.'
  }
  
  if (code === 'email_not_confirmed' ||
      errorString.includes('email_not_confirmed') ||
      errorString.includes('email not confirmed') ||
      errorString.includes('email address not confirmed')) {
    return 'Please confirm your email before signing in.'
  }
  
  if (code === 'too_many_requests' ||
      errorString.includes('too_many_requests') ||
      errorString.includes('too many requests') ||
      errorString.includes('rate limit') ||
      errorString.includes('email rate limit exceeded')) {
    return 'Too many attempts. Try again shortly.'
  }
  
  // Map other common error patterns (fallback for cases where code isn't set)
  if (errorString.includes('password should be at least') ||
      errorString.includes('password is too short')) {
    return 'Password is too short. Please use a stronger password.'
  }
  
  if (errorString.includes('invalid email') ||
      errorString.includes('email format')) {
    return 'Please enter a valid email address.'
  }
  
  if (errorString.includes('token has expired') ||
      errorString.includes('session expired') ||
      errorString.includes('jwt expired')) {
    return 'Your session has expired. Please sign in again.'
  }
  
  if (errorString.includes('network') ||
      errorString.includes('fetch failed') ||
      errorString.includes('connection')) {
    return 'Network error. Please check your connection and try again.'
  }
  
  // Generic fallback - never expose raw error details to users
  return 'Unable to sign in. Please check your credentials and try again.'
}

/**
 * @deprecated Use authErrorToMessage instead for consistency
 * This function is kept for backward compatibility but delegates to authErrorToMessage
 */
export function getAuthErrorMessage(error: any): string {
  return authErrorToMessage(error, 'legacy')
}

/**
 * Get redirect URL after login
 */
export async function getRedirectUrl(
  nextParam: string | null,
  callbackUrlParam: string | null
): Promise<string> {
  // Use explicit redirect parameter if provided, but sanitize it carefully.
  // We only allow safe internal paths and we block certain "utility" routes
  // (like Settings) so login respects the configured default landing page.
  const explicitNext = nextParam || callbackUrlParam
  if (explicitNext) {
    const trimmed = explicitNext.trim()
    const isInternal =
      trimmed.startsWith('/') &&
      !trimmed.startsWith('//') &&
      !trimmed.toLowerCase().startsWith('/\\') // extra hardening for odd encodings

    // Strip query/hash for route checks (but keep them for the final redirect)
    const pathOnly = trimmed.split(/[?#]/)[0]

    const blockedPrefixes = ['/login', '/auth', '/settings']
    const isBlocked = blockedPrefixes.some((p) => pathOnly === p || pathOnly.startsWith(p + '/'))

    if (
      isInternal &&
      !isBlocked &&
      pathOnly !== '/' &&
      pathOnly !== '/login'
    ) {
      return trimmed
    }
  }

  // Default: go to home. The server-side HomePage (`/`) will resolve the actual landing
  // page using `resolveLandingPage()` (user default -> workspace default -> first accessible),
  // so this respects the selected "Default Page at Login" setting.
  return '/'
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
    supabase.auth.getUser().then(({ data: { user }, error }: { data: { user: any }, error: any }) => {
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
    let safeNext = next && next !== '/login' ? next : '/'
    // Defense-in-depth: never redirect to settings/auth after login; let `/` resolve the landing page.
    const safePathOnly = safeNext.split(/[?#]/)[0]
    if (
      safePathOnly === '/settings' ||
      safePathOnly.startsWith('/settings/') ||
      safePathOnly === '/auth' ||
      safePathOnly.startsWith('/auth/')
    ) {
      safeNext = '/'
    }
    window.location.href = safeNext
  } catch (error: any) {
    const errorMsg = error.message || 'Failed to redirect after authentication'
    if (options?.onError) {
      options.onError(errorMsg)
    }
  }
}
