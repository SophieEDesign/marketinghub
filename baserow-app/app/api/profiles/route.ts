import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/roles'

/**
 * GET /api/profiles - Get all profiles (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Security: Only admins can view all profiles
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }

    const supabase = await createClient()
    
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      // If table doesn't exist, return empty array
      if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
        return NextResponse.json({ profiles: [] })
      }
      throw error
    }

    return NextResponse.json({ profiles: profiles || [] })
  } catch (error: any) {
    console.error('Error loading profiles:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load profiles' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/profiles - Create or update a profile (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Security: Only admins can create/update profiles
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }

    const supabase = await createClient()
    const body = await request.json()
    const { user_id, role } = body

    if (!user_id || !role) {
      return NextResponse.json(
        { error: 'user_id and role are required' },
        { status: 400 }
      )
    }

    if (role !== 'admin' && role !== 'member') {
      return NextResponse.json(
        { error: 'role must be "admin" or "member"' },
        { status: 400 }
      )
    }

    // Upsert profile (create or update)
    const { data: profile, error } = await supabase
      .from('profiles')
      .upsert({
        user_id,
        role,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ profile })
  } catch (error: any) {
    console.error('Error creating/updating profile:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create/update profile' },
      { status: 500 }
    )
  }
}
