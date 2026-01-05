"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Settings, GripVertical } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import InterfaceDetailDrawer from './InterfaceDetailDrawer'

interface Interface {
  id: string
  name: string
  type: 'interface'
  group_id: string | null
  group_name?: string | null
  order_index: number
  is_admin_only: boolean
  is_default?: boolean
  created_at: string
}

interface InterfaceGroup {
  id: string
  name: string
  interfaces: Interface[]
}

export default function InterfacesTab() {
  const [groups, setGroups] = useState<InterfaceGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedInterface, setSelectedInterface] = useState<Interface | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    loadInterfaces()
  }, [])

  async function loadInterfaces() {
    setLoading(true)
    try {
      const supabase = createClient()
      
      // Load interface views
      const { data: views, error } = await supabase
        .from('views')
        .select('id, name, type, group_id, order_index, is_admin_only, created_at')
        .eq('type', 'interface')
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error loading interfaces:', error)
        setGroups([])
        return
      }

      // Load groups
      const groupIds = [...new Set(views?.map(v => v.group_id).filter(Boolean) || [])]
      const groupMap = new Map<string, { id: string; name: string }>()
      
      if (groupIds.length > 0) {
        const { data: groupsData } = await supabase
          .from('views')
          .select('id, name')
          .in('id', groupIds)

        groupsData?.forEach(g => {
          groupMap.set(g.id, { id: g.id, name: g.name })
        })
      }

      // Check which interface is default (from workspace_settings or first interface)
      let defaultId: string | null = null
      try {
        const { data: defaultInterface, error: settingsError } = await supabase
          .from('workspace_settings')
          .select('default_interface_id')
          .maybeSingle()

        // Handle errors gracefully - column might not exist or RLS might block
        if (!settingsError && defaultInterface) {
          defaultId = defaultInterface.default_interface_id || null
        }
      } catch (error) {
        // Ignore errors - defaultId remains null
        console.warn('Could not load default interface setting:', error)
      }

      // Group interfaces
      const grouped: InterfaceGroup[] = []
      const uncategorized: Interface[] = []

      views?.forEach((view) => {
        const interfaceData: Interface = {
          ...view,
          group_name: view.group_id ? groupMap.get(view.group_id)?.name || null : null,
          is_default: view.id === defaultId,
        }

        if (view.group_id && groupMap.has(view.group_id)) {
          const group = grouped.find(g => g.id === view.group_id)
          if (group) {
            group.interfaces.push(interfaceData)
          } else {
            grouped.push({
              id: view.group_id!,
              name: groupMap.get(view.group_id!)!.name,
              interfaces: [interfaceData],
            })
          }
        } else {
          uncategorized.push(interfaceData)
        }
      })

      // Sort interfaces within each group
      grouped.forEach(group => {
        group.interfaces.sort((a, b) => a.order_index - b.order_index)
      })
      uncategorized.sort((a, b) => a.order_index - b.order_index)

      // Add uncategorized group if needed
      if (uncategorized.length > 0) {
        grouped.push({
          id: 'uncategorized',
          name: 'Uncategorized',
          interfaces: uncategorized,
        })
      }

      setGroups(grouped)
    } catch (error) {
      console.error('Error loading interfaces:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleAccess(interfaceId: string, isAdminOnly: boolean) {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('views')
        .update({ is_admin_only: !isAdminOnly })
        .eq('id', interfaceId)

      if (error) throw error

      loadInterfaces()
    } catch (error: any) {
      console.error('Error updating access:', error)
      alert(error.message || 'Failed to update access')
    }
  }

  async function handleSetDefault(interfaceId: string) {
    try {
      const supabase = createClient()
      
      // Get or create workspace_settings
      const { data: existing, error: fetchError } = await supabase
        .from('workspace_settings')
        .select('id')
        .maybeSingle()

      // Handle case where table/column doesn't exist or RLS blocks access
      if (fetchError) {
        console.warn('Could not access workspace_settings:', fetchError)
        alert('Could not update default interface. The workspace_settings table may need to be configured.')
        return
      }

      if (existing) {
        const { error: updateError } = await supabase
          .from('workspace_settings')
          .update({ default_interface_id: interfaceId })
          .eq('id', existing.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('workspace_settings')
          .insert({ default_interface_id: interfaceId })

        if (insertError) throw insertError
      }

      loadInterfaces()
    } catch (error: any) {
      console.error('Error setting default interface:', error)
      alert(error.message || 'Failed to set default interface')
    }
  }

  function handleOpenDetail(iface: Interface) {
    setSelectedInterface(iface)
    setDrawerOpen(true)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading interfaces...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Interfaces</CardTitle>
          <CardDescription>
            Manage interface access and permissions by role
          </CardDescription>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground border border-dashed rounded-lg">
              <p className="text-sm mb-2">No interfaces found</p>
              <p className="text-xs">Create interfaces in the Pages tab</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groups.map((group) => (
                <div key={group.id} className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    {group.name}
                  </h3>
                  <div className="space-y-2">
                    {group.interfaces.map((iface) => (
                      <div
                        key={iface.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <GripVertical className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleOpenDetail(iface)}
                                className="font-medium text-gray-900 hover:text-blue-600 text-left"
                              >
                                {iface.name}
                              </button>
                              {iface.is_default && (
                                <Badge variant="outline" className="text-xs">
                                  Default
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">Admin only</span>
                            <Switch
                              checked={iface.is_admin_only}
                              onCheckedChange={() => handleToggleAccess(iface.id, iface.is_admin_only)}
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDetail(iface)}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedInterface && (
        <InterfaceDetailDrawer
          interface={selectedInterface}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          onUpdate={loadInterfaces}
        />
      )}
    </>
  )
}
