import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/roles"
import { resolveLandingPage } from "@/lib/interfaces"

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
      // If there's an error, redirect to login with error message
      const nextParam = searchParams.next ? `&next=${encodeURIComponent(searchParams.next)}` : ''
      redirect(`/login?error=${encodeURIComponent(error.message)}${nextParam}`)
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

  // Resolve landing page with priority order and validation
  try {
    const { pageId, reason } = await resolveLandingPage()
    
    if (pageId) {
      // Redirect to resolved page
      redirect(`/pages/${pageId}`)
    }
    
    // No accessible pages found - redirect based on role
    if (admin) {
      redirect("/settings?tab=pages")
    } else {
      // Members can't access settings, show empty state
      // This should rarely happen, but handle gracefully
      redirect("/")
    }
  } catch (error) {
    // Error resolving landing page - fallback to old system
    const isDev = process.env.NODE_ENV === 'development'
    if (isDev) {
      console.warn('[Landing Page] Error resolving landing page, falling back:', error)
      if (error instanceof Error) {
        console.warn('[Landing Page] Error details:', error.message, error.stack)
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
        redirect(`/pages/${firstInterface.id}`)
      }
    } catch (fallbackError) {
      // Last resort fallback
      if (admin) {
        redirect("/settings?tab=pages")
      } else {
        redirect("/")
      }
    }
  }
}
