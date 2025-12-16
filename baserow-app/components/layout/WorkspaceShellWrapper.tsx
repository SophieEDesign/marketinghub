import { getTables } from "@/lib/crud/tables"
import { getViews } from "@/lib/crud/views"
import { createClient } from "@/lib/supabase/server"
import { getUserRole } from "@/lib/roles"
import WorkspaceShell from "./WorkspaceShell"
import type { View } from "@/types/database"
import type { Automation } from "@/types/database"

interface WorkspaceShellWrapperProps {
  children: React.ReactNode
  title?: string
}

export default async function WorkspaceShellWrapper({
  children,
  title,
}: WorkspaceShellWrapperProps) {
  const supabase = await createClient()
  
  // Fetch all data in parallel using existing functions from baserow-app/lib/crud
  const [tables, userRole] = await Promise.all([
    getTables().catch(() => []),
    getUserRole(),
  ])

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

  // Fetch interface pages - check if pages table exists, otherwise use views with type='page'
  let interfacePages: any[] = []
  try {
    // Try pages table first
    const { data: pagesData, error: pagesError } = await supabase
      .from('pages')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (!pagesError && pagesData) {
      interfacePages = pagesData.map((page) => ({
        id: page.id,
        name: page.name,
        description: page.description || undefined,
        config: page.config || {},
        access_level: page.access_level || 'authenticated',
        allowed_roles: page.allowed_roles || undefined,
        owner_id: page.owner_id || undefined,
        created_at: page.created_at,
        updated_at: page.updated_at || page.created_at,
      }))
    } else {
      // Fallback to views with type='page' if pages table doesn't exist
      const { data: interfacePagesData } = await supabase
        .from('views')
        .select('id, name, description, table_id, type, access_level, allowed_roles, created_at, updated_at')
        .eq('type', 'page')
        .order('created_at', { ascending: false })
      
      interfacePages = (interfacePagesData || []).map((view) => ({
        id: view.id,
        name: view.name,
        description: view.description || undefined,
        config: {},
        access_level: view.access_level || 'authenticated',
        allowed_roles: view.allowed_roles || undefined,
        owner_id: undefined,
        created_at: view.created_at,
        updated_at: view.updated_at,
      }))
    }
  } catch (error) {
    // If both fail, interfacePages remains empty array
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
    <WorkspaceShell
      title={title}
      tables={tables}
      views={viewsByTable}
      interfacePages={interfacePages}
      dashboards={dashboards}
      automations={automations}
      userRole={userRole}
    >
      {children}
    </WorkspaceShell>
  )
}
