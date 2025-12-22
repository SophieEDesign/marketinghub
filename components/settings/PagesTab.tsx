"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Edit, Copy, Trash2, FileText, Grid, Calendar, Columns, FileEdit } from 'lucide-react'
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
import { createClientSupabaseClient } from '@/lib/supabase'

interface Page {
  id: string
  name: string
  type: 'interface' | 'view'
  viewType?: string
  tableId?: string
  tableName?: string
  updated_at?: string
  created_at?: string
}

export default function SettingsPagesTab() {
  const router = useRouter()
  const [pages, setPages] = useState<Page[]>([])
  const [loading, setLoading] = useState(true)
  const [newPageOpen, setNewPageOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pageToDelete, setPageToDelete] = useState<Page | null>(null)
  
  // New page form state
  const [newPageName, setNewPageName] = useState('')
  const [newPageType, setNewPageType] = useState<'interface' | 'view'>('interface')
  const [newViewType, setNewViewType] = useState<'grid' | 'kanban' | 'calendar' | 'form'>('grid')
  const [newPageTableId, setNewPageTableId] = useState<string>('')
  const [tables, setTables] = useState<Array<{ id: string; name: string }>>([])
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadPages()
    loadTables()
  }, [])

  async function loadTables() {
    try {
      const supabase = createClientSupabaseClient()
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
      const supabase = createClientSupabaseClient()
      
      // Load interface pages (from pages table)
      const { data: interfacePages, error: pagesError } = await supabase
        .from('pages')
        .select('id, name, updated_at, created_at')
        .order('updated_at', { ascending: false })

      // Load views (from views table) - these are view pages
      const { data: views, error: viewsError } = await supabase
        .from('views')
        .select('id, name, type, table_id, updated_at, created_at')
        .order('updated_at', { ascending: false })

      // Load table names separately
      const tableIds = views?.map(v => v.table_id).filter(Boolean) || []
      const tableMap = new Map<string, string>()
      if (tableIds.length > 0) {
        const { data: tablesData } = await supabase
          .from('tables')
          .select('id, name')
          .in('id', tableIds)
        
        if (tablesData) {
          tablesData.forEach(t => tableMap.set(t.id, t.name))
        }
      }

      const allPages: Page[] = []

      if (!pagesError && interfacePages) {
        interfacePages.forEach((page) => {
          allPages.push({
            id: page.id,
            name: page.name,
            type: 'interface',
            updated_at: page.updated_at,
            created_at: page.created_at,
          })
        })
      }

      if (!viewsError && views) {
        views.forEach((view: any) => {
          allPages.push({
            id: view.id,
            name: view.name,
            type: 'view',
            viewType: view.type,
            tableId: view.table_id,
            tableName: view.table_id ? tableMap.get(view.table_id) : undefined,
            updated_at: view.updated_at,
            created_at: view.created_at,
          })
        })
      }

      // Sort by updated_at descending
      allPages.sort((a, b) => {
        const aDate = a.updated_at || a.created_at || ''
        const bDate = b.updated_at || b.created_at || ''
        return bDate.localeCompare(aDate)
      })

      setPages(allPages)
    } catch (error) {
      console.error('Error loading pages:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreatePage() {
    if (!newPageName.trim()) {
      alert('Page name is required')
      return
    }

    if (newPageType === 'view' && !newPageTableId) {
      alert('Please select a table for the view')
      return
    }

    setCreating(true)
    try {
      const supabase = createClientSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (newPageType === 'interface') {
        // Create interface page
        const { data, error } = await supabase
          .from('pages')
          .insert([
            {
              name: newPageName.trim(),
              settings: {
                access: 'authenticated',
                layout: { cols: 12, rowHeight: 30, margin: [10, 10] },
              },
              created_by: user?.id,
            },
          ])
          .select()
          .single()

        if (error) throw error

        // Redirect to interface page builder
        router.push(`/interface/${data.id}`)
      } else {
        // Create view
        const { data, error } = await supabase
          .from('views')
          .insert([
            {
              table_id: newPageTableId,
              name: newPageName.trim(),
              type: newViewType,
              config: {},
              owner_id: user?.id,
              access_level: 'authenticated',
            },
          ])
          .select()
          .single()

        if (error) throw error

        // Redirect to view
        router.push(`/tables/${newPageTableId}/views/${data.id}`)
      }

      // Reset form and close modal
      setNewPageName('')
      setNewPageType('interface')
      setNewViewType('grid')
      setNewPageOpen(false)
      
      // Reload pages list
      await loadPages()
      
      // Refresh router to update sidebar - this will trigger server-side refetch
      router.refresh()
      
      // Also trigger a window event that sidebar can listen to
      window.dispatchEvent(new CustomEvent('pages-updated'))
    } catch (error: any) {
      console.error('Error creating page:', error)
      alert(error.message || 'Failed to create page')
    } finally {
      setCreating(false)
    }
  }

  async function handleEdit(page: Page) {
    if (page.type === 'interface') {
      router.push(`/interface/${page.id}`)
    } else if (page.tableId) {
      router.push(`/tables/${page.tableId}/views/${page.id}`)
    } else {
      // Try to find table for view
      const supabase = createClientSupabaseClient()
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

  async function handleDuplicate(page: Page) {
    if (!confirm(`Duplicate "${page.name}"?`)) return

    try {
      const supabase = createClientSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (page.type === 'interface') {
        // Load original page
        const { data: original, error: fetchError } = await supabase
          .from('pages')
          .select('*')
          .eq('id', page.id)
          .single()

        if (fetchError) throw fetchError

        // Load blocks
        const { data: blocks } = await supabase
          .from('page_blocks')
          .select('*')
          .eq('page_id', page.id)
          .order('order_index')

        // Create duplicate page
        const { data: newPage, error: createError } = await supabase
          .from('pages')
          .insert([
            {
              name: `${original.name} (Copy)`,
              description: original.description,
              settings: original.settings,
              created_by: user?.id,
            },
          ])
          .select()
          .single()

        if (createError) throw createError

        // Duplicate blocks
        if (blocks && blocks.length > 0) {
          const newBlocks = blocks.map((block) => ({
            page_id: newPage.id,
            type: block.type,
            x: block.x,
            y: block.y,
            w: block.w,
            h: block.h,
            config: block.config,
            order_index: block.order_index,
          }))

          await supabase.from('page_blocks').insert(newBlocks)
        }

        router.push(`/interface/${newPage.id}`)
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
      const supabase = createClientSupabaseClient()

      if (pageToDelete.type === 'interface') {
        const { error } = await supabase
          .from('pages')
          .delete()
          .eq('id', pageToDelete.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('views')
          .delete()
          .eq('id', pageToDelete.id)

        if (error) throw error
      }

      setDeleteDialogOpen(false)
      setPageToDelete(null)
      await loadPages()
      router.refresh()
      window.dispatchEvent(new CustomEvent('pages-updated'))
    } catch (error: any) {
      console.error('Error deleting page:', error)
      alert(error.message || 'Failed to delete page')
    }
  }

  function getPageTypeLabel(page: Page): string {
    if (page.type === 'interface') return 'Interface Page'
    if (page.viewType === 'grid') return 'Grid View'
    if (page.viewType === 'kanban') return 'Kanban View'
    if (page.viewType === 'calendar') return 'Calendar View'
    if (page.viewType === 'form') return 'Form View'
    return 'View'
  }

  function getPageTypeIcon(page: Page) {
    if (page.type === 'interface') return FileText
    if (page.viewType === 'grid') return Grid
    if (page.viewType === 'kanban') return Columns
    if (page.viewType === 'calendar') return Calendar
    if (page.viewType === 'form') return FileEdit
    return FileText
  }

  function formatDate(dateString?: string): string {
    if (!dateString) return '—'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return '—'
    }
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
              <CardTitle>Pages</CardTitle>
              <CardDescription>Manage your interface pages and views</CardDescription>
            </div>
            <Button onClick={() => setNewPageOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Page
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {pages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">No pages yet. Create your first page to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b">
                <div className="col-span-4">Name</div>
                <div className="col-span-2">Type</div>
                <div className="col-span-2">Table</div>
                <div className="col-span-2">Last Updated</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>
              {pages.map((page) => {
                const Icon = getPageTypeIcon(page)
                return (
                  <div
                    key={page.id}
                    className="grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-gray-50 rounded-md transition-colors border-b"
                  >
                    <div className="col-span-4 flex items-center gap-2">
                      <Icon className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">{page.name}</span>
                    </div>
                    <div className="col-span-2 text-sm text-gray-600">
                      {getPageTypeLabel(page)}
                    </div>
                    <div className="col-span-2 text-sm text-gray-600">
                      {page.tableName || '—'}
                    </div>
                    <div className="col-span-2 text-sm text-gray-500">
                      {formatDate(page.updated_at)}
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-1">
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
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Page Modal */}
      <Dialog open={newPageOpen} onOpenChange={setNewPageOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Page</DialogTitle>
            <DialogDescription>
              Create a new interface page or view
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="page-name">Page Name *</Label>
              <Input
                id="page-name"
                value={newPageName}
                onChange={(e) => setNewPageName(e.target.value)}
                placeholder="My Dashboard"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newPageName.trim() && !creating) {
                    handleCreatePage()
                  }
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="page-type">Page Type *</Label>
              <Select value={newPageType} onValueChange={(value: any) => setNewPageType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="interface">Interface Page</SelectItem>
                  <SelectItem value="view">View (Grid/Kanban/Calendar/Form)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newPageType === 'view' && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="view-type">View Type *</Label>
                  <Select value={newViewType} onValueChange={(value: any) => setNewViewType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grid">Grid</SelectItem>
                      <SelectItem value="kanban">Kanban</SelectItem>
                      <SelectItem value="calendar">Calendar</SelectItem>
                      <SelectItem value="form">Form</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="table">Table *</Label>
                  <Select value={newPageTableId} onValueChange={setNewPageTableId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a table" />
                    </SelectTrigger>
                    <SelectContent>
                      {tables.map((table) => (
                        <SelectItem key={table.id} value={table.id}>
                          {table.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewPageOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreatePage} disabled={creating || !newPageName.trim()}>
              {creating ? 'Creating...' : 'Create Page'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </>
  )
}
