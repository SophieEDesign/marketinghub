import { redirect } from "next/navigation"
import { getTables } from "@/lib/crud/tables"
import { createClient } from "@/lib/supabase/server"
import { getUserRole, isAdmin } from "@/lib/roles"
import { getWorkspaceSettings } from "@/lib/branding"
import { BrandingProvider } from "@/contexts/BrandingContext"
import { SidebarModeProvider } from "@/contexts/SidebarModeContext"
import { EditModeProvider } from "@/contexts/EditModeContext"
import { UIModeProvider } from "@/contexts/UIModeContext"
import { getInterfaces, getInterfaceCategories, resolveLandingPage, type Interface, type InterfaceCategory } from "@/lib/interfaces"
import { withTimeout } from "@/lib/with-timeout"
import WorkspaceShell from "./WorkspaceShell"
import DynamicFavicon from "./DynamicFavicon"
import type { View } from "@/types/database"
import type { Automation } from "@/types/database"
import {
  assertJsonSerializable,
  prepareForRscPayload,
} from "@/lib/serialization/sanitize-for-client"
import { isNextRedirectError } from "@/lib/next-navigation"
import { cache } from "react"

interface WorkspaceShellWrapperProps {
  children: React.ReactNode
  title?: string
  hideTopbar?: boolean // Option to hide topbar (for interface pages that have their own toolbar)
  hideRecordPanel?: boolean // Option to hide the global RecordPanel (for pages that have their own record detail panel)
}

const HOT_PATH_DEBUG = process.env.HOT_PATH_DEBUG === "true"

function hotPathInfo(message: string, payload: Record<string, unknown>) {
  if (!HOT_PATH_DEBUG) return
  console.info(message, payload)
}

function hotPathError(message: string, payload: Record<string, unknown>) {
  if (!HOT_PATH_DEBUG) return
  console.error(message, payload)
}

const MARKETING_CORE_PAGE_ORDER = [
  "Marketing Home",
  "Theme Workspace",
  "Content Planning",
  "Things To Do",
  "Resource Hub",
  "Social Calendar",
  "Event Calendar",
] as const
const QUIET_PAGE_HINTS = ["test", "admin", "debug", "raw", "seed", "tmp"]

function getNavPriority(name: string, isAdminOnly: boolean): number {
  const coreIndex = MARKETING_CORE_PAGE_ORDER.findIndex((n) => n.toLowerCase() === String(name || "").toLowerCase())
  if (coreIndex >= 0) return coreIndex
  if (isAdminOnly) return 500
  const normalized = String(name || "").toLowerCase()
  if (QUIET_PAGE_HINTS.some((hint) => normalized.includes(hint))) return 600
  return 200
}

/** Per-request cache for expensive shell nav fetches (tables + views + role). */
const loadShellCoreNav = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/login")
  }

  const [tables, userRole, brandingSettings, admin] = await Promise.all([
    getTables().catch((error) => {
      if (process.env.NODE_ENV === "development") {
        console.error("[WorkspaceShellWrapper] Error loading tables:", error)
      }
      return []
    }),
    getUserRole(),
    getWorkspaceSettings().catch(() => null),
    isAdmin(),
  ])

  const viewsByTable: Record<string, View[]> = {}
  for (const table of tables) {
    viewsByTable[table.id] = []
  }
  if (tables.length > 0) {
    const tableIds = tables.map((t) => t.id)
    const { data: allViews, error: viewsError } = await supabase
      .from("views")
      .select("*")
      .in("table_id", tableIds)
      .order("created_at", { ascending: true })
    if (!viewsError && allViews) {
      for (const view of allViews as View[]) {
        if (view.table_id && viewsByTable[view.table_id]) {
          viewsByTable[view.table_id].push(view)
        }
      }
    }
  }

  return { supabase, tables, userRole, brandingSettings, userIsAdmin: admin, admin, viewsByTable }
})

