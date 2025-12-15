import { createServerSupabaseClient } from './supabase'
import type { View, ViewField, ViewFilter, ViewSort, ViewTab } from '@/types/database'

export async function loadView(viewId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('views')
    .select('*')
    .eq('id', viewId)
    .single()

  if (error) throw error
  return data as View
}

export async function loadViews(tableId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('views')
    .select('*')
    .eq('table_id', tableId)

  if (error) throw error
  return (data || []) as View[]
}

export async function loadViewFields(viewId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('view_fields')
    .select('*')
    .eq('view_id', viewId)
    .order('position', { ascending: true })

  if (error) throw error
  return (data || []) as ViewField[]
}

export async function loadViewFilters(viewId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('view_filters')
    .select('*')
    .eq('view_id', viewId)

  if (error) throw error
  return (data || []) as ViewFilter[]
}

export async function loadViewSorts(viewId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('view_sorts')
    .select('*')
    .eq('view_id', viewId)

  if (error) throw error
  return (data || []) as ViewSort[]
}

export async function loadViewTabs(viewId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('view_tabs')
    .select('*')
    .eq('view_id', viewId)
    .order('position', { ascending: true })

  if (error) throw error
  return (data || []) as ViewTab[]
}

export async function createView(
  tableId: string,
  name: string,
  type: View['type'],
  accessLevel: View['access_level'] = 'authenticated',
  ownerId?: string,
  allowedRoles?: string[]
) {
  const supabase = await createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('views')
    .insert([
      {
        table_id: tableId,
        name,
        type,
        config: {},
        access_level: accessLevel,
        owner_id: ownerId,
        allowed_roles: allowedRoles || [],
      },
    ])
    .select()
    .single()

  if (error) throw error
  return data as View
}

export async function updateView(viewId: string, updates: Partial<View>) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('views')
    .update(updates)
    .eq('id', viewId)
    .select()
    .single()

  if (error) throw error
  return data as View
}

export async function duplicateView(viewId: string) {
  const supabase = await createServerSupabaseClient()
  const view = await loadView(viewId)
  const fields = await loadViewFields(viewId)
  const filters = await loadViewFilters(viewId)
  const sorts = await loadViewSorts(viewId)

  // Create new view
  const newView = await createView(
    view.table_id,
    `${view.name} (Copy)`,
    view.type,
    view.access_level,
    view.owner_id,
    view.allowed_roles
  )

  // Copy fields
  if (fields.length > 0) {
    await supabase.from('view_fields').insert(
      fields.map((f) => ({
        view_id: newView.id,
        field_name: f.field_name,
        visible: f.visible,
        position: f.position,
      }))
    )
  }

  // Copy filters
  if (filters.length > 0) {
    await supabase.from('view_filters').insert(
      filters.map((f) => ({
        view_id: newView.id,
        field_name: f.field_name,
        operator: f.operator,
        value: f.value,
      }))
    )
  }

  // Copy sorts
  if (sorts.length > 0) {
    await supabase.from('view_sorts').insert(
      sorts.map((s) => ({
        view_id: newView.id,
        field_name: s.field_name,
        direction: s.direction,
      }))
    )
  }

  return newView
}
