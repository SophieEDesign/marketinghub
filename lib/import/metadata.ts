// Client-side import will be done dynamically
import type { ParsedColumn } from './csvParser'

type TableFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'checkbox'
  | 'single_select'
  | 'multi_select'

function mapParsedColumnToTableFieldType(colType: ParsedColumn['type']): TableFieldType {
  switch (colType) {
    case 'boolean':
      return 'checkbox'
    case 'single_select':
      return 'single_select'
    case 'multi_select':
      return 'multi_select'
    case 'number':
      return 'number'
    case 'date':
      return 'date'
    case 'text':
    default:
      return 'text'
  }
}

function extractChoicesForColumn(
  rows: Record<string, any>[],
  columnName: string,
  fieldType: 'single_select' | 'multi_select'
): string[] {
  const unique = new Set<string>()
  let checked = 0

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const raw = (row as any)[columnName]
    if (raw === null || raw === undefined || raw === '') continue

    const s = String(raw).trim()
    if (!s) continue

    checked++

    if (fieldType === 'multi_select') {
      s.split(/[,;]/)
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .forEach(p => unique.add(p))
    } else {
      unique.add(s)
    }

    // Soft cap to avoid huge sets from very large CSVs
    if (checked > 10000 && unique.size > 200) break
  }

  return Array.from(unique).sort().slice(0, 100)
}

/**
 * Create all metadata records for imported table
 */
export async function createImportMetadata(
  tableName: string,
  displayName: string,
  columns: ParsedColumn[],
  rows: Record<string, any>[]
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

    // 2.5 Create table_fields (field metadata, including select choices)
    const tableFieldsPayload = columns.map((col, index) => {
      const fieldType = mapParsedColumnToTableFieldType(col.type)
      const options: Record<string, any> = {}

      if (fieldType === 'single_select' || fieldType === 'multi_select') {
        const choices = extractChoicesForColumn(rows, col.name, fieldType)
        if (choices.length > 0) {
          options.choices = choices
        }
      }

      return {
        table_id: tableId,
        name: col.sanitizedName,
        label: col.name, // preserve original header as user-facing label
        type: fieldType,
        position: index,
        order_index: index,
        required: false,
        options,
      }
    })

    const { error: tableFieldsError } = await supabase
      .from('table_fields')
      .upsert(tableFieldsPayload as any, { onConflict: 'table_id,name' })

    if (tableFieldsError) {
      const msg = tableFieldsError.message || 'Unknown error'
      // Help the user if migrations haven't been applied yet.
      if (
        msg.includes('relation "table_fields" does not exist') ||
        msg.toLowerCase().includes('table_fields') && msg.toLowerCase().includes('does not exist')
      ) {
        return {
          success: false,
          tableId,
          viewId,
          error:
            `Database Setup Required\n\n` +
            `The table_fields table is missing. To fix this:\n\n` +
            `1. Go to your Supabase Dashboard\n` +
            `2. Navigate to SQL Editor\n` +
            `3. Run the migration file: supabase/migrations/create_table_fields.sql\n\n` +
            `This enables field metadata (including select options).`,
        }
      }

      // If this fails we should stop, because select options rely on it.
      return {
        success: false,
        tableId,
        viewId,
        error: `Failed to create field metadata: ${msg}`,
      }
    }

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
