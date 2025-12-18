"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase/client"
import type { TableField } from "@/types/fields"
import { FIELD_TYPES } from "@/types/fields"

interface HideFieldsDialogProps {
  isOpen: boolean
  onClose: () => void
  viewId: string
  tableFields: TableField[]
  viewFields: Array<{
    field_name: string
    visible: boolean
    position: number
  }>
  hiddenFields: string[]
  onHiddenFieldsChange?: (fields: string[]) => void
}

export default function HideFieldsDialog({
  isOpen,
  onClose,
  viewId,
  tableFields,
  viewFields,
  hiddenFields,
  onHiddenFieldsChange,
}: HideFieldsDialogProps) {
  const [localHiddenFields, setLocalHiddenFields] = useState<string[]>(hiddenFields)

  useEffect(() => {
    setLocalHiddenFields(hiddenFields)
  }, [hiddenFields, isOpen])

  function toggleField(fieldName: string) {
    if (localHiddenFields.includes(fieldName)) {
      setLocalHiddenFields(localHiddenFields.filter(f => f !== fieldName))
    } else {
      setLocalHiddenFields([...localHiddenFields, fieldName])
    }
  }

  async function handleSave() {
    try {
      // Update view_fields visibility
      const updates = viewFields.map((vf) => ({
        field_name: vf.field_name,
        visible: !localHiddenFields.includes(vf.field_name),
      }))

      await Promise.all(
        updates.map((update) =>
          supabase
            .from("view_fields")
            .update({ visible: update.visible })
            .eq("view_id", viewId)
            .eq("field_name", update.field_name)
        )
      )

      onHiddenFieldsChange?.(localHiddenFields)
      onClose()
    } catch (error) {
      console.error("Error saving hidden fields:", error)
      alert("Failed to save field visibility")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Hide Fields</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-4 max-h-96 overflow-y-auto">
          {viewFields.map((vf) => {
            const field = tableFields.find((f) => f.name === vf.field_name)
            const isHidden = localHiddenFields.includes(vf.field_name)

            return (
              <div key={vf.field_name} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded">
                <input
                  type="checkbox"
                  id={`hide-${vf.field_name}`}
                  checked={isHidden}
                  onChange={() => toggleField(vf.field_name)}
                  className="w-4 h-4"
                />
                <Label
                  htmlFor={`hide-${vf.field_name}`}
                  className="flex-1 text-sm font-medium text-gray-700 cursor-pointer"
                >
                  {vf.field_name}
                </Label>
                {field && (
                  <span className="text-xs text-gray-500">
                    {FIELD_TYPES.find(t => t.type === field.type)?.label}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Apply
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
