import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/roles'
import WorkspaceShellWrapper from '@/components/layout/WorkspaceShellWrapper'
import { Settings, Shield, Database, Key, FileText, Palette } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import SettingsWorkspaceTab from '@/components/settings/WorkspaceTab'
import SettingsPagesTab from '@/components/settings/PagesTab'
import SettingsPermissionsTab from '@/components/settings/PermissionsTab'
import SettingsStorageTab from '@/components/settings/StorageTab'
import SettingsApiTab from '@/components/settings/ApiTab'
import SettingsBrandingTab from '@/components/settings/BrandingTab'
import SettingsDataTab from '@/components/settings/DataTab'

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
          <p className="text-muted-foreground">Manage your workspace settings and preferences</p>
        </div>

        <Tabs defaultValue="workspace" className="space-y-6">
          <TabsList>
            <TabsTrigger value="workspace">
              <Settings className="mr-2 h-4 w-4" />
              Workspace
            </TabsTrigger>
            <TabsTrigger value="pages">
              <FileText className="mr-2 h-4 w-4" />
              Interfaces
            </TabsTrigger>
            <TabsTrigger value="permissions">
              <Shield className="mr-2 h-4 w-4" />
              Permissions
            </TabsTrigger>
            <TabsTrigger value="storage">
              <Database className="mr-2 h-4 w-4" />
              Storage
            </TabsTrigger>
            <TabsTrigger value="api">
              <Key className="mr-2 h-4 w-4" />
              API Keys
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workspace" className="space-y-4">
            <SettingsWorkspaceTab />
          </TabsContent>

          <TabsContent value="pages" className="space-y-4">
            <SettingsPagesTab />
          </TabsContent>

          <TabsContent value="permissions" className="space-y-4">
            <SettingsPermissionsTab />
          </TabsContent>

          <TabsContent value="data" className="space-y-4">
            <SettingsDataTab />
          </TabsContent>

          <TabsContent value="storage" className="space-y-4">
            <SettingsStorageTab />
          </TabsContent>

          <TabsContent value="api" className="space-y-4">
            <SettingsApiTab />
          </TabsContent>

          <TabsContent value="branding" className="space-y-4">
            <SettingsBrandingTab />
          </TabsContent>
        </Tabs>
      </div>
    </WorkspaceShellWrapper>
  )
}
