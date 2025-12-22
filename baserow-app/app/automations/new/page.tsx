import { redirect } from 'next/navigation'
import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/roles"
import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import NewAutomationClient from "@/components/automations/NewAutomationClient"

export default async function NewAutomationPage() {
  // Security: Only admins can access automations
  const admin = await isAdmin()
  if (!admin) {
    // Redirect to first available interface
    const supabase = await createClient()
    const { data: firstInterface } = await supabase
      .from('views')
      .select('id')
      .eq('type', 'interface')
      .or('is_admin_only.is.null,is_admin_only.eq.false')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    
    if (firstInterface) {
      redirect(`/pages/${firstInterface.id}`)
    } else {
      redirect('/')
    }
  }

  return (
    <WorkspaceShellWrapper title="New Automation">
      <NewAutomationClient />
    </WorkspaceShellWrapper>
  )
}
