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

  // If not found in new system, try old system for backward compatibility
  if (!page) {
    const { data: view } = await supabase
      .from("views")
      .select("id, name, type, is_admin_only")
      .eq("id", pageId)
      .maybeSingle()

    if (!view || view.type !== 'interface') {
      // Page not found - render with null page so InterfacePageClient shows "not found" UI
      // DO NOT redirect - let the component handle it
      if (isDev) {
        console.warn('[Redirect] Page not found, rendering null page:', pageId)
      }
      page = null
      pageName = "Page Not Found"
    } else {
      // Check permissions for old system
      if (view.is_admin_only && !admin) {
        // Permission denied - render with null page so component shows access denied UI
        // DO NOT redirect - let the component handle it
        if (isDev) {
          console.warn('[Redirect] Access denied, rendering null page:', pageId)
        }
        page = null
        pageName = "Access Denied"
      } else {
        pageName = view.name || "Interface Page"
      }
    }
  } else {
    // Check permissions for new system
    if (page.is_admin_only && !admin) {
      // Permission denied - render with null page so component shows access denied UI
      // DO NOT redirect - let the component handle it
      if (isDev) {
        console.warn('[Redirect] Access denied, rendering null page:', pageId)
      }
      page = null
      pageName = "Access Denied"
    } else {
      pageName = page.name || "Interface Page"

      // Load initial data from SQL view if source_view is set
      if (page.source_view) {
        try {
          initialData = await querySqlView(page.source_view, page.config?.default_filters || {})
        } catch (error) {
          console.error('Error loading initial SQL view data:', error)
          // Continue without data - PageRenderer will handle loading state
        }
      }
    }
  }

  // ALWAYS render - never redirect away from explicitly requested page
  // Invalid pages will show setup UI via PageRenderer
  // Hide RecordPanel for record_review pages since they have their own record detail panel
  const hideRecordPanel = page ? isRecordReviewPage(page.page_type as any) : false
  
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
