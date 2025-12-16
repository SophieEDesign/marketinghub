import { createClient } from '@/lib/supabase/server'
import type { TableField } from '@/types/fields'

/**
 * Get all fields for a table
 */
export async function getTableFields(tableId: string): Promise<TableField[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('table_fields')
    .select('*')
    .eq('table_id', tableId)
    .order('position', { ascending: true })

  if (error) {
    // If table doesn't exist, return empty array
    if (error.code === '42P01') {
      return []
    }
    throw error
  }

  return (data || []) as TableField[]
}

/**
 * Get actual columns from Supabase table using information_schema
 */
export async function getActualTableColumns(tableName: string): Promise<Array<{ name: string; type: string }>> {
  const supabase = await createClient()
  
  // Query information_schema to get actual columns
  const { data, error } = await supabase.rpc('get_table_columns', {
    table_name: tableName
  })

  if (error) {
    // Fallback: Try direct query if RPC doesn't exist
    // For now, return empty and let the system work with metadata only
    console.warn('Could not fetch actual columns:', error)
    return []
  }

  return data || []
}

/**
 * Create table_fields table if it doesn't exist
 * This should be run as a migration, but we'll provide a helper
 */
export async function ensureTableFieldsTable(): Promise<void> {
  const supabase = await createClient()
  
  // Try to query the table - if it fails, it doesn't exist
  const { error } = await supabase
    .from('table_fields')
    .select('id')
    .limit(1)

  if (error && error.code === '42P01') {
    // Table doesn't exist - would need to create it via migration
    console.warn('table_fields table does not exist. Please run migration to create it.')
  }
}
