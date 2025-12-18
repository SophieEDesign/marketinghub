import { createClient } from "@/lib/supabase/server"
import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import EditAutomationClient from "@/components/automations/EditAutomationClient"
import type { Automation } from "@/types/database"

export default async function AutomationPage({
  params,
}: {
  params: { automationId: string }
}) {
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
