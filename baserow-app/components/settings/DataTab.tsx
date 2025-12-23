"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Table2, ChevronRight, ChevronDown, Grid3x3, FileText, Calendar, Layout, Trash2 } from 'lucide-react'
import Link from 'next/link'

interface Table {
  id: string
  name: string
  created_at: string
}

interface View {
  id: string
  name: string
  type: string
  table_id: string
}

export default function SettingsDataTab() {
  const router = useRouter()
  const [tables, setTables] = useState<Table[]>([])
  const [viewsByTable, setViewsByTable] = useState<Record<string, View[]>>({})
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [tableToDelete, setTableToDelete] = useState<Table | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadTables()
  }, [])

  async function loadTables() {
    setLoading(true)
    try {
      const supabase = createClient()
      
      // Load all tables
      const { data: tablesData, error: tablesError } = await supabase
        .from('tables')
        .select('id, name, created_at')
        .order('created_at', { ascending: false })

      if (tablesError) throw tablesError

      setTables(tablesData || [])

      // Load views for each table
      const viewsMap: Record<string, View[]> = {}
      await Promise.all(
        (tablesData || []).map(async (table) => {
          const { data: viewsData, error: viewsError } = await supabase
            .from('views')
            .select('id, name, type, table_id')
            .eq('table_id', table.id)
            .order('created_at', { ascending: true })

          if (!viewsError && viewsData) {
            viewsMap[table.id] = viewsData
          }
        })
      )

      setViewsByTable(viewsMap)
    } catch (error) {
      console.error('Error loading tables:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleNewTable() {
    const name = prompt("Enter table name:")
    if (!name) return

    const supabase = createClient()
    const { data, error } = await supabase
      .from("tables")
      .insert([{ name }])
      .select()
      .single()

    if (error) {
      console.error("Error creating table:", error)
      alert("Failed to create table")
    } else {
      router.refresh()
      loadTables()
    }
  }

  async function handleNewView(tableId: string) {
    const name = prompt("Enter view name:")
    if (!name) return

    const supabase = createClient()
    const { data, error } = await supabase
      .from("views")
      .insert([{ 
        table_id: tableId,
        name,
        type: "grid"
      }])
      .select()
      .single()

    if (error) {
      console.error("Error creating view:", error)
      alert("Failed to create view")
    } else {
      router.refresh()
      loadTables()
    }
  }

  function toggleTable(tableId: string) {
    setExpandedTables(prev => {
      const next = new Set(prev)
      if (next.has(tableId)) {
        next.delete(tableId)
      } else {
        next.add(tableId)
      }
      return next
    })
  }

  function handleDeleteClick(table: Table) {
    setTableToDelete(table)
    setDeleteDialogOpen(true)
  }

  async function handleDelete() {
    if (!tableToDelete) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/tables/${tableToDelete.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to delete table')
      }

      // Refresh the list
      await loadTables()
      setDeleteDialogOpen(false)
      setTableToDelete(null)
      router.refresh()
    } catch (error: any) {
      console.error('Error deleting table:', error)
      alert(`Failed to delete table: ${error.message || 'Unknown error'}`)
    } finally {
      setDeleting(false)
    }
  }

  function getViewIcon(type: string) {
    switch (type) {
      case "grid":
        return <Grid3x3 className="h-3.5 w-3.5" />
      case "form":
        return <FileText className="h-3.5 w-3.5" />
      case "kanban":
        return <Layout className="h-3.5 w-3.5" />
      case "calendar":
        return <Calendar className="h-3.5 w-3.5" />
      default:
        return <Grid3x3 className="h-3.5 w-3.5" />
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading tables...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Core Data</CardTitle>
            <CardDescription>Manage your data tables and views</CardDescription>
          </div>
          <Button onClick={handleNewTable}>
            <Plus className="h-4 w-4 mr-2" />
            New Table
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {tables.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground border border-dashed rounded-lg">
            <p className="text-sm mb-2">No tables found</p>
            <p className="text-xs">Create your first table to get started.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {tables.map((table) => {
              const isExpanded = expandedTables.has(table.id)
              const tableViews = viewsByTable[table.id] || []

              return (
                <div key={table.id} className="group border rounded-lg p-2 hover:bg-gray-50 relative">
                  <div className="flex items-center">
                    <button
                      onClick={() => toggleTable(table.id)}
                      className="p-1 hover:bg-gray-100 rounded transition-colors mr-2"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-500" />
                      )}
                    </button>
                    <Table2 className="h-4 w-4 text-gray-500 mr-2" />
                    <Link
                      href={`/tables/${table.id}`}
                      className="flex-1 text-sm font-medium text-gray-700 hover:text-gray-900"
                    >
                      {table.name}
                    </Link>
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleDeleteClick(table)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all text-red-600 hover:text-red-700"
                      title="Delete table"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="ml-8 mt-2 space-y-1">
                      {tableViews.map((view) => (
                        <Link
                          key={view.id}
                          href={`/tables/${table.id}/views/${view.id}`}
                          className="flex items-center gap-2 px-2 py-1.5 rounded transition-colors text-gray-600 hover:bg-gray-100 text-sm"
                        >
                          {getViewIcon(view.type)}
                          <span>{view.name}</span>
                        </Link>
                      ))}
                      <button
                        onClick={() => handleNewView(table.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>New View</span>
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Table</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{tableToDelete?.name}&quot;? This will permanently delete the table, all its data, views, and fields. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
