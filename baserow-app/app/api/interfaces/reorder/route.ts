import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/interfaces/reorder - Reorder interfaces within or between groups
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { interfaceUpdates } = body // Array of { id, group_id, order_index }

    if (!Array.isArray(interfaceUpdates)) {
      return NextResponse.json(
        { error: 'interfaceUpdates must be an array' },
        { status: 400 }
      )
    }

    // Get or create "Ungrouped" group for null group_id values
    // The schema requires group_id to be NOT NULL, so we need to use a system group
    let ungroupedGroupId: string | null = null
    const hasNullGroupId = interfaceUpdates.some((u: { group_id: string | null }) => u.group_id === null)
    
    if (hasNullGroupId) {
      // Try to find existing "Ungrouped" group
      const { data: existingGroup } = await supabase
        .from('interface_groups')
        .select('id')
        .eq('name', 'Ungrouped')
        .maybeSingle()
      
      if (existingGroup) {
        ungroupedGroupId = existingGroup.id
      } else {
        // Create "Ungrouped" group if it doesn't exist
        // Note: is_system column may not exist in all databases, so we'll try without it first
        const { data: newGroup, error: createError } = await supabase
          .from('interface_groups')
          .insert({
            name: 'Ungrouped',
            order_index: 9999,
            collapsed: false,
          })
          .select('id')
          .single()
        
        if (createError || !newGroup) {
          console.error('Error creating Ungrouped group:', createError)
          return NextResponse.json(
            { error: `Failed to create Ungrouped group: ${createError?.message || 'Unknown error'}` },
            { status: 500 }
          )
        }
        
        ungroupedGroupId = newGroup.id
        
        // Try to mark as system group if column exists (non-critical)
        await supabase
          .from('interface_groups')
          .update({ is_system: true })
          .eq('id', ungroupedGroupId)
          .then(() => {}) // Ignore errors - column might not exist
      }
    }

    // Update each interface page's group_id and order_index
    // Interface pages are stored in interface_pages table, not views
    const updatePromises = interfaceUpdates.map(async (update: { id: string; group_id: string | null; order_index: number }) => {
      // Replace null group_id with ungrouped group ID
      const finalGroupId = update.group_id === null ? ungroupedGroupId : update.group_id
      
      if (!finalGroupId) {
        throw new Error(`Cannot update interface page ${update.id}: group_id is required`)
      }
      
      const { error } = await supabase
        .from('interface_pages')
        .update({
          group_id: finalGroupId,
          order_index: update.order_index,
        })
        .eq('id', update.id)
      
      if (error) {
        console.error(`Error updating interface page ${update.id}:`, error)
        throw new Error(`Failed to update interface page ${update.id}: ${error.message}`)
      }
      
      return { id: update.id, success: true }
    })

    await Promise.all(updatePromises)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error in reorder API:', error)
    const errorMessage = (error as { message?: string })?.message || 'Failed to reorder interfaces'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
