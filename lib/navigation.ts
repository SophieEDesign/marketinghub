import { createServerSupabaseClient } from './supabase'
import { getUserRoles } from './permissions'

export interface SidebarCategory {
  id: string
  name: string
  icon: string
  position: number
}

export interface SidebarItem {
  id: string
  category_id: string | null
  item_type: 'table' | 'view' | 'dashboard' | 'link'
  item_id: string
  label: string
  href: string
  icon: string | null
  position: number
}

export interface TableWithViews {
  id: string
  name: string
  supabase_table: string
  views: Array<{
    id: string
    name: string
    type: string
    access_level: string
    allowed_roles: string[] | null
  }>
}

export async function getSidebarCategories() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('sidebar_categories')
    .select('*')
    .order('position', { ascending: true })

  if (error) {
    console.error('Error loading sidebar categories:', error)
    return []
  }

  return (data || []) as SidebarCategory[]
}

export async function getSidebarItems(categoryId?: string | null) {
  const supabase = await createServerSupabaseClient()
  let query = supabase
    .from('sidebar_items')
    .select('*')
    .order('position', { ascending: true })

  if (categoryId !== undefined) {
    if (categoryId === null) {
      query = query.is('category_id', null)
    } else {
      query = query.eq('category_id', categoryId)
    }
  }

  const { data, error } = await query

  if (error) {
    console.error('Error loading sidebar items:', error)
    return []
  }

  return (data || []) as SidebarItem[]
}

export async function getTables() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('tables')
    .select('id, name, supabase_table')
    .order('name', { ascending: true })

  if (error) {
    console.error('Error loading tables:', error)
    return []
  }

  return (data || []) as Array<{ id: string; name: string; supabase_table: string }>
}

export async function getViewsForTable(tableId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('views')
    .select('id, name, type, access_level, allowed_roles')
    .eq('table_id', tableId)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error loading views:', error)
    return []
  }

  return (data || []) as Array<{
    id: string
    name: string
    type: string
    access_level: string
    allowed_roles: string[] | null
  }>
}

export async function getDashboardViews() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('views')
    .select('id, table_id, name, type, access_level, allowed_roles')
    .eq('type', 'page')
    .order('name', { ascending: true })

  if (error) {
    console.error('Error loading dashboard views:', error)
    return []
  }

  return (data || []) as Array<{
    id: string
    table_id: string
    name: string
    type: string
    access_level: string
    allowed_roles: string[] | null
  }>
}

export async function getTablesWithViews(userId: string) {
  const tables = await getTables()
  const userRoles = await getUserRoles(userId)

  const tablesWithViews: TableWithViews[] = []

  for (const table of tables) {
    const views = await getViewsForTable(table.id)
    
    // Filter views based on permissions
    const visibleViews = views.filter((view) => {
      if (view.access_level === 'public') return true
      if (view.access_level === 'authenticated') return true
      if (view.access_level === 'owner') {
        // Check if user has required role
        if (view.allowed_roles && view.allowed_roles.length > 0) {
          return view.allowed_roles.some((role) => userRoles.includes(role))
        }
        return true
      }
      return false
    })

    tablesWithViews.push({
      ...table,
      views: visibleViews,
    })
  }

  return tablesWithViews
}

export async function ensureSidebarItemsForTables() {
  const supabase = await createServerSupabaseClient()
  const tables = await getTables()

  for (const table of tables) {
    // Check if sidebar item already exists for this table
    const { data: existing } = await supabase
      .from('sidebar_items')
      .select('id')
      .eq('item_type', 'table')
      .eq('item_id', table.id)
      .single()

    if (!existing) {
      // Get max position for table items
      const { data: maxPos } = await supabase
        .from('sidebar_items')
        .select('position')
        .eq('item_type', 'table')
        .order('position', { ascending: false })
        .limit(1)
        .single()

      const nextPosition = maxPos?.position ? maxPos.position + 1 : 0

      await supabase.from('sidebar_items').insert({
        item_type: 'table',
        item_id: table.id,
        label: table.name,
        href: `/data/${table.id}`,
        icon: 'database',
        position: nextPosition,
        category_id: null,
      })
    } else {
      // Update label in case table name changed
      await supabase
        .from('sidebar_items')
        .update({ label: table.name })
        .eq('id', existing.id)
    }
  }
}

export async function ensureDashboardsCategory() {
  const supabase = await createServerSupabaseClient()
  
  // Check if dashboards category exists
  const { data: existing } = await supabase
    .from('sidebar_categories')
    .select('id')
    .eq('name', 'Dashboards')
    .single()

  if (!existing) {
    // Get max position
    const { data: maxPos } = await supabase
      .from('sidebar_categories')
      .select('position')
      .order('position', { ascending: false })
      .limit(1)
      .single()

    const nextPosition = maxPos?.position ? maxPos.position + 1 : 0

    await supabase.from('sidebar_categories').insert({
      name: 'Dashboards',
      icon: 'layout-dashboard',
      position: nextPosition,
    })
  }
}

export async function updateSidebarOrder(
  items: Array<{ id: string; position: number }>,
  type: 'items' | 'categories'
) {
  const supabase = await createServerSupabaseClient()
  const table = type === 'items' ? 'sidebar_items' : 'sidebar_categories'

  const updates = items.map((item) =>
    supabase
      .from(table)
      .update({ position: item.position })
      .eq('id', item.id)
  )

  await Promise.all(updates)
}

// Client-side version
export async function updateSidebarOrderClient(
  supabase: any,
  items: Array<{ id: string; position: number }>,
  type: 'items' | 'categories'
) {
  const table = type === 'items' ? 'sidebar_items' : 'sidebar_categories'

  const updates = items.map((item) =>
    supabase
      .from(table)
      .update({ position: item.position })
      .eq('id', item.id)
  )

  await Promise.all(updates)
}
