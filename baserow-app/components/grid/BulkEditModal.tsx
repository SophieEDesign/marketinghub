"use client"

import { useState, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { TableField } from "@/types/fields"
import { FIELD_TYPES } from "@/types/fields"
import RichTextEditor from "@/components/fields/RichTextEditor"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { useOperationFeedback } from "@/hooks/useOperationFeedback"

interface BulkEditModalProps {
  isOpen: boolean
  onClose: () => void
  selectedCount: number
  tableName: string
  tableFields: TableField[]
  userRole?: "admin" | "editor" | "viewer" | null
  onSave: (updates: Record<string, any>) => Promise<void>
  onDelete?: () => Promise<void>
}

type Operation = "set" | "clear" | "append" | "add" | "remove"

export default function BulkEditModal({
  isOpen,
  onClose,
  selectedCount,
  tableName,
  tableFields,
  userRole = "editor",
  onSave,
  onDelete,
}: BulkEditModalProps) {
  const { handleError, handleSuccess } = useOperationFeedback({
    errorTitle: "Bulk Edit Failed",
    successTitle: "Bulk Edit Successful",
  })
  const [selectedFieldName, setSelectedFieldName] = useState<string>("")
  const [operation, setOperation] = useState<Operation>("set")
  const [value, setValue] = useState<any>("")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Filter editable fields based on permissions
  const editableFields = useMemo(() => {
    return tableFields.filter((field) => {
      // Exclude virtual fields
      const fieldTypeInfo = FIELD_TYPES.find((t) => t.type === field.type)
      if (fieldTypeInfo?.isVirtual) return false

      // Exclude read-only fields
      if (field.options?.read_only) return false

      // Admin can edit all editable fields
      if (userRole === "admin") return true

      // Editor can edit non-read-only fields
      if (userRole === "editor") return true

      // Viewer cannot edit
      return false
    })
  }, [tableFields, userRole])

  const selectedField = editableFields.find((f) => f.name === selectedFieldName)
  const canDelete = userRole === "admin"

  // Get available operations for the selected field type
  const availableOperations = useMemo(() => {
    if (!selectedField) return []

    const ops: Operation[] = ["set", "clear"]

    switch (selectedField.type) {
      case "text":
      case "long_text":
      case "url":
      case "email":
        ops.push("append")
        break
      case "multi_select":
        ops.push("add", "remove")
        break
    }

    return ops
  }, [selectedField])

  // Reset form when field changes
  const handleFieldChange = (fieldName: string) => {
    setSelectedFieldName(fieldName)
    setOperation("set")
    setValue("")
  }

  const handleSave = async () => {
    if (!selectedFieldName) {
      handleError(new Error("Please select a field"), "Validation Error", "Please select a field to edit")
      return
    }

    if (operation === "set" && value === "" && selectedField?.type !== "checkbox") {
      handleError(new Error("Please enter a value"), "Validation Error", "Please enter a value")
      return
    }

    setSaving(true)
    try {
      const updates: Record<string, any> = {}

      if (operation === "clear") {
        updates[selectedFieldName] = null
      } else if (operation === "set") {
        updates[selectedFieldName] = value
      } else if (operation === "append") {
        updates[selectedFieldName] = { __append: value }
      } else if (operation === "add") {
        updates[selectedFieldName] = { __add: Array.isArray(value) ? value : [value] }
      } else if (operation === "remove") {
        updates[selectedFieldName] = { __remove: Array.isArray(value) ? value : [value] }
      }

      await onSave(updates)
      handleSuccess("Bulk Edit Complete", `Successfully updated ${selectedCount} record${selectedCount !== 1 ? "s" : ""}`)
      onClose()
    } catch (error: any) {
      console.error("Error saving bulk edit:", error)
      handleError(error, "Bulk Edit Failed", error.message || "Failed to save changes")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return
    setShowDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    if (!onDelete) return

    setDeleting(true)
    try {
      await onDelete()
      handleSuccess("Records Deleted", `Successfully deleted ${selectedCount} record${selectedCount !== 1 ? "s" : ""}`)
      onClose()
    } catch (error: any) {
      console.error("Error deleting records:", error)
      handleError(error, "Delete Failed", error.message || "Failed to delete records")
    } finally {
      setDeleting(false)
    }
  }

  // Render field-specific input
  const renderFieldInput = () => {
    if (!selectedField) return null

    switch (selectedField.type) {
      case "checkbox":
        return (
          <div className="space-y-2">
            <Label>Value</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="checkbox-true"
                checked={value === true}
                onCheckedChange={(checked) => setValue(checked === true)}
              />
              <Label htmlFor="checkbox-true" className="cursor-pointer">
                True
              </Label>
              <Checkbox
                id="checkbox-false"
                checked={value === false}
                onCheckedChange={(checked) => setValue(checked === false)}
                className="ml-4"
              />
              <Label htmlFor="checkbox-false" className="cursor-pointer">
                False
              </Label>
            </div>
          </div>
        )

      case "single_select":
        const choices = selectedField.options?.choices || []
        return (
          <div className="space-y-2">
            <Label>Value</Label>
            <Select value={value} onValueChange={setValue}>
              <SelectTrigger>
                <SelectValue placeholder="Select a value" />
              </SelectTrigger>
              <SelectContent>
                {choices.map((choice: string) => (
                  <SelectItem key={choice} value={choice}>
                    {choice}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )

      case "multi_select":
        const multiChoices = selectedField.options?.choices || []
        if (operation === "add" || operation === "remove") {
          return (
            <div className="space-y-2">
              <Label>Values</Label>
              <div className="space-y-2 max-h-40 overflow-y-auto border rounded p-2">
                {multiChoices.map((choice: string) => (
                  <div key={choice} className="flex items-center space-x-2">
                    <Checkbox
                      id={`choice-${choice}`}
                      checked={Array.isArray(value) && value.includes(choice)}
                      onCheckedChange={(checked) => {
                        const current = Array.isArray(value) ? value : []
                        if (checked) {
                          setValue([...current, choice])
                        } else {
                          setValue(current.filter((v) => v !== choice))
                        }
                      }}
                    />
                    <Label htmlFor={`choice-${choice}`} className="cursor-pointer">
                      {choice}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )
        }
        return null

      case "date":
        return (
          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              type="date"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
        )

      case "number":
      case "percent":
      case "currency":
        return (
          <div className="space-y-2">
            <Label>Number</Label>
            <Input
              type="number"
              value={value}
              onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
            />
          </div>
        )

      case "long_text":
        return (
          <div className="space-y-2">
            <Label>Text</Label>
            <RichTextEditor
              value={value}
              onChange={setValue}
              editable={true}
              showToolbar={true}
              minHeight="150px"
            />
          </div>
        )

      default:
        return (
          <div className="space-y-2">
            <Label>Value</Label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter value"
            />
          </div>
        )
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Edit {selectedCount} Records</DialogTitle>
          <DialogDescription>
            Update multiple records at once. Only the selected field will be changed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Field Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Select Field</Label>
            <Select value={selectedFieldName} onValueChange={handleFieldChange}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a field to edit" />
              </SelectTrigger>
              <SelectContent>
                {editableFields.map((field) => (
                  <SelectItem key={field.id} value={field.name}>
                    {field.name} ({FIELD_TYPES.find((t) => t.type === field.type)?.label || field.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Operation Selection */}
          {selectedField && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Operation</Label>
              <RadioGroup value={operation} onValueChange={(v) => setOperation(v as Operation)}>
                {availableOperations.map((op) => (
                  <div key={op} className="flex items-center space-x-2">
                    <RadioGroupItem value={op} id={`op-${op}`} />
                    <Label htmlFor={`op-${op}`} className="cursor-pointer capitalize">
                      {op === "set" && "Set value"}
                      {op === "clear" && "Clear value"}
                      {op === "append" && "Append text"}
                      {op === "add" && "Add values"}
                      {op === "remove" && "Remove values"}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Field Input */}
          {selectedField && operation !== "clear" && renderFieldInput()}

          {/* Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>You are about to update {selectedCount} record{selectedCount !== 1 ? "s" : ""}.</strong>
            </p>
            {selectedField && (
              <p className="text-sm text-blue-700 mt-1">
                Field: <strong>{selectedField.name}</strong> will be {operation === "set" ? "set to" : operation === "clear" ? "cleared" : operation === "append" ? "appended with" : operation === "add" ? "added with" : "removed from"}{" "}
                {operation !== "clear" && <strong>{typeof value === "object" ? JSON.stringify(value) : String(value)}</strong>}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          {canDelete && onDelete && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={saving || deleting}
              className="mr-auto"
            >
              {deleting ? "Deleting..." : `Delete ${selectedCount} Record${selectedCount !== 1 ? "s" : ""}`}
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || deleting || !selectedFieldName}>
            {saving ? "Saving..." : `Apply to ${selectedCount} Record${selectedCount !== 1 ? "s" : ""}`}
          </Button>
        </div>
      </DialogContent>
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={confirmDelete}
        title="Delete Records"
        description={`Are you sure you want to delete ${selectedCount} record${selectedCount !== 1 ? "s" : ""}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        loading={deleting}
      />
    </Dialog>
  )
}

