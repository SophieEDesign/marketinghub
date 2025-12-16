import { createClient } from '../supabase/server'

export interface Dashboard {
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

export async function getDashboards() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('dashboards')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) {
    // If table doesn't exist, return empty array
    if (error.code === '42P01') return []
    throw error
  }
  return (data || []) as Dashboard[]
}

export async function getDashboard(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('dashboards')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) {
    if (error.code === 'PGRST116' || error.code === '42P01') return null
    throw error
  }
  
  return data as Dashboard | null
}
