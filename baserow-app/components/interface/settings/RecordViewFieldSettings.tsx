"use client"

/**
 * Record View Field Settings Component
 * 
 * Allows users to configure which fields appear in the Record Field Panel,
 * their order, and editability.
 */

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { GripVertical, Trash2, Plus } from "lucide-react"
import type { TableField } from "@/types/fields"

interface FieldConfig {
  field: string // Field name or ID
  editable: boolean
  order?: number
}

interface RecordViewFieldSettingsProps {
  tableId: string | null
  fields: FieldConfig[]
  allFields: TableField[]
  onChange: (fields: FieldConfig[]) => void
}

export default function RecordViewFieldSettings({
  tableId,
  fields,
  allFields,
  onChange,
}: RecordViewFieldSettingsProps) {
  const [localFields, setLocalFields] = useState<FieldConfig[]>(fields)

  useEffect(() => {
    setLocalFields(fields)
  }, [fields])

  // Create a map of field name/id to field object
  const fieldMap = new Map<string, TableField>()
  allFields.forEach((field) => {
    fieldMap.set(field.name, field)
    fieldMap.set(field.id, field)
  })

  // Get field objects for configured fields
  const configuredFields = localFields
    .map((config) => {
      const field = fieldMap.get(config.field)
      return field ? { field, config } : null
    })
    .filter((item): item is { field: TableField; config: FieldConfig } => item !== null)
    .sort((a, b) => (a.config.order ?? 0) - (b.config.order ?? 0))

  // Get available fields (not yet configured)
  const availableFields = allFields.filter(
    (field) => !localFields.some((config) => config.field === field.name || config.field === field.id)
  )

  const handleAddField = (field: TableField) => {
    const newConfig: FieldConfig = {
      field: field.name,
      editable: true,
      order: localFields.length,
    }
    const updated = [...localFields, newConfig]
    setLocalFields(updated)
    onChange(updated)
  }

  const handleRemoveField = (index: number) => {
    const updated = localFields.filter((_, i) => i !== index)
    // Reorder remaining fields
    const reordered = updated.map((config, i) => ({ ...config, order: i }))
    setLocalFields(reordered)
    onChange(reordered)
  }

  const handleToggleEditable = (index: number) => {
    const updated = [...localFields]
    updated[index] = { ...updated[index], editable: !updated[index].editable }
    setLocalFields(updated)
    onChange(updated)
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const updated = [...localFields]
    const temp = updated[index]
    updated[index] = updated[index - 1]
    updated[index - 1] = temp
    // Update orders
    const reordered = updated.map((config, i) => ({ ...config, order: i }))
    setLocalFields(reordered)
    onChange(reordered)
  }

  const handleMoveDown = (index: number) => {
    if (index === localFields.length - 1) return
    const updated = [...localFields]
    const temp = updated[index]
    updated[index] = updated[index + 1]
    updated[index + 1] = temp
    // Update orders
    const reordered = updated.map((config, i) => ({ ...config, order: i }))
    setLocalFields(reordered)
    onChange(reordered)
  }

  const handleSelectAll = () => {
    const allFieldConfigs: FieldConfig[] = allFields.map((field, index) => ({
      field: field.name,
      editable: true,
      order: index,
    }))
    setLocalFields(allFieldConfigs)
    onChange(allFieldConfigs)
  }

  const handleSelectNone = () => {
    setLocalFields([])
    onChange([])
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-semibold">Field Panel Configuration</Label>
            <p className="text-xs text-gray-500 mt-1">
              Select which fields appear in the Record Field Panel and configure their order and editability.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs text-blue-600 hover:text-blue-700 underline"
            >
              Select All
            </button>
            <span className="text-xs text-gray-300">|</span>
            <button
              type="button"
              onClick={handleSelectNone}
              className="text-xs text-blue-600 hover:text-blue-700 underline"
            >
              Select None
            </button>
          </div>
        </div>
      </div>

      {/* Configured Fields */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-gray-700">Selected Fields</Label>
        {configuredFields.length === 0 ? (
          <div className="text-sm text-gray-500 py-4 text-center border border-gray-200 rounded-lg">
            No fields selected. Add fields below.
          </div>
        ) : (
          <div className="space-y-2">
            {configuredFields.map(({ field, config }, index) => {
              const originalIndex = localFields.findIndex(
                (f) => f.field === config.field
              )

              return (
                <div
                  key={field.id}
                  className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">{field.name}</div>
                    <div className="text-xs text-gray-500">{field.type}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Checkbox
                        id={`editable-${field.id}`}
                        checked={config.editable}
                        onCheckedChange={() => handleToggleEditable(originalIndex)}
                      />
                      <Label
                        htmlFor={`editable-${field.id}`}
                        className="text-xs text-gray-600 cursor-pointer"
                      >
                        Editable
                      </Label>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMoveUp(originalIndex)}
                        disabled={originalIndex === 0}
                        className="h-7 w-7 p-0"
                      >
                        ↑
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMoveDown(originalIndex)}
                        disabled={originalIndex === localFields.length - 1}
                        className="h-7 w-7 p-0"
                      >
                        ↓
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveField(originalIndex)}
                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Available Fields */}
      {availableFields.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs font-medium text-gray-700">Available Fields</Label>
          <div className="grid grid-cols-2 gap-2">
            {availableFields.map((field) => (
              <Button
                key={field.id}
                variant="outline"
                size="sm"
                onClick={() => handleAddField(field)}
                className="justify-start h-auto py-2"
              >
                <Plus className="h-3 w-3 mr-1" />
                <span className="text-xs">{field.name}</span>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
