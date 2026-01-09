import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/roles'

/**
 * DELETE /api/users/[userId] - Delete a user (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Security: Only admins can delete users
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }

    const { userId } = await params

    // Use admin client to delete user
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

    // First, delete the user's profile from the profiles table
    const supabase = await createClient()
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('user_id', userId)

    if (profileError) {
      console.warn('Error deleting profile (may not exist):', profileError)
      // Continue with auth user deletion even if profile deletion fails
    }

    // Delete user from auth
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error('Error deleting user:', deleteError)
      
      // Handle specific error cases
      const errorMessage = deleteError.message || ''
      if (
        errorMessage.includes('Invalid API key') ||
        errorMessage.includes('JWT') ||
        (errorMessage.includes('invalid') && errorMessage.includes('key')) ||
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('401') ||
        errorMessage.includes('403') ||
        errorMessage.includes('User not allowed')
      ) {
        return NextResponse.json(
          { 
            error: 'Server configuration error: Invalid service role key or insufficient permissions. Please verify SUPABASE_SERVICE_ROLE_KEY is correct and has admin privileges.',
            details: 'To fix this: 1) Go to your Supabase project → Settings → API, 2) Copy the "service_role" key (NOT the anon key), 3) Add it to Vercel project settings → Environment Variables as SUPABASE_SERVICE_ROLE_KEY, 4) Redeploy your application.'
          },
          { status: 500 }
        )
      }
      
      return NextResponse.json(
        { error: deleteError.message || 'Failed to delete user' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    })
  } catch (error: any) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete user' },
      { status: 500 }
    )
  }
}
