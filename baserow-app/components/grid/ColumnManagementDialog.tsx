"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Edit, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase/client"
import type { TableField } from "@/types/fields"

interface ColumnManagementDialogProps {
  isOpen: boolean
  onClose: () => void
  field: TableField
  tableId: string
  onFieldUpdated?: () => void
}

export default function ColumnManagementDialog({
  isOpen,
  onClose,
  field,
  tableId,
  onFieldUpdated,
}: ColumnManagementDialogProps) {
  const [choices, setChoices] = useState<string[]>([])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState("")
  const [newChoice, setNewChoice] = useState("")

  useEffect(() => {
    if (isOpen && field) {
      setChoices(field.options?.choices || [])
      setEditingIndex(null)
      setEditValue("")
      setNewChoice("")
    }
  }, [isOpen, field])

  async function handleAddChoice() {
    if (!newChoice.trim()) return

    const updatedChoices = [...choices, newChoice.trim()]
    await saveChoices(updatedChoices)
    setNewChoice("")
  }

  async function handleDeleteChoice(index: number) {
    if (!confirm(`Are you sure you want to delete "${choices[index]}"?`)) {
      return
    }

    const updatedChoices = choices.filter((_, i) => i !== index)
    await saveChoices(updatedChoices)
  }

  async function handleSaveEdit() {
    if (editingIndex === null || !editValue.trim()) return

    const updatedChoices = [...choices]
    updatedChoices[editingIndex] = editValue.trim()
    await saveChoices(updatedChoices)
    setEditingIndex(null)
    setEditValue("")
  }

  async function saveChoices(newChoices: string[]) {
    try {
      const updatedOptions = {
        ...field.options,
        choices: newChoices,
      }

      await supabase
        .from("table_fields")
        .update({ options: updatedOptions })
        .eq("id", field.id)

      setChoices(newChoices)
      onFieldUpdated?.()
    } catch (error) {
      console.error("Error saving choices:", error)
      alert("Failed to save column changes")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Columns</DialogTitle>
          <DialogDescription>
            Configure column settings and visibility for this view.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label className="text-sm font-medium text-gray-700">
              Field: {field.name}
            </Label>
            <p className="text-xs text-gray-500 mt-1">
              Each option becomes a Kanban column
            </p>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {choices.map((choice, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200"
              >
                {editingIndex === index ? (
                  <>
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="flex-1 h-8 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSaveEdit()
                        } else if (e.key === "Escape") {
                          setEditingIndex(null)
                          setEditValue("")
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveEdit}
                      className="h-8"
                    >
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingIndex(null)
                        setEditValue("")
                      }}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-gray-900">{choice}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingIndex(index)
                        setEditValue(choice)
                      }}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteChoice(index)}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={newChoice}
              onChange={(e) => setNewChoice(e.target.value)}
              placeholder="New column name"
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddChoice()
                }
              }}
            />
            <Button onClick={handleAddChoice}>
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
