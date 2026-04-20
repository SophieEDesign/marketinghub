import { redirect } from "next/navigation"
import { getTables } from "@/lib/crud/tables"
import { getViews } from "@/lib/crud/views"
import { createClient } from "@/lib/supabase/server"
import { getUserRole, isAdmin } from "@/lib/roles"
import { getWorkspaceSettings } from "@/lib/branding"
import { BrandingProvider } from "@/contexts/BrandingContext"
import { SidebarModeProvider } from "@/contexts/SidebarModeContext"
import { EditModeProvider } from "@/contexts/EditModeContext"
import { UIModeProvider } from "@/contexts/UIModeContext"
import { getInterfaces, getInterfaceCategories, resolveLandingPage, type Interface, type InterfaceCategory } from "@/lib/interfaces"
import WorkspaceShell from "./WorkspaceShell"
import DynamicFavicon from "./DynamicFavicon"
import type { View } from "@/types/database"
import type { Automation } from "@/types/database"

interface WorkspaceShellWrapperProps {
  children: React.ReactNode
  title?: string
  hideTopbar?: boolean // Option to hide topbar (for interface pages that have their own toolbar)
  hideRecordPanel?: boolean // Option to hide the global RecordPanel (for pages that have their own record detail panel)
}

function containsBigInt(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === "bigint") return true
  if (value == null) return false
  if (typeof value !== "object") return false
  const obj = value as object
  if (seen.has(obj)) return false
  seen.add(obj)
  if (Array.isArray(value)) {
    return value.some((entry) => containsBigInt(entry, seen))
  }
  return Object.values(value as Record<string, unknown>).some((entry) => containsBigInt(entry, seen))
}

function sanitizeForClient<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, current) => (typeof current === "bigint" ? current.toString() : current))
  ) as T
}

