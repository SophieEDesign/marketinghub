"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Edit, Copy, Trash2, FileText, Grid, Calendar, Columns, FileEdit, Settings } from 'lucide-react'
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
  updated_at?: string
  created_at?: string
  page_type?: string // For interface_pages
  is_interface_page?: boolean // Flag to distinguish interface_pages from views
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
  const [newPageType, setNewPageType] = useState<'interface' | 'grid' | 'kanban' | 'calendar' | 'form'>('interface')
  const [newPageTableId, setNewPageTableId] = useState<string>('')
  const [newPageIsAdminOnly, setNewPageIsAdminOnly] = useState(false)
  const [tables, setTables] = useState<Array<{ id: string; name: string }>>([])
  const [creating, setCreating] = useState(false)
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false)
  const [selectedPageForSettings, setSelectedPageForSettings] = useState<string | null>(null)

  useEffect(() => {
    loadPages()
    loadTables()
  }, [])

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
      
      // Load interface pages from interface_pages table (new system)
      const { data: interfacePages, error: interfacePagesError } = await supabase
        .from('interface_pages')
        .select('id, name, page_type, updated_at, created_at')
        .order('updated_at', { ascending: false })

      // Load all views from views table (including old interface pages with type='interface')
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

      // Convert interface_pages to Page format
      const interfacePagesList: Page[] = (interfacePages || []).map((page: any) => ({
        id: page.id,
        name: page.name,
        type: 'interface' as const,
        page_type: page.page_type,
        is_interface_page: true,
        tableId: null,
        tableName: undefined,
        updated_at: page.updated_at,
        created_at: page.created_at,
      }))

      // Convert views to Page format
      const viewsList: Page[] = (views || []).map((view: any) => {
        const tableName = view.table_id ? tableMap.get(view.table_id) : undefined
        // For non-interface views, include table name in display name if it's generic
        let displayName = view.name
        if (view.type !== 'interface' && tableName && (view.name === 'All Records' || view.name.toLowerCase().includes('all records'))) {
          displayName = `${view.name} (${tableName})`
        }
        
        return {
          id: view.id,
          name: view.name,
          displayName: displayName,
          type: view.type === 'interface' ? 'interface' : (view.type as 'grid' | 'kanban' | 'calendar' | 'form'),
          tableId: view.table_id,
          tableName: tableName,
          is_interface_page: false,
          updated_at: view.updated_at,
          created_at: view.created_at,
        }
      })

      // Separate interfaces and views
      const allInterfaces = [...interfacePagesList, ...viewsList.filter(p => p.type === 'interface')]
      const tableViews = viewsList.filter(p => p.type !== 'interface')
      
      // Sort each group by updated_at descending
      allInterfaces.sort((a, b) => {
        const aDate = a.updated_at || a.created_at || ''
        const bDate = b.updated_at || b.created_at || ''
        return bDate.localeCompare(aDate)
      })
      
      tableViews.sort((a, b) => {
        const aDate = a.updated_at || a.created_at || ''
        const bDate = b.updated_at || b.created_at || ''
        return bDate.localeCompare(aDate)
      })

      // Combine: interfaces first, then views
      setPages([...allInterfaces, ...tableViews])
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

      if (newPageType !== 'interface' && !newPageTableId) {
        alert('Please select a table for the view')
        return
      }

    setCreating(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (newPageType === 'interface') {
        // Create interface page as a view with type='interface'
        const { data, error } = await supabase
          .from('views')
          .insert([
            {
              name: newPageName.trim(),
              type: 'interface',
              table_id: null, // Interface pages don't belong to a table
              config: {
                access: 'authenticated',
                layout: { cols: 12, rowHeight: 30, margin: [10, 10] },
              },
              owner_id: user?.id,
              access_level: 'authenticated',
              is_admin_only: newPageIsAdminOnly,
            },
          ])
          .select()
          .single()

        if (error) throw error

        // Redirect to pages route (not interface route)
        router.push(`/pages/${data.id}`)
      } else {
        // Create view (grid, kanban, calendar, or form)
        const { data, error } = await supabase
          .from('views')
          .insert([
            {
              table_id: newPageTableId,
              name: newPageName.trim(),
              type: newPageType, // grid, kanban, calendar, or form
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
      setNewPageTableId('')
      setNewPageIsAdminOnly(false)
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
      const supabase = createClient()

      // All pages are in views table
      const { error } = await supabase
        .from('views')
        .delete()
        .eq('id', pageToDelete.id)

      if (error) throw error
      
      // If it was an interface page, blocks will be cascade deleted via view_blocks foreign key

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
                <CardTitle>Interfaces</CardTitle>
                <CardDescription>Manage your interface pages and views</CardDescription>
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
              <p className="text-sm">No pages yet. Create your first page to get started.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Interfaces Section */}
              {pages.filter(p => p.type === 'interface').length > 0 && (
                <div className="space-y-2">
                  <div className="px-4 py-2">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Interface Pages
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">Custom dashboard pages with blocks and widgets</p>
                  </div>
                  <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b">
                    <div className="col-span-4">Name</div>
                    <div className="col-span-2">Type</div>
                    <div className="col-span-2">Table</div>
                    <div className="col-span-2">Last Updated</div>
                    <div className="col-span-2 text-right">Actions</div>
                  </div>
                  {pages.filter(p => p.type === 'interface').map((page) => {
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
                  })}
                </div>
              )}

              {/* Views Section */}
              {pages.filter(p => p.type !== 'interface').length > 0 && (
                <div className="space-y-2">
                  <div className="px-4 py-2">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Table Views
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">Grid, Kanban, Calendar, and Form views for your tables</p>
                  </div>
                  <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b">
                    <div className="col-span-4">Name</div>
                    <div className="col-span-2">Type</div>
                    <div className="col-span-2">Table</div>
                    <div className="col-span-2">Last Updated</div>
                    <div className="col-span-2 text-right">Actions</div>
                  </div>
                  {pages.filter(p => p.type !== 'interface').map((page) => {
                    const Icon = getPageTypeIcon(page)
                    return (
                      <div
                        key={page.id}
                        className="grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-gray-50 rounded-md transition-colors border-b"
                      >
                        <div className="col-span-4 flex items-center gap-2">
                          <Icon className="h-4 w-4 text-gray-400" />
                          <span className="font-medium">{page.displayName || page.name}</span>
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
            </div>
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
            <DialogTitle>Delete Interface</DialogTitle>
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
