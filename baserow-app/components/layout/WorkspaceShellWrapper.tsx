import { redirect } from "next/navigation"
import { getTables } from "@/lib/crud/tables"
import { getViews } from "@/lib/crud/views"
import { createClient } from "@/lib/supabase/server"
import { getUserRole, isAdmin } from "@/lib/roles"
import { getWorkspaceSettings } from "@/lib/branding"
import { BrandingProvider } from "@/contexts/BrandingContext"
import { SidebarModeProvider } from "@/contexts/SidebarModeContext"
import { getInterfaces, getInterfaceCategories, type Interface, type InterfaceCategory } from "@/lib/interfaces"
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
  
  // Check authentication - redirect to login if not authenticated
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }
  
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
      .select('id, name, order_index, collapsed, workspace_id, is_system')
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

  // Fetch interface pages from both old (views) and new (interface_pages) tables
  // Filter by permissions: admin sees all, member sees only non-admin-only interfaces
  let interfacePages: any[] = []
  try {
    // Load from new interface_pages table
    let newPagesQuery = supabase
      .from('interface_pages')
      .select('id, name, page_type, group_id, order_index, created_at, updated_at, created_by, is_admin_only')
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: false })
    
    // Filter out admin-only interfaces for non-admin users
    if (!userIsAdmin) {
      newPagesQuery = newPagesQuery.or('is_admin_only.is.null,is_admin_only.eq.false')
    }
    
    const { data: newPagesData, error: newPagesError } = await newPagesQuery
    
    if (!newPagesError && newPagesData) {
      interfacePages = newPagesData.map((page) => ({
        id: page.id,
        name: page.name,
        description: undefined,
        config: {},
        access_level: 'authenticated',
        allowed_roles: undefined,
        owner_id: page.created_by || undefined,
        created_at: page.created_at,
        updated_at: page.updated_at,
        group_id: page.group_id || null,
        order_index: page.order_index || 0,
        is_admin_only: page.is_admin_only || false,
        is_new_system: true, // Flag to indicate this is from new system
      }))
    }

    // Also load from old views table for backward compatibility
    let oldPagesQuery = supabase
      .from('views')
      .select('id, name, description, table_id, type, access_level, allowed_roles, created_at, updated_at, owner_id, group_id, order_index, is_admin_only')
      .eq('type', 'interface')
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: false })
    
    // Filter out admin-only interfaces for non-admin users
    if (!userIsAdmin) {
      oldPagesQuery = oldPagesQuery.or('is_admin_only.is.null,is_admin_only.eq.false')
    }
    
    const { data: oldPagesData, error: oldPagesError } = await oldPagesQuery
    
    if (!oldPagesError && oldPagesData) {
      // Merge old pages, avoiding duplicates (by ID)
      const existingIds = new Set(interfacePages.map(p => p.id))
      const oldPages = oldPagesData
        .filter(view => !existingIds.has(view.id))
        .map((view) => ({
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
          is_admin_only: view.is_admin_only || false,
          is_new_system: false, // Flag to indicate this is from old system
        }))
      
      interfacePages = [...interfacePages, ...oldPages]
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
      <SidebarModeProvider>
        <WorkspaceShell
          title={title}
          tables={tables}
          views={viewsByTable}
          interfacePages={interfacePages as any}
          interfaceGroups={interfaceGroups}
          dashboards={dashboards}
          automations={automations}
          userRole={userRole}
          hideTopbar={hideTopbar}
        >
          {children}
        </WorkspaceShell>
      </SidebarModeProvider>
    </BrandingProvider>
  )
}
