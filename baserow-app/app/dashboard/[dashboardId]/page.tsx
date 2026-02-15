import EmptyView from "@/components/layout/EmptyView"
import { getInterfacePage } from "@/lib/interface/pages"
import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import InterfacePageClient from "@/components/interface/InterfacePageClient"
import { isAdmin } from "@/lib/roles"
import { LayoutDashboard } from "lucide-react"

/**
 * Dashboard route - unified with /pages/[pageId] architecture.
 * If dashboardId exists as an interface page, render through InterfacePageClient.
 * Otherwise show placeholder (dashboards table entries not yet migrated).
 */
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ dashboardId: string }>
}) {
  const { dashboardId } = await params
  const page = await getInterfacePage(dashboardId)
  const admin = await isAdmin()

  if (page) {
    // Page exists in interface_pages - use same flow as /pages/[pageId]
    if (page.is_admin_only && !admin) {
      return (
        <WorkspaceShellWrapper title="Access Denied">
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Access denied
          </div>
        </WorkspaceShellWrapper>
      )
    }
    return (
      <WorkspaceShellWrapper title={page.name} hideTopbar={true}>
        <InterfacePageClient
          key={dashboardId}
          pageId={dashboardId}
          initialPage={page}
          initialData={[]}
          isAdmin={admin}
        />
      </WorkspaceShellWrapper>
    )
  }

  // Dashboard not in interface_pages - show placeholder
  return (
    <WorkspaceShellWrapper title="Dashboard">
      <EmptyView
        message={`Dashboard ${dashboardId} - Coming soon…`}
        icon={<LayoutDashboard className="h-12 w-12" />}
      />
    </WorkspaceShellWrapper>
  )
}
