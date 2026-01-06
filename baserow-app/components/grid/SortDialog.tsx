"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, ArrowUp, ArrowDown, GripVertical } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase/client"
import type { TableField } from "@/types/fields"

interface SortDialogProps {
  isOpen: boolean
  onClose: () => void
  viewId: string
  tableFields: TableField[]
  sorts: Array<{
    id: string
    field_name: string
    direction: string
  }>
  onSortsChange?: (sorts: Array<{ id?: string; field_name: string; direction: string }>) => void
}

export default function SortDialog({
  isOpen,
  onClose,
  viewId,
  tableFields,
  sorts,
  onSortsChange,
}: SortDialogProps) {
  const [localSorts, setLocalSorts] = useState(sorts)

  useEffect(() => {
    setLocalSorts(sorts)
  }, [sorts, isOpen])

  function addSort() {
    setLocalSorts([
      ...localSorts,
      {
        id: `temp-${Date.now()}`,
        field_name: tableFields[0]?.name || "",
        direction: "asc",
      },
    ])
  }

  function removeSort(index: number) {
    setLocalSorts(localSorts.filter((_, i) => i !== index))
  }

  function updateSort(index: number, updates: Partial<typeof localSorts[0]>) {
    const newSorts = [...localSorts]
    newSorts[index] = { ...newSorts[index], ...updates }
    setLocalSorts(newSorts)
  }

  function moveSort(fromIndex: number, toIndex: number) {
    const newSorts = [...localSorts]
    const [removed] = newSorts.splice(fromIndex, 1)
    newSorts.splice(toIndex, 0, removed)
    setLocalSorts(newSorts)
  }

  async function handleSave() {
    try {
      // Delete existing sorts
      await supabase.from("view_sorts").delete().eq("view_id", viewId)

      // Insert new sorts with order_index
      if (localSorts.length > 0) {
        const sortsToInsert = localSorts
          .filter(s => s.field_name)
          .map((sort, index) => ({
            view_id: viewId,
            field_name: sort.field_name,
            direction: sort.direction,
            order_index: index,
          }))

        if (sortsToInsert.length > 0) {
          await supabase.from("view_sorts").insert(sortsToInsert)
        }
      }

      onSortsChange?.(localSorts)
      onClose()
    } catch (error) {
      console.error("Error saving sorts:", error)
      alert("Failed to save sorts")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" aria-describedby="sort-dialog-description">
        <DialogHeader>
          <DialogTitle>Sort Records</DialogTitle>
          <DialogDescription id="sort-dialog-description">
            Configure how records are sorted in this view.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {localSorts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No sorts applied</p>
              <p className="text-xs mt-1">Add a sort to organize your records</p>
            </div>
          ) : (
            localSorts.map((sort, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="text-xs text-gray-500 font-medium w-8">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <Select
                      value={sort.field_name}
                      onValueChange={(value) => updateSort(index, { field_name: value })}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {tableFields.map((field) => (
                          <SelectItem key={field.id} value={field.name}>
                            {field.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-32">
                    <Select
                      value={sort.direction}
                      onValueChange={(value) => updateSort(index, { direction: value })}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asc">
                          <div className="flex items-center gap-2">
                            <ArrowUp className="h-3.5 w-3.5" />
                            Ascending
                          </div>
                        </SelectItem>
                        <SelectItem value="desc">
                          <div className="flex items-center gap-2">
                            <ArrowDown className="h-3.5 w-3.5" />
                            Descending
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-1">
                    {index > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveSort(index, index - 1)}
                        className="h-7 w-7 p-0"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {index < localSorts.length - 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveSort(index, index + 1)}
                        className="h-7 w-7 p-0"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSort(index)}
                      className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={addSort}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Sort
          </Button>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Apply Sorts
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
