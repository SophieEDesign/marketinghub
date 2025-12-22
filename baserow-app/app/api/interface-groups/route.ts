import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/interface-groups - Get all interface groups
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    // If table doesn't exist yet (migration not run), return empty array
    const { data: groups, error } = await supabase
      .from('interface_groups')
      .select('*')
      .order('order_index', { ascending: true })

    if (error) {
      // If table doesn't exist (42P01) or relation doesn't exist (PGRST116), return empty array
      if (error.code === '42P01' || error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
        console.warn('interface_groups table may not exist yet, returning empty groups array')
        return NextResponse.json({ groups: [] })
      }
      
      // If RLS error (401/403), return empty array (user might not have access yet)
      if (error.code === 'PGRST301' || error.message?.includes('permission') || error.message?.includes('policy')) {
        console.warn('RLS policy may be blocking access, returning empty groups array')
        return NextResponse.json({ groups: [] })
      }
      
      return NextResponse.json(
        { error: error.message || 'Failed to load interface groups' },
        { status: 500 }
      )
    }

    return NextResponse.json({ groups: groups || [] })
  } catch (error: any) {
    // If any error occurs, return empty array to prevent breaking the UI
    console.warn('Error loading interface groups:', error)
    return NextResponse.json({ groups: [] })
  }
}

/**
 * POST /api/interface-groups - Create a new interface group
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      // Silently fail - interface groups are optional
      console.warn('User not authenticated, cannot create interface group')
      return NextResponse.json({ group: null }, { status: 200 })
    }

    const body = await request.json()
    const { name, workspace_id } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Group name is required' },
        { status: 400 }
      )
    }

    // Get max order_index to place new group at bottom
    const { data: lastGroup } = await supabase
      .from('interface_groups')
      .select('order_index')
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle()

    const orderIndex = lastGroup ? (lastGroup.order_index + 1) : 0

    const { data: group, error } = await supabase
      .from('interface_groups')
      .insert([
        {
          name: name.trim(),
          workspace_id: workspace_id || null,
          order_index: orderIndex,
          collapsed: false,
        },
      ])
      .select()
      .single()

    if (error) {
      // If table doesn't exist or RLS error, silently fail
      if (error.code === '42P01' || error.code === 'PGRST116' || 
          error.code === 'PGRST301' ||
          error.message?.includes('relation') || 
          error.message?.includes('does not exist') ||
          error.message?.includes('permission') ||
          error.message?.includes('policy')) {
        console.warn('interface_groups table may not exist or RLS blocking, cannot create group')
        return NextResponse.json({ group: null }, { status: 200 })
      }
      
      console.error('Error creating interface group:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to create interface group' },
        { status: 500 }
      )
    }

    return NextResponse.json({ group }, { status: 201 })
  } catch (error: any) {
    // Silently fail - interface groups are optional
    console.warn('Error creating interface group:', error)
    return NextResponse.json({ group: null }, { status: 200 })
  }
}
