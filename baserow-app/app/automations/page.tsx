import EmptyView from "@/components/layout/EmptyView"
import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import { Zap } from "lucide-react"

export default function AutomationsPage() {
  return (
    <WorkspaceShellWrapper title="Automations">
      <EmptyView
        message="Automations - Coming soon…"
        icon={<Zap className="h-12 w-12" />}
      />
    </WorkspaceShellWrapper>
  )
}
