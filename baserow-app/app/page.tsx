import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function HomePage() {
  const supabase = await createClient()

  // Find default interface page
  const { data: defaultInterface } = await supabase
    .from("views")
    .select("id")
    .eq("type", "interface")
    .eq("is_default", true)
    .single()

  if (defaultInterface) {
    redirect(`/pages/${defaultInterface.id}`)
  }

  // If no default, find first interface by created_at
  const { data: firstInterface } = await supabase
    .from("views")
    .select("id")
    .eq("type", "interface")
    .order("created_at", { ascending: true })
    .limit(1)
    .single()

  if (firstInterface) {
    redirect(`/pages/${firstInterface.id}`)
  }

  // If no interfaces exist, show empty state (redirect to settings to create one)
  redirect("/settings?tab=pages")
}
