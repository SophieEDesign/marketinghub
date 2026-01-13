import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { authErrorToMessage } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/'

  if (code) {
    const supabase = await createClient()
    
    // Exchange the code for a session
    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && sessionData?.user) {
      // Successfully confirmed email and created session
      // Create or update profile with role from user metadata (if invited)
      const userMetadata = sessionData.user.user_metadata || {}
      const role = (userMetadata.role || 'member') as 'admin' | 'member' // Default to member if no role specified
      
      // Create or update profile - ensure role is always set
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          user_id: sessionData.user.id,
          role: role,
        }, {
          onConflict: 'user_id',
        })

      // If profile creation failed, log but don't block auth flow
      if (profileError) {
        // Only log in development to avoid exposing errors in production
        if (process.env.NODE_ENV === 'development') {
          console.error('Error creating/updating profile:', profileError)
        }
        
        // Try to create profile with default role if upsert failed
        // This handles cases where the profile doesn't exist yet
        if (!profileError.message?.includes('duplicate') && 
            !profileError.message?.includes('already exists')) {
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              user_id: sessionData.user.id,
              role: 'member',
            })
            .select()
            .maybeSingle()
          
          if (insertError && process.env.NODE_ENV === 'development') {
            console.error('Error creating profile with default role:', insertError)
          }
        }
        // Don't fail the auth flow if profile creation fails - user can still proceed
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

      // Redirect to home page
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
