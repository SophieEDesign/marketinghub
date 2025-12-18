import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import { Settings, Shield, Database, Key } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
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
          <Card>
            <CardHeader>
              <CardTitle>Workspace Settings</CardTitle>
              <CardDescription>Configure your workspace preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Workspace Name</label>
                <input
                  type="text"
                  defaultValue="Marketing Hub"
                  className="w-full px-3 py-2 border rounded-md"
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  Workspace name cannot be changed at this time
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Default View Type</label>
                <select className="w-full px-3 py-2 border rounded-md" defaultValue="grid">
                  <option value="grid">Grid</option>
                  <option value="kanban">Kanban</option>
                  <option value="calendar">Calendar</option>
                </select>
              </div>
              <div className="pt-4">
                <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                  Save Changes
                </button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Permissions</CardTitle>
              <CardDescription>Manage access control and user permissions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">Access Control</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Configure who can access your workspace and tables
                  </p>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="access" value="public" className="w-4 h-4" />
                      <span>Public - Anyone can view</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="access" value="authenticated" defaultChecked className="w-4 h-4" />
                      <span>Authenticated - Logged in users only</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="access" value="owner" className="w-4 h-4" />
                      <span>Owner - Only you</span>
                    </label>
                  </div>
                </div>
                <div className="pt-4">
                  <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                    Update Permissions
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Storage</CardTitle>
              <CardDescription>Monitor your storage usage</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Storage Used</span>
                    <span className="text-sm text-muted-foreground">0 MB / 1 GB</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: '0%' }}></div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Storage is used for file attachments and uploaded media
                  </p>
                </div>
                <div className="pt-4">
                  <button className="px-4 py-2 border rounded-md hover:bg-gray-50">
                    Upgrade Storage
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>Manage your API keys for programmatic access</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-4">
                    API keys allow you to access your data programmatically. Keep them secure and never share them publicly.
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div>
                        <p className="text-sm font-medium">Default API Key</p>
                        <p className="text-xs text-muted-foreground">Created on account creation</p>
                      </div>
                      <button className="text-xs text-red-600 hover:text-red-700">
                        Revoke
                      </button>
                    </div>
                  </div>
                </div>
                <div className="pt-4">
                  <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                    Generate New API Key
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
