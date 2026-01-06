"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Trash2, Save, Clock } from "lucide-react"
import { IconPicker } from "@/components/ui/icon-picker"
import VersionHistoryPanel from "@/components/versioning/VersionHistoryPanel"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import type { Page } from "@/lib/interface/types"

interface PageSettingsDrawerProps {
  page: Page
  open: boolean
  onOpenChange: (open: boolean) => void
  onPageUpdate: () => void
}

interface InterfaceGroup {
  id: string
  name: string
}

interface View {
  id: string
  name: string
  table_id: string | null
}

export default function PageSettingsDrawer({
  page,
  open,
  onOpenChange,
  onPageUpdate,
}: PageSettingsDrawerProps) {
  const router = useRouter()
  const [name, setName] = useState(page.name)
  const [description, setDescription] = useState(page.description || "")
  const [icon, setIcon] = useState("")
  const [isAdminOnly, setIsAdminOnly] = useState(page.is_admin_only || false)
  const [groupId, setGroupId] = useState<string | null>(null)
  const [defaultView, setDefaultView] = useState<string | null>(null)
  const [hideViewSwitcher, setHideViewSwitcher] = useState(false)
  const [isDefault, setIsDefault] = useState(false)
  const [groups, setGroups] = useState<InterfaceGroup[]>([])
  const [views, setViews] = useState<View[]>([])
  const [saving, setSaving] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false)

  useEffect(() => {
    if (open) {
      loadGroups()
      loadViews()
      loadDefaultStatus()
    }
  }, [open, page.id])

  async function loadDefaultStatus() {
    try {
      const supabase = createClient()
      const { data: workspaceSettings, error } = await supabase
        .from('workspace_settings')
        .select('default_interface_id')
        .maybeSingle()
      
      // Handle errors gracefully - column might not exist (400), RLS might block (403), or table might not exist
      if (!error && workspaceSettings) {
        setIsDefault(workspaceSettings.default_interface_id === page.id)
      } else {
        setIsDefault(false)
        // Only log non-400 errors (400 means column/table doesn't exist, which is fine)
        if (error && error.code !== 'PGRST116' && error.code !== '42P01' && !error.message?.includes('column') && !error.message?.includes('does not exist')) {
          console.warn('Error loading default status:', error)
        }
      }
    } catch (error: any) {
      setIsDefault(false)
      // Don't log 400 errors as they're expected if the column doesn't exist
      if (error?.status !== 400 && error?.code !== 'PGRST116' && error?.code !== '42P01') {
        console.warn('Error loading default status:', error)
      }
    }
  }

  useEffect(() => {
    setName(page.name)
    setDescription(page.description || "")
    // Extract icon from settings if it exists
    const pageIcon = page.settings?.icon || ""
    setIcon(pageIcon)
    setIsAdminOnly(page.is_admin_only || false)
    // Load group_id and other settings from page
    // Note: These might be in the page object or need to be fetched
    setGroupId((page as any).group_id || null)
    setDefaultView((page as any).default_view || null)
    setHideViewSwitcher((page as any).hide_view_switcher || false)
  }, [page])

  async function loadGroups() {
    try {
      const response = await fetch('/api/interface-groups')
      const data = await response.json()
      setGroups(data.groups || [])
    } catch (error) {
      console.error('Error loading groups:', error)
    }
  }

  async function loadViews() {
    try {
      const supabase = createClient()
      // Load all views that could be used as default views
      // These would typically be grid/kanban/calendar views from tables
      const { data: viewsData } = await supabase
        .from('views')
        .select('id, name, table_id, type')
        .neq('type', 'interface')
        .order('name', { ascending: true })
      
      setViews((viewsData || []) as View[])
    } catch (error) {
      console.error('Error loading views:', error)
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      alert("Interface name is required")
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/pages/${page.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          group_id: groupId || null,
          default_view: defaultView || null,
          hide_view_switcher: hideViewSwitcher,
          is_admin_only: isAdminOnly,
          settings: {
            ...page.settings,
            icon: icon.trim() || null,
          },
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update interface")
      }

      // Update default interface setting
      try {
        const supabase = createClient()
        const { data: existing, error: fetchError } = await supabase
          .from('workspace_settings')
          .select('id')
          .maybeSingle()

        // Handle case where table/column doesn't exist or RLS blocks access
        if (fetchError) {
          console.warn('Could not access workspace_settings:', fetchError)
          // Don't fail the save - just skip default interface update
        } else if (isDefault) {
          if (existing) {
            const { error: updateError } = await supabase
              .from('workspace_settings')
              .update({ default_interface_id: page.id })
              .eq('id', existing.id)
            
            if (updateError) console.warn('Could not update default interface:', updateError)
          } else {
            const { error: insertError } = await supabase
              .from('workspace_settings')
              .insert({ default_interface_id: page.id })
            
            if (insertError) console.warn('Could not insert default interface:', insertError)
          }
        } else {
          // Remove default if unchecked
          if (existing) {
            const { data: currentSettings, error: currentError } = await supabase
              .from('workspace_settings')
              .select('default_interface_id')
              .eq('id', existing.id)
              .single()
            
            if (!currentError && currentSettings?.default_interface_id === page.id) {
              const { error: updateError } = await supabase
                .from('workspace_settings')
                .update({ default_interface_id: null })
                .eq('id', existing.id)
              
              if (updateError) console.warn('Could not remove default interface:', updateError)
            }
          }
        }
      } catch (error) {
        console.warn('Error updating default interface setting:', error)
        // Don't fail the save - just skip default interface update
      }

      // Trigger sidebar refresh
      window.dispatchEvent(new CustomEvent('pages-updated'))

      onPageUpdate()
      onOpenChange(false)
    } catch (error: any) {
      console.error("Failed to update interface:", error)
      alert(error.message || "Failed to update interface")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    // Confirmation is already shown in the dialog, so proceed
    setDeleting(true)
    try {
      const response = await fetch(`/api/pages/${page.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete interface")
      }

      // Redirect to home or interface list
      router.push("/")
      // Trigger sidebar refresh
      window.dispatchEvent(new CustomEvent('pages-updated'))
    } catch (error: any) {
      console.error("Failed to delete interface:", error)
      alert(error.message || "Failed to delete interface")
      setDeleting(false)
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[400px] sm:w-[400px]">
          <SheetHeader>
            <SheetTitle>Interface Settings</SheetTitle>
            <SheetDescription>
              Manage your interface name, icon, and other settings
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="page-name">Interface Name</Label>
              <Input
                id="page-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Dashboard"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="page-description">Description</Label>
              <Textarea
                id="page-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description for this interface"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Icon</Label>
              <IconPicker
                value={icon}
                onChange={setIcon}
                placeholder="📊"
              />
              <p className="text-xs text-muted-foreground">
                Optional: Select an icon to represent this interface
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="interface-group">Interface</Label>
              <Select
                value={groupId || "__none__"}
                onValueChange={(value) => setGroupId(value === "__none__" ? null : value)}
              >
                <SelectTrigger id="interface-group">
                  <SelectValue placeholder="Ungrouped Interface" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Ungrouped Interface</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Organize this page into an Interface in the sidebar
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default-view">Default View</Label>
              <Select
                value={defaultView || "__none__"}
                onValueChange={(value) => setDefaultView(value === "__none__" ? null : value)}
              >
                <SelectTrigger id="default-view">
                  <SelectValue placeholder="None (use interface blocks)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None (use interface blocks)</SelectItem>
                  {views.map((view) => (
                    <SelectItem key={view.id} value={view.id}>
                      {view.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Optional: Default view to show when opening this interface
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="hide-view-switcher"
                  checked={hideViewSwitcher}
                  onChange={(e) => setHideViewSwitcher(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="hide-view-switcher" className="text-sm font-normal cursor-pointer">
                  Hide view switcher
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                If enabled, the view switcher will be hidden in this interface
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="set-as-default"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="set-as-default" className="text-sm font-normal cursor-pointer">
                  Set as default landing page
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Users will be redirected to this interface when they log in
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="admin-only-setting"
                  checked={isAdminOnly}
                  onChange={(e) => setIsAdminOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="admin-only-setting" className="text-sm font-normal cursor-pointer">
                  Admin only (hide from members)
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                If enabled, only admins will be able to see this interface
              </p>
            </div>

            <div className="pt-4 border-t">
              <Button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="w-full"
              >
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>

            <div className="pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setVersionHistoryOpen(true)}
                className="w-full"
              >
                <Clock className="mr-2 h-4 w-4" />
                Version History
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                View and restore previous versions of this interface
              </p>
            </div>

            <div className="pt-4 border-t">
              <div className="space-y-2">
                <Label className="text-red-600">Danger Zone</Label>
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  className="w-full"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Interface
                </Button>
                <p className="text-xs text-muted-foreground">
                  This action cannot be undone. All blocks on this interface will be deleted.
                </p>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent aria-describedby="delete-interface-dialog-description">
          <DialogHeader>
            <DialogTitle>Delete Interface?</DialogTitle>
            <DialogDescription id="delete-interface-dialog-description">
              This will permanently delete the interface &quot;<strong>{page.name}</strong>&quot; and all its blocks.
              <br />
              <br />
              <strong className="text-red-600">This action cannot be undone.</strong>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? "Deleting..." : "Delete Interface"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VersionHistoryPanel
        open={versionHistoryOpen}
        onOpenChange={setVersionHistoryOpen}
        entityType="page"
        entityId={page.id}
        onRestore={() => {
          // Refresh page data after restore
          onPageUpdate()
        }}
      />
    </>
  )
}
