import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/roles'

/**
 * GET /api/admin/bookings - Get all bookings (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Security: Only admins can view bookings
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }

    const supabase = await createClient()
    
    // Try to query bookings table
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      // If table doesn't exist, return empty array instead of error
      if (
        error.code === 'PGRST116' || 
        error.code === '42P01' ||
        error.message?.includes('relation') || 
        error.message?.includes('does not exist')
      ) {
        console.warn('Bookings table does not exist, returning empty array')
        return NextResponse.json({ bookings: [] })
      }
      throw error
    }

    return NextResponse.json({ bookings: bookings || [] })
  } catch (error: any) {
    console.error('Error loading bookings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load bookings' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/bookings - Create a new booking (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Security: Only admins can create bookings
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }

    const supabase = await createClient()
    const body = await request.json()

    const { data: booking, error } = await supabase
      .from('bookings')
      .insert([body])
      .select()
      .single()

    if (error) {
      // If table doesn't exist, return helpful error
      if (
        error.code === 'PGRST116' || 
        error.code === '42P01' ||
        error.message?.includes('relation') || 
        error.message?.includes('does not exist')
      ) {
        return NextResponse.json(
          { error: 'Bookings table does not exist. Please create it first.' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({ booking })
  } catch (error: any) {
    console.error('Error creating booking:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create booking' },
      { status: 500 }
    )
  }
}

