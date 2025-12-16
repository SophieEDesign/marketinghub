import { createClient } from '../supabase/server'
import type { View } from '@/types/database'

export async function getViews(tableId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('views')
    .select('*')
    .eq('table_id', tableId)
    .order('created_at', { ascending: true })
  
  if (error) {
    // If table doesn't exist or no views, return empty array
    if (error.code === '42P01' || error.code === 'PGRST116') {
      return []
    }
    throw error
  }
  return (data || []) as View[]
}

export async function getView(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('views')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) throw error
  return data as View
}

export async function createView(view: Omit<View, 'id' | 'created_at' | 'updated_at'>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('views')
    .insert([view])
    .select()
    .single()
  
  if (error) throw error
  return data as View
}

export async function updateView(id: string, updates: Partial<View>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('views')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data as View
}

export async function deleteView(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('views')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}
