"use client"

// Interfaces group pages. Pages render content. Creation flows must never mix the two.

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { createClient } from "@/lib/supabase/client"

interface InterfaceCreationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (interfaceId: string) => void
}

export default function InterfaceCreationModal({
  open,
  onOpenChange,
  onCreated,
}: InterfaceCreationModalProps) {
  const [name, setName] = useState("")
  const [isAdminOnly, setIsAdminOnly] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (open) {
      // Reset form when modal opens
      setName("")
      setIsAdminOnly(true)
    }
  }, [open])

  async function handleCreate() {
    if (!name.trim()) {
      alert("Interface name is required")
      return
    }

    setCreating(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        throw new Error("You must be logged in to create an interface")
      }

      // Get max order_index to place new interface at bottom
      const { data: lastGroup } = await supabase
        .from('interface_groups')
        .select('order_index')
        .order('order_index', { ascending: false })
        .limit(1)
        .maybeSingle()

      const orderIndex = lastGroup ? (lastGroup.order_index + 1) : 0

      // Create interface group
      const { data: group, error } = await supabase
        .from('interface_groups')
        .insert([
          {
            name: name.trim(),
            order_index: orderIndex,
            collapsed: false,
            is_admin_only: isAdminOnly,
          },
        ])
        .select()
        .single()

      if (error) {
        throw new Error(error.message || "Failed to create interface")
      }

      // Reset form
      setName("")
      setIsAdminOnly(true)
      setCreating(false)
      onOpenChange(false)

      // Callback with new interface ID
      if (onCreated && group) {
        onCreated(group.id)
      }

      // Refresh the page to show new interface
      window.dispatchEvent(new CustomEvent('interfaces-updated'))
    } catch (error: any) {
      console.error("Failed to create interface:", error)
      alert(error.message || "Failed to create interface")
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Interface</DialogTitle>
          <DialogDescription>
            Interfaces are containers that group related pages together. They help organize your workspace.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="interface-name">Interface Name *</Label>
            <Input
              id="interface-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Interface"
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim() && !creating) {
                  handleCreate()
                }
              }}
            />
            <p className="text-xs text-gray-500">
              This is the name that will appear in the sidebar as a folder.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="admin-only">Admin Only</Label>
              <p className="text-xs text-gray-500">
                Only administrators can see and access this interface
              </p>
            </div>
            <Switch
              id="admin-only"
              checked={isAdminOnly}
              onCheckedChange={setIsAdminOnly}
            />
          </div>
          <p className="text-xs text-gray-500 italic">
            Note: Admin-only functionality will be implemented in a future update.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={creating || !name.trim()}>
            {creating ? "Creating..." : "Create Interface"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

