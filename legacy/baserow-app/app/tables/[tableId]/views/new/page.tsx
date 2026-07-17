import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import NewViewForm from "./NewViewForm"

export default function NewViewPage({
  params,
}: {
  params: { tableId: string }
}) {
  return (
    <WorkspaceShellWrapper title="Create New View">
      <NewViewForm tableId={params.tableId} />
    </WorkspaceShellWrapper>
  )
}