const MARKETING_CORE_PAGE_ORDER = [
  "Marketing Home",
  "Theme Workspace",
  "Content Planning",
  "Campaign Archive",
  "Campaign Workspace",
  "Internal Staff Hub",
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

export default async function WorkspaceShellWrapper({
  children,
  title,
  hideTopbar = false,
  hideRecordPanel = false,
}: WorkspaceShellWrapperProps) {
  try {
    // #region agent log
    console.info("[agent-debug]", {
      sessionId: "909a6f",
      runId: "initial",
      hypothesisId: "H11",
      location: "components/layout/WorkspaceShellWrapper.tsx:entry",
      message: "Entered WorkspaceShellWrapper",
      data: { hasTitle: Boolean(title), hideTopbar, hideRecordPanel },
      timestamp: Date.now(),
    })
    // #endregion
  // #region agent log
  console.error("[agent-debug]", {
    sessionId: "909a6f",
    runId: "initial",
    hypothesisId: "H12",
    location: "components/layout/WorkspaceShellWrapper.tsx:post-entry",
    message: "Reached immediately after shell entry",
    data: { hasTitle: Boolean(title) },
    timestamp: Date.now(),
  })
  // #endregion
  const supabase = await createClient()
  // #region agent log
  console.error("[agent-debug]", {
    sessionId: "909a6f",
    runId: "initial",
    hypothesisId: "H13",
    location: "components/layout/WorkspaceShellWrapper.tsx:after-createClient",
    message: "createClient completed in shell wrapper",
    data: { hasSupabase: Boolean(supabase) },
    timestamp: Date.now(),
  })
  // #endregion
  
  // Check authentication - redirect to login if not authenticated
  const { data: { user } } = await supabase.auth.getUser()
  // #region agent log
  console.error("[agent-debug]", {
    sessionId: "909a6f",
    runId: "initial",
    hypothesisId: "H13",
    location: "components/layout/WorkspaceShellWrapper.tsx:after-getUser",
    message: "auth.getUser completed in shell wrapper",
    data: { hasUser: Boolean(user) },
    timestamp: Date.now(),
  })
  // #endregion
  if (!user) {
    // Note: For better redirect preservation, the login page should be accessed
    // with ?next=/desired-path parameter. This component redirects to /login
    // and the login page will handle the redirect after authentication.
    redirect('/login')
  }
  
  // Fetch all data in parallel using existing functions from baserow-app/lib/crud
  const [tables, userRole, brandingSettings] = await Promise.all([
    getTables().catch((error) => {
      // Log error but don't crash the app (only in development)
      if (process.env.NODE_ENV === 'development') {
        console.error('[WorkspaceShellWrapper] Error loading tables:', error)
      }
      return []
    }),
    getUserRole(),
    getWorkspaceSettings().catch(() => null),
  ])
  // #region agent log
  console.error("[agent-debug]", {
    sessionId: "909a6f",
    runId: "initial",
    hypothesisId: "H13",
    location: "components/layout/WorkspaceShellWrapper.tsx:after-initial-parallel",
    message: "Initial parallel data load completed",
    data: { tablesCount: tables.length, hasUserRole: Boolean(userRole), hasBranding: Boolean(brandingSettings) },
    timestamp: Date.now(),
  })
  // #endregion
  
  const userIsAdmin = await isAdmin()
  // #region agent log
  console.error("[agent-debug]", {
    sessionId: "909a6f",
    runId: "initial",
    hypothesisId: "H13",
    location: "components/layout/WorkspaceShellWrapper.tsx:after-isAdmin-userIsAdmin",
    message: "Resolved userIsAdmin in shell wrapper",
    data: { userIsAdmin },
    timestamp: Date.now(),
  })
  // #endregion

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
  // #region agent log
  console.error("[agent-debug]", {
    sessionId: "909a6f",
    runId: "initial",
    hypothesisId: "H13",
    location: "components/layout/WorkspaceShellWrapper.tsx:after-viewsByTable",
    message: "Loaded viewsByTable in shell wrapper",
    data: { tableCount: tables.length, viewsTableKeys: Object.keys(viewsByTable).length },
    timestamp: Date.now(),
  })
  // #endregion

  // Check if user is admin for filtering
  const admin = await isAdmin()
  // #region agent log
  console.error("[agent-debug]", {
    sessionId: "909a6f",
    runId: "initial",
    hypothesisId: "H13",
    location: "components/layout/WorkspaceShellWrapper.tsx:after-isAdmin-admin",
    message: "Resolved admin flag in shell wrapper",
    data: { admin },
    timestamp: Date.now(),
  })
  // #endregion
  
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
        is_admin_only: page.is_admin_only ?? true,
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
          is_admin_only: view.is_admin_only ?? true,
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
    // #region agent log
    console.info("[agent-debug]", {
      sessionId: "909a6f",
      runId: "initial",
      hypothesisId: "H11",
      location: "components/layout/WorkspaceShellWrapper.tsx:resolveLandingPage:start",
      message: "Resolving landing page for shell links",
      data: { interfacePageCount: interfacePages.length },
      timestamp: Date.now(),
    })
    // #endregion
    // #region agent log
    console.error("[agent-debug]", {
      sessionId: "909a6f",
      runId: "initial",
      hypothesisId: "H21",
      location: "components/layout/WorkspaceShellWrapper.tsx:resolveLandingPage:before-await",
      message: "About to await resolveLandingPage in shell wrapper",
      data: {},
      timestamp: Date.now(),
    })
    // #endregion
    const resolvedLanding = await resolveLandingPage()
    // #region agent log
    console.error("[agent-debug]", {
      sessionId: "909a6f",
      runId: "initial",
      hypothesisId: "H21",
      location: "components/layout/WorkspaceShellWrapper.tsx:resolveLandingPage:after-await",
      message: "resolveLandingPage returned in shell wrapper",
      data: {
        hasResult: Boolean(resolvedLanding),
        resultType: typeof resolvedLanding,
        pageIdType: typeof (resolvedLanding as any)?.pageId,
      },
      timestamp: Date.now(),
    })
    // #endregion
    const resolvedPageId = (resolvedLanding as any)?.pageId
    defaultPageId = typeof resolvedPageId === "string" ? resolvedPageId : null
    if (resolvedPageId != null && typeof resolvedPageId !== "string") {
      // #region agent log
      console.error("[agent-debug]", {
        sessionId: "909a6f",
        runId: "initial",
        hypothesisId: "H21",
        location: "components/layout/WorkspaceShellWrapper.tsx:resolveLandingPage:non-string-pageId",
        message: "resolveLandingPage returned non-string pageId; using null fallback",
        data: { resolvedPageIdType: typeof resolvedPageId },
        timestamp: Date.now(),
      })
      // #endregion
    }
    // #region agent log
    console.info("[agent-debug]", {
      sessionId: "909a6f",
      runId: "initial",
      hypothesisId: "H11",
      location: "components/layout/WorkspaceShellWrapper.tsx:resolveLandingPage:success",
      message: "Resolved landing page for shell links",
      data: { defaultPageId },
      timestamp: Date.now(),
    })
    // #endregion
  } catch (error) {
    // #region agent log
    console.error("[agent-debug]", {
      sessionId: "909a6f",
      runId: "initial",
      hypothesisId: "H21",
      location: "components/layout/WorkspaceShellWrapper.tsx:resolveLandingPage:catch",
      message: "resolveLandingPage failed in shell wrapper",
      data: {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : typeof error,
        hasStack: Boolean(error instanceof Error && error.stack),
      },
      timestamp: Date.now(),
    })
    // #endregion
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
  // #region agent log
  console.error("[agent-debug]", {
    sessionId: "909a6f",
    runId: "initial",
    hypothesisId: "H13",
    location: "components/layout/WorkspaceShellWrapper.tsx:after-landingPageTitle",
    message: "Computed landingPageTitle in shell wrapper",
    data: { defaultPageId, landingPageTitle, interfacePagesCount: interfacePages.length },
    timestamp: Date.now(),
  })
  // #endregion

  // #region agent log
  console.info("[agent-debug]", {
    sessionId: "909a6f",
    runId: "initial",
    hypothesisId: "H11",
    location: "components/layout/WorkspaceShellWrapper.tsx:pre-return",
    message: "WorkspaceShellWrapper reached return",
    data: { defaultPageId, landingPageTitle, tablesCount: tables.length },
    timestamp: Date.now(),
  })
  // #endregion

  const shellPayloadHasBigInt = containsBigInt({
    tables,
    viewsByTable,
    interfacePages,
    interfaceGroups,
    dashboards,
  })
  // #region agent log
  console.error("[agent-debug]", {
    sessionId: "909a6f",
    runId: "initial",
    hypothesisId: "H23",
    location: "components/layout/WorkspaceShellWrapper.tsx:shell-props-summary",
    message: "Prepared WorkspaceShell props before SSR handoff",
    data: {
      tablesCount: tables.length,
      viewsTableKeys: Object.keys(viewsByTable).length,
      interfacePagesCount: interfacePages.length,
      interfaceGroupsCount: interfaceGroups.length,
      dashboardsCount: dashboards.length,
      hasBigInt: shellPayloadHasBigInt,
    },
    timestamp: Date.now(),
  })
  // #endregion

  let safeTables = tables
  let safeViewsByTable = viewsByTable
  let safeInterfacePages = interfacePages
  let safeInterfaceGroups = interfaceGroups
  let safeDashboards = dashboards

  if (shellPayloadHasBigInt) {
    // #region agent log
    console.error("[agent-debug]", {
      sessionId: "909a6f",
      runId: "initial",
      hypothesisId: "H23",
      location: "components/layout/WorkspaceShellWrapper.tsx:shell-props-sanitize",
      message: "Detected BigInt in WorkspaceShell props; sanitizing payload",
      data: {},
      timestamp: Date.now(),
    })
    // #endregion
    safeTables = sanitizeForClient(tables)
    safeViewsByTable = sanitizeForClient(viewsByTable)
    safeInterfacePages = sanitizeForClient(interfacePages)
    safeInterfaceGroups = sanitizeForClient(interfaceGroups)
    safeDashboards = sanitizeForClient(dashboards)
  }

  try {
    JSON.stringify({
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
    })
    // #region agent log
    console.error("[agent-debug]", {
      sessionId: "909a6f",
      runId: "initial",
      hypothesisId: "H23",
      location: "components/layout/WorkspaceShellWrapper.tsx:shell-props-serializable",
      message: "WorkspaceShell props passed JSON serialization preflight",
      data: {},
      timestamp: Date.now(),
    })
    // #endregion
  } catch (serializeError) {
    // #region agent log
    console.error("[agent-debug]", {
      sessionId: "909a6f",
      runId: "initial",
      hypothesisId: "H23",
      location: "components/layout/WorkspaceShellWrapper.tsx:shell-props-serialize-fail",
      message: "WorkspaceShell props failed JSON serialization preflight",
      data: {
        errorMessage: serializeError instanceof Error ? serializeError.message : String(serializeError),
      },
      timestamp: Date.now(),
    })
    // #endregion
    throw serializeError
  }

    return (
      <BrandingProvider settings={brandingSettings}>
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
    // #region agent log
    console.error("[agent-debug]", {
      sessionId: "909a6f",
      runId: "initial",
      hypothesisId: "H17",
      location: "components/layout/WorkspaceShellWrapper.tsx:outer-catch",
      message: "Unhandled exception in workspace shell wrapper",
      data: {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : typeof error,
        hasStack: Boolean(error instanceof Error && error.stack),
      },
      timestamp: Date.now(),
    })
    // #endregion
    throw error
  }
}
