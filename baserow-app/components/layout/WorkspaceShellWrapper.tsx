import { getTables } from "@/lib/crud/tables"
import { getViews } from "@/lib/crud/views"
import { createClient } from "@/lib/supabase/server"
import { getUserRole, isAdmin } from "@/lib/roles"
import { getWorkspaceSettings } from "@/lib/branding"
import { BrandingProvider } from "@/contexts/BrandingContext"
import WorkspaceShell from "./WorkspaceShell"
import type { View } from "@/types/database"
import type { Automation } from "@/types/database"

interface WorkspaceShellWrapperProps {
  children: React.ReactNode
  title?: string
  hideTopbar?: boolean // Option to hide topbar (for interface pages that have their own toolbar)
}

export default async function WorkspaceShellWrapper({
  children,
  title,
  hideTopbar = false,
}: WorkspaceShellWrapperProps) {
  const supabase = await createClient()
  
  // Fetch all data in parallel using existing functions from baserow-app/lib/crud
  const [tables, userRole, brandingSettings] = await Promise.all([
    getTables().catch(() => []),
    getUserRole(),
    getWorkspaceSettings().catch(() => null),
  ])
  
  const userIsAdmin = await isAdmin()

  // Fetch views for all tables using existing getViews function
  // Handle errors gracefully - tables may not have views yet
  const viewsByTable: Record<string, View[]> = {}
  await Promise.all(
    tables.map(async (table) => {
      try {
        const tableViews = await getViews(table.id).catch(() => [])
        viewsByTable[table.id] = tableViews || []
      } catch (error) {
        // Table may not have views yet - this is normal
        viewsByTable[table.id] = []
      }
    })
  )

  // Fetch interface groups
  let interfaceGroups: any[] = []
  try {
    const { data: groupsData, error: groupsError } = await supabase
      .from('interface_groups')
      .select('*')
      .order('order_index', { ascending: true })
    
    if (!groupsError && groupsData) {
      interfaceGroups = groupsData
    } else if (groupsError) {
      // If table doesn't exist (42P01) or RLS error, just return empty array
      if (groupsError.code === '42P01' || groupsError.code === 'PGRST116' || 
          groupsError.message?.includes('relation') || groupsError.message?.includes('does not exist') ||
          groupsError.code === 'PGRST301' || groupsError.message?.includes('permission')) {
        console.warn('interface_groups table may not exist or RLS blocking access, returning empty array')
        interfaceGroups = []
      } else {
        console.error('Error loading interface groups:', groupsError)
      }
    }
  } catch (error) {
    // If fails, interfaceGroups remains empty array
    console.warn('Error loading interface groups:', error)
  }

  // Fetch interface pages from views table where type='interface'
  let interfacePages: any[] = []
  try {
    const { data: interfacePagesData, error: pagesError } = await supabase
      .from('views')
      .select('id, name, description, table_id, type, access_level, allowed_roles, created_at, updated_at, owner_id, group_id, order_index')
      .eq('type', 'interface')
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: false })
    
    if (!pagesError && interfacePagesData) {
      interfacePages = interfacePagesData.map((view) => ({
        id: view.id,
        name: view.name,
        description: view.description || undefined,
        config: {},
        access_level: view.access_level || 'authenticated',
        allowed_roles: view.allowed_roles || undefined,
        owner_id: view.owner_id || undefined,
        created_at: view.created_at,
        updated_at: view.updated_at,
        group_id: view.group_id || null,
        order_index: view.order_index || 0,
      }))
    }
  } catch (error) {
    // If fails, interfacePages remains empty array
    console.error('Error loading interface pages:', error)
  }

  // Fetch dashboards from dashboards table - handle case where table might not exist
  let dashboards: any[] = []
  try {
    const { data: dashboardsData, error: dashboardsError } = await supabase
      .from('dashboards')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (!dashboardsError && dashboardsData) {
      dashboards = dashboardsData.map((db) => ({
        id: db.id,
        name: db.name,
        description: db.description || undefined,
        config: db.config || {},
        access_level: db.access_level || 'authenticated',
        allowed_roles: db.allowed_roles || undefined,
        owner_id: db.owner_id || undefined,
        created_at: db.created_at,
        updated_at: db.updated_at || db.created_at,
      }))
    }
  } catch (error) {
    // Dashboards table may not exist - this is fine
    console.error('Error loading dashboards:', error)
  }

  // Fetch automations from automations table - handle case where table might not exist
  let automations: Automation[] = []
  try {
    const { data: automationsData, error: automationsError } = await supabase
      .from('automations')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (!automationsError && automationsData) {
      automations = automationsData as Automation[]
    }
  } catch (error) {
    // Automations table may not exist - this is fine
    console.error('Error loading automations:', error)
  }

  return (
    <BrandingProvider settings={brandingSettings}>
      <WorkspaceShell
        title={title}
        tables={tables}
        views={viewsByTable}
        interfacePages={interfacePages}
        interfaceGroups={interfaceGroups}
        dashboards={dashboards}
        automations={automations}
        userRole={userRole}
        hideTopbar={hideTopbar}
      >
        {children}
      </WorkspaceShell>
    </BrandingProvider>
  )
}
