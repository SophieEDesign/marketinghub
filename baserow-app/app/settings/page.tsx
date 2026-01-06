import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/roles'
import WorkspaceShellWrapper from '@/components/layout/WorkspaceShellWrapper'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import SettingsWorkspaceTab from '@/components/settings/WorkspaceTab'
import SettingsPagesTab from '@/components/settings/PagesTab'
import SettingsInterfacesTab from '@/components/settings/InterfacesTab'
import SettingsUsersTab from '@/components/settings/UsersTab'
import SettingsStorageTab from '@/components/settings/StorageTab'
import SettingsApiTab from '@/components/settings/ApiTab'
import SettingsBrandingTab from '@/components/settings/BrandingTab'
import SettingsDataTab from '@/components/settings/DataTab'
import SettingsAutomationsTab from '@/components/settings/AutomationsTab'

export default async function SettingsPage() {
  // Security: Only admins can access settings
  const admin = await isAdmin()
  if (!admin) {
    // Redirect to first available interface
    const supabase = await createClient()
    const { data: firstInterface } = await supabase
      .from('views')
      .select('id')
      .eq('type', 'interface')
      .or('is_admin_only.is.null,is_admin_only.eq.false')
      .order('order_index', { ascending: true })
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
    <WorkspaceShellWrapper title="Settings">
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">Configure workspace settings and admin controls</p>
        </div>

        <Tabs defaultValue="workspace" className="space-y-6">
          <div className="overflow-x-auto">
            <TabsList className="inline-flex w-auto min-w-full">
              <TabsTrigger value="workspace">Workspace</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="interfaces">Interface Access & Sharing</TabsTrigger>
              <TabsTrigger value="pages">Interface Pages</TabsTrigger>
              <TabsTrigger value="data">Data</TabsTrigger>
              <TabsTrigger value="storage">Storage</TabsTrigger>
              <TabsTrigger value="api">API Keys</TabsTrigger>
              <TabsTrigger value="branding">Branding</TabsTrigger>
              <TabsTrigger value="automations">Automations</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="workspace" className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">Identity & metadata only</p>
            <SettingsWorkspaceTab />
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">Who can access the workspace</p>
            <SettingsUsersTab />
          </TabsContent>

          <TabsContent value="interfaces" className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">Who can see which Interfaces</p>
            <SettingsInterfacesTab />
          </TabsContent>

          <TabsContent value="pages" className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">Manage the screens users interact with inside each Interface</p>
            <SettingsPagesTab />
          </TabsContent>

          <TabsContent value="data" className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">Raw data management (Admin / Power User only)</p>
            <SettingsDataTab />
          </TabsContent>

          <TabsContent value="storage" className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">Files, uploads, limits</p>
            <SettingsStorageTab />
          </TabsContent>

          <TabsContent value="api" className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">Technical integrations (Admin only)</p>
            <SettingsApiTab />
          </TabsContent>

          <TabsContent value="branding" className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">Look & feel</p>
            <SettingsBrandingTab />
          </TabsContent>

          <TabsContent value="automations" className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">Background logic</p>
            <SettingsAutomationsTab />
          </TabsContent>
        </Tabs>
      </div>
    </WorkspaceShellWrapper>
  )
}
