"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
import { createClient } from "@/lib/supabase/client"
import { IconPicker } from "@/components/ui/icon-picker"

interface NewPageModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultGroupId?: string | null
}

export default function NewPageModal({ open, onOpenChange, defaultGroupId }: NewPageModalProps) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [icon, setIcon] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!name.trim()) {
      alert("Interface name is required")
      return
    }

    setLoading(true)
    try {
      // Create interface page as a view with type='interface'
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      // Get max order_index for the group (or uncategorized)
      const { data: lastInterface } = await supabase
        .from('views')
        .select('order_index')
        .eq('type', 'interface')
        .eq('group_id', defaultGroupId || null)
        .order('order_index', { ascending: false })
        .limit(1)
        .maybeSingle()

      const orderIndex = lastInterface ? (lastInterface.order_index + 1) : 0

      const { data: view, error } = await supabase
        .from('views')
        .insert([
          {
            name: name.trim(),
            type: 'interface',
            table_id: null,
            group_id: defaultGroupId || null,
            order_index: orderIndex,
            config: {
              settings: {
                icon: icon.trim() || null,
                access: 'authenticated',
                layout: { cols: 12, rowHeight: 30, margin: [10, 10] },
              },
            },
            owner_id: user?.id,
            access_level: 'authenticated',
          },
        ])
        .select()
        .single()

      if (error) {
        throw new Error(error.message || "Failed to create interface")
      }

      if (view) {
        // Reset form
        setName("")
        setIcon("")
        onOpenChange(false)
        // Redirect to the new interface route
        router.push(`/pages/${view.id}`)
        router.refresh()
        window.dispatchEvent(new CustomEvent('pages-updated'))
      }
    } catch (error: any) {
      console.error("Failed to create interface:", error)
      alert(error.message || "Failed to create interface")
    } finally {
      setLoading(false)
    }
  }

  function handleCancel() {
    setName("")
    setIcon("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Interface</DialogTitle>
          <DialogDescription>
            Create a new interface. You can add blocks and customize it after creation.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="page-name">Interface Name *</Label>
            <Input
              id="page-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Dashboard"
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) {
                  handleCreate()
                }
              }}
            />
          </div>
          <div className="grid gap-2">
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading || !name.trim()}>
            {loading ? "Creating..." : "Create Interface"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
