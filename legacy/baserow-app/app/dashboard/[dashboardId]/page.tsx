import { redirect } from "next/navigation"
import { getInterfacePage } from "@/lib/interface/pages"
import { isAdmin } from "@/lib/roles"
import EmptyView from "@/components/layout/EmptyView"
import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import { LayoutDashboard } from "lucide-react"

/**
 * Legacy /dashboard/[dashboardId] route - redirect to canonical /pages/[dashboardId] when page exists.
 * Only /pages/[pageId] renders InterfacePageClient.
 */
export default async function DashboardPage({
  params,
}: {
  params: { dashboardId: string }
}) {
  const { dashboardId } = params
  const page = await getInterfacePage(dashboardId)
  const admin = await isAdmin()

  if (page) {
    if (page.is_admin_only && !admin) {
      return (
        <WorkspaceShellWrapper title="Access Denied">
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Access denied
          </div>
        </WorkspaceShellWrapper>
      )
    }
    redirect(`/pages/${dashboardId}`)
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
