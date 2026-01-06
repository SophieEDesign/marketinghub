"use client"

import { useState, useEffect } from "react"
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
import { Save } from "lucide-react"
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
import { Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { InterfacePage } from "@/lib/interface/page-types-only"
import { PAGE_TYPE_DEFINITIONS } from "@/lib/interface/page-types"

interface InterfacePageSettingsDrawerProps {
  pageId: string
  isOpen: boolean
  onClose: () => void
  onUpdate: (updatedPage: InterfacePage) => void
}

interface InterfaceGroup {
  id: string
  name: string
}

export default function InterfacePageSettingsDrawer({
  pageId,
  isOpen,
  onClose,
  onUpdate,
}: InterfacePageSettingsDrawerProps) {
  const [page, setPage] = useState<InterfacePage | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [pageType, setPageType] = useState<string>("")
  const [sourceTable, setSourceTable] = useState<string>("") // Changed from sourceView - users select tables, not SQL views
  const [baseTable, setBaseTable] = useState<string>("")
  const [interfaceId, setInterfaceId] = useState<string>("") // Changed from groupId - terminology fix
  const [isAdminOnly, setIsAdminOnly] = useState(false)
  const [interfaces, setInterfaces] = useState<InterfaceGroup[]>([]) // Changed from groups - terminology fix
  const [tables, setTables] = useState<Array<{ id: string; name: string }>>([])
  const [saving, setSaving] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen && pageId) {
      setLoading(true)
      loadPage()
      loadInterfaces()
      loadTables()
    } else if (!isOpen) {
      // Reset state when drawer closes to prevent glitching
      setPage(null)
      setName("")
      setDescription("")
      setPageType("")
      setSourceTable("")
      setBaseTable("")
      setInterfaceId("")
      setIsAdminOnly(false)
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, pageId])

  async function loadPage() {
    try {
      const res = await fetch(`/api/interface-pages/${pageId}`)
      if (!res.ok) throw new Error('Failed to load page')
      
      const pageData = await res.json()
      setPage(pageData)
      setName(pageData.name || "")
      setDescription("") // InterfacePage doesn't have description field
      setPageType(pageData.page_type || "")
      // Map source_view to sourceTable for display (users see tables, not SQL views)
      // If page has source_view, we need to find which table it references
      // For now, store the table ID if available, otherwise use base_table
      setSourceTable(pageData.base_table || "")
      setBaseTable(pageData.base_table || "")
      setInterfaceId(pageData.group_id || "") // Interface is required, no "__none__" option
      setIsAdminOnly(pageData.is_admin_only || false)
      setLoading(false)
    } catch (error) {
      console.error("Error loading page:", error)
      setLoading(false)
    }
  }

  async function loadInterfaces() {
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('interface_groups')
        .select('id, name')
        .order('name')
      
      if (data) {
        setInterfaces(data)
      }
    } catch (error) {
      console.error('Error loading interfaces:', error)
    }
  }

  async function loadTables() {
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('tables')
        .select('id, name')
        .order('name')
      
      if (data) {
        setTables(data)
      }
    } catch (error) {
      console.error('Error loading tables:', error)
    }
  }

  async function handleSave() {
    if (!name.trim() || !page) {
      return
    }

    // Interface is required
    if (!interfaceId) {
      alert('Please select an Interface')
      return
    }

    setSaving(true)
    try {
      // When user selects a table, we store it as base_table
      // SQL views are created automatically behind the scenes
      const res = await fetch(`/api/interface-pages/${pageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          base_table: sourceTable || baseTable || null,
          // source_view will be auto-generated from base_table if needed
          group_id: interfaceId, // Required - no null option
          is_admin_only: isAdminOnly,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update page')
      }

      const updatedPage = await res.json()
      onUpdate(updatedPage)
      onClose()
    } catch (error: any) {
      console.error('Error saving page:', error)
      alert(error.message || 'Failed to save page')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!page) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/interface-pages/${pageId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete page')
      }

      // Redirect to home or first available page
      window.location.href = '/'
    } catch (error: any) {
      console.error('Error deleting page:', error)
      alert(error.message || 'Failed to delete page')
    } finally {
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const pageTypeDef = page ? PAGE_TYPE_DEFINITIONS[page.page_type as keyof typeof PAGE_TYPE_DEFINITIONS] : null

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Page Settings</SheetTitle>
            <SheetDescription>
              Configure page settings and data source
            </SheetDescription>
          </SheetHeader>

          {loading ? (
            <div className="p-4">Loading...</div>
          ) : !page ? (
            <div className="p-4 text-red-600">Page not found</div>
          ) : (

          <div className="mt-6 space-y-6">
            {/* Basic Settings */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Page Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter page name"
                />
              </div>

              <div className="space-y-2">
                <Label>Page Type</Label>
                <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                  {pageTypeDef?.label || pageType} - {pageTypeDef?.description || ''}
                </div>
                <p className="text-xs text-gray-500">
                  Page type cannot be changed after creation
                </p>
              </div>

              {/* Source Table (for pages that need data) */}
              {pageTypeDef && (pageTypeDef.requiresSourceView || pageTypeDef.requiresBaseTable) && (
                <div className="space-y-2">
                  <Label htmlFor="sourceTable">Source Table *</Label>
                  <Select
                    value={sourceTable || baseTable}
                    onValueChange={(value) => {
                      setSourceTable(value)
                      setBaseTable(value) // Keep both in sync
                    }}
                  >
                    <SelectTrigger id="sourceTable">
                      <SelectValue placeholder="Select table" />
                    </SelectTrigger>
                    <SelectContent>
                      {tables.map((table) => (
                        <SelectItem key={table.id} value={table.id}>
                          {table.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    {pageTypeDef?.requiresBaseTable 
                      ? 'Table used for this page'
                      : 'Table that provides data for this page. SQL views are created automatically.'}
                  </p>
                </div>
              )}

              {/* Interface (required) */}
              <div className="space-y-2">
                <Label htmlFor="interface">Interface *</Label>
                <Select
                  value={interfaceId}
                  onValueChange={setInterfaceId}
                  required
                >
                  <SelectTrigger id="interface">
                    <SelectValue placeholder="Select Interface" />
                  </SelectTrigger>
                  <SelectContent>
                    {interfaces.map((iface) => (
                      <SelectItem key={iface.id} value={iface.id}>
                        {iface.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Every page must belong to an Interface
                </p>
              </div>

              {/* Admin Only */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isAdminOnly"
                  checked={isAdminOnly}
                  onChange={(e) => setIsAdminOnly(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="isAdminOnly" className="cursor-pointer">
                  Admin only
                </Label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Page
              </Button>

              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent aria-describedby="delete-dialog-description">
          <DialogHeader>
            <DialogTitle>Delete Page</DialogTitle>
            <DialogDescription id="delete-dialog-description">
              Are you sure you want to delete &quot;{name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}


