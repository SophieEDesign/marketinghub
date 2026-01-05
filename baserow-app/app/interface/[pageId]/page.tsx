import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getInterfacePage } from "@/lib/interface/pages"
import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import InterfacePageClient from "@/components/interface/InterfacePageClient"

export default async function InterfacePage({
  params,
}: {
  params: Promise<{ pageId: string }>
}) {
  const { pageId } = await params
  const supabase = await createClient()

  // First check if it's a new system page (interface_pages table)
  const newPage = await getInterfacePage(pageId)
  if (newPage) {
    // Redirect to new route
    redirect(`/pages/${pageId}`)
  }

  // Otherwise, try old system (views table)
  const { data: view } = await supabase
    .from("views")
    .select("id, name, type, is_admin_only")
    .eq("id", pageId)
    .eq("type", "interface")
    .maybeSingle()

  if (!view) {
    // Page not found in either system, redirect to home
    redirect('/')
  }

  return (
    <WorkspaceShellWrapper title={view.name || "Interface Page"}>
      <InterfacePageClient pageId={pageId} />
    </WorkspaceShellWrapper>
  )
}
