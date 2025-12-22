import { redirect } from 'next/navigation'
import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/roles"
import { getInterfaceById, canAccessInterface, getDefaultInterface } from "@/lib/interfaces"
import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import InterfacePageClient from "@/components/interface/InterfacePageClient"

export default async function PagePage({
  params,
}: {
  params: { pageId: string }
}) {
  const supabase = await createClient()
  const admin = await isAdmin()

  // Try to load interface from new system
  let interfaceData = await getInterfaceById(params.pageId)
  let interfaceName = "Interface Page"

  // If not found in new system, fallback to views table
  if (!interfaceData) {
    const { data: view } = await supabase
      .from("views")
      .select("id, name, type, is_admin_only")
      .eq("id", params.pageId)
      .maybeSingle()

    if (!view || view.type !== 'interface') {
      // Redirect to first available interface
      const defaultInterface = await getDefaultInterface()
      if (defaultInterface) {
        redirect(`/pages/${defaultInterface.id}`)
      } else {
        redirect('/')
      }
    }

    // Check permissions for old system
    if (view.is_admin_only && !admin) {
      const defaultInterface = await getDefaultInterface()
      if (defaultInterface) {
        redirect(`/pages/${defaultInterface.id}`)
      } else {
        redirect('/')
      }
    }

    interfaceName = view.name || "Interface Page"
  } else {
    // Check permissions for new system
    const canAccess = await canAccessInterface(params.pageId)
    if (!canAccess) {
      const defaultInterface = await getDefaultInterface()
      if (defaultInterface) {
        redirect(`/pages/${defaultInterface.id}`)
      } else {
        redirect('/')
      }
    }

    interfaceName = interfaceData.name || "Interface Page"
  }

  return (
    <WorkspaceShellWrapper title={interfaceName} hideTopbar={true}>
      <InterfacePageClient pageId={params.pageId} />
    </WorkspaceShellWrapper>
  )
}
