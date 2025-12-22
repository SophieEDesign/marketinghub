import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/interface-groups - Get all interface groups
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: groups, error } = await supabase
      .from('interface_groups')
      .select('*')
      .order('order_index', { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Failed to load interface groups' },
        { status: 500 }
      )
    }

    return NextResponse.json({ groups: groups || [] })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to load interface groups' },
      { status: 500 }
    )
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
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
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
      return NextResponse.json(
        { error: error.message || 'Failed to create interface group' },
        { status: 500 }
      )
    }

    return NextResponse.json({ group }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create interface group' },
      { status: 500 }
    )
  }
}
