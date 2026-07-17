import { redirect } from 'next/navigation'
import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/roles"
import Link from "next/link"
import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import { Plus, Activity } from "lucide-react"
import type { Automation } from "@/types/database"
import AutomationsListClient from "@/components/automations/AutomationsListClient"
import AutomationHealthDashboard from "@/components/automations/AutomationHealthDashboard"

export default async function AutomationsPage() {
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

  // Load all automations
  const { data: automations, error } = await supabase
    .from("automations")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error loading automations:", error)
  }

  const automationList = (automations || []) as Automation[]

  return (
    <WorkspaceShellWrapper title="Automations">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Automations</h1>
            <p className="text-muted-foreground mt-1">
              Automate workflows with triggers and actions
            </p>
          </div>
          <Link
            href="/automations/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            New Automation
          </Link>
        </div>

        {automationList.length === 0 ? (
          <div className="text-center py-12 border border-gray-200 rounded-lg">
            <p className="text-gray-500 mb-4">No automations yet</p>
            <Link
              href="/automations/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create Your First Automation
            </Link>
          </div>
        ) : (
          <>
            {/* Health Dashboard Summary */}
            {automationList.length > 0 && (
              <div className="border-b border-gray-200 pb-6">
                <AutomationHealthDashboard automations={automationList} />
              </div>
            )}
            
            {/* Automation List */}
            <div className={automationList.length > 0 ? "pt-6" : ""}>
              <AutomationsListClient automations={automationList} />
            </div>
          </>
        )}
      </div>
    </WorkspaceShellWrapper>
  )
}
