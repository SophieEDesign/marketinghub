import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/roles'

function isPermissionDenied(error: { code?: string; message?: string } | null | undefined) {
  return Boolean(
    error &&
    (error.code === '42501' ||
      error.code === 'PGRST301' ||
      error.message?.toLowerCase().includes('permission') ||
      error.message?.toLowerCase().includes('policy'))
  )
}

/**
 * PATCH /api/interface-groups/[groupId] - Update an interface group
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }
    const { groupId } = await params
    const supabase = await createClient()
    
    const body = await request.json()
    const { name, order_index, collapsed, is_admin_only, icon } = body

    const updates: any = {}
    if (name !== undefined) updates.name = name.trim()
    if (order_index !== undefined) updates.order_index = order_index
    if (collapsed !== undefined) updates.collapsed = collapsed
    if (is_admin_only !== undefined) updates.is_admin_only = is_admin_only
    // Only include icon if provided and column exists (will fail gracefully if column doesn't exist)
    if (icon !== undefined) updates.icon = icon

    const { data: group, error } = await supabase
      .from('interface_groups')
      .update(updates)
      .eq('id', groupId)
      .select()
      .single()

    if (error) {
      if (isPermissionDenied(error)) {
        return NextResponse.json(
          { error: 'Unauthorized: Admin access required' },
          { status: 403 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to update interface group' },
        { status: 500 }
      )
    }

    return NextResponse.json({ group })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update interface group' },
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
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }
    const { groupId } = await params
    const supabase = await createClient()

    // Find the "Ungrouped" system group to move pages to
    const { data: ungroupedGroup } = await supabase
      .from('interface_groups')
      .select('id')
      .eq('is_system', true)
      .ilike('name', '%ungrouped%')
      .maybeSingle()

    const targetGroupId = ungroupedGroup?.id || null

    // Move all interface pages in this group to Ungrouped (or null if no Ungrouped group)
    const { error: movePagesError } = await supabase
      .from('interface_pages')
      .update({ group_id: targetGroupId })
      .eq('group_id', groupId)
    if (movePagesError && isPermissionDenied(movePagesError)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }

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
      if (isPermissionDenied(error)) {
        return NextResponse.json(
          { error: 'Unauthorized: Admin access required' },
          { status: 403 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to delete interface group' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to delete interface group' },
      { status: 500 }
    )
  }
}
