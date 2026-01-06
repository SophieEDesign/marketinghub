"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Settings, GripVertical, Folder, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import InterfaceDetailDrawer from './InterfaceDetailDrawer'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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
  is_admin_only?: boolean
  interfaces: Interface[]
}

export default function InterfacesTab() {
  const [groups, setGroups] = useState<InterfaceGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedInterface, setSelectedInterface] = useState<Interface | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [groupToDelete, setGroupToDelete] = useState<InterfaceGroup | null>(null)
  const [deleting, setDeleting] = useState(false)

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

      // Log errors for debugging
      if (pagesError) {
        console.error('Error loading interface_pages:', pagesError)
        // Check if it's a table doesn't exist error
        if (pagesError.code === '42P01' || pagesError.code === 'PGRST116' || 
            pagesError.message?.includes('relation') || 
            pagesError.message?.includes('does not exist')) {
          console.warn('interface_pages table does not exist, falling back to views table')
          await loadInterfacesFromViewsTable()
          return
        }
        // For other errors, still try to load groups
      }

      // New system: use interface_pages table (matches sidebar)
      // Pass pagesData even if empty - we still want to show all interfaces
      await loadInterfacesFromPagesTable(pagesData || [])

      // If no pages found and no groups, fallback to old system
      if ((!pagesData || pagesData.length === 0) && groups.length === 0) {
        console.warn('No interface_pages found, trying fallback to views table')
        await loadInterfacesFromViewsTable()
      }
    } catch (error) {
      console.error('Error loading interfaces:', error)
      // Try fallback on error
      try {
        await loadInterfacesFromViewsTable()
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError)
        setGroups([])
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadInterfacesFromPagesTable(pagesData: any[]) {
    const supabase = createClient()
    
    // Load ALL interface groups (interfaces) - not just ones with pages
    // This matches the sidebar: interfaces are the containers, pages belong to them
    let groupsData: any[] = []
    try {
      const { data, error } = await supabase
        .from('interface_groups')
        .select('id, name, order_index, is_system, is_admin_only')
        .order('order_index', { ascending: true })
      
      if (!error && data) {
        groupsData = data
      } else if (error) {
        console.error('Error loading interface_groups:', error)
        // Check if it's a column error
        if (error.code === '42703' || error.message?.includes('column "is_system" does not exist')) {
          // Column doesn't exist - fetch without it
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('interface_groups')
            .select('id, name, order_index, is_admin_only')
            .order('order_index', { ascending: true })
          
          if (!fallbackError && fallbackData) {
            groupsData = fallbackData.map((g: any) => ({ ...g, is_system: false, is_admin_only: g.is_admin_only || false }))
          } else if (fallbackError) {
            console.error('Error loading interface_groups (fallback):', fallbackError)
          }
        } else {
          // Other error - might be RLS or table doesn't exist
          console.error('Failed to load interface_groups:', error)
          // Try without is_system as fallback
          const { data: fallbackData } = await supabase
            .from('interface_groups')
            .select('id, name, order_index, is_admin_only')
            .order('order_index', { ascending: true })
          
          if (fallbackData) {
            groupsData = fallbackData.map((g: any) => ({ ...g, is_system: false, is_admin_only: g.is_admin_only || false }))
          }
        }
      }
    } catch (error) {
      console.error('Exception loading interface groups:', error)
    }

    // Filter out system groups (like "Ungrouped") from display
    const allGroups = (groupsData || [])
      .filter(g => !g.is_system)
      .map(g => ({
        id: g.id,
        name: g.name,
        order_index: g.order_index || 0,
        is_admin_only: g.is_admin_only || false,
      }))

    // Group pages by group_id
    const pagesByGroup = new Map<string, any[]>()
    pagesData.forEach((page) => {
      const groupId = page.group_id
      if (groupId) {
        if (!pagesByGroup.has(groupId)) {
          pagesByGroup.set(groupId, [])
        }
        pagesByGroup.get(groupId)!.push({
          id: page.id,
          name: page.name,
          type: 'interface',
          group_id: groupId,
          order_index: page.order_index || 0,
          is_admin_only: page.is_admin_only || false,
          created_at: page.created_at,
        })
      }
    })

    // Sort pages within each group by order_index
    pagesByGroup.forEach((pages) => {
      pages.sort((a, b) => a.order_index - b.order_index)
    })

    // Build grouped structure: interfaces (groups) with their pages
    const grouped: InterfaceGroup[] = allGroups.map(group => ({
      id: group.id,
      name: group.name,
      is_admin_only: group.is_admin_only || false,
      interfaces: pagesByGroup.get(group.id) || [],
    }))

    // Show ALL interfaces, even if they have no pages (for settings, admins should see all)
    // This allows admins to manage interfaces even if they don't have pages yet
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

  async function handleToggleInterfaceAccess(groupId: string, isAdminOnly: boolean) {
    try {
      const supabase = createClient()
      
      // Update interface_groups table
      const { error } = await supabase
        .from('interface_groups')
        .update({ is_admin_only: !isAdminOnly })
        .eq('id', groupId)

      if (error) throw error

      loadInterfaces()
    } catch (error: any) {
      console.error('Error updating interface access:', error)
      alert(error.message || 'Failed to update interface access')
    }
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

  async function handleDeleteGroup(group: InterfaceGroup) {
    setGroupToDelete(group)
    setDeleteDialogOpen(true)
  }

  async function confirmDeleteGroup() {
    if (!groupToDelete) return

    setDeleting(true)
    try {
      const supabase = createClient()

      // Find the "Ungrouped" system group
      let allGroups: any[] = []
      try {
        const { data, error } = await supabase
          .from('interface_groups')
          .select('id, name, is_system')
          .order('order_index', { ascending: true })

        if (error && (error.code === '42703' || error.message?.includes('column "is_system" does not exist'))) {
          // Fallback: try without is_system column
          const { data: fallbackData } = await supabase
            .from('interface_groups')
            .select('id, name')
            .order('order_index', { ascending: true })
          
          allGroups = (fallbackData || []).map((g: any) => ({ ...g, is_system: false }))
        } else if (data) {
          allGroups = data
        }
      } catch (error) {
        console.error('Error loading groups:', error)
      }

      const ungroupedGroup = allGroups.find(g => 
        (g.is_system && g.name === 'Ungrouped') || 
        (!g.is_system && g.name.toLowerCase() === 'ungrouped')
      )

      if (!ungroupedGroup) {
        alert('Cannot find Ungrouped Interface. Pages will be moved to null Interface. Please refresh the page.')
        // Continue with null group_id as fallback
      }

      const targetGroupId = ungroupedGroup?.id || null

      // Move all pages in this group to Ungrouped (or null if no Ungrouped group found)
      const pagesToMove = groupToDelete.interfaces || []
      if (pagesToMove.length > 0) {
        await Promise.all(
          pagesToMove.map(page =>
            supabase
              .from('interface_pages')
              .update({ group_id: targetGroupId })
              .eq('id', page.id)
          )
        )
      }

      // Also move any pages from views table if using old system
      await supabase
        .from('views')
        .update({ group_id: targetGroupId })
        .eq('group_id', groupToDelete.id)
        .eq('type', 'interface')

      // Delete the group
      const { error } = await supabase
        .from('interface_groups')
        .delete()
        .eq('id', groupToDelete.id)

      if (error) throw error

      setDeleteDialogOpen(false)
      setGroupToDelete(null)
      await loadInterfaces()
    } catch (error: any) {
      console.error('Error deleting interface:', error)
      alert(error.message || 'Failed to delete interface')
    } finally {
      setDeleting(false)
    }
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
            Manage who can see which Interfaces. Interfaces are containers that hold Pages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground border border-dashed rounded-lg">
              <p className="text-sm mb-2">No interfaces found</p>
              <p className="text-xs mb-4">Create your first interface and pages from the sidebar</p>
              <p className="text-xs text-gray-400">
                Check the browser console for any errors loading interfaces
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {groups.map((group) => (
                <div key={group.id} className="space-y-3">
                  {/* Interface Header */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 border rounded-lg">
                    <div className="flex items-center gap-3 flex-1">
                      <Folder className="h-5 w-5 text-gray-500" />
                      <h3 className="text-base font-semibold text-gray-900">
                        {group.name}
                      </h3>
                      <Badge variant="outline" className="text-xs">
                        {group.interfaces.length} {group.interfaces.length === 1 ? 'page' : 'pages'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Admin only</span>
                        <Switch
                          checked={group.is_admin_only || false}
                          onCheckedChange={() => handleToggleInterfaceAccess(group.id, group.is_admin_only || false)}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteGroup(group)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Pages under this Interface */}
                  {group.interfaces.length > 0 ? (
                    <div className="space-y-2 pl-6">
                      {group.interfaces.map((page) => (
                        <div
                          key={page.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <GripVertical className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleOpenDetail(page)}
                                  className="font-medium text-gray-900 hover:text-blue-600 text-left"
                                >
                                  {page.name}
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-600">Admin only</span>
                              <Switch
                                checked={page.is_admin_only}
                                onCheckedChange={() => handleToggleAccess(page.id, page.is_admin_only)}
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDetail(page)}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="pl-6 py-2 text-sm text-muted-foreground italic">
                      No pages in this interface yet
                    </div>
                  )}
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

      {/* Delete Interface Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Interface</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{groupToDelete?.name}&quot;? 
              {groupToDelete && groupToDelete.interfaces.length > 0 && (
                <>
                  <br />
                  <br />
                  This will move {groupToDelete.interfaces.length} {groupToDelete.interfaces.length === 1 ? 'page' : 'pages'} to the &quot;Ungrouped&quot; Interface.
                </>
              )}
              <br />
              <br />
              <strong className="text-red-600">This action cannot be undone.</strong>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteGroup} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete Interface'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
