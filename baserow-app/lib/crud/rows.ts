import { createClient } from '../supabase/server'
import type { TableRow } from '@/types/database'

export async function getRows(tableId: string, options?: {
  limit?: number
  offset?: number
  filters?: any[]
  sorts?: any[]
}) {
  const supabase = await createClient()
  let query = supabase
    .from('table_rows')
    .select('*')
    .eq('table_id', tableId)
  
  if (options?.limit) {
    query = query.limit(options.limit)
  }
  
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
  }
  
  if (options?.sorts && options.sorts.length > 0) {
    // Apply sorting
    for (const sort of options.sorts) {
      // This is simplified - actual implementation would need field mapping
      query = query.order('created_at', { ascending: sort.order_direction === 'asc' })
    }
  } else {
    query = query.order('created_at', { ascending: false })
  }
  
  const { data, error } = await query
  
  if (error) throw error
  return data as TableRow[]
}

export async function getRow(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('table_rows')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) throw error
  return data as TableRow
}

export async function createRow(row: Omit<TableRow, 'id' | 'created_at' | 'updated_at'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  const { data, error } = await supabase
    .from('table_rows')
    .insert([{ ...row, created_by: user?.id }])
    .select()
    .single()
  
  if (error) throw error
  return data as TableRow
}

export async function updateRow(id: string, updates: Partial<TableRow>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  const { data, error } = await supabase
    .from('table_rows')
    .update({ ...updates, updated_by: user?.id })
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data as TableRow
}

export async function deleteRow(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('table_rows')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}
