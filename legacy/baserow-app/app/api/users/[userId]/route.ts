import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/roles'

/**
 * PATCH /api/users/[userId] - Update user email and name (admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Security: Only admins can update user information
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }

    const { userId } = await params
    const body = await request.json()
    const { email, name } = body

    // Validate that at least one field is provided
    if (email === undefined && name === undefined) {
      return NextResponse.json(
        { error: 'At least one field (email or name) must be provided' },
        { status: 400 }
      )
    }

    // Validate email format if provided
    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email.trim())) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        )
      }
    }

    // Use admin client to update user
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

    // Prepare update object
    const updateData: {
      email?: string
      user_metadata?: Record<string, any>
    } = {}

    if (email !== undefined) {
      updateData.email = email.trim()
    }

    if (name !== undefined) {
      // Get current user metadata to preserve other fields
      const { data: currentUser, error: getUserError } = await adminClient.auth.admin.getUserById(userId)
      
      if (getUserError) {
        console.error('Error fetching current user:', getUserError)
        // Handle invalid API key error specifically
        const errorMessage = getUserError.message || ''
        if (
          errorMessage.includes('Invalid API key') ||
          errorMessage.includes('JWT') ||
          (errorMessage.includes('invalid') && errorMessage.includes('key')) ||
          errorMessage.includes('unauthorized') ||
          errorMessage.includes('401')
        ) {
          return NextResponse.json(
            { 
              error: 'Server configuration error: Invalid service role key. Please verify SUPABASE_SERVICE_ROLE_KEY is correct.',
              details: 'To fix this: 1) Go to your Supabase project → Settings → API, 2) Copy the "service_role" key (NOT the anon key), 3) Add it to Vercel project settings → Environment Variables as SUPABASE_SERVICE_ROLE_KEY, 4) Redeploy your application.'
            },
            { status: 500 }
          )
        }
        return NextResponse.json(
          { error: getUserError.message || 'Failed to fetch user information' },
          { status: 500 }
        )
      }
      
      const currentMetadata = currentUser?.user?.user_metadata || {}
      
      updateData.user_metadata = {
        ...currentMetadata,
        name: name.trim() || null,
        full_name: name.trim() || null, // Store in both fields for compatibility
      }
    }

    // Update user
    const { data: updatedUser, error: updateError } = await adminClient.auth.admin.updateUserById(
      userId,
      updateData
    )

    if (updateError) {
      console.error('Error updating user:', updateError)
      
      // Handle invalid API key error specifically
      const errorMessage = updateError.message || ''
      if (
        errorMessage.includes('Invalid API key') ||
        errorMessage.includes('JWT') ||
        (errorMessage.includes('invalid') && errorMessage.includes('key')) ||
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('401')
      ) {
        return NextResponse.json(
          { 
            error: 'Server configuration error: Invalid service role key. Please verify SUPABASE_SERVICE_ROLE_KEY is correct.',
            details: 'To fix this: 1) Go to your Supabase project → Settings → API, 2) Copy the "service_role" key (NOT the anon key), 3) Add it to Vercel project settings → Environment Variables as SUPABASE_SERVICE_ROLE_KEY, 4) Redeploy your application.'
          },
          { status: 500 }
        )
      }
      
      return NextResponse.json(
        { error: updateError.message || 'Failed to update user' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      user: {
        id: updatedUser.user.id,
        email: updatedUser.user.email,
        name: updatedUser.user.user_metadata?.name || updatedUser.user.user_metadata?.full_name || null,
      },
    })
  } catch (error: any) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update user' },
      { status: 500 }
    )
  }
}

