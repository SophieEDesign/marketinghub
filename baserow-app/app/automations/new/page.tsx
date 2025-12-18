import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import NewAutomationClient from "@/components/automations/NewAutomationClient"

export default function NewAutomationPage() {
  return (
    <WorkspaceShellWrapper title="New Automation">
      <NewAutomationClient />
    </WorkspaceShellWrapper>
  )
}
