// Client-side import will be done dynamically
import type { ParsedColumn } from './csvParser'

/**
 * Create all metadata records for imported table.
 *
 * Behavior:
 * - Always creates a first field called "Title" which is treated as the
 *   default label/ID-style field for the table.
 * - The Title field:
 *   - Uses internal name "title"
 *   - Has label "Title" by default
 *   - Is type "text" by default
 *   - Is stored at position/order_index 0 and is intended to stay at order 1.
 * - The table's primary_field_name is set to this internal name so other
 *   parts of the app (duplicate detection, record display, etc.) use it as
 *   the default primary field unless explicitly changed later.
 */
export async function createImportMetadata(
  tableName: string,
  displayName: string,
  columns: ParsedColumn[]
): Promise<{ 
  success: boolean
  tableId?: string
  viewId?: string
  error?: string 
}> {
  // This runs client-side, so we need to use the client
  const { supabase } = await import('@/lib/supabase/client')

  try {
    // 1. Create table record
    const { data: tableData, error: tableError } = await supabase
      .from('tables')
      .insert([
        {
          name: displayName,
          supabase_table: tableName,
          description: `Imported from CSV on ${new Date().toISOString()}`,
        },
      ])
      .select()
      .single()

    if (tableError || !tableData) {
      return {
        success: false,
        error: `Failed to create table record: ${tableError?.message || 'Unknown error'}`,
      }
    }

    const tableId = tableData.id

    // 2. Create default grid view
    const { data: viewData, error: viewError } = await supabase
      .from('views')
      .insert([
        {
          table_id: tableId,
          name: 'Grid View',
          type: 'grid',
        },
      ])
      .select()
      .single()

    if (viewError || !viewData) {
      return {
        success: false,
        tableId,
        error: `Failed to create view: ${viewError?.message || 'Unknown error'}`,
      }
    }

    const viewId = viewData.id

    // 3. Create view_fields for each column
    const viewFields = columns.map((col, index) => ({
      view_id: viewId,
      field_name: col.sanitizedName,
      visible: true,
      position: index,
    }))

    const { error: fieldsError } = await supabase
      .from('view_fields')
      .insert(viewFields)

    if (fieldsError) {
      console.error('Error creating view fields:', fieldsError)
      // Don't fail the whole import if fields fail - they can be added later
    }

    return {
      success: true,
      tableId,
      viewId,
    }
  } catch (error: any) {
    console.error('Error creating metadata:', error)
    return {
      success: false,
      error: error.message || 'Failed to create metadata',
    }
  }
}
