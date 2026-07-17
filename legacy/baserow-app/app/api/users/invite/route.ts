import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/roles'
import { getAuthRateLimiter } from '@/lib/rate-limit'
import { getRequestIp } from '@/lib/request-ip'
import { inviteUserByEmail } from '@/lib/users/invite-user'
import type { InviteRole } from '@/lib/users/invite-user'

const MAX_BODY_SIZE = 1024 * 10 // 10KB

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 5 invites per 15 min per IP (when Upstash configured)
    const authLimiter = getAuthRateLimiter()
    if (authLimiter) {
      const ip = getRequestIp(request)
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
    
    const inviteResult = await inviteUserByEmail(
      adminClient,
      email.trim(),
      role as InviteRole,
      { default_interface }
    )

    if (!inviteResult.ok) {
      const errorMessage = inviteResult.error || ''
      if (errorMessage.includes('already exists')) {
        return NextResponse.json(
          { error: 'A user with this email already exists' },
          { status: 400 }
        )
      }
      if (
        errorMessage.includes('Invalid API key') ||
        errorMessage.includes('JWT') ||
        errorMessage.includes('service_role') ||
        errorMessage.includes('unauthorized')
      ) {
        return NextResponse.json(
          {
            error:
              'Server configuration error: Invalid service role key. Please verify SUPABASE_SERVICE_ROLE_KEY is correct.',
            details:
              'Copy the service_role key from Supabase → Settings → API and set SUPABASE_SERVICE_ROLE_KEY on your deployment.',
          },
          { status: 500 }
        )
      }
      return NextResponse.json(
        { error: inviteResult.error || 'Failed to send invitation' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'User invitation sent successfully',
      email: email.trim(),
      role,
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
