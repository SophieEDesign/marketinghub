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
      
      // Try new interfaces table first
      const { data: interfacesData, error: interfacesError } = await supabase
        .from('interfaces')
        .select('id, name, category_id, is_default, created_at, updated_at')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true })

      if (!interfacesError && interfacesData && interfacesData.length > 0) {
        // New system: use interfaces table
        await loadInterfacesFromNewSystem(interfacesData)
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

  async function loadInterfacesFromNewSystem(interfacesData: any[]) {
    const supabase = createClient()
    
    // Load categories
    const categoryIds = [...new Set(interfacesData.map(i => i.category_id).filter(Boolean))]
    const categoryMap = new Map<string, { id: string; name: string }>()
    
    if (categoryIds.length > 0) {
      const { data: categoriesData } = await supabase
        .from('interface_categories')
        .select('id, name')
        .in('id', categoryIds)

      categoriesData?.forEach(c => {
        categoryMap.set(c.id, { id: c.id, name: c.name })
      })
    }

    // Load permissions for all interfaces
    const interfaceIds = interfacesData.map(i => i.id)
    const { data: permissionsData } = await supabase
      .from('interface_permissions')
      .select('interface_id, role')
      .in('interface_id', interfaceIds)

    // Build permission map: interface is admin-only if it has 'admin' permission
    // and doesn't have 'staff' or 'member' permissions
    const permissionMap = new Map<string, { hasAdmin: boolean; hasOtherRoles: boolean }>()
    permissionsData?.forEach(p => {
      const current = permissionMap.get(p.interface_id) || { hasAdmin: false, hasOtherRoles: false }
      if (p.role === 'admin') {
        current.hasAdmin = true
      } else if (p.role === 'staff' || p.role === 'member') {
        current.hasOtherRoles = true
      }
      permissionMap.set(p.interface_id, current)
    })

    // Group interfaces
    const grouped: InterfaceGroup[] = []
    const uncategorized: Interface[] = []

    interfacesData.forEach((iface) => {
      const permissions = permissionMap.get(iface.id)
      // Admin-only if it has admin permission but no other roles
      const isAdminOnly = permissions?.hasAdmin === true && permissions?.hasOtherRoles === false
      const categoryId = iface.category_id
      const categoryName = categoryId ? categoryMap.get(categoryId)?.name || null : null

      const interfaceData: Interface = {
        id: iface.id,
        name: iface.name,
        type: 'interface',
        group_id: categoryId,
        category_id: categoryId,
        group_name: categoryName,
        category_name: categoryName,
        order_index: 0, // New system doesn't use order_index
        is_admin_only: isAdminOnly,
        is_default: iface.is_default || false,
        created_at: iface.created_at,
      }

      if (categoryId && categoryMap.has(categoryId)) {
        const group = grouped.find(g => g.id === categoryId)
        if (group) {
          group.interfaces.push(interfaceData)
        } else {
          grouped.push({
            id: categoryId,
            name: categoryMap.get(categoryId)!.name,
            interfaces: [interfaceData],
          })
        }
      } else {
        uncategorized.push(interfaceData)
      }
    })

    // Sort interfaces within each group
    grouped.forEach(group => {
      group.interfaces.sort((a, b) => {
        if (a.is_default) return -1
        if (b.is_default) return 1
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })
    })
    uncategorized.sort((a, b) => {
      if (a.is_default) return -1
      if (b.is_default) return 1
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })

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
      
      // Check if interface exists in new interfaces table
      const { data: interfaceData, error: checkError } = await supabase
        .from('interfaces')
        .select('id')
        .eq('id', interfaceId)
        .maybeSingle()

      if (!checkError && interfaceData) {
        // New system: use interface_permissions table
        if (!isAdminOnly) {
          // Enable admin-only: add admin permission and remove other permissions
          // First, remove all existing permissions
          await supabase
            .from('interface_permissions')
            .delete()
            .eq('interface_id', interfaceId)

          // Then add admin permission
          const { error: insertError } = await supabase
            .from('interface_permissions')
            .insert({ interface_id: interfaceId, role: 'admin' })

          if (insertError) throw insertError
        } else {
          // Disable admin-only: remove admin permission (makes it public)
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

      loadInterfaces()
    } catch (error: any) {
      console.error('Error updating access:', error)
      alert(error.message || 'Failed to update access')
    }
  }

  async function handleSetDefault(interfaceId: string) {
    try {
      const supabase = createClient()
      
      // Check if interface exists in new interfaces table
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
            Manage who can see each interface. Interfaces are containers that group related pages together.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground border border-dashed rounded-lg">
              <p className="text-sm mb-2">No interfaces found</p>
              <p className="text-xs">Create your first Interface to group pages together</p>
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
