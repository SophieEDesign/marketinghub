import { createClient } from "@/lib/supabase/server"
import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import InterfacePageClient from "@/components/interface/InterfacePageClient"
import type { Page } from "@/lib/interface/types"

export default async function InterfacePage({
  params,
}: {
  params: { pageId: string }
}) {
  const supabase = await createClient()

  // Load page for title
  const { data: page } = await supabase
    .from("pages")
    .select("name")
    .eq("id", params.pageId)
    .single()

  return (
    <WorkspaceShellWrapper title={(page as Page)?.name || "Interface Page"}>
      <InterfacePageClient pageId={params.pageId} />
    </WorkspaceShellWrapper>
  )
}
