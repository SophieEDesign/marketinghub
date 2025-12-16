import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import ImportClient from "@/components/import/ImportClient"

export default function ImportPage() {
  return (
    <WorkspaceShellWrapper title="Import CSV">
      <ImportClient />
    </WorkspaceShellWrapper>
  )
}
