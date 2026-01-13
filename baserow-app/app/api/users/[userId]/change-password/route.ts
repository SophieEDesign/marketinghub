import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/roles'

/**
 * POST /api/users/[userId]/change-password
 * Allows admins to change a user's password
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // Security: Only admins can change passwords
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }

    const { password } = await request.json()

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // Check password strength (at least 2 of: uppercase, lowercase, numbers, special)
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
    if (criteriaMet < 2) {
      return NextResponse.json(
        { 
          error: 'Password must include at least 2 of: uppercase letters, lowercase letters, numbers, or special characters' 
        },
        { status: 400 }
      )
    }

    // Use admin client to update password
    const adminClient = createAdminClient()

    // Update user password using admin API
    const { data, error } = await adminClient.auth.admin.updateUserById(
      params.userId,
      {
        password: password,
      }
    )

    if (error) {
      console.error('Error updating password:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to update password' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully',
    })
  } catch (error: any) {
    console.error('Error in change password route:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update password' },
      { status: 500 }
    )
  }
}
