import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { authErrorToMessage, getRedirectUrl } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = await getRedirectUrl(requestUrl.searchParams.get('next'), null)

  if (code) {
    const supabase = await createClient()
    
    // Exchange the code for a session
    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && sessionData?.user) {
      // Successfully confirmed email and created session
      // Ensure a profile row exists for this user.
      // CRITICAL: Do NOT overwrite an existing profile role on login.
      // Overwriting would allow accidental (or malicious) role changes via user metadata.
      const userMetadata = sessionData.user.user_metadata || {}
      const requestedRole = (userMetadata.role === 'admin' ? 'admin' : 'member') as 'admin' | 'member'

      try {
        const { data: existingProfile, error: existingProfileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', sessionData.user.id)
          .maybeSingle()

        // If profile exists, never overwrite role here.
        if (!existingProfileError && existingProfile?.role) {
          // noop
        } else {
          // Create profile with safest default. If the user was provisioned via a trusted invite flow
          // that sets role metadata, we can use it ONLY for initial creation.
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              user_id: sessionData.user.id,
              role: requestedRole,
            })

          if (insertError && process.env.NODE_ENV === 'development') {
            console.error('Error creating profile:', insertError)
          }
        }
      } catch (e) {
        // Don't block auth flow if profile syncing fails.
        if (process.env.NODE_ENV === 'development') {
          console.error('Error ensuring profile exists:', e)
        }
      }

      // Check if this is an invited user who needs to set up a password
      // Invited users will have a role in user_metadata (set during invitation)
      // We check if password_setup_complete is not in metadata to avoid redirecting again
      // Also check if user was created via invite (has role but hasn't completed password setup)
      const hasRole = !!userMetadata.role
      const passwordSetupComplete = !!userMetadata.password_setup_complete
      const isInvitedUser = hasRole && !passwordSetupComplete

      // Additional check: if user was just created (recent timestamp) and has a role,
      // they're likely an invited user who needs to set a password
      const userCreatedAt = sessionData.user.created_at
      const isRecentlyCreated = userCreatedAt && 
        (new Date().getTime() - new Date(userCreatedAt).getTime()) < 5 * 60 * 1000 // Created within last 5 minutes

      if (isInvitedUser || (hasRole && isRecentlyCreated && !passwordSetupComplete)) {
        // Redirect to password setup page
        const setupUrl = new URL('/auth/setup-password', request.url)
        if (next && next !== '/') {
          setupUrl.searchParams.set('next', next)
        }
        return NextResponse.redirect(setupUrl)
      }

      // Redirect to resolved/sanitized next (or `/` which will resolve the configured landing page)
      return NextResponse.redirect(new URL(next, request.url))
    } else {
      // Error confirming email - use centralized error mapping
      const friendlyMessage = authErrorToMessage(error, 'emailConfirmation')
      
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(friendlyMessage)}`, request.url))
    }
  }

  // No code provided, redirect to login
  return NextResponse.redirect(new URL('/login', request.url))
}
