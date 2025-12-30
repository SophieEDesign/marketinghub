import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

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
        console.error('Error creating/updating profile:', profileError)
        // Try to create profile with default role if upsert failed
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            user_id: sessionData.user.id,
            role: 'member',
          })
          .select()
          .maybeSingle()
        
        if (insertError && !insertError.message?.includes('duplicate')) {
          console.error('Error creating profile with default role:', insertError)
        }
      }

      if (profileError) {
        console.error('Error creating profile:', profileError)
        // Don't fail the auth flow if profile creation fails
      }

      // Redirect to home page
      return NextResponse.redirect(new URL(next, request.url))
    } else {
      // Error confirming email
      console.error('Error confirming email:', error)
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error?.message || 'Failed to confirm email')}`, request.url))
    }
  }

  // No code provided, redirect to login
  return NextResponse.redirect(new URL('/login', request.url))
}
