"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { GripVertical, Trash2, Plus } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import type { BlockConfig } from "@/lib/interface/types"
import type { Table, TableField } from "@/types/database"

interface FormFieldConfig {
  field_id: string
  field_name: string
  required: boolean
  visible: boolean
  order: number
}

interface FormDataSettingsProps {
  config: BlockConfig
  tables: Table[]
  fields: TableField[]
  onUpdate: (updates: Partial<BlockConfig>) => void
  onTableChange: (tableId: string) => Promise<void>
}

export default function FormDataSettings({
  config,
  tables,
  fields,
  onUpdate,
  onTableChange,
}: FormDataSettingsProps) {
  const formFields: FormFieldConfig[] = config?.form_fields || []
  
  // Initialize form fields from table fields if not configured
  const initializeFields = () => {
    if (formFields.length === 0 && fields.length > 0) {
      const initialFields: FormFieldConfig[] = fields.map((field, index) => ({
        field_id: field.id,
        field_name: field.name,
        required: false,
        visible: true,
        order: index,
      }))
      onUpdate({ form_fields: initialFields })
    }
  }

  const addField = (fieldId: string) => {
    const field = fields.find(f => f.id === fieldId)
    if (!field) return

    const newField: FormFieldConfig = {
      field_id: field.id,
      field_name: field.name,
      required: false,
      visible: true,
      order: formFields.length,
    }
    onUpdate({ form_fields: [...formFields, newField] })
  }

  const removeField = (fieldId: string) => {
    onUpdate({
      form_fields: formFields.filter(f => f.field_id !== fieldId),
    })
  }

  const updateField = (fieldId: string, updates: Partial<FormFieldConfig>) => {
    onUpdate({
      form_fields: formFields.map(f =>
        f.field_id === fieldId ? { ...f, ...updates } : f
      ),
    })
  }

  const reorderField = (fieldId: string, direction: 'up' | 'down') => {
    const index = formFields.findIndex(f => f.field_id === fieldId)
    if (index === -1) return

    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= formFields.length) return

    const newFields = [...formFields]
    ;[newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]]
    
    // Update order values
    newFields.forEach((f, i) => {
      f.order = i
    })

    onUpdate({ form_fields: newFields })
  }

  const availableFields = fields.filter(
    f => !formFields.some(ff => ff.field_id === f.id)
  )

  // Auto-initialize on mount if needed
  useState(() => {
    if (config.table_id && formFields.length === 0 && fields.length > 0) {
      initializeFields()
    }
  })

  return (
    <div className="space-y-4">
      {/* Table Selection */}
      <div className="space-y-2">
        <Label>Table *</Label>
        <Select
          value={config.table_id || ""}
          onValueChange={onTableChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a table" />
          </SelectTrigger>
          <SelectContent>
            {tables.map((table) => (
              <SelectItem key={table.id} value={table.id}>
                {table.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Form Fields Configuration */}
      {config.table_id && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Form Fields</Label>
            {availableFields.length > 0 && (
              <Select
                value=""
                onValueChange={addField}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Add field" />
                </SelectTrigger>
                <SelectContent>
                  {availableFields.map((field) => (
                    <SelectItem key={field.id} value={field.id}>
                      {field.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {formFields.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-4 border rounded">
              No fields added. Select fields from the dropdown above.
            </div>
          ) : (
            <div className="space-y-2">
              {formFields
                .sort((a, b) => a.order - b.order)
                .map((formField) => {
                  const field = fields.find(f => f.id === formField.field_id)
                  return (
                    <div
                      key={formField.field_id}
                      className="border rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-gray-400" />
                        <div className="flex-1 font-medium">
                          {field?.name || formField.field_name}
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formField.visible}
                              onChange={(e) =>
                                updateField(formField.field_id, {
                                  visible: e.target.checked,
                                })
                              }
                              className="cursor-pointer"
                            />
                            <span>Visible</span>
                          </label>
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formField.required}
                              onChange={(e) =>
                                updateField(formField.field_id, {
                                  required: e.target.checked,
                                })
                              }
                              className="cursor-pointer"
                            />
                            <span>Required</span>
                          </label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeField(formField.field_id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-6">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => reorderField(formField.field_id, 'up')}
                          disabled={formField.order === 0}
                        >
                          ↑
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => reorderField(formField.field_id, 'down')}
                          disabled={formField.order === formFields.length - 1}
                        >
                          ↓
                        </Button>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}

      {/* Submit Action */}
      <div className="space-y-2">
        <Label>Submit Action</Label>
        <Select
          value={config.submit_action || 'create'}
          onValueChange={(value) => onUpdate({ submit_action: value as 'create' | 'update' | 'custom' })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="create">Create Record</SelectItem>
            <SelectItem value="update">Update Record</SelectItem>
            <SelectItem value="custom">Custom Action</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

