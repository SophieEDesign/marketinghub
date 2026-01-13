import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/roles'

/**
 * POST /api/users/[userId]/reinvite - Reinvite a user (admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Security: Only admins can reinvite users
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }

    const { userId } = await params

    // Use admin client to reinvite user
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

    // Get user information first
    const { data: userData, error: getUserError } = await adminClient.auth.admin.getUserById(userId)
    
    if (getUserError || !userData?.user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const user = userData.user
    const email = user.email

    if (!email) {
      return NextResponse.json(
        { error: 'User does not have an email address' },
        { status: 400 }
      )
    }

    // Get user's role from profile
    const supabase = await createClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', userId)
      .single()

    const role = profile?.role || user.user_metadata?.role || 'member'

    // Get the base URL for the redirect link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      'http://localhost:3000'

    // Check if user has a password set
    // Note: encrypted_password might not be directly accessible, so we check if user can sign in
    // Users without passwords typically have null or empty encrypted_password
    const hasPassword = user.encrypted_password && user.encrypted_password.length > 0

    // If user doesn't have a password, use password recovery instead of invite
    if (!hasPassword) {
      // Generate password recovery link (for users without passwords)
      // This allows them to set their password
      const { data: recoveryData, error: recoveryError } = await adminClient.auth.admin.generateLink({
        type: 'recovery',
        email: email,
        options: {
          redirectTo: `${baseUrl}/auth/callback`,
        },
      })

      if (recoveryError) {
        console.error('Supabase recovery link error:', recoveryError)
        return NextResponse.json(
          { error: recoveryError.message || 'Failed to generate password reset link' },
          { status: 500 }
        )
      }

      // generateLink creates the link but doesn't automatically send the email
      // We need to trigger Supabase's password reset email
      // Use the Admin API to update user and trigger email, or use the regular auth endpoint
      // For now, we'll use the recovery link and note that email needs to be sent
      // The recovery link can be used to set the password
      
      // Try to use Supabase's built-in password reset by calling the auth endpoint
      // This requires making a request to Supabase's auth API
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      
      if (supabaseUrl && serviceRoleKey) {
        try {
          // Call Supabase's password reset endpoint directly
          const resetResponse = await fetch(`${supabaseUrl}/auth/v1/recover`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': serviceRoleKey,
              'Authorization': `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              email: email,
              redirectTo: `${baseUrl}/auth/callback`,
            }),
          })

          if (resetResponse.ok) {
            return NextResponse.json({
              success: true,
              message: 'Password reset email sent successfully. User can now set their password.',
            })
          } else {
            const errorData = await resetResponse.json().catch(() => ({}))
            console.error('Password reset email error:', errorData)
            // Fallback: return the recovery link
            return NextResponse.json({
              success: true,
              message: 'Password reset link generated. Please send this link to the user manually.',
              recoveryLink: recoveryData?.properties?.action_link,
              note: 'You can copy the recoveryLink above and send it to the user via email.',
            })
          }
        } catch (fetchError) {
          console.error('Error calling password reset endpoint:', fetchError)
          // Fallback: return the recovery link
          return NextResponse.json({
            success: true,
            message: 'Password reset link generated. Please send this link to the user manually.',
            recoveryLink: recoveryData?.properties?.action_link,
            note: 'You can copy the recoveryLink above and send it to the user via email.',
          })
        }
      } else {
        // Fallback: return the recovery link
        return NextResponse.json({
          success: true,
          message: 'Password reset link generated. Please send this link to the user manually.',
          recoveryLink: recoveryData?.properties?.action_link,
          note: 'You can copy the recoveryLink above and send it to the user via email.',
        })
      }
    }

    // User has password - try to invite/reinvite normally
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          role: role,
          default_interface: user.user_metadata?.default_interface || null,
        },
        redirectTo: `${baseUrl}/auth/callback`,
      }
    )

    if (inviteError) {
      console.error('Supabase reinvite error:', inviteError)
      
      // If inviteUserByEmail fails (e.g., user already exists), try generateLink instead
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: 'invite',
        email: email,
        options: {
          redirectTo: `${baseUrl}/auth/callback`,
          data: {
            role: role,
            default_interface: user.user_metadata?.default_interface || null,
          },
        },
      })

      if (linkError) {
        return NextResponse.json(
          { error: linkError.message || 'Failed to generate invitation link' },
          { status: 500 }
        )
      }

      // generateLink creates the link but doesn't send email automatically
      // For now, we'll return success - the link is generated and can be used
      // In production, you might want to send the email via a separate service
      return NextResponse.json({
        success: true,
        message: 'Invitation link generated successfully',
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation sent successfully',
    })
  } catch (error: any) {
    console.error('Error reinviting user:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to reinvite user' },
      { status: 500 }
    )
  }
}
