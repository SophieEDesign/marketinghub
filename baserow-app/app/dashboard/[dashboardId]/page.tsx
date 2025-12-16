import EmptyView from "@/components/layout/EmptyView"
import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import { LayoutDashboard } from "lucide-react"

export default function DashboardPage({
  params,
}: {
  params: { dashboardId: string }
}) {
  return (
    <WorkspaceShellWrapper title="Dashboard">
      <EmptyView
        message={`Dashboard ${params.dashboardId} - Coming soon…`}
        icon={<LayoutDashboard className="h-12 w-12" />}
      />
    </WorkspaceShellWrapper>
  )
}
