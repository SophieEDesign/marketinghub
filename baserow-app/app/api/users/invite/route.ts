import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/roles'

export async function POST(request: NextRequest) {
  try {
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
    const adminClient = createAdminClient()
    
    // Get the base URL for the redirect link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      'http://localhost:3000'

    // Invite user via Supabase Auth Admin API
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email.trim(),
      {
        data: {
          role: role,
          default_interface: default_interface && default_interface !== '__none__' ? default_interface : null,
        },
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

      return NextResponse.json(
        { error: inviteError.message || 'Failed to send invitation' },
        { status: 500 }
      )
    }

    // Note: Profile will be created automatically when user accepts invitation
    // via the auth callback route, which reads role from user_metadata
    // If user already exists, we can create profile now
    if (inviteData?.user?.id) {
      const supabase = await createClient()
      const { error: profileError } = await supabase
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
          details: 'Contact your administrator to configure user invitations.'
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
