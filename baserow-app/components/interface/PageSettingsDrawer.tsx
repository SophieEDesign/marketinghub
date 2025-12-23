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
import { Trash2, Save } from "lucide-react"
import { IconPicker } from "@/components/ui/icon-picker"
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
  const [groups, setGroups] = useState<InterfaceGroup[]>([])
  const [views, setViews] = useState<View[]>([])
  const [saving, setSaving] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (open) {
      loadGroups()
      loadViews()
    }
  }, [open])

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
    setDeleting(true)
    try {
      const response = await fetch(`/api/pages/${page.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete page")
      }

      // Redirect to home or interface list
      router.push("/")
    } catch (error: any) {
      console.error("Failed to delete page:", error)
      alert(error.message || "Failed to delete page")
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
              <Label htmlFor="interface-group">Interface Group</Label>
              <Select
                value={groupId || "__none__"}
                onValueChange={(value) => setGroupId(value === "__none__" ? null : value)}
              >
                <SelectTrigger id="interface-group">
                  <SelectValue placeholder="No group (Uncategorized)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No group (Uncategorized)</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Organize this interface into a group in the sidebar
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
            <DialogDescription>
              This will permanently delete the interface &quot;{page.name}&quot; and all its blocks. This action cannot be undone.
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
    </>
  )
}
