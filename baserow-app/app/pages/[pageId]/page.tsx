import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/roles"
import { getInterfacePage, querySqlView } from "@/lib/interface/pages"
import { isRecordReviewPage } from "@/lib/interface/page-types"
import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import InterfacePageClient from "@/components/interface/InterfacePageClient"

const isDev = process.env.NODE_ENV === 'development'
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

export default async function PagePage({
  params,
}: {
  params: Promise<{ pageId: string }>
}) {
  const { pageId } = await params
  if (!pageId || typeof pageId !== "string" || !UUID_REGEX.test(pageId)) {
    if (isDev) {
      console.warn("[Page Render] Invalid pageId, redirecting home:", pageId)
    }
    redirect("/")
  }

  const supabase = await createClient()
  const admin = await isAdmin()

  let page = await getInterfacePage(pageId)
  let pageName = "Interface Page"
  let initialData: any[] = []

  if (isDev) {
    console.log('[Page Render] Loading page:', { pageId, found: !!page })
  }

  // If not found in new system, try old system for backward compatibility
  if (!page) {
    const { data: view } = await supabase
      .from("views")
      .select("id, name, type, is_admin_only")
      .eq("id", pageId)
      .maybeSingle()

    if (!view || view.type !== 'interface') {
      // Page not found - render with null page so InterfacePageClient shows "not found" UI
      // DO NOT redirect - this is a valid state (page doesn't exist)
      // The default page router should only redirect if page doesn't exist, not on render errors
      if (isDev) {
        console.warn('[Page Render] ✗ Page not found:', pageId)
      }
      page = null
      pageName = "Page Not Found"
    } else {
      // Check permissions for old system
      if (view.is_admin_only && !admin) {
        // Permission denied - render with null page so component shows access denied UI
        // DO NOT redirect - this is a valid state (page not accessible)
        if (isDev) {
          console.warn('[Page Render] ✗ Access denied:', pageId)
        }
        page = null
        pageName = "Access Denied"
      } else {
        pageName = view.name || "Interface Page"
        if (isDev) {
          console.log('[Page Render] ✓ Page found in views table:', pageId)
        }
      }
    }
  } else {
    // Check permissions for new system
    if (page.is_admin_only && !admin) {
      // Permission denied - render with null page so component shows access denied UI
      // DO NOT redirect - this is a valid state (page not accessible)
      if (isDev) {
        console.warn('[Page Render] ✗ Access denied:', pageId)
      }
      page = null
      pageName = "Access Denied"
    } else {
      pageName = page.name || "Interface Page"
      if (isDev) {
        console.log('[Page Render] ✓ Page found in interface_pages:', pageId)
      }

      // Load initial data from SQL view if source_view is set
      // CRITICAL: Errors loading data are NOT reasons to redirect
      // If data fails to load, the page should still render and show an error state
      if (page.source_view) {
        try {
          initialData = await querySqlView(page.source_view, page.config?.default_filters || {})
          if (isDev) {
            console.log('[Page Render] Loaded initial data:', { count: initialData.length })
          }
        } catch (error) {
          console.error('[Page Render] Error loading initial SQL view data (continuing to render):', error)
          if (isDev) {
            console.log('[Page Render] Page will render with empty data - component will handle error state')
          }
        }
      }
    }
  }

  if (isDev && !page) {
    console.log('[Page Render] Rendering with null page (not found or access denied) - NO redirect')
  }

  const hideRecordPanel = page ? isRecordReviewPage(page.page_type as any) : false

  if (isDev && page) {
    console.log('[Page Render] Rendering page:', { pageId, pageName, hasData: initialData.length > 0 })
  }

  const initialDataHasBigInt = containsBigInt(initialData)
  const initialPageHasBigInt = containsBigInt(page ?? null)
  let safeInitialData = initialData
  let safeInitialPage = page || undefined

  if (initialDataHasBigInt || initialPageHasBigInt) {
    safeInitialData = sanitizeForClient(initialData)
    safeInitialPage = sanitizeForClient(page || undefined)
  }

  return (
    <WorkspaceShellWrapper title={pageName} hideTopbar={true} hideRecordPanel={hideRecordPanel}>
      <InterfacePageClient
        pageId={pageId}
        initialPage={safeInitialPage}
        initialData={safeInitialData}
        isAdmin={admin}
      />
    </WorkspaceShellWrapper>
  )
}
