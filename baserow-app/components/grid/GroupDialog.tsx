"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
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
      // Update view config
      const { data: viewData } = await supabase
        .from("views")
        .select("config")
        .eq("id", viewId)
        .single()

      const currentConfig = (viewData?.config as Record<string, any>) || {}
      const newConfig = {
        ...currentConfig,
        groupBy: selectedField || null,
      }

      await supabase
        .from("views")
        .update({ config: newConfig })
        .eq("id", viewId)

      onGroupChange?.(selectedField || null)
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
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label className="text-sm font-medium text-gray-700">Group by Field</Label>
            <p className="text-xs text-gray-500 mt-1 mb-3">
              Select a field to group records by. Records with the same value will be grouped together.
            </p>
            <Select value={selectedField} onValueChange={setSelectedField}>
              <SelectTrigger>
                <SelectValue placeholder="Select a field to group by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No grouping</SelectItem>
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
