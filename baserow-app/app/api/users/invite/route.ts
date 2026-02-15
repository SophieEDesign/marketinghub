import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/roles'
import { getAuthRateLimiter } from '@/lib/rate-limit'

const MAX_BODY_SIZE = 1024 * 10 // 10KB

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 5 invites per 15 min per IP (when Upstash configured)
    const authLimiter = getAuthRateLimiter()
    if (authLimiter) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || 'unknown'
      const { success } = await authLimiter.limit(`invite:${ip}`)
      if (!success) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { status: 429 }
        )
      }
    }

    // Request body size limit
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10)
    if (contentLength > MAX_BODY_SIZE) {
      return NextResponse.json(
        { error: 'Request body too large' },
        { status: 413 }
      )
    }

    // Security: Only admins can invite users
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { email, role, default_interface } = body

    if (!email || !role) {
      return NextResponse.json(
        { error: 'email and role are required' },
        { status: 400 }
      )
    }

    if (role !== 'admin' && role !== 'member') {
      return NextResponse.json(
        { error: 'role must be "admin" or "member"' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Use admin client to send invitation
    let adminClient
    try {
      adminClient = createAdminClient()
    } catch (error: any) {
      console.error('Error creating admin client:', error)
      
      // Check if it's a missing service role key error
      if (error.message?.includes('SUPABASE_SERVICE_ROLE_KEY')) {
        return NextResponse.json(
          { 
            error: 'Server configuration error: Service role key not configured. Please set SUPABASE_SERVICE_ROLE_KEY environment variable.',
            details: 'To fix this: 1) Go to your Supabase project → Settings → API, 2) Copy the "service_role" key (NOT the anon key), 3) Add it to Vercel project settings → Environment Variables as SUPABASE_SERVICE_ROLE_KEY, 4) Redeploy your application.'
          },
          { status: 500 }
        )
      }
      
      return NextResponse.json(
        { error: error.message || 'Failed to initialize admin client' },
        { status: 500 }
      )
    }
    
    // Get the base URL for the redirect link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      'http://localhost:3000'

    // Invite user via Supabase Auth Admin API
    // Build user metadata - only include default_interface if it has a valid value
    const userMetadata: { role: string; default_interface?: string } = {
      role: role,
    }
    
    if (default_interface && default_interface !== '__none__') {
      userMetadata.default_interface = default_interface
    }
    
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email.trim(),
      {
        data: userMetadata,
        redirectTo: `${baseUrl}/auth/callback`,
      }
    )

    if (inviteError) {
      console.error('Supabase invite error:', inviteError)
      
      // Handle specific error cases
      if (inviteError.message?.includes('already registered') || inviteError.message?.includes('already exists')) {
        return NextResponse.json(
          { error: 'A user with this email already exists' },
          { status: 400 }
        )
      }
      
      // Handle invalid API key error
      const errorMessage = inviteError.message || ''
      const errorCode = (inviteError as any)?.code || (inviteError as any)?.status || ''
      
      // Check for authentication/authorization errors
      if (
        errorMessage.includes('Invalid API key') ||
        errorMessage.includes('JWT') ||
        (errorMessage.includes('invalid') && errorMessage.includes('key')) ||
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('401') ||
        errorCode === '401' ||
        errorCode === 'PGRST301' ||
        errorMessage.includes('service_role')
      ) {
        // Log the actual error for debugging (server-side only)
        console.error('Supabase API error details:', {
          message: errorMessage,
          code: errorCode,
          error: inviteError
        })
        
        return NextResponse.json(
          { 
            error: 'Server configuration error: Invalid service role key. Please verify SUPABASE_SERVICE_ROLE_KEY is correct.',
            details: 'To fix this: 1) Go to your Supabase project → Settings → API, 2) Copy the "service_role" key (NOT the anon key), 3) Ensure the key matches your Supabase project URL, 4) Add it to Vercel project settings → Environment Variables as SUPABASE_SERVICE_ROLE_KEY, 5) Redeploy your application. If the key is correct, verify it matches the project URL in NEXT_PUBLIC_SUPABASE_URL.',
            debug: process.env.NODE_ENV === 'development' ? {
              hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
              keyLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
              supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
              errorMessage,
              errorCode
            } : undefined
          },
          { status: 500 }
        )
      }

      return NextResponse.json(
        { error: inviteError.message || 'Failed to send invitation' },
        { status: 500 }
      )
    }

    // Note: Profile will be created automatically when user accepts invitation
    // via the auth callback route, which reads role from user_metadata
    // If user already exists, we can create profile now using admin client to bypass RLS
    if (inviteData?.user?.id) {
      const { error: profileError } = await adminClient
        .from('profiles')
        .upsert({
          user_id: inviteData.user.id,
          role: role,
        }, {
          onConflict: 'user_id',
        })

      if (profileError) {
        console.error('Error creating profile:', profileError)
        // Don't fail the request if profile creation fails - user can still sign in
      }
    }

    return NextResponse.json({ 
      message: 'User invitation sent successfully',
      email: email.trim(),
      role,
      user: inviteData?.user,
    })
  } catch (error: any) {
    console.error('Error inviting user:', error)
    
    // Check if it's a missing service role key error
    if (error.message?.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return NextResponse.json(
        { 
          error: 'Server configuration error: Service role key not configured. Please set SUPABASE_SERVICE_ROLE_KEY environment variable.',
          details: 'To fix this: 1) Go to your Supabase project → Settings → API, 2) Copy the "service_role" key (NOT the anon key), 3) Add it to Vercel project settings → Environment Variables as SUPABASE_SERVICE_ROLE_KEY, 4) Redeploy your application.'
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Failed to invite user' },
      { status: 500 }
    )
  }
}
