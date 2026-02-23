"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Edit, Copy, Trash2, FileText, Grid, Calendar, Columns, FileEdit, Settings, GripVertical } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { formatDateTimeUK } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'
import InterfacePageSettingsDrawer from '@/components/interface/InterfacePageSettingsDrawer'
import PageCreationWizard from '@/components/interface/PageCreationWizard'
import type { InterfacePage } from '@/lib/interface/page-types-only'

interface Page {
  id: string
  name: string
  displayName?: string // Display name with table info for views
  type: 'interface' | 'grid' | 'kanban' | 'calendar' | 'form'
  tableId?: string | null
  tableName?: string
  group_id?: string | null // Interface ID (references interface_groups - Interface container)
  order_index?: number // Order index for sorting pages within groups
  updated_at?: string
  created_at?: string
  page_type?: string // For interface_pages
  is_interface_page?: boolean // Flag to distinguish interface_pages from views
}

export default function SettingsPagesTab() {
  const router = useRouter()
  const { toast } = useToast()
  const [pages, setPages] = useState<Page[]>([])
  const [loading, setLoading] = useState(true)
  const [newPageOpen, setNewPageOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pageToDelete, setPageToDelete] = useState<Page | null>(null)
  
  // New page form state
  const [newPageName, setNewPageName] = useState('')
  const [newPageType, setNewPageType] = useState<'interface' | 'grid' | 'kanban' | 'calendar' | 'form'>('interface')
  const [newPageTableId, setNewPageTableId] = useState<string>('')
  const [newPageIsAdminOnly, setNewPageIsAdminOnly] = useState(true)
  const [tables, setTables] = useState<Array<{ id: string; name: string }>>([])
  const [creating, setCreating] = useState(false)
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false)
  const [selectedPageForSettings, setSelectedPageForSettings] = useState<string | null>(null)
  const [interfaceGroups, setInterfaceGroups] = useState<Array<{ id: string; name: string }>>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  
  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    loadPages()
    loadTables()
    loadInterfaceGroups()
  }, [])

  async function loadInterfaceGroups() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('interface_groups')
        .select('id, name')
        .order('name')

      if (!error && data) {
        setInterfaceGroups(data)
      }
    } catch (error) {
      console.error('Error loading interface groups:', error)
    }
  }

  async function loadTables() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('tables')
        .select('id, name')
        .order('name')

      if (!error && data) {
        setTables(data)
        if (data.length > 0) {
          setNewPageTableId(data[0].id)
        }
      }
    } catch (error) {
      console.error('Error loading tables:', error)
    }
  }

  async function loadPages() {
    setLoading(true)
    try {
      const supabase = createClient()
      
      // Load only interface pages from interface_pages table
      // These are the actual Pages that belong to Interfaces
      const { data: interfacePages, error: interfacePagesError } = await supabase
        .from('interface_pages')
        .select('id, name, page_type, group_id, updated_at, created_at')
        .order('updated_at', { ascending: false })

      if (interfacePagesError) {
        console.error('Error loading interface pages:', interfacePagesError)
      }

      // Load interface groups (these are the Interfaces)
      const { data: interfaceGroups } = await supabase
        .from('interface_groups')
        .select('id, name')
        .order('name')

      const groupMap = new Map<string, string>()
      if (interfaceGroups) {
        interfaceGroups.forEach((g: { id: string; name: string }) => groupMap.set(g.id, g.name))
      }

      // Convert interface_pages to Page format
      const pagesList: Page[] = (interfacePages || []).map((page: any) => ({
        id: page.id,
        name: page.name,
        type: 'interface' as const,
        page_type: page.page_type,
        is_interface_page: true,
        group_id: page.group_id,
        tableId: null,
        tableName: undefined,
        updated_at: page.updated_at,
        created_at: page.created_at,
      }))

      // Sort by updated_at descending
      pagesList.sort((a, b) => {
        const aDate = a.updated_at || a.created_at || ''
        const bDate = b.updated_at || b.created_at || ''
        return bDate.localeCompare(aDate)
      })

      setPages(pagesList)
    } catch (error) {
      console.error('Error loading pages:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleEdit(page: Page) {
    if (page.type === 'interface') {
      router.push(`/pages/${page.id}`)
    } else if (page.tableId) {
      router.push(`/tables/${page.tableId}/views/${page.id}`)
    } else {
      // Try to find table for view
      const supabase = createClient()
      const { data: view } = await supabase
        .from('views')
        .select('table_id')
        .eq('id', page.id)
        .single()
      
      if (view?.table_id) {
        router.push(`/tables/${view.table_id}/views/${page.id}`)
      }
    }
  }

  function handlePageSettings(page: Page) {
    if (page.is_interface_page) {
      setSelectedPageForSettings(page.id)
      setSettingsDrawerOpen(true)
    }
  }

  async function handleDuplicate(page: Page) {
    if (!confirm(`Duplicate "${page.name}"?`)) return

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (page.type === 'interface') {
        // Load original view
        const { data: original, error: fetchError } = await supabase
          .from('views')
          .select('*')
          .eq('id', page.id)
          .single()

        if (fetchError) throw fetchError

        // Load blocks (from view_blocks table, using view_id)
        const { data: blocks } = await supabase
          .from('view_blocks')
          .select('*')
          .eq('view_id', page.id)
          .order('position')

        // Create duplicate view
        const { data: newView, error: createError } = await supabase
          .from('views')
          .insert([
            {
              name: `${original.name} (Copy)`,
              type: 'interface',
              table_id: null,
              config: original.config || {},
              owner_id: user?.id,
              access_level: original.access_level || 'authenticated',
            },
          ])
          .select()
          .single()

        if (createError) throw createError

        // Duplicate blocks
        if (blocks && blocks.length > 0) {
          const newBlocks = blocks.map((block: any) => ({
            view_id: newView.id,
            type: block.type,
            position: block.position,
            settings: block.settings,
            visibility: block.visibility,
          }))

          await supabase.from('view_blocks').insert(newBlocks)
        }

        router.push(`/pages/${newView.id}`)
      } else {
        // Duplicate view
        const { data: original, error: fetchError } = await supabase
          .from('views')
          .select('*')
          .eq('id', page.id)
          .single()

        if (fetchError) throw fetchError

        const { data: newView, error: createError } = await supabase
          .from('views')
          .insert([
            {
              table_id: original.table_id,
              name: `${original.name} (Copy)`,
              type: original.type,
              config: original.config,
              owner_id: user?.id,
              access_level: original.access_level,
            },
          ])
          .select()
          .single()

        if (createError) throw createError

        router.push(`/tables/${original.table_id}/views/${newView.id}`)
      }

      await loadPages()
      router.refresh()
      window.dispatchEvent(new CustomEvent('pages-updated'))
    } catch (error: any) {
      console.error('Error duplicating page:', error)
      alert(error.message || 'Failed to duplicate page')
    }
  }

  async function handleDelete() {
    if (!pageToDelete) return

    try {
      // Check if it's an interface page (from interface_pages table)
      if (pageToDelete.is_interface_page) {
        // Use the API endpoint for interface pages
        const response = await fetch(`/api/interface-pages/${pageToDelete.id}`, {
          method: 'DELETE',
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to delete page')
        }
      } else {
        // Soft delete from views table (for backward compatibility with old system)
        const supabase = createClient()
        const { error } = await supabase
          .from('views')
          .update({
            is_archived: true,
            archived_at: new Date().toISOString(),
          })
          .eq('id', pageToDelete.id)

        if (error) {
          console.error('Error deleting view:', error)
          throw error
        }
      }

      setDeleteDialogOpen(false)
      setPageToDelete(null)
      await loadPages()
      router.refresh()
      window.dispatchEvent(new CustomEvent('pages-updated'))
      toast({ title: "Moved to trash", description: "Page has been moved to trash." })
    } catch (error: any) {
      console.error('Error deleting page:', error)
      alert(error.message || 'Failed to delete page. Make sure you have permission to delete pages.')
    }
  }

  function getPageTypeLabel(page: Page): string {
    if (page.type === 'interface') return 'Interface Page'
    if (page.type === 'grid') return 'Grid View'
    if (page.type === 'kanban') return 'Kanban View'
    if (page.type === 'calendar') return 'Calendar View'
    if (page.type === 'form') return 'Form View'
    return 'View'
  }

  function getPageTypeIcon(page: Page) {
    if (page.type === 'interface') return FileText
    if (page.type === 'grid') return Grid
    if (page.type === 'kanban') return Columns
    if (page.type === 'calendar') return Calendar
    if (page.type === 'form') return FileEdit
    return FileText
  }

  function formatDate(dateString?: string): string {
    // UK format: DD/MM/YYYY HH:mm
    return formatDateTimeUK(dateString || null, '—')
  }

  // Group pages by interface
  const pagesByGroup = pages.reduce((acc, page) => {
    const groupId = page.group_id || 'ungrouped'
    if (!acc[groupId]) {
      acc[groupId] = []
    }
    acc[groupId].push(page)
    return acc
  }, {} as Record<string, Page[]>)

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    // Only handle page dragging
    if (!activeId.startsWith('page-')) return

    const pageId = activeId.replace('page-', '')
    const activePage = pages.find((p) => p.id === pageId)
    if (!activePage) return

    let targetGroupId: string | null = null

    // Determine target group
    if (overId.startsWith('group-')) {
      targetGroupId = overId.replace('group-', '')
    } else if (overId.startsWith('page-')) {
      const targetPageId = overId.replace('page-', '')
      const targetPage = pages.find((p) => p.id === targetPageId)
      targetGroupId = targetPage?.group_id || null
    } else if (overId === 'ungrouped') {
      targetGroupId = null
    }

    // If dropping on same group, just reorder
    if (activePage.group_id === targetGroupId) {
      const groupPages = (targetGroupId ? pagesByGroup[targetGroupId] || [] : pagesByGroup['ungrouped'] || [])
        .filter((p) => p.id !== pageId)
        .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))

      let insertIndex = groupPages.length
      if (overId.startsWith('page-')) {
        const targetPageId = overId.replace('page-', '')
        const targetIndex = groupPages.findIndex((p) => p.id === targetPageId)
        if (targetIndex !== -1) {
          insertIndex = targetIndex
        }
      }

      const updates: Array<{ id: string; group_id: string | null; order_index: number }> = []

      // Update pages before insertion point
      for (let i = 0; i < insertIndex; i++) {
        updates.push({
          id: groupPages[i].id,
          group_id: targetGroupId,
          order_index: i,
        })
      }

      // Insert the moved page
      updates.push({
        id: pageId,
        group_id: targetGroupId,
        order_index: insertIndex,
      })

      // Update pages after insertion point
      for (let i = insertIndex; i < groupPages.length; i++) {
        updates.push({
          id: groupPages[i].id,
          group_id: targetGroupId,
          order_index: i + 1,
        })
      }

      try {
        await fetch('/api/interfaces/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interfaceUpdates: updates }),
        })

        await loadPages()
        window.dispatchEvent(new CustomEvent('pages-updated'))
      } catch (error) {
        console.error('Failed to reorder pages:', error)
        alert('Failed to reorder pages. Please try again.')
      }
    } else {
      // Moving to different group
      const targetPages = (targetGroupId ? pagesByGroup[targetGroupId] || [] : pagesByGroup['ungrouped'] || [])
        .filter((p) => p.id !== pageId)
        .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))

      let insertIndex = targetPages.length
      if (overId.startsWith('page-')) {
        const targetPageId = overId.replace('page-', '')
        const targetIndex = targetPages.findIndex((p) => p.id === targetPageId)
        if (targetIndex !== -1) {
          insertIndex = targetIndex
        }
      }

      const updates: Array<{ id: string; group_id: string | null; order_index: number }> = []

      // Update pages before insertion point
      for (let i = 0; i < insertIndex; i++) {
        updates.push({
          id: targetPages[i].id,
          group_id: targetGroupId,
          order_index: i,
        })
      }

      // Insert the moved page
      updates.push({
        id: pageId,
        group_id: targetGroupId,
        order_index: insertIndex,
      })

      // Update pages after insertion point
      for (let i = insertIndex; i < targetPages.length; i++) {
        updates.push({
          id: targetPages[i].id,
          group_id: targetGroupId,
          order_index: i + 1,
        })
      }

      // Update pages in old group
      const oldGroupPages = (activePage.group_id
        ? pagesByGroup[activePage.group_id] || []
        : pagesByGroup['ungrouped'] || []).filter((p) => p.id !== pageId)

      oldGroupPages.forEach((p, i) => {
        updates.push({
          id: p.id,
          group_id: activePage.group_id ?? null,
          order_index: i,
        })
      })

      try {
        await fetch('/api/interfaces/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interfaceUpdates: updates }),
        })

        await loadPages()
        window.dispatchEvent(new CustomEvent('pages-updated'))
      } catch (error) {
        console.error('Failed to move page:', error)
        alert('Failed to move page. Please try again.')
      }
    }
  }

  // Sortable Page Component
  function SortablePage({ page }: { page: Page }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: `page-${page.id}`,
    })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    }

    const Icon = getPageTypeIcon(page)

    return (
      <div ref={setNodeRef} style={style} className="grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-gray-50 rounded-md transition-colors border-b">
        <div className="col-span-4 flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="p-1 hover:bg-gray-200 rounded cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4 text-gray-400" />
          </button>
          <Icon className="h-4 w-4 text-gray-400" />
          <span className="font-medium">{page.name}</span>
        </div>
        <div className="col-span-2 text-sm text-gray-600">
          {getPageTypeLabel(page)}
        </div>
        <div className="col-span-2 text-sm text-gray-600">
          {page.group_id
            ? (interfaceGroups.find((g: { id: string; name: string }) => g.id === page.group_id)?.name || 'Unknown Interface')
            : 'Ungrouped'}
        </div>
        <div className="col-span-2 text-sm text-gray-500">
          {formatDate(page.updated_at)}
        </div>
        <div className="col-span-2 flex items-center justify-end gap-1">
          {page.is_interface_page && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePageSettings(page)}
              title="Page Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEdit(page)}
            title="Edit"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDuplicate(page)}
            title="Duplicate"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPageToDelete(page)
              setDeleteDialogOpen(true)
            }}
            title="Delete"
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      </div>
    )
  }

  // Droppable Group Component
  function DroppableGroup({ groupId, groupName, children }: { groupId: string | null; groupName: string; children: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({
      id: groupId ? `group-${groupId}` : 'ungrouped',
    })

    return (
      <div
        ref={setNodeRef}
        className={isOver ? 'bg-blue-50 rounded-md p-2' : ''}
      >
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-4">
          {groupName}
        </div>
        {children}
      </div>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading pages...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Interface Pages</CardTitle>
                <CardDescription>Manage the screens users interact with inside each Interface</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => {
                  setNewPageOpen(true)
                }}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Page
                </Button>
              </div>
            </div>
        </CardHeader>
        <CardContent>
          {pages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm mb-2">No pages yet.</p>
              <p className="text-xs">Create your first page to get started.</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="space-y-4">
                <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b">
                  <div className="col-span-4">Name</div>
                  <div className="col-span-2">Type</div>
                  <div className="col-span-2">Interface</div>
                  <div className="col-span-2">Last Updated</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>
                <SortableContext items={[...interfaceGroups.map((g) => `group-${g.id}`), ...pages.map((p) => `page-${p.id}`), 'ungrouped']} strategy={verticalListSortingStrategy}>
                  {/* Render pages grouped by interface */}
                  {interfaceGroups.map((group) => {
                    const groupPages = (pagesByGroup[group.id] || []).sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                    if (groupPages.length === 0) return null
                    return (
                      <DroppableGroup key={group.id} groupId={group.id} groupName={group.name}>
                        {groupPages.map((page) => (
                          <SortablePage key={page.id} page={page} />
                        ))}
                      </DroppableGroup>
                    )
                  })}
                  {/* Render ungrouped pages */}
                  {(pagesByGroup['ungrouped'] || []).length > 0 && (
                    <DroppableGroup groupId={null} groupName="Ungrouped">
                      {(pagesByGroup['ungrouped'] || [])
                        .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                        .map((page) => (
                          <SortablePage key={page.id} page={page} />
                        ))}
                    </DroppableGroup>
                  )}
                </SortableContext>
                <DragOverlay>
                  {activeId ? (
                    <div className="bg-white border border-gray-200 rounded shadow-lg p-2">
                      <span className="text-sm text-gray-700">
                        {pages.find((p) => `page-${p.id}` === activeId)?.name}
                      </span>
                    </div>
                  ) : null}
                </DragOverlay>
              </div>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Page Creation Wizard */}
      <PageCreationWizard
        open={newPageOpen}
        onOpenChange={setNewPageOpen}
        defaultGroupId={null}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Page</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{pageToDelete?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Page Settings Drawer for Interface Pages */}
      {selectedPageForSettings && (
        <InterfacePageSettingsDrawer
          pageId={selectedPageForSettings}
          isOpen={settingsDrawerOpen}
          onClose={() => {
            setSettingsDrawerOpen(false)
            setSelectedPageForSettings(null)
          }}
          onUpdate={(updatedPage: InterfacePage) => {
            // Reload pages after update
            loadPages()
            setSettingsDrawerOpen(false)
            setSelectedPageForSettings(null)
          }}
        />
      )}
    </>
  )
}
