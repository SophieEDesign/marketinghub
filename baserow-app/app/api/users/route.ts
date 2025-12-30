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
    
    // Use admin client to get user emails
    const { createAdminClient } = await import('@/lib/supabase/admin')
    let adminClient
    try {
      adminClient = createAdminClient()
    } catch (error) {
      console.warn('Admin client not available, using profile data only')
    }

    for (const profile of profiles || []) {
      try {
        let email = `User ${profile.user_id.substring(0, 8)}...`
        let name = null
        let lastActive = null

        // Try to get user details from auth.users if admin client is available
        if (adminClient) {
          try {
            const { data: authUser } = await adminClient.auth.admin.getUserById(profile.user_id)
            if (authUser?.user) {
              email = authUser.user.email || email
              name = authUser.user.user_metadata?.name || authUser.user.user_metadata?.full_name || null
              lastActive = authUser.user.last_sign_in_at || null
            }
          } catch (error) {
            // If we can't get user details, use placeholder
            console.warn(`Could not fetch user details for ${profile.user_id}`)
          }
        }

        // Ensure role is always set (default to 'member' if null/undefined)
        const role = profile.role || 'member'

        users.push({
          id: profile.id,
          user_id: profile.user_id,
          email: email,
          name: name,
          role: role as 'admin' | 'member',
          is_active: true,
          last_active: lastActive,
          created_at: profile.created_at,
        })
      } catch (error) {
        // If we can't get user details, still include the profile
        const role = profile.role || 'member'
        users.push({
          id: profile.id,
          user_id: profile.user_id,
          email: `User ${profile.user_id.substring(0, 8)}...`,
          name: null,
          role: role as 'admin' | 'member',
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
