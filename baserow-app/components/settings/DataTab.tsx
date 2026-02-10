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
import { Plus, Table2, Trash2, Edit2, Check, X, Upload, Download } from 'lucide-react'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import CSVImportModal from '@/components/layout/CSVImportModal'

interface Table {
  id: string
  name: string
  created_at: string
  supabase_table: string
}

export default function SettingsDataTab() {
  const router = useRouter()
  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [tableToDelete, setTableToDelete] = useState<Table | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editingTableId, setEditingTableId] = useState<string | null>(null)
  const [editingTableName, setEditingTableName] = useState<string>('')
  const [savingName, setSavingName] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [tableToImport, setTableToImport] = useState<Table | null>(null)
  const [selectTableDialogOpen, setSelectTableDialogOpen] = useState(false)
  const [exportingTableId, setExportingTableId] = useState<string | null>(null)

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
        .select('id, name, created_at, supabase_table')
        .order('created_at', { ascending: false })

      if (tablesError) throw tablesError

      setTables(tablesData || [])
    } catch (error) {
      console.error('Error loading tables:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleNewTable() {
    const name = prompt("Enter table name:")
    if (!name) return

    try {
      const supabase = createClient()
      
      // Generate a unique table name for the Supabase table
      const sanitizedName = name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
      const timestamp = Date.now()
      const supabaseTableName = `table_${sanitizedName}_${timestamp}`

      // Create the table metadata record
      const { data, error: insertError } = await supabase
        .from("tables")
        .insert([
          {
            name,
            supabase_table: supabaseTableName,
          },
        ])
        .select()
        .single()

      if (insertError) {
        console.error("Error creating table:", insertError)
        alert(`Failed to create table: ${insertError.message || 'Unknown error'}`)
        return
      }

      // Try to create the actual Supabase table
      try {
        const createResponse = await fetch('/api/tables/create-table', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tableName: supabaseTableName })
        })
        
        const createResult = await createResponse.json()
        
        if (!createResult.success) {
          console.warn('Supabase table creation:', createResult.message || createResult.error)
          // Don't fail the whole operation - table metadata is created
          // User can create the table manually if needed
        }
      } catch (createError) {
        console.warn('Failed to create Supabase table automatically:', createError)
        // Continue anyway - table metadata is created
      }

      router.refresh()
      loadTables()
    } catch (error: any) {
      console.error("Error creating table:", error)
      alert(`Failed to create table: ${error.message || 'Unknown error'}`)
    }
  }


  function handleDeleteClick(table: Table) {
    setTableToDelete(table)
    setDeleteDialogOpen(true)
  }

  function handleEditClick(table: Table, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setEditingTableId(table.id)
    setEditingTableName(table.name)
  }

  function handleCancelEdit() {
    setEditingTableId(null)
    setEditingTableName('')
    setSavingName(false)
  }

  async function handleSaveName() {
    if (!editingTableId || !editingTableName.trim()) {
      handleCancelEdit()
      return
    }

    setSavingName(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('tables')
        .update({ name: editingTableName.trim() })
        .eq('id', editingTableId)

      if (error) {
        throw error
      }

      // Update local state
      setTables(prev => prev.map(t => 
        t.id === editingTableId ? { ...t, name: editingTableName.trim() } : t
      ))

      setEditingTableId(null)
      setEditingTableName('')
      router.refresh()
    } catch (error: any) {
      console.error('Error updating table name:', error)
      alert(`Failed to update table name: ${error.message || 'Unknown error'}`)
    } finally {
      setSavingName(false)
    }
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

  function handleImportClick(table: Table, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setTableToImport(table)
    setImportModalOpen(true)
  }

  async function handleExportClick(table: Table, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    try {
      setExportingTableId(table.id)
      const res = await fetch(`/api/tables/${table.id}/export-csv`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to export CSV')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${table.name || 'table'}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (error: any) {
      console.error('Error exporting CSV:', error)
      alert(error.message || 'Failed to export CSV')
    } finally {
      setExportingTableId(null)
    }
  }

  function handleImportComplete() {
    setImportModalOpen(false)
    setTableToImport(null)
    router.refresh()
  }

  function handleImportCSVClick() {
    if (tables.length === 0) {
      alert('No tables available. Please create a table first.')
      return
    }
    setSelectTableDialogOpen(true)
  }

  function handleSelectTableForImport(table: Table) {
    setTableToImport(table)
    setSelectTableDialogOpen(false)
    setImportModalOpen(true)
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
            <CardTitle>Data</CardTitle>
            <CardDescription>Raw data management</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleImportCSVClick} disabled={tables.length === 0}>
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
            <Button onClick={handleNewTable}>
              <Plus className="h-4 w-4 mr-2" />
              New Table
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            <strong>Admin / Power User Only:</strong> Changes here affect all Interfaces and Pages.
          </p>
        </div>
        {tables.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground border border-dashed rounded-lg">
            <p className="text-sm mb-2">No tables found</p>
            <p className="text-xs">Create your first table to get started.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {tables.map((table) => (
              <div key={table.id} className="group border rounded-lg p-2 hover:bg-gray-50 relative">
                <div className="flex items-center">
                  <Table2 className="h-4 w-4 text-gray-500 mr-2" />
                  {editingTableId === table.id ? (
                    <div className="flex-1 flex items-center gap-2">
                      <Input
                        value={editingTableName}
                        onChange={(e) => setEditingTableName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveName()
                          } else if (e.key === 'Escape') {
                            handleCancelEdit()
                          }
                        }}
                        className="h-7 text-sm"
                        autoFocus
                        disabled={savingName}
                      />
                      <button
                        onClick={handleSaveName}
                        disabled={savingName}
                        className="p-1 hover:bg-green-100 rounded transition-all text-green-600 hover:text-green-700 disabled:opacity-50"
                        title="Save"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={savingName}
                        className="p-1 hover:bg-gray-100 rounded transition-all text-gray-600 hover:text-gray-700 disabled:opacity-50"
                        title="Cancel"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Link
                        href={`/tables/${table.id}`}
                        className="flex-1 text-sm font-medium text-gray-700 hover:text-gray-900"
                      >
                        {table.name}
                      </Link>
                      <button
                        onClick={(e) => handleExportClick(table, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-emerald-100 rounded transition-all text-emerald-600 hover:text-emerald-700"
                        title={exportingTableId === table.id ? 'Exporting...' : 'Export CSV'}
                        disabled={exportingTableId === table.id}
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => handleImportClick(table, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-blue-100 rounded transition-all text-blue-600 hover:text-blue-700"
                        title="Import CSV"
                      >
                        <Upload className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => handleEditClick(table, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition-all text-gray-600 hover:text-gray-700"
                        title="Edit table name"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
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
                    </>
                  )}
                </div>
              </div>
            ))}
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

      {/* Select Table Dialog */}
      <Dialog open={selectTableDialogOpen} onOpenChange={setSelectTableDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Table to Import CSV</DialogTitle>
            <DialogDescription>
              Choose which table you want to import CSV data into.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {tables.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No tables available. Create a table first.
              </p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {tables.map((table) => (
                  <button
                    key={table.id}
                    onClick={() => handleSelectTableForImport(table)}
                    className="w-full text-left p-3 border rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <Table2 className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">{table.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectTableDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Modal */}
      {tableToImport && (
        <CSVImportModal
          open={importModalOpen}
          onOpenChange={setImportModalOpen}
          tableId={tableToImport.id}
          tableName={tableToImport.name}
          supabaseTableName={tableToImport.supabase_table}
          onImportComplete={handleImportComplete}
        />
      )}
    </Card>
  )
}
