import { createClient } from '../supabase/server'

export interface Page {
  id: string
  name: string
  description?: string
  config?: Record<string, any>
  access_level: string
  allowed_roles?: string[]
  owner_id?: string
  created_at: string
  updated_at?: string
}

/**
 * Get all interface pages (views with type='page')
 */
export async function getInterfacePages() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('views')
    .select('*')
    .eq('type', 'page')
    .order('created_at', { ascending: false })
  
  if (error) {
    if (error.code === '42P01') return []
    throw error
  }
  return (data || []) as Page[]
}

/**
 * Get a single interface page by ID
 */
export async function getInterfacePage(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('views')
    .select('*')
    .eq('id', id)
    .eq('type', 'page')
    .single()
  
  if (error) {
    if (error.code === 'PGRST116' || error.code === '42P01') return null
    throw error
  }
  
  return data as Page | null
}
