import { redirect } from 'next/navigation'
import { createClient } from "@/lib/supabase/server"
import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import InterfacePageClient from "@/components/interface/InterfacePageClient"

export default async function PagePage({
  params,
}: {
  params: { pageId: string }
}) {
  const supabase = await createClient()

  // Load view (interface page) from views table
  const { data: view, error } = await supabase
    .from("views")
    .select("id, name, type")
    .eq("id", params.pageId)
    .single()

  if (error || !view) {
    redirect('/settings?tab=pages')
  }

  // Confirm it's an interface page
  if (view.type !== 'interface') {
    // If it's not an interface page, redirect to the appropriate view route
    if (view.type && view.type !== 'interface') {
      // Try to find the table_id
      const { data: viewWithTable } = await supabase
        .from('views')
        .select('table_id')
        .eq('id', params.pageId)
        .single()
      
      if (viewWithTable?.table_id) {
        redirect(`/tables/${viewWithTable.table_id}/views/${params.pageId}`)
      }
    }
    redirect('/settings?tab=pages')
  }

  return (
    <WorkspaceShellWrapper title={view.name || "Interface Page"} hideTopbar={true}>
      <InterfacePageClient pageId={params.pageId} />
    </WorkspaceShellWrapper>
  )
}
