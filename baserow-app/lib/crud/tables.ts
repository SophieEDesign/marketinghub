import { createClient } from '../supabase/server'
import type { Table } from '@/types/database'

export async function getTables() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tables')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data as Table[]
}

export async function getTable(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tables')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) throw error
  return data as Table
}

export async function createTable(table: Omit<Table, 'id' | 'created_at' | 'updated_at'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  const { data, error } = await supabase
    .from('tables')
    .insert([{ ...table, created_by: user?.id }])
    .select()
    .single()
  
  if (error) throw error
  return data as Table
}

export async function updateTable(id: string, updates: Partial<Table>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tables')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data as Table
}

export async function deleteTable(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('tables')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}
