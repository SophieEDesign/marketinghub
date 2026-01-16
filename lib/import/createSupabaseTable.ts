// Client-side import will be done dynamically

export interface ColumnDefinition {
  name: string
  type: 'text' | 'number' | 'boolean' | 'date'
}

/**
 * Map inferred type to PostgreSQL type
 */
function mapToPostgresType(type: 'text' | 'number' | 'boolean' | 'date'): string {
  switch (type) {
    case 'number':
      return 'numeric'
    case 'boolean':
      return 'boolean'
    case 'date':
      return 'timestamptz'
    case 'text':
    default:
      return 'text'
  }
}

/**
 * Create a Supabase table dynamically
 */
export async function createSupabaseTable(
  tableName: string,
  columns: ColumnDefinition[]
): Promise<{ success: boolean; error?: string }> {
  // This runs client-side, so we need to use the client
  const { supabase } = await import('@/lib/supabase/client')

  try {
    // Build SQL to create table
    const columnDefinitions = columns
      .map(col => {
        const pgType = mapToPostgresType(col.type)
        return `"${col.name}" ${pgType}`
      })
      .join(',\n    ')

    const sql = `
      CREATE TABLE IF NOT EXISTS "${tableName}" (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        created_by uuid NOT NULL DEFAULT auth.uid(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid NOT NULL DEFAULT auth.uid(),
        ${columnDefinitions}
      );
    `

    // Try to use enhanced RPC function first (create_table_with_columns)
    const columnsJson = columns.map(col => ({
      name: col.name,
      type: mapToPostgresType(col.type)
    }))
    
    const { error: rpcError } = await supabase.rpc('create_table_with_columns', {
      table_name: tableName,
      columns: columnsJson as any // Supabase will serialize to JSONB
    })

    if (rpcError) {
      // Fallback: Try create base table, then add columns one by one
      const { error: baseTableError } = await supabase.rpc('create_dynamic_table', {
        table_name: tableName
      })

      if (baseTableError) {
        return {
          success: false,
          error: `Failed to create table. RPC function may not be available. SQL needed: ${sql}`
        }
      }

      // Add columns one by one
      for (const column of columns) {
        const pgType = mapToPostgresType(column.type)
        const { error: addColumnError } = await supabase.rpc('add_column_to_table', {
          table_name: tableName,
          column_name: column.name,
          column_type: pgType
        })

        if (addColumnError) {
          console.warn(`Failed to add column ${column.name}:`, addColumnError)
          // Continue with other columns
        }
      }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error creating Supabase table:', error)
    return {
      success: false,
      error: error.message || 'Failed to create table'
    }
  }
}
