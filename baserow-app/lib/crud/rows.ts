import { createClient } from '@/lib/supabase/server'
import type { TableRow } from '@/types/database'

async function resolveSupabaseTableName(tableId: string): Promise<string> {
  const supabase = await createClient()
  const { data: table, error } = await supabase
    .from('tables')
    .select('supabase_table')
    .eq('id', tableId)
    .maybeSingle()
  if (error || !table?.supabase_table) {
    throw new Error(`Table not found for table_id=${tableId}`)
  }
  return table.supabase_table
}

export async function getRows(tableId: string, options?: {
  limit?: number
  offset?: number
  filters?: any[]
  sorts?: any[]
}) {
  if (!tableId) {
    console.warn("getRows: tableId is required")
    return []
  }

  // Sanitize tableId - remove any trailing :X patterns (might be view ID or malformed)
  const sanitizedTableId = tableId.split(':')[0]

  const supabase = await createClient()
  const physicalTable = await resolveSupabaseTableName(sanitizedTableId)
  let query = supabase
    .from(physicalTable)
    .select('*')
  
  if (options?.limit) {
    query = query.limit(options.limit)
  }
  
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
  }
  
  if (options?.sorts && options.sorts.length > 0) {
    // Apply sorting
    for (const sort of options.sorts) {
      query = query.order(sort.field_name || 'created_at', { ascending: sort.order_direction === 'asc' })
    }
  } else {
    query = query.order('created_at', { ascending: false })
  }
  
  const { data, error } = await query
  
  if (error) {
    throw error
  }
  return (data || []) as TableRow[]
}

export async function getRow(tableId: string, id: string) {
  const supabase = await createClient()
  const physicalTable = await resolveSupabaseTableName(tableId)
  const { data, error } = await supabase
    .from(physicalTable)
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) throw error
  return data as TableRow
}

export async function createRow(row: Omit<TableRow, 'id' | 'created_at' | 'updated_at'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const physicalTable = await resolveSupabaseTableName(row.table_id)
  
  const { data, error } = await supabase
    .from(physicalTable)
    .insert([{ ...(row.data || {}), created_by: user?.id }])
    .select()
    .single()
  
  if (error) throw error
  return data as TableRow
}

export async function updateRow(tableId: string, id: string, updates: Partial<TableRow>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const physicalTable = await resolveSupabaseTableName(tableId)
  
  const { data, error } = await supabase
    .from(physicalTable)
    .update({ ...(updates.data || {}), updated_by: user?.id })
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data as TableRow
}

export async function deleteRow(tableId: string, id: string) {
  const supabase = await createClient()
  const physicalTable = await resolveSupabaseTableName(tableId)
  const { error } = await supabase
    .from(physicalTable)
    .delete()
    .eq('id', id)
  
  if (error) throw error
}
