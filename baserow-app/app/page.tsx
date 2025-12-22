import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/roles"

export default async function HomePage() {
  const supabase = await createClient()
  const admin = await isAdmin()

  // Build query for interfaces based on role
  let defaultQuery = supabase
    .from("views")
    .select("id")
    .eq("type", "interface")
    .eq("is_default", true)

  // If not admin, filter out admin-only interfaces
  if (!admin) {
    defaultQuery = defaultQuery.or('is_admin_only.is.null,is_admin_only.eq.false')
  }

  const { data: defaultInterface } = await defaultQuery.maybeSingle()

  if (defaultInterface) {
    redirect(`/pages/${defaultInterface.id}`)
  }

  // If no default, find first interface by created_at
  let firstQuery = supabase
    .from("views")
    .select("id")
    .eq("type", "interface")
    .order("created_at", { ascending: true })
    .limit(1)

  // If not admin, filter out admin-only interfaces
  if (!admin) {
    firstQuery = firstQuery.or('is_admin_only.is.null,is_admin_only.eq.false')
  }

  const { data: firstInterface } = await firstQuery.maybeSingle()

  if (firstInterface) {
    redirect(`/pages/${firstInterface.id}`)
  }

  // If no interfaces exist, redirect based on role
  if (admin) {
    redirect("/settings?tab=pages")
  } else {
    // Members can't access settings, show empty state
    redirect("/")
  }
}
