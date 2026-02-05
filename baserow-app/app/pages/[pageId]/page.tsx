import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/roles"
import { getInterfacePage, querySqlView } from "@/lib/interface/pages"
import { isRecordReviewPage } from "@/lib/interface/page-types"
import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import InterfacePageClient from "@/components/interface/InterfacePageClient"

const isDev = process.env.NODE_ENV === 'development'

export default async function PagePage({
  params,
}: {
  params: Promise<{ pageId: string }>
}) {
  const { pageId } = await params
  const supabase = await createClient()
  const admin = await isAdmin()

  // CRITICAL: Load page data FIRST - never redirect before data is loaded
  // Load interface page from new system
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
          // Data load error - log but continue rendering
          // The page component will handle showing the error state
          console.error('[Page Render] Error loading initial SQL view data (continuing to render):', error)
          if (isDev) {
            console.log('[Page Render] Page will render with empty data - component will handle error state')
          }
          // Continue without data - PageRenderer will handle loading state
        }
      }
    }
  }

  // ALWAYS render - never redirect away from explicitly requested page
  // CRITICAL: Only redirect if page doesn't exist or is not accessible
  // DO NOT redirect on render errors (missing blocks, data errors, etc.)
  // Those should be shown on the page itself
  // NOTE: record_view and record_review intentionally share the same shell.
  // They differ only by left-column configuration and settings UX.
  // See docs/architecture/PAGE_TYPE_CONSOLIDATION.md
  // Hide RecordPanel for record-centric pages since they have their own record detail panel
  const hideRecordPanel = page ? isRecordReviewPage(page.page_type as any) : false
  
  if (isDev && page) {
    console.log('[Page Render] Rendering page:', { pageId, pageName, hasData: initialData.length > 0 })
  }
  
  return (
    <WorkspaceShellWrapper title={pageName} hideTopbar={true} hideRecordPanel={hideRecordPanel}>
      <InterfacePageClient 
        pageId={pageId} 
        initialPage={page || undefined}
        initialData={initialData}
        isAdmin={admin}
      />
    </WorkspaceShellWrapper>
  )
}
