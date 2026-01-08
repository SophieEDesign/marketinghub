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

/**
 * Check if a view name already exists for a table
 */
async function checkViewNameExists(tableId: string | null, groupId: string | null, name: string): Promise<boolean> {
  const supabase = await createClient()
  
  if (tableId) {
    const { data } = await supabase
      .from('views')
      .select('id')
      .eq('table_id', tableId)
      .eq('name', name)
      .is('is_archived', false)
      .limit(1)
    
    if (data && data.length > 0) return true
  }
  
  if (groupId) {
    const { data } = await supabase
      .from('views')
      .select('id')
      .eq('group_id', groupId)
      .eq('name', name)
      .is('is_archived', false)
      .limit(1)
    
    if (data && data.length > 0) return true
  }
  
  return false
}

/**
 * Generate a unique view name by appending a number if needed
 */
async function generateUniqueViewName(tableId: string | null, groupId: string | null, baseName: string): Promise<string> {
  let name = baseName
  let counter = 1
  
  while (await checkViewNameExists(tableId, groupId, name)) {
    name = `${baseName} (${counter})`
    counter++
  }
  
  return name
}

export async function createView(view: Omit<View, 'id' | 'created_at' | 'updated_at'>) {
  const supabase = await createClient()
  
  // Check if name already exists and generate unique name if needed
  const uniqueName = await generateUniqueViewName(view.table_id || null, view.group_id || null, view.name)
  const viewWithUniqueName = { ...view, name: uniqueName }
  
  const { data, error } = await supabase
    .from('views')
    .insert([viewWithUniqueName])
    .select()
    .single()
  
  if (error) {
    // If it's a duplicate key error, try with a unique name
    if (error.code === '23505' && error.message?.includes('idx_views_table_name') || error.message?.includes('idx_views_group_name')) {
      const fallbackName = await generateUniqueViewName(view.table_id || null, view.group_id || null, view.name)
      const { data: retryData, error: retryError } = await supabase
        .from('views')
        .insert([{ ...view, name: fallbackName }])
        .select()
        .single()
      
      if (retryError) throw retryError
      return retryData as View
    }
    throw error
  }
  
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
