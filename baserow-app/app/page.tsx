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
    
    // No default page resolved - do NOT fall back to a random page.
    if (isDev) {
      console.warn('[Default Page] No default page resolved - showing empty state')
    }

    if (admin) {
      redirect("/settings?tab=pages")
    }

    return (
      <WorkspaceShellWrapper title="Welcome">
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-2xl font-semibold text-gray-900">No Default Page Set</h1>
            <p className="text-gray-600">
              Your workspace does not have a default page configured. Please contact your
              administrator to set one.
            </p>
          </div>
        </div>
      </WorkspaceShellWrapper>
    )
  } catch (error) {
    // Error resolving landing page - log and show empty state (no random fallback)
    if (isDev) {
      console.error('[Default Page] Error resolving landing page:', error)
      if (error instanceof Error) {
        console.error('[Default Page] Error details:', error.message, error.stack)
      }
    }

    if (admin) {
      redirect("/settings?tab=pages")
    }

    return (
      <WorkspaceShellWrapper title="Welcome">
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-2xl font-semibold text-gray-900">Unable to Load Default Page</h1>
            <p className="text-gray-600">
              We couldn&#39;t determine a default page. Please contact your administrator.
            </p>
          </div>
        </div>
      </WorkspaceShellWrapper>
    )
  }
}
