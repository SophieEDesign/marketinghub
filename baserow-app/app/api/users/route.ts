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
    
    // Use admin client to get user emails and pending invitations
    const { createAdminClient } = await import('@/lib/supabase/admin')
    let adminClient
    try {
      adminClient = createAdminClient()
    } catch (error) {
      console.warn('Admin client not available, using profile data only')
    }

    // Get profile user IDs to check which users have profiles
    // Ensure profiles is an array (defensive check)
    const profilesArray = Array.isArray(profiles) ? profiles : []
    const profileUserIds = new Set(profilesArray.map(p => p.user_id))

    // If admin client is available, also load pending invitations (users without profiles)
    if (adminClient) {
      try {
        // List all users from auth.users
        const { data: authUsersData, error: listError } = await adminClient.auth.admin.listUsers()
        
        // Ensure users is an array (defensive check)
        const authUsers = Array.isArray(authUsersData?.users) ? authUsersData.users : []
        
        if (!listError && authUsers.length > 0) {
          // Find users who have been invited but don't have profiles yet
          for (const authUser of authUsers) {
            // Skip if user already has a profile (will be handled below)
            if (profileUserIds.has(authUser.id)) {
              continue
            }

            // Check if user was invited (has invited_at but hasn't signed in)
            const isInvited = authUser.invited_at && !authUser.last_sign_in_at
            const isPending = isInvited || (!authUser.confirmed_at && authUser.email)

            if (isPending && authUser.email) {
              // This is a pending invitation - user hasn't accepted yet
              const role = (authUser.user_metadata?.role || 'member') as 'admin' | 'member'
              
              users.push({
                id: `pending-${authUser.id}`, // Use a temporary ID since no profile exists
                user_id: authUser.id,
                email: authUser.email,
                name: authUser.user_metadata?.name || authUser.user_metadata?.full_name || null,
                role: role,
                is_active: false, // Pending invitations are not active
                is_pending: true, // Mark as pending invitation
                last_active: null,
                created_at: authUser.created_at || new Date().toISOString(),
              })
            }
          }
        }
      } catch (error) {
        console.warn('Could not load pending invitations:', error)
      }
    }

    // Load users with profiles (accepted invitations)
    // Ensure profiles is an array (defensive check)
    for (const profile of profilesArray) {
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

    // Ensure users is always an array before returning
    const usersArray = Array.isArray(users) ? users : []
    return NextResponse.json({ users: usersArray })
  } catch (error: any) {
    console.error('Error loading users:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load users' },
      { status: 500 }
    )
  }
}
