import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/roles"
import { getDefaultInterface, getInterfaces } from "@/lib/interfaces"

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

  // Try to get default interface using new system
  try {
    const defaultInterface = await getDefaultInterface()
    if (defaultInterface) {
      redirect(`/pages/${defaultInterface.id}`)
    }
  } catch (error) {
    // Fallback to old system
    console.warn('Error loading default interface, falling back to views table:', error)
  }

  // If no default, get first accessible interface
  try {
    const interfaces = await getInterfaces()
    if (interfaces.length > 0) {
      redirect(`/pages/${interfaces[0].id}`)
    }
  } catch (error) {
    // Fallback to old system
    console.warn('Error loading interfaces, falling back to views table:', error)
    
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
  }

  // If no interfaces exist, redirect based on role
  if (admin) {
    redirect("/settings?tab=pages")
  } else {
    // Members can't access settings, show empty state
    redirect("/")
  }
}
