import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import InterfacePage from "@/components/views/InterfacePage"
import { getView } from "@/lib/crud/views"

export default async function InterfacePageRoute({
  params,
}: {
  params: { pageId: string }
}) {
  const view = await getView(params.pageId).catch(() => null)
  
  if (!view || view.type !== "page") {
    return (
      <WorkspaceShellWrapper title="Interface Page Not Found">
        <div className="text-center py-12">
          <p className="text-destructive">Interface page not found</p>
        </div>
      </WorkspaceShellWrapper>
    )
  }

  return (
    <WorkspaceShellWrapper title={view.name}>
      <div className="w-full h-full -m-6">
        <InterfacePage viewId={params.pageId} />
      </div>
    </WorkspaceShellWrapper>
  )
}
