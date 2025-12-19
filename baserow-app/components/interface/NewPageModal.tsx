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

interface NewPageModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function NewPageModal({ open, onOpenChange }: NewPageModalProps) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [icon, setIcon] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!name.trim()) {
      alert("Page name is required")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: null,
          settings: {
            icon: icon.trim() || null,
            access: "authenticated",
            layout: { cols: 12, rowHeight: 30, margin: [10, 10] },
          },
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create page")
      }

      const { page } = await response.json()

      if (page) {
        // Reset form
        setName("")
        setIcon("")
        onOpenChange(false)
        // Redirect to the new page in edit mode
        router.push(`/interface/${page.id}`)
      }
    } catch (error: any) {
      console.error("Failed to create page:", error)
      alert(error.message || "Failed to create page")
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
          <DialogTitle>Create New Page</DialogTitle>
          <DialogDescription>
            Create a new interface page. You can add blocks and customize it after creation.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="page-name">Page Name *</Label>
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
            <Label htmlFor="page-icon">Icon (Emoji)</Label>
            <Input
              id="page-icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="📊"
              maxLength={2}
            />
            <p className="text-xs text-muted-foreground">
              Optional: Add an emoji to represent this page
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading || !name.trim()}>
            {loading ? "Creating..." : "Create Page"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