export default async function WorkspaceShellWrapper({
  children,
  title,
  hideTopbar = false,
  hideRecordPanel = false,
}: WorkspaceShellWrapperProps) {
  try {
  const { supabase, tables, userRole, brandingSettings, userIsAdmin, admin, viewsByTable } =
    await loadShellCoreNav()
  
  // Fetch interface groups
  let interfaceGroups: any[] = []
  try {
    // Start with minimal query (columns that definitely exist)
    const groupsQuery = supabase
      .from('interface_groups')
      .select('id, name, order_index')
      .order('order_index', { ascending: true })
    
    const { data: minimalData, error: minimalError } = await groupsQuery
    
    if (minimalError) {
      // If minimal query fails, try even simpler
      const { data: basicData, error: basicError } = await supabase
        .from('interface_groups')
        .select('id, name')
        .order('order_index', { ascending: true })
      
      if (!basicError && basicData) {
        interfaceGroups = basicData
          .map((g: any) => ({ ...g, order_index: 0, collapsed: false, is_system: false, is_admin_only: false, icon: null }))
          .filter((g: any) => admin || !g.is_admin_only)
      } else if (basicError) {
        // If table doesn't exist (42P01) or RLS error, just return empty array
        if (basicError.code === '42P01' || basicError.code === 'PGRST116' || 
            basicError.message?.includes('relation') || basicError.message?.includes('does not exist') ||
            basicError.code === 'PGRST301' || basicError.message?.includes('permission')) {
            console.warn('interface_groups table may not exist or RLS blocking access, returning empty array')
          interfaceGroups = []
        } else {
          console.error('Error loading interface_groups:', basicError)
        }
      }
    } else if (minimalData) {
      // Try to fetch additional columns if they exist
      try {
        // First try without icon column to avoid 400 errors
        const { data: dataWithoutIcon, error: errorWithoutIcon } = await supabase
          .from('interface_groups')
          .select('id, name, order_index, collapsed, workspace_id, is_system, is_admin_only')
          .order('order_index', { ascending: true })
        
        if (!errorWithoutIcon && dataWithoutIcon) {
          // If that works, try with icon column
          try {
            const { data: fullData, error: fullError } = await supabase
              .from('interface_groups')
              .select('id, name, order_index, collapsed, workspace_id, is_system, is_admin_only, icon')
              .order('order_index', { ascending: true })
            
            if (!fullError && fullData) {
              interfaceGroups = fullData
                .filter((g: any) => admin || !g.is_admin_only)
            } else {
              // Icon column doesn't exist - use data without icon
              interfaceGroups = dataWithoutIcon
                .map((g: any) => ({ ...g, icon: null }))
                .filter((g: any) => admin || !g.is_admin_only)
            }
          } catch (e) {
            // Icon column doesn't exist - use data without icon
            interfaceGroups = dataWithoutIcon
              .map((g: any) => ({ ...g, icon: null }))
              .filter((g: any) => admin || !g.is_admin_only)
          }
        } else {
          // Fallback to minimal data with defaults
          interfaceGroups = minimalData
            .map((g: any) => ({ ...g, collapsed: false, is_system: false, is_admin_only: false, icon: null }))
            .filter((g: any) => admin || !g.is_admin_only)
        }
      } catch (e: any) {
        // Some columns don't exist - use minimal data and add defaults
        interfaceGroups = minimalData
          .map((g: any) => ({ ...g, collapsed: false, is_system: false, is_admin_only: false, icon: null }))
          .filter((g: any) => admin || !g.is_admin_only)
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
    const activePageOr = userIsAdmin
      ? 'is_archived.is.null,is_archived.eq.false'
      : 'and(is_archived.is.null,is_archived.eq.false,is_admin_only.is.null,is_admin_only.eq.false)'

    // Load from new interface_pages table
    let newPagesQuery = supabase
      .from('interface_pages')
      .select('id, name, page_type, group_id, order_index, created_at, updated_at, created_by, is_admin_only, is_hidden')
      .or(activePageOr)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: false })
    
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
        is_admin_only: page.is_admin_only ?? true,
        is_hidden: page.is_hidden ?? false,
        is_new_system: true, // Flag to indicate this is from new system
      }))
    }

    // Also load from old views table for backward compatibility
    let oldPagesQuery = supabase
      .from('views')
      .select('id, name, description, table_id, type, access_level, allowed_roles, created_at, updated_at, owner_id, group_id, order_index, is_admin_only')
      .eq('type', 'interface')
      .or(activePageOr)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: false })
    
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
          is_admin_only: view.is_admin_only ?? true,
          is_hidden: false,
          is_new_system: false, // Flag to indicate this is from old system
        }))
      
      interfacePages = [...interfacePages, ...oldPages]
    }
  } catch (error) {
    // If fails, interfacePages remains empty array
    console.error('Error loading interface pages:', error)
  }

  interfacePages = [...interfacePages].sort((a, b) => {
    const priorityDiff = getNavPriority(a.name || "", Boolean(a.is_admin_only)) - getNavPriority(b.name || "", Boolean(b.is_admin_only))
    if (priorityDiff !== 0) return priorityDiff
    const orderDiff = (a.order_index || 0) - (b.order_index || 0)
    if (orderDiff !== 0) return orderDiff
    return String(a.name || "").localeCompare(String(b.name || ""))
  })

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

  // Get workspace name for title
  let workspaceName: string | null = null
  try {
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', 'default')
      .maybeSingle()
    
    if (workspace?.name) {
      workspaceName = workspace.name
    }
  } catch (error) {
    // Workspace table might not exist - ignore
  }

  // Determine final title: page title > workspace name > default
  const finalTitle = title || workspaceName || "Baserow App"

  // Resolve default page for "Back to home" link - never link to abstract / route
  let defaultPageId: string | null = null
  try {

    const resolvedLanding = await withTimeout(
      resolveLandingPage(),
      8_000,
      "resolveLandingPage timed out"
    )
    const resolvedPageId = (resolvedLanding as any)?.pageId
    defaultPageId = typeof resolvedPageId === "string" ? resolvedPageId : null
    if (resolvedPageId != null && typeof resolvedPageId !== "string") {
    }
  } catch (error) {
    // Fallback: first accessible interface page
    if (interfacePages.length > 0) {
      defaultPageId = interfacePages[0].id
    }
  }

  const landingPageTitle: string | null =
    defaultPageId != null
      ? (interfacePages.find((p: { id: string }) => p.id === defaultPageId)?.name as string | undefined) ??
        null
      : null


  const safeTables = prepareForRscPayload(tables)
  const safeViewsByTable = prepareForRscPayload(viewsByTable)
  const safeInterfacePages = prepareForRscPayload(interfacePages)
  const safeInterfaceGroups = prepareForRscPayload(interfaceGroups)
  const safeDashboards = prepareForRscPayload(dashboards)
  const safeBrandingSettings = prepareForRscPayload(brandingSettings)

  assertJsonSerializable(
    {
      title: title ?? null,
      tables: safeTables,
      views: safeViewsByTable,
      interfacePages: safeInterfacePages,
      interfaceGroups: safeInterfaceGroups,
      dashboards: safeDashboards,
      userRole,
      hideTopbar,
      hideRecordPanel,
      defaultPageId,
      landingPageTitle,
    },
    "WorkspaceShellWrapper"
  )

    return (
      <BrandingProvider settings={safeBrandingSettings}>
        <DynamicFavicon />
        <EditModeProvider>
          <UIModeProvider>
            <SidebarModeProvider>
              <div data-page-title={finalTitle}>
              <WorkspaceShell
                title={title}
                tables={safeTables}
                views={safeViewsByTable}
                interfacePages={safeInterfacePages as any}
                interfaceGroups={safeInterfaceGroups}
                dashboards={safeDashboards}
                userRole={userRole}
                hideTopbar={hideTopbar}
                hideRecordPanel={hideRecordPanel}
                defaultPageId={defaultPageId}
                landingPageTitle={landingPageTitle}
              >
                {children}
              </WorkspaceShell>
              </div>
            </SidebarModeProvider>
          </UIModeProvider>
        </EditModeProvider>
      </BrandingProvider>
    )
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error
    }
    const message = error instanceof Error ? error.message : String(error)
    const digest = error && typeof error === "object" && "digest" in error ? (error as { digest?: string }).digest : undefined
    console.error("[WorkspaceShellWrapper] Render failed:", { message, digest, error })
    throw error
  }
}
