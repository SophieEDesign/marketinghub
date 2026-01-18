"use client"

import { useState, useEffect } from "react"
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
import { FIELD_TYPES } from "@/types/fields"

interface GroupDialogProps {
  isOpen: boolean
  onClose: () => void
  viewId: string
  tableFields: TableField[]
  groupBy?: string
  onGroupChange?: (fieldName: string | null) => void
}

export default function GroupDialog({
  isOpen,
  onClose,
  viewId,
  tableFields,
  groupBy,
  onGroupChange,
}: GroupDialogProps) {
  const [selectedField, setSelectedField] = useState<string>(groupBy || "")

  useEffect(() => {
    setSelectedField(groupBy || "")
  }, [groupBy, isOpen])

  // Filter fields that can be grouped (not formula, not lookup)
  const groupableFields = tableFields.filter(
    (f) => f.type !== "formula" && f.type !== "lookup"
  )

  async function handleSave() {
    try {
      // Update grid view settings instead of views.config
      const groupByValue = selectedField === "__none__" ? null : selectedField
      
      // Check if settings exist
      const { data: existing } = await supabase
        .from("grid_view_settings")
        .select("id")
        .eq("view_id", viewId)
        .single()

      if (existing) {
        // Update existing settings
        await supabase
          .from("grid_view_settings")
          .update({ group_by_field: groupByValue })
          .eq("view_id", viewId)
      } else {
        // Create new settings
        await supabase
          .from("grid_view_settings")
          .insert([
            {
              view_id: viewId,
              group_by_field: groupByValue,
              column_widths: {},
              column_order: [],
              column_wrap_text: {},
              row_height: 'standard',
              frozen_columns: 0,
            },
          ])
      }

      onGroupChange?.(groupByValue)
      onClose()
    } catch (error) {
      console.error("Error saving group:", error)
      alert("Failed to save group setting")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Group Records</DialogTitle>
          <DialogDescription>
            Select a field to group records by. Records with the same value will be grouped together.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label className="text-sm font-medium text-gray-700">Group by Field</Label>
            <Select value={selectedField || "__none__"} onValueChange={(value) => setSelectedField(value === "__none__" ? "" : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a field to group by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No grouping</SelectItem>
                {groupableFields.map((field) => (
                  <SelectItem key={field.id} value={field.name}>
                    {field.name} ({FIELD_TYPES.find(t => t.type === field.type)?.label})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Apply Grouping
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
