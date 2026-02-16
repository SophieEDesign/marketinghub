import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getInterfacePage } from "@/lib/interface/pages"
import { isAdmin } from "@/lib/roles"
import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import InterfacePageClient from "@/components/interface/InterfacePageClient"

export default async function InterfacePage({
  params,
}: {
  params: Promise<{ pageId: string }>
}) {
  const { pageId } = await params
  const supabase = await createClient()
  const admin = await isAdmin()

  // First check if it's a new system page (interface_pages table)
  const newPage = await getInterfacePage(pageId)
  if (newPage) {
    // Redirect to canonical route (old /interface/xxx -> /pages/xxx)
    console.log('[Redirect] app/interface/[pageId] redirecting to canonical /pages/' + pageId)
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
    console.log('[Redirect] app/interface/[pageId] page not found, redirecting to /')
    redirect('/')
  }

  // Convert view to InterfacePage shape for InterfacePageClient
  const page = {
    id: view.id,
    name: view.name || "Interface Page",
    page_type: "content" as const,
    base_table: null,
    config: {},
    group_id: null,
    order_index: 0,
    created_at: "",
    updated_at: "",
    created_by: null,
    is_admin_only: view.is_admin_only ?? false,
    saved_view_id: null,
    dashboard_layout_id: null,
    form_config_id: null,
    record_config_id: null,
    source_view: null,
  }

  return (
    <WorkspaceShellWrapper title={page.name} hideTopbar={true}>
      <InterfacePageClient
        key={pageId}
        pageId={pageId}
        initialPage={page as any}
        initialData={[]}
        isAdmin={admin}
      />
    </WorkspaceShellWrapper>
  )
}
