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
  category_id?: string | null
  group_name?: string | null
  category_name?: string | null
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
      
      // Try interface_pages table first (matches sidebar)
      const { data: pagesData, error: pagesError } = await supabase
        .from('interface_pages')
        .select('id, name, group_id, order_index, is_admin_only, created_at, updated_at')
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: true })

      if (!pagesError && pagesData && pagesData.length > 0) {
        // New system: use interface_pages table (matches sidebar)
        await loadInterfacesFromPagesTable(pagesData)
        return
      }

      // Fallback to old system: views table
      await loadInterfacesFromViewsTable()
    } catch (error) {
      console.error('Error loading interfaces:', error)
      setGroups([])
    } finally {
      setLoading(false)
    }
  }

  async function loadInterfacesFromPagesTable(pagesData: any[]) {
    const supabase = createClient()
    
    // Load interface groups (matches sidebar)
    const groupIds = [...new Set(pagesData.map(p => p.group_id).filter(Boolean))]
    const groupMap = new Map<string, { id: string; name: string }>()
    
    if (groupIds.length > 0) {
      const { data: groupsData } = await supabase
        .from('interface_groups')
        .select('id, name')
        .in('id', groupIds)

      groupsData?.forEach(g => {
        groupMap.set(g.id, { id: g.id, name: g.name })
      })
    }

    // Group pages by group_id (matches sidebar logic)
    const grouped: InterfaceGroup[] = []
    const uncategorized: Interface[] = []

    pagesData.forEach((page) => {
      const groupId = page.group_id
      const groupName = groupId ? groupMap.get(groupId)?.name || null : null

      const interfaceData: Interface = {
        id: page.id,
        name: page.name,
        type: 'interface',
        group_id: groupId,
        category_id: groupId, // Use group_id as category_id for compatibility
        group_name: groupName,
        category_name: groupName,
        order_index: page.order_index || 0,
        is_admin_only: page.is_admin_only || false,
        is_default: false, // interface_pages doesn't have is_default
        created_at: page.created_at,
      }

      if (groupId && groupMap.has(groupId)) {
        const group = grouped.find(g => g.id === groupId)
        if (group) {
          group.interfaces.push(interfaceData)
        } else {
          grouped.push({
            id: groupId,
            name: groupMap.get(groupId)!.name,
            interfaces: [interfaceData],
          })
        }
      } else {
        uncategorized.push(interfaceData)
      }
    })

    // Sort interfaces within each group by order_index
    grouped.forEach(group => {
      group.interfaces.sort((a, b) => a.order_index - b.order_index)
    })
    uncategorized.sort((a, b) => a.order_index - b.order_index)

    // Add "Ungrouped" group if needed (matches sidebar)
    if (uncategorized.length > 0) {
      grouped.push({
        id: 'ungrouped-system-virtual',
        name: 'Ungrouped',
        interfaces: uncategorized,
      })
    }

    setGroups(grouped)
  }

  async function loadInterfacesFromViewsTable() {
    const supabase = createClient()
    
    // Load interface views (old system)
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

    // Check which interface is default (from workspace_settings)
    let defaultId: string | null = null
    try {
      const { data: defaultInterface, error: settingsError } = await supabase
        .from('workspace_settings')
        .select('default_interface_id')
        .maybeSingle()

      if (settingsError) {
        if (settingsError.code === 'PGRST116' || 
            settingsError.code === '42P01' || 
            settingsError.code === '42703' ||
            settingsError.message?.includes('column') ||
            settingsError.message?.includes('does not exist') ||
            settingsError.message?.includes('relation')) {
          defaultId = null
        } else {
          console.warn('Error checking default interface:', settingsError)
        }
      } else if (defaultInterface) {
        defaultId = defaultInterface.default_interface_id || null
      }
    } catch (error: any) {
      if (error?.code !== 'PGRST116' && error?.code !== '42P01' && error?.code !== '42703') {
        console.warn('Error checking default interface:', error)
      }
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
  }

  async function handleToggleAccess(interfaceId: string, isAdminOnly: boolean) {
    try {
      const supabase = createClient()
      
      // Check if page exists in interface_pages table (matches sidebar)
      const { data: pageData, error: checkError } = await supabase
        .from('interface_pages')
        .select('id')
        .eq('id', interfaceId)
        .maybeSingle()

      if (!checkError && pageData) {
        // New system: update interface_pages table directly
        const { error: updateError } = await supabase
          .from('interface_pages')
          .update({ is_admin_only: !isAdminOnly })
          .eq('id', interfaceId)

        if (updateError) throw updateError
      } else {
        // Fallback: check interfaces table
        const { data: interfaceData, error: interfaceCheckError } = await supabase
          .from('interfaces')
          .select('id')
          .eq('id', interfaceId)
          .maybeSingle()

        if (!interfaceCheckError && interfaceData) {
          // Use interface_permissions table
          if (!isAdminOnly) {
            await supabase
              .from('interface_permissions')
              .delete()
              .eq('interface_id', interfaceId)

            const { error: insertError } = await supabase
              .from('interface_permissions')
              .insert({ interface_id: interfaceId, role: 'admin' })

            if (insertError) throw insertError
          } else {
            const { error: deleteError } = await supabase
              .from('interface_permissions')
              .delete()
              .eq('interface_id', interfaceId)
              .eq('role', 'admin')

            if (deleteError) throw deleteError
          }
        } else {
          // Old system: update views table
          const { error } = await supabase
            .from('views')
            .update({ is_admin_only: !isAdminOnly })
            .eq('id', interfaceId)

          if (error) throw error
        }
      }

      loadInterfaces()
    } catch (error: any) {
      console.error('Error updating access:', error)
      alert(error.message || 'Failed to update access')
    }
  }

  async function handleSetDefault(interfaceId: string) {
    try {
      const supabase = createClient()
      
      // interface_pages doesn't have is_default, so check interfaces table
      const { data: interfaceData, error: checkError } = await supabase
        .from('interfaces')
        .select('id')
        .eq('id', interfaceId)
        .maybeSingle()

      if (!checkError && interfaceData) {
        // New system: update interfaces table directly
        // First, unset all other defaults
        await supabase
          .from('interfaces')
          .update({ is_default: false })
          .neq('id', interfaceId)

        // Then set this one as default
        const { error: updateError } = await supabase
          .from('interfaces')
          .update({ is_default: true })
          .eq('id', interfaceId)

        if (updateError) throw updateError
      } else {
        // Old system: use workspace_settings
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
          <CardTitle>Interface Access & Sharing</CardTitle>
          <CardDescription>
            Manage access permissions and sharing for Interfaces. To create or edit Pages, use the Pages tab.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground border border-dashed rounded-lg">
              <p className="text-sm mb-2">No interface pages found</p>
              <p className="text-xs">Create your first page from the sidebar</p>
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
