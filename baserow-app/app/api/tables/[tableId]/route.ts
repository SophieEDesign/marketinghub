import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTable } from '@/lib/crud/tables'
import { isAdmin } from '@/lib/roles'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { tableId: string } }
) {
  try {
    // Check admin permissions
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      )
    }

    const supabase = await createClient()
    const body = await request.json()
    const { name, description } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Table name is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    const table = await getTable(params.tableId)
    if (!table) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      )
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (name !== undefined) updates.name = name.trim()
    if (description !== undefined) updates.description = description || null

    const { data: updatedTable, error: updateError } = await supabase
      .from('tables')
      .update(updates)
      .eq('id', params.tableId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to update table: ${updateError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ table: updatedTable })
  } catch (error: any) {
    console.error('Error updating table:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update table' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { tableId: string } }
) {
  try {
    // Check admin permissions
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      )
    }

    const supabase = await createClient()
    const table = await getTable(params.tableId)

    if (!table) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      )
    }

    // 0. Before deleting views, identify and handle pages that will lose their anchor
    // Pages with saved_view_id pointing to views from this table will have their anchor
    // set to NULL when views are deleted (ON DELETE CASCADE). We need to handle these pages.
    
    // Find views that will be deleted
    const { data: viewsToDelete, error: viewsFetchError } = await supabase
      .from('views')
      .select('id')
      .eq('table_id', params.tableId)

    if (viewsFetchError) {
      console.error('Error fetching views to delete:', viewsFetchError)
      // Continue anyway
    }

    const viewIdsToDelete = viewsToDelete?.map(v => v.id) || []

    // Find pages that depend on these views via saved_view_id
    // These pages will lose their anchor when views are deleted
    if (viewIdsToDelete.length > 0) {
      const { data: orphanedPages, error: orphanedPagesError } = await supabase
        .from('interface_pages')
        .select('id, saved_view_id')
        .in('saved_view_id', viewIdsToDelete)

      if (orphanedPagesError) {
        console.error('Error finding orphaned pages:', orphanedPagesError)
      } else if (orphanedPages && orphanedPages.length > 0) {
        // Delete pages that will lose their anchor
        // These pages are invalid without their anchor view
        const orphanedPageIds = orphanedPages.map(p => p.id)
        const { error: deleteOrphanedError } = await supabase
          .from('interface_pages')
          .delete()
          .in('id', orphanedPageIds)

        if (deleteOrphanedError) {
          console.error('Error deleting orphaned pages:', deleteOrphanedError)
          return NextResponse.json(
            { error: `Failed to delete table: Cannot delete pages that depend on this table's views: ${deleteOrphanedError.message}` },
            { status: 500 }
          )
        }
      }
    }

    // 1. Delete all views associated with this table
    // This will now work because we've already deleted pages that depended on these views
    const { error: viewsError } = await supabase
      .from('views')
      .delete()
      .eq('table_id', params.tableId)

    if (viewsError) {
      console.error('Error deleting views:', viewsError)
      // Continue anyway - we'll try to clean up what we can
    }

    // 2. Disconnect remaining pages from this table (set base_table to null)
    // This allows pages to be reconnected to a different table later
    // Only do this after views are deleted to avoid anchor validation trigger issues
    // Note: Pages that depended on deleted views were already deleted in step 0
    const { error: pagesDisconnectError } = await supabase
      .from('interface_pages')
      .update({ base_table: null })
      .eq('base_table', params.tableId)

    if (pagesDisconnectError) {
      // If this is an anchor validation error, provide a clearer message
      if (pagesDisconnectError.message?.includes('exactly one anchor')) {
        console.error('Error disconnecting pages from table (anchor validation):', pagesDisconnectError)
        return NextResponse.json(
          { error: `Failed to delete table: Some pages associated with this table are in an invalid state. Please delete those pages manually first. ${pagesDisconnectError.message}` },
          { status: 500 }
        )
      }
      console.error('Error disconnecting pages from table:', pagesDisconnectError)
      // Continue anyway - we'll try to clean up what we can
    }

    // 3. Delete all fields associated with this table
    const { error: fieldsError } = await supabase
      .from('table_fields')
      .delete()
      .eq('table_id', params.tableId)

    if (fieldsError) {
      console.error('Error deleting fields:', fieldsError)
      // Continue anyway
    }

    // 4. Delete view_fields that reference fields from this table
    // (This is a cleanup step - view_fields reference field names, not table_id)
    // We'll let cascade handle this if there's a foreign key, otherwise it's okay

    // 5. Drop the actual Supabase table if it exists
    if (table.supabase_table) {
      try {
        const dropTableSQL = `DROP TABLE IF EXISTS "${table.supabase_table}" CASCADE;`
        const { error: dropError } = await supabase.rpc('execute_sql_safe', {
          sql_text: dropTableSQL
        })

        if (dropError) {
          console.error('Error dropping Supabase table:', dropError)
          // Continue anyway - metadata cleanup is important
        }
      } catch (sqlErr: any) {
        console.error('Error executing DROP TABLE:', sqlErr)
        // Continue with metadata cleanup
      }
    }

    // 6. Delete the table metadata record
    const { error: deleteError } = await supabase
      .from('tables')
      .delete()
      .eq('id', params.tableId)

    if (deleteError) {
      return NextResponse.json(
        { error: `Failed to delete table: ${deleteError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting table:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete table' },
      { status: 500 }
    )
  }
}
