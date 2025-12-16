import EmptyView from "@/components/layout/EmptyView"
import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import { FileText } from "lucide-react"

export default function InterfacePage({
  params,
}: {
  params: { pageId: string }
}) {
  return (
    <WorkspaceShellWrapper title="Interface Page">
      <EmptyView
        message={`Interface page ${params.pageId} - Coming soon…`}
        icon={<FileText className="h-12 w-12" />}
      />
    </WorkspaceShellWrapper>
  )
}
