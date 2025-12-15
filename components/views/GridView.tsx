'use client'

import { useState } from 'react'
import { createClientSupabaseClient } from '@/lib/supabase'
import { updateRowClient } from '@/lib/data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import ViewToolbar from './ViewToolbar'
import FilterBar from './FilterBar'
import SortBar from './SortBar'
import type { ViewField, ViewFilter, ViewSort } from '@/types/database'

interface GridViewProps {
  tableId: string
  viewId: string
  rows: Record<string, any>[]
  visibleFields: ViewField[]
  filters: ViewFilter[]
  sorts: ViewSort[]
}

const ITEMS_PER_PAGE = 50

export default function GridView({
  tableId,
  viewId,
  rows,
  visibleFields,
  filters,
  sorts,
}: GridViewProps) {
  const [editingCell, setEditingCell] = useState<{
    rowId: string
    fieldName: string
  } | null>(null)
  const [editValue, setEditValue] = useState('')

  async function handleCellEdit(rowId: string, fieldName: string, value: any) {
    const supabase = createClientSupabaseClient()
    await updateRowClient(supabase, tableId, rowId, { [fieldName]: value })
    window.location.reload()
  }

  async function handleAddRow() {
    const supabase = createClientSupabaseClient()
    const { createRowClient } = await import('@/lib/data')
    await createRowClient(supabase, tableId, {})
    window.location.reload()
  }

  const startEdit = (rowId: string, fieldName: string, currentValue: any) => {
    setEditingCell({ rowId, fieldName })
    setEditValue(String(currentValue || ''))
  }

  const saveEdit = () => {
    if (editingCell) {
      handleCellEdit(editingCell.rowId, editingCell.fieldId, editValue)
      setEditingCell(null)
    }
  }

  return (
    <div className="w-full space-y-4">
      <ViewToolbar
        viewId={viewId}
        onAddRow={handleAddRow}
        showFilters={true}
        showSorts={true}
      />
      
      {filters.length > 0 && (
        <FilterBar viewId={viewId} filters={filters} />
      )}
      
      {sorts.length > 0 && (
        <SortBar viewId={viewId} sorts={sorts} />
      )}

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b bg-muted/50">
                {visibleFields.map((field) => (
                  <th
                    key={field.id}
                    className="px-4 py-2 text-left text-sm font-medium min-w-[150px]"
                  >
                    {field.field_name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b hover:bg-muted/50">
                  {visibleFields.map((field) => {
                    const isEditing =
                      editingCell?.rowId === row.id &&
                      editingCell?.fieldName === field.field_name
                    const value = row[field.field_name] || ''

                    return (
                      <td key={field.id} className="px-4 py-2">
                        {isEditing ? (
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit()
                              if (e.key === 'Escape') setEditingCell(null)
                            }}
                            autoFocus
                            className="h-8"
                          />
                        ) : (
                          <div
                            onClick={() => startEdit(row.id, field.field_name, value)}
                            className="min-h-[32px] flex items-center cursor-pointer hover:bg-muted/50 px-2 rounded"
                          >
                            {value || (
                              <span className="text-muted-foreground">Empty</span>
                            )}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
