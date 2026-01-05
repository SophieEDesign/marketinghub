import { redirect } from 'next/navigation'
import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/roles"
import { getInterfacePage, querySqlView } from "@/lib/interface/pages"
import { getAllInterfacePages } from "@/lib/interface/pages"
import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import InterfacePageClient from "@/components/interface/InterfacePageClient"

export default async function PagePage({
  params,
}: {
  params: { pageId: string }
}) {
  const supabase = await createClient()
  const admin = await isAdmin()

  // Load interface page from new system
  let page = await getInterfacePage(params.pageId)
  let pageName = "Interface Page"
  let initialData: any[] = []

  // If not found in new system, try old system for backward compatibility
  if (!page) {
    const { data: view } = await supabase
      .from("views")
      .select("id, name, type, is_admin_only")
      .eq("id", params.pageId)
      .maybeSingle()

    if (!view || view.type !== 'interface') {
      // Redirect to first available interface page
      const allPages = await getAllInterfacePages()
      if (allPages.length > 0) {
        redirect(`/pages/${allPages[0].id}`)
      } else {
        redirect('/')
      }
    }

    // Check permissions for old system
    if (view.is_admin_only && !admin) {
      const allPages = await getAllInterfacePages()
      if (allPages.length > 0) {
        redirect(`/pages/${allPages[0].id}`)
      } else {
        redirect('/')
      }
    }

    pageName = view.name || "Interface Page"
  } else {
    // Check permissions for new system
    if (page.is_admin_only && !admin) {
      const allPages = await getAllInterfacePages()
      if (allPages.length > 0) {
        redirect(`/pages/${allPages[0].id}`)
      } else {
        redirect('/')
      }
    }

    pageName = page.name || "Interface Page"

    // Load initial data from SQL view if source_view is set
    if (page.source_view) {
      try {
        initialData = await querySqlView(page.source_view, page.config?.default_filters || {})
      } catch (error) {
        console.error('Error loading initial SQL view data:', error)
        // Continue without data - PageRenderer will handle loading state
      }
    }
  }

  return (
    <WorkspaceShellWrapper title={pageName} hideTopbar={true}>
      <InterfacePageClient 
        pageId={params.pageId} 
        initialPage={page || undefined}
        initialData={initialData}
        isAdmin={admin}
      />
    </WorkspaceShellWrapper>
  )
}
