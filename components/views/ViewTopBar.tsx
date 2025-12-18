"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Grid, FileText, Columns, Calendar, Layout, ChevronDown, Trash2, Edit2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ViewTopBarProps {
  viewId: string
  viewName: string
  viewType: 'grid' | 'kanban' | 'calendar' | 'form' | 'gallery' | 'page'
  tableId: string
  onViewDeleted?: () => void
}

const viewIcons = {
  grid: Grid,
  kanban: Columns,
  calendar: Calendar,
  form: FileText,
  gallery: Layout,
  page: Layout,
}

export default function ViewTopBar({
  viewId,
  viewName,
  viewType,
  tableId,
  onViewDeleted,
}: ViewTopBarProps) {
  const router = useRouter()
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [newName, setNewName] = useState(viewName)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)

  const Icon = viewIcons[viewType] || Grid

  async function handleRename() {
    if (!newName.trim() || newName === viewName) {
      setRenameOpen(false)
      return
    }

    setIsRenaming(true)
    try {
      const { error } = await supabase
        .from('views')
        .update({ name: newName.trim() })
        .eq('id', viewId)

      if (error) throw error

      setRenameOpen(false)
      router.refresh()
    } catch (error) {
      console.error('Error renaming view:', error)
      alert('Failed to rename view')
    } finally {
      setIsRenaming(false)
    }
  }

  async function handleDelete() {
    setIsDeleting(true)
    try {
      const { error } = await supabase.from('views').delete().eq('id', viewId)

      if (error) throw error

      setDeleteOpen(false)
      onViewDeleted?.()
      router.push(`/data/${tableId}`)
    } catch (error) {
      console.error('Error deleting view:', error)
      alert('Failed to delete view')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex-shrink-0 w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center">
              <Icon className="h-4 w-4 text-gray-600" />
            </div>
            <h1 className="text-base font-semibold text-gray-900 truncate">{viewName}</h1>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2 text-gray-600 hover:text-gray-900">
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                <Edit2 className="mr-2 h-4 w-4" />
                Rename view
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete view
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename View</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="view-name">View Name</Label>
              <Input
                id="view-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter view name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRename()
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={isRenaming || !newName.trim()}>
              {isRenaming ? 'Renaming...' : 'Rename'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete View</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to delete &quot;{viewName}&quot;? This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
