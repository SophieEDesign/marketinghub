"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface ViewManagementDialogProps {
  isOpen: boolean
  onClose: () => void
  viewId: string
  viewName: string
  tableId: string
  initialAction?: "rename" | "duplicate" | "delete"
  onAction?: (action: "duplicate" | "rename" | "delete" | "setDefault") => void
}

export default function ViewManagementDialog({
  isOpen,
  onClose,
  viewId,
  viewName,
  tableId,
  initialAction,
  onAction,
}: ViewManagementDialogProps) {
  const router = useRouter()
  const [action, setAction] = useState<"rename" | "duplicate" | "delete" | null>(initialAction || null)
  const [newName, setNewName] = useState(viewName)

  useEffect(() => {
    if (isOpen) {
      if (initialAction) {
        setAction(initialAction)
        if (initialAction === "duplicate") {
          setNewName(`${viewName} (Copy)`)
        } else {
          setNewName(viewName)
        }
      } else {
        setAction(null)
        setNewName(viewName)
      }
    }
  }, [isOpen, viewName, initialAction])

  async function handleRename() {
    if (!newName.trim()) {
      alert("View name is required")
      return
    }

    try {
      await supabase
        .from("views")
        .update({ name: newName.trim() })
        .eq("id", viewId)

      onAction?.("rename")
      router.refresh()
      onClose()
    } catch (error) {
      console.error("Error renaming view:", error)
      alert("Failed to rename view")
    }
  }

  async function handleDuplicate() {
    if (!newName.trim()) {
      alert("View name is required")
      return
    }

    try {
      // Get current view data
      const { data: currentView } = await supabase
        .from("views")
        .select("*")
        .eq("id", viewId)
        .single()

      if (!currentView) {
        alert("View not found")
        return
      }

      // Get view fields, filters, sorts
      const [fieldsRes, filtersRes, sortsRes] = await Promise.all([
        supabase.from("view_fields").select("*").eq("view_id", viewId),
        supabase.from("view_filters").select("*").eq("view_id", viewId),
        supabase.from("view_sorts").select("*").eq("view_id", viewId),
      ])

      // Create new view
      const { data: newView, error: viewError } = await supabase
        .from("views")
        .insert([
          {
            table_id: tableId,
            name: newName.trim(),
            type: currentView.type,
            config: currentView.config,
          },
        ])
        .select()
        .single()

      if (viewError || !newView) {
        alert("Failed to create duplicate view")
        return
      }

      // Copy view fields
      if (fieldsRes.data && fieldsRes.data.length > 0) {
        await supabase.from("view_fields").insert(
          fieldsRes.data.map((f) => ({
            view_id: newView.id,
            field_name: f.field_name,
            visible: f.visible,
            position: f.position,
          }))
        )
      }

      // Copy filters
      if (filtersRes.data && filtersRes.data.length > 0) {
        await supabase.from("view_filters").insert(
          filtersRes.data.map((f) => ({
            view_id: newView.id,
            field_name: f.field_name,
            operator: f.operator,
            value: f.value,
          }))
        )
      }

      // Copy sorts
      if (sortsRes.data && sortsRes.data.length > 0) {
        await supabase.from("view_sorts").insert(
          sortsRes.data.map((f) => ({
            view_id: newView.id,
            field_name: f.field_name,
            direction: f.direction,
            order_index: f.order_index,
          }))
        )
      }

      onAction?.("duplicate")
      router.push(`/tables/${tableId}/views/${newView.id}`)
      onClose()
    } catch (error) {
      console.error("Error duplicating view:", error)
      alert("Failed to duplicate view")
    }
  }

  async function handleDelete() {
    try {
      const { error } = await supabase.from("views").delete().eq("id", viewId)
      
      if (error) throw error
      
      onAction?.("delete")
      onClose()
      router.push(`/tables/${tableId}`)
    } catch (error) {
      console.error("Error deleting view:", error)
      alert("Failed to delete view: " + (error as Error).message)
    }
  }

  const currentAction = action || initialAction

  if (currentAction === "rename") {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent aria-describedby="rename-view-dialog-description">
          <DialogHeader>
            <DialogTitle>Rename View</DialogTitle>
            <DialogDescription id="rename-view-dialog-description">
              Enter a new name for this view.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>View Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1"
                autoFocus
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleRename}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (currentAction === "duplicate") {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent aria-describedby="duplicate-view-dialog-description">
          <DialogHeader>
            <DialogTitle>Duplicate View</DialogTitle>
            <DialogDescription id="duplicate-view-dialog-description">
              Create a copy of this view with a new name.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>New View Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1"
                placeholder={`${viewName} (Copy)`}
                autoFocus
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleDuplicate}>Duplicate</Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (currentAction === "delete") {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent aria-describedby="delete-view-dialog-description">
          <DialogHeader>
            <DialogTitle>Delete View</DialogTitle>
            <DialogDescription id="delete-view-dialog-description">
              Are you sure you want to delete &quot;{viewName}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return null
}
