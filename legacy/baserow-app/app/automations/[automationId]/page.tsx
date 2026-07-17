import { redirect } from 'next/navigation'
import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/roles"
import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import EditAutomationClient from "@/components/automations/EditAutomationClient"
import type { Automation } from "@/types/database"

export default async function AutomationPage({
  params,
}: {
  params: { automationId: string }
}) {
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

  const supabase = await createClient()

  // Load automation for title
  const { data: automation } = await supabase
    .from("automations")
    .select("name")
    .eq("id", params.automationId)
    .single()

  return (
    <WorkspaceShellWrapper title={(automation as Automation)?.name || "Edit Automation"}>
      <EditAutomationClient automationId={params.automationId} />
    </WorkspaceShellWrapper>
  )
}
