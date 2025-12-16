import EmptyView from "@/components/layout/EmptyView"
import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import { Settings } from "lucide-react"

export default function SettingsPage() {
  return (
    <WorkspaceShellWrapper title="Settings">
      <EmptyView
        message="Settings - Coming soon…"
        icon={<Settings className="h-12 w-12" />}
      />
    </WorkspaceShellWrapper>
  )
}
