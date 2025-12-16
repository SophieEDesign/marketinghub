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
  
  // Fetch all data in parallel using existing functions
  const [tables, userRole] = await Promise.all([
    getTables().catch(() => []),
    getUserRole(),
  ])

  // Fetch views for all tables using existing function
  const viewsByTable: Record<string, View[]> = {}
  await Promise.all(
    tables.map(async (table) => {
      try {
        const tableViews = await getViews(table.id)
        viewsByTable[table.id] = tableViews
      } catch {
        viewsByTable[table.id] = []
      }
    })
  )

  // Fetch interface pages from views table (type='page') - using existing pattern
  const { data: interfacePagesData } = await supabase
    .from('views')
    .select('id, name, description, table_id, type, access_level, allowed_roles, created_at, updated_at')
    .eq('type', 'page')
    .order('created_at', { ascending: false })
  
  const interfacePages = (interfacePagesData || []).map((view) => ({
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

  // Fetch dashboards from dashboards table - using existing pattern
  const { data: dashboardsData } = await supabase
    .from('dashboards')
    .select('*')
    .order('created_at', { ascending: false })
  
  const dashboards = (dashboardsData || []).map((db) => ({
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

  // Fetch automations from automations table - using existing pattern
  const { data: automationsData } = await supabase
    .from('automations')
    .select('*')
    .order('created_at', { ascending: false })
  
  const automations = (automationsData || []) as Automation[]

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
