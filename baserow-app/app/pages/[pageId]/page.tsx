import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/roles"
import { getInterfacePage, querySqlView } from "@/lib/interface/pages"
import { isRecordReviewPage } from "@/lib/interface/page-types"
import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import InterfacePageClient from "@/components/interface/InterfacePageClient"

const isDev = process.env.NODE_ENV === 'development'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function PagePage({
  params,
}: {
  params: { pageId: string }
}) {
  // #region agent log
  fetch('http://127.0.0.1:7903/ingest/9d016980-ed95-431c-a758-912799743da1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'909a6f'},body:JSON.stringify({sessionId:'909a6f',runId:'initial',hypothesisId:'H6',location:'app/pages/[pageId]/page.tsx:entry',message:'Entered server page renderer',data:{hasParams:Boolean(params)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const { pageId } = await params
  // #region agent log
  fetch('http://127.0.0.1:7903/ingest/9d016980-ed95-431c-a758-912799743da1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'909a6f'},body:JSON.stringify({sessionId:'909a6f',runId:'initial',hypothesisId:'H6',location:'app/pages/[pageId]/page.tsx:params',message:'Resolved route params',data:{pageId,isUuid:Boolean(pageId && UUID_REGEX.test(pageId))},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (!pageId || typeof pageId !== "string" || !UUID_REGEX.test(pageId)) {
    if (isDev) {
      console.warn("[Page Render] Invalid pageId, redirecting home:", pageId)
    }
    redirect("/")
  }
  const supabase = await createClient()
  // #region agent log
  fetch('http://127.0.0.1:7903/ingest/9d016980-ed95-431c-a758-912799743da1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'909a6f'},body:JSON.stringify({sessionId:'909a6f',runId:'initial',hypothesisId:'H7',location:'app/pages/[pageId]/page.tsx:createClient',message:'Server Supabase client created',data:{pageId,hasClient:Boolean(supabase)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const admin = await isAdmin()
  // #region agent log
  fetch('http://127.0.0.1:7903/ingest/9d016980-ed95-431c-a758-912799743da1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'909a6f'},body:JSON.stringify({sessionId:'909a6f',runId:'initial',hypothesisId:'H8',location:'app/pages/[pageId]/page.tsx:isAdmin',message:'Resolved admin status',data:{pageId,admin},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  // CRITICAL: Load page data FIRST - never redirect before data is loaded
  // Load interface page from new system
  let page = await getInterfacePage(pageId)
  // #region agent log
  fetch('http://127.0.0.1:7903/ingest/9d016980-ed95-431c-a758-912799743da1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'909a6f'},body:JSON.stringify({sessionId:'909a6f',runId:'initial',hypothesisId:'H9',location:'app/pages/[pageId]/page.tsx:getInterfacePage',message:'Loaded interface page metadata',data:{pageId,found:Boolean(page),pageType:page?.page_type||null,hasSourceView:Boolean(page?.source_view)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
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
          // #region agent log
          fetch('http://127.0.0.1:7903/ingest/9d016980-ed95-431c-a758-912799743da1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'909a6f'},body:JSON.stringify({sessionId:'909a6f',runId:'initial',hypothesisId:'H9',location:'app/pages/[pageId]/page.tsx:querySqlView:success',message:'Loaded SQL view data',data:{pageId,sourceView:page.source_view,rowCount:Array.isArray(initialData)?initialData.length:null},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          if (isDev) {
            console.log('[Page Render] Loaded initial data:', { count: initialData.length })
          }
        } catch (error) {
          // #region agent log
          fetch('http://127.0.0.1:7903/ingest/9d016980-ed95-431c-a758-912799743da1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'909a6f'},body:JSON.stringify({sessionId:'909a6f',runId:'initial',hypothesisId:'H9',location:'app/pages/[pageId]/page.tsx:querySqlView:catch',message:'Failed loading SQL view data but continuing',data:{pageId,sourceView:page?.source_view||null,errorMessage:error instanceof Error ? error.message : String(error)},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
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
  // CRITICAL: No redirect when page is null (not found / access denied) - render InterfacePageClient with null
  // DO NOT redirect on render errors (missing blocks, data errors, etc.)
  if (isDev && !page) {
    console.log('[Page Render] Rendering with null page (not found or access denied) - NO redirect')
  }
  // Those should be shown on the page itself
  // NOTE: record_view and record_review intentionally share the same shell.
  // They differ only by left-column configuration and settings UX.
  // See docs/architecture/PAGE_TYPE_CONSOLIDATION.md
  // Hide RecordPanel for record-centric pages since they have their own record detail panel
  const hideRecordPanel = page ? isRecordReviewPage(page.page_type as any) : false
  
  if (isDev && page) {
    console.log('[Page Render] Rendering page:', { pageId, pageName, hasData: initialData.length > 0 })
  }
  // #region agent log
  fetch('http://127.0.0.1:7903/ingest/9d016980-ed95-431c-a758-912799743da1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'909a6f'},body:JSON.stringify({sessionId:'909a6f',runId:'initial',hypothesisId:'H6',location:'app/pages/[pageId]/page.tsx:pre-return',message:'Server page renderer reached return',data:{pageId,pageResolved:Boolean(page),pageName,initialDataCount:Array.isArray(initialData)?initialData.length:0},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  
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
