import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/roles"
import { resolveLandingPage } from "@/lib/interfaces"
import { getAllInterfacePages } from "@/lib/interface/pages"
import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import { authErrorToMessage } from "@/lib/auth-utils"

const isDev = process.env.NODE_ENV === 'development'

export default async function HomePage({
  searchParams,
}: {
  searchParams?: { code?: string; next?: string }
}) {
  const supabase = await createClient()
  
  // Handle email confirmation code if present
  if (searchParams?.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(searchParams.code)
    if (error) {
      // If there's an error, redirect to login with user-friendly error message
      const userFriendlyError = authErrorToMessage(error, 'emailConfirmation')
      const nextParam = searchParams.next ? `&next=${encodeURIComponent(searchParams.next)}` : ''
      redirect(`/login?error=${encodeURIComponent(userFriendlyError)}${nextParam}`)
    }
    // After successful confirmation, continue with normal flow
  }
  
  // Check authentication - redirect to login if not authenticated
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    // Preserve the next parameter if present
    const nextParam = searchParams?.next ? `?next=${encodeURIComponent(searchParams.next)}` : ''
    redirect(`/login${nextParam}`)
  }
  
  const admin = await isAdmin()

  // CRITICAL: Load accessible pages FIRST before any redirect logic
  // This ensures we have data before making redirect decisions
  // Filter by admin access to match resolveLandingPage() logic
  let accessiblePages: Array<{ id: string }> = []
  try {
    const allPages = await getAllInterfacePages()
    // Filter out admin-only pages for non-admin users (matching resolveLandingPage logic)
    accessiblePages = allPages
      .filter(p => admin || !p.is_admin_only)
      .map(p => ({ id: p.id }))
    
    if (isDev) {
      console.log(`[Redirect] Loaded ${accessiblePages.length} accessible pages (filtered from ${allPages.length} total)`)
    }
  } catch (error) {
    if (isDev) {
      console.warn('[Redirect] Error loading pages:', error)
    }
  }

  // CRITICAL: Resolve landing page with priority order and validation
  // Only redirect if user is authenticated AND valid default exists
  // This redirect happens ONCE at server render time - client-side effects cannot override it
  try {
    const { pageId, reason } = await resolveLandingPage()
    
    if (isDev) {
      console.log(`[Default Page] resolveLandingPage returned:`, { 
        pageId, 
        reason, 
        inAccessiblePages: pageId ? accessiblePages.some(p => p.id === pageId) : false,
        accessiblePagesCount: accessiblePages.length
      })
    }
    
    // resolveLandingPage() already validates access (existence + permissions)
    // If it returns a pageId, the page exists and user has access
    // We should redirect to it - even if it fails to render, that's a separate issue
    if (pageId) {
      // Log the redirect decision
      if (isDev) {
        console.log('[Default Page] ✓ Redirecting to resolved page:', { 
          reason, 
          pageId,
          note: 'Page exists and is accessible. Render errors will be shown on the page, not masked by redirect.'
        })
      }
      // CRITICAL: This redirect happens at server render time
      // Client-side effects cannot override this redirect
      // If the page fails to render, it will show an error on the page itself
      redirect(`/pages/${pageId}`)
    }
    
    // No default page resolved - fallback to first accessible page
    if (accessiblePages.length > 0) {
      const firstPageId = accessiblePages[0].id
      if (isDev) {
        console.log('[Default Page] No default set, using first accessible page:', { 
          reason: 'first_accessible_fallback', 
          pageId: firstPageId 
        })
      }
      redirect(`/pages/${firstPageId}`)
    }
    
    // No accessible pages found - show empty state instead of redirecting
    // Redirecting to "/" creates a loop, so we render an empty state here
    if (isDev) {
      console.warn('[Default Page] No accessible pages found - showing empty state')
    }
    
    if (admin) {
      redirect("/settings?tab=pages")
    } else {
      // Members can't access settings - show empty state page
      // Return empty state component instead of redirecting to avoid loop
      return (
        <WorkspaceShellWrapper title="Welcome">
          <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
            <div className="max-w-md text-center space-y-4">
              <h1 className="text-2xl font-semibold text-gray-900">No Pages Available</h1>
              <p className="text-gray-600">
                No pages are available yet. Please contact an administrator to create pages.
              </p>
              <p className="text-sm text-gray-500">
                If you&#39;re an administrator, you can create pages in Settings.
              </p>
            </div>
          </div>
        </WorkspaceShellWrapper>
      )
    }
  } catch (error) {
    // Error resolving landing page - log and fallback
    if (isDev) {
      console.error('[Default Page] Error resolving landing page:', error)
      if (error instanceof Error) {
        console.error('[Default Page] Error details:', error.message, error.stack)
      }
    }
    
    // Fallback: try to get first accessible interface from views table
    try {
      let firstQuery = supabase
        .from("views")
        .select("id")
        .eq("type", "interface")
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(1)

      if (!admin) {
        firstQuery = firstQuery.or('is_admin_only.is.null,is_admin_only.eq.false')
      }

      const { data: firstInterface } = await firstQuery.maybeSingle()
      if (firstInterface) {
        if (isDev) {
          console.log('[Default Page] Fallback to views table:', { 
            reason: 'fallback_views_table', 
            pageId: firstInterface.id 
          })
        }
        redirect(`/pages/${firstInterface.id}`)
      }
    } catch (fallbackError) {
      if (isDev) {
        console.error('[Default Page] Fallback error:', fallbackError)
      }
    }
    
    // Last resort fallback - show empty state instead of redirecting
    if (admin) {
      redirect("/settings?tab=pages")
    } else {
      // Show empty state instead of redirecting to avoid loop
      return (
        <WorkspaceShellWrapper title="Welcome">
          <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
            <div className="max-w-md text-center space-y-4">
              <h1 className="text-2xl font-semibold text-gray-900">No Pages Available</h1>
              <p className="text-gray-600">
                No pages are available yet. Please contact an administrator to create pages.
              </p>
              <p className="text-sm text-gray-500">
                If you&#39;re an administrator, you can create pages in Settings.
              </p>
            </div>
          </div>
        </WorkspaceShellWrapper>
      )
    }
  }
}
