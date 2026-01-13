"use client"

import { useState, useEffect, useCallback } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { GripVertical, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { IconPicker } from '@/components/ui/icon-picker'

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

interface View {
  id: string
  name: string
  type: string
  position: number
}

interface InterfaceDetailDrawerProps {
  interface: Interface
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: () => void
}

export default function InterfaceDetailDrawer({
  interface: iface,
  open,
  onOpenChange,
  onUpdate,
}: InterfaceDetailDrawerProps) {
  const [name, setName] = useState(iface.name)
  const [icon, setIcon] = useState('')
  const [description, setDescription] = useState('')
  const [group, setGroup] = useState<string>(iface.group_id || '')
  const [isAdminOnly, setIsAdminOnly] = useState(iface.is_admin_only ?? true)
  const [views, setViews] = useState<View[]>([])
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([])
  const [saving, setSaving] = useState(false)
  const [loadingViews, setLoadingViews] = useState(false)

  useEffect(() => {
    if (open) {
      loadInterfaceDetails()
      loadGroups()
      loadViews()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, iface.id])

  useEffect(() => {
    setName(iface.name)
    setIsAdminOnly(iface.is_admin_only ?? true)
    setGroup(iface.group_id || '')
  }, [iface])

  const loadInterfaceDetails = useCallback(async () => {
    try {
      const supabase = createClient()
      
      // Try interface_pages first (matches sidebar)
      const { data: page } = await supabase
        .from('interface_pages')
        .select('name, config, group_id, is_admin_only')
        .eq('id', iface.id)
        .maybeSingle()

      if (page) {
        setName(page.name)
        setIcon(page.config?.settings?.icon || '')
        setDescription(page.config?.description || '')
        setIsAdminOnly(page.is_admin_only ?? true)
        setGroup(page.group_id || '')
        return
      }

      // Fallback to views table
      const { data: view } = await supabase
        .from('views')
        .select('name, config, group_id, is_admin_only')
        .eq('id', iface.id)
        .maybeSingle()

      if (view) {
        setName(view.name)
        setIcon(view.config?.settings?.icon || '')
        setDescription(view.config?.description || '')
        setIsAdminOnly(view.is_admin_only ?? true)
        setGroup(view.group_id || '')
      }
    } catch (error) {
      console.error('Error loading interface details:', error)
    }
  }, [iface.id])

  const loadGroups = useCallback(async () => {
    try {
      const supabase = createClient()
      
      // Try interface_groups first (matches sidebar)
      const { data: groupsData } = await supabase
        .from('interface_groups')
        .select('id, name')
        .order('order_index', { ascending: true })

      if (groupsData && groupsData.length > 0) {
        setGroups(groupsData.map(g => ({ id: g.id, name: g.name })))
        return
      }

      // Fallback to old system: groups stored as views
      const { data: allInterfaces } = await supabase
        .from('views')
        .select('group_id')
        .eq('type', 'interface')
        .not('group_id', 'is', null)

      const groupIds = [...new Set(allInterfaces?.map(v => v.group_id).filter(Boolean) || [])]
      
      if (groupIds.length > 0) {
        const { data: groupsDataOld } = await supabase
          .from('views')
          .select('id, name')
          .in('id', groupIds)

        if (groupsDataOld) {
          setGroups(groupsDataOld.map(g => ({ id: g.id, name: g.name })))
        }
      }
    } catch (error) {
      console.error('Error loading groups:', error)
    }
  }, [])

  const loadViews = useCallback(async () => {
    setLoadingViews(true)
    try {
      const supabase = createClient()
      // For interface views, we need to check if there's a junction table
      // or if views are linked via config
      const { data: interfaceViews } = await supabase
        .from('interface_views')
        .select('view_id, position')
        .eq('interface_id', iface.id)
        .order('position', { ascending: true })

      if (interfaceViews && interfaceViews.length > 0) {
        const viewIds = interfaceViews.map(iv => iv.view_id)
        const { data: viewsData } = await supabase
          .from('views')
          .select('id, name, type')
          .in('id', viewIds)

        if (viewsData) {
          const viewsWithPosition = viewsData.map(v => ({
            ...v,
            position: interfaceViews.find(iv => iv.view_id === v.id)?.position || 0,
          }))
          setViews(viewsWithPosition.sort((a, b) => a.position - b.position))
        }
      } else {
        // Fallback: check config for linked views
        const { data: view } = await supabase
          .from('views')
          .select('config')
          .eq('id', iface.id)
          .single()

        if (view?.config?.linked_views) {
          const linkedViewIds = view.config.linked_views
          const { data: viewsData } = await supabase
            .from('views')
            .select('id, name, type')
            .in('id', linkedViewIds)

          if (viewsData) {
            setViews(viewsData.map((v, i) => ({ ...v, position: i })))
          }
        }
      }
    } catch (error) {
      console.error('Error loading views:', error)
    } finally {
      setLoadingViews(false)
    }
  }, [iface.id])

  useEffect(() => {
    if (open) {
      loadInterfaceDetails()
      loadGroups()
      loadViews()
    }
  }, [open, iface.id, loadInterfaceDetails, loadGroups, loadViews])

  useEffect(() => {
    setName(iface.name)
    setIsAdminOnly(iface.is_admin_only ?? true)
    setGroup(iface.group_id || '')
  }, [iface])

  async function handleSave() {
    setSaving(true)
    try {
      const supabase = createClient()
      
      // Check if page exists in interface_pages table (matches sidebar)
      const { data: pageData, error: checkError } = await supabase
        .from('interface_pages')
        .select('id, config')
        .eq('id', iface.id)
        .maybeSingle()

      // Get existing config to merge with
      let existingConfig: any = {}
      if (!checkError && pageData) {
        existingConfig = pageData.config || {}
      } else {
        // Fallback: get from views table
        const { data: viewData } = await supabase
          .from('views')
          .select('config')
          .eq('id', iface.id)
          .maybeSingle()
        existingConfig = viewData?.config || {}
      }

      // Merge icon and description with existing config
      const config: any = {
        ...existingConfig,
        ...(description !== undefined ? { description } : {}),
      }
      
      // Merge settings, preserving existing settings
      if (icon || existingConfig.settings) {
        config.settings = {
          ...(existingConfig.settings || {}),
          ...(icon ? { icon } : {}),
        }
        // Remove icon from settings if it's empty
        if (!icon && config.settings.icon) {
          delete config.settings.icon
        }
      }

      if (!checkError && pageData) {
        // Update interface_pages table
        const { error: updateError } = await supabase
          .from('interface_pages')
          .update({
            name,
            group_id: group || null,
            is_admin_only: isAdminOnly,
            config,
          })
          .eq('id', iface.id)

        if (updateError) throw updateError

        // Also update the interface_group's icon if this page belongs to a group
        // The sidebar displays interface_groups, so icons need to be on the group
        if (group) {
          const { error: groupIconError } = await supabase
            .from('interface_groups')
            .update({ icon: icon || null })
            .eq('id', group)
          
          // Ignore errors if icon column doesn't exist (graceful degradation)
          if (groupIconError && !groupIconError.message?.includes('column') && !groupIconError.message?.includes('does not exist')) {
            console.warn('Failed to update interface_group icon:', groupIconError)
          }
        }
      } else {
        // Fallback: update views table
        const { error: updateError } = await supabase
          .from('views')
          .update({
            name,
            group_id: group || null,
            is_admin_only: isAdminOnly,
            config,
          })
          .eq('id', iface.id)

        if (updateError) throw updateError

        // Also update the interface_group's icon if this view belongs to a group
        if (group) {
          const { error: groupIconError } = await supabase
            .from('interface_groups')
            .update({ icon: icon || null })
            .eq('id', group)
          
          // Ignore errors if icon column doesn't exist (graceful degradation)
          if (groupIconError && !groupIconError.message?.includes('column') && !groupIconError.message?.includes('does not exist')) {
            console.warn('Failed to update interface_group icon:', groupIconError)
          }
        }
      }


      onUpdate()
      onOpenChange(false)
    } catch (error: any) {
      console.error('Error saving interface:', error)
      alert(error.message || 'Failed to save interface')
    } finally {
      setSaving(false)
    }
  }

  async function handleTogglePermission(role: 'admin' | 'member', hasAccess: boolean) {
    try {
      const supabase = createClient()
      
      // Check if interfaces table exists, otherwise use views table with is_admin_only
      // For now, we'll use the is_admin_only field for admin-only access
      // Member access is the inverse of is_admin_only
      if (role === 'admin') {
        // Admin always has access
        return
      }

      // For member/staff, toggle is_admin_only
      const { error } = await supabase
        .from('views')
        .update({ is_admin_only: !hasAccess })
        .eq('id', iface.id)

      if (error) throw error

      setIsAdminOnly(!hasAccess)
      onUpdate()
    } catch (error: any) {
      console.error('Error updating permission:', error)
      alert(error.message || 'Failed to update permission')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{iface.name}</SheetTitle>
          <SheetDescription>Manage interface settings and permissions</SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="general" className="mt-6">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="views">Views</TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Interface name"
              />
            </div>

            <div className="space-y-2">
              <Label>Icon</Label>
              <IconPicker
                value={icon}
                onChange={setIcon}
                placeholder="📄"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="group">Interface</Label>
              <select
                id="group"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Ungrouped Interface</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

          </TabsContent>

          <TabsContent value="views" className="space-y-4 mt-4">
            {loadingViews ? (
              <div className="text-center text-muted-foreground py-8">
                Loading views...
              </div>
            ) : views.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 border border-dashed rounded-lg">
                <p className="text-sm">No views linked to this interface</p>
                <p className="text-xs mt-1">Views can be added from the interface page</p>
              </div>
            ) : (
              <div className="space-y-2">
                {views.map((view) => (
                  <div
                    key={view.id}
                    className="flex items-center gap-3 p-3 border rounded-lg"
                  >
                    <GripVertical className="h-4 w-4 text-gray-400" />
                    <div className="flex-1">
                      <div className="font-medium">{view.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {view.type}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="permissions" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <Label>Admin</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Full access to view and edit
                    </p>
                  </div>
                  <Badge variant="default">Always enabled</Badge>
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Member</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Can view and edit this interface
                    </p>
                  </div>
                  <Switch
                    checked={!isAdminOnly}
                    onCheckedChange={(checked) => handleTogglePermission('member', checked)}
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
