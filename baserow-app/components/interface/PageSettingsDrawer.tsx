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
import { Trash2, Save } from "lucide-react"
import { IconPicker } from "@/components/ui/icon-picker"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Page } from "@/lib/interface/types"

interface PageSettingsDrawerProps {
  page: Page
  open: boolean
  onOpenChange: (open: boolean) => void
  onPageUpdate: () => void
}

export default function PageSettingsDrawer({
  page,
  open,
  onOpenChange,
  onPageUpdate,
}: PageSettingsDrawerProps) {
  const router = useRouter()
  const [name, setName] = useState(page.name)
  const [icon, setIcon] = useState("")
  const [saving, setSaving] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setName(page.name)
    // Extract icon from settings if it exists
    const pageIcon = page.settings?.icon || ""
    setIcon(pageIcon)
  }, [page])

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
