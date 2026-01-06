import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * PATCH /api/interface-groups/[groupId] - Update an interface group
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    // Optional: Check authentication (RLS will handle it, but we can be explicit)
    // if (!user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }
    
    const body = await request.json()
    const { name, order_index, collapsed, is_admin_only } = body

    const updates: any = {}
    if (name !== undefined) updates.name = name.trim()
    if (order_index !== undefined) updates.order_index = order_index
    if (collapsed !== undefined) updates.collapsed = collapsed
    if (is_admin_only !== undefined) updates.is_admin_only = is_admin_only

    const { data: group, error } = await supabase
      .from('interface_groups')
      .update(updates)
      .eq('id', groupId)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Failed to update interface group' },
        { status: 500 }
      )
    }

    return NextResponse.json({ group })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update interface group' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/interface-groups/[groupId] - Delete an interface group
 * Moves all interfaces in this group to uncategorized (group_id = null)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    // Optional: Check authentication (RLS will handle it, but we can be explicit)
    // if (!user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    // Find the "Ungrouped" system group to move pages to
    const { data: ungroupedGroup } = await supabase
      .from('interface_groups')
      .select('id')
      .eq('is_system', true)
      .ilike('name', '%ungrouped%')
      .maybeSingle()

    const targetGroupId = ungroupedGroup?.id || null

    // Move all interface pages in this group to Ungrouped (or null if no Ungrouped group)
    await supabase
      .from('interface_pages')
      .update({ group_id: targetGroupId })
      .eq('group_id', groupId)

    // Also move views table entries (for backward compatibility)
    await supabase
      .from('views')
      .update({ group_id: targetGroupId })
      .eq('group_id', groupId)
      .eq('type', 'interface')

    // Delete the group
    const { error } = await supabase
      .from('interface_groups')
      .delete()
      .eq('id', groupId)

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Failed to delete interface group' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete interface group' },
      { status: 500 }
    )
  }
}
