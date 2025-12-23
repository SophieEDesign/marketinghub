import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/roles'

export async function GET(request: NextRequest) {
  try {
    // Security: Only admins can view all users
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }

    const supabase = await createClient()
    
    // Load profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (profilesError) {
      return NextResponse.json({ users: [] })
    }

    // Load auth users to get emails and metadata
    // Note: This requires service role or admin access
    const users = []
    
    for (const profile of profiles || []) {
      try {
        // Try to get user from auth.users via admin API
        // In production, you'd use Supabase Admin API with service role
        // For now, we'll return profile data and let client handle display
        users.push({
          id: profile.id,
          user_id: profile.user_id,
          email: `User ${profile.user_id.substring(0, 8)}...`, // Placeholder
          name: null,
          role: profile.role,
          is_active: true,
          last_active: null,
          created_at: profile.created_at,
        })
      } catch (error) {
        // If we can't get user details, still include the profile
        users.push({
          id: profile.id,
          user_id: profile.user_id,
          email: `User ${profile.user_id.substring(0, 8)}...`,
          name: null,
          role: profile.role,
          is_active: true,
          last_active: null,
          created_at: profile.created_at,
        })
      }
    }

    return NextResponse.json({ users })
  } catch (error: any) {
    console.error('Error loading users:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load users' },
      { status: 500 }
    )
  }
}
