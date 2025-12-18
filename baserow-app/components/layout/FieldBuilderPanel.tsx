"use client"

import { useState, useEffect } from "react"
import { Plus, Edit, Trash2, X, Save, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { TableField, FieldType, FieldOptions } from "@/types/fields"
import { FIELD_TYPES } from "@/types/fields"
import FormulaEditor from "@/components/fields/FormulaEditor"

interface FieldBuilderPanelProps {
  tableId: string
  supabaseTableName: string
  onFieldsUpdated: () => void
}

export default function FieldBuilderPanel({
  tableId,
  supabaseTableName,
  onFieldsUpdated,
}: FieldBuilderPanelProps) {
  const [fields, setFields] = useState<TableField[]>([])
  const [loading, setLoading] = useState(true)
  const [editingField, setEditingField] = useState<TableField | null>(null)
  const [showNewField, setShowNewField] = useState(false)

  useEffect(() => {
    loadFields()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId])

  async function loadFields() {
    try {
      const response = await fetch(`/api/tables/${tableId}/fields`)
      const data = await response.json()
      if (data.fields) {
        setFields(data.fields)
      }
    } catch (error) {
      console.error("Error loading fields:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateField(fieldData: Partial<TableField>) {
    try {
      const response = await fetch(`/api/tables/${tableId}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fieldData),
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || "Failed to create field")
        return
      }

      await loadFields()
      onFieldsUpdated()
      setShowNewField(false)
    } catch (error) {
      console.error("Error creating field:", error)
      alert("Failed to create field")
    }
  }

  async function handleUpdateField(fieldId: string, updates: Partial<TableField>) {
    try {
      const response = await fetch(`/api/tables/${tableId}/fields`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldId,
          ...updates,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || "Failed to update field")
        return
      }

      await loadFields()
      onFieldsUpdated()
      setEditingField(null)
    } catch (error) {
      console.error("Error updating field:", error)
      alert("Failed to update field")
    }
  }

  async function handleDeleteField(fieldId: string, fieldName: string) {
    if (!confirm(`Are you sure you want to delete the field "${fieldName}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/tables/${tableId}/fields?fieldId=${fieldId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || "Failed to delete field")
        return
      }

      await loadFields()
      onFieldsUpdated()
    } catch (error) {
      console.error("Error deleting field:", error)
      alert("Failed to delete field")
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading fields...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Fields</h3>
        <Button
          size="sm"
          onClick={() => setShowNewField(true)}
          className="h-8 px-3 text-sm"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          New Field
        </Button>
      </div>

      {showNewField && (
        <NewFieldForm
          onSave={handleCreateField}
          onCancel={() => setShowNewField(false)}
        />
      )}

      <div className="space-y-2">
        {fields.map((field) => (
          <FieldItem
            key={field.id}
            field={field}
            isEditing={editingField?.id === field.id}
            onEdit={() => setEditingField(field)}
            onSave={(updates) => handleUpdateField(field.id, updates)}
            onCancel={() => setEditingField(null)}
            onDelete={() => handleDeleteField(field.id, field.name)}
            tableFields={fields}
          />
        ))}
      </div>
    </div>
  )
}

function NewFieldForm({
  onSave,
  onCancel,
}: {
  onSave: (fieldData: Partial<TableField>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState("")
  const [type, setType] = useState<FieldType>("text")
  const [required, setRequired] = useState(false)
  const [options, setOptions] = useState<FieldOptions>({})

  const fieldTypeInfo = FIELD_TYPES.find(t => t.type === type)
  const isVirtual = fieldTypeInfo?.isVirtual || false

  function handleSubmit() {
    if (!name.trim()) {
      alert("Field name is required")
      return
    }

    onSave({
      name: name.trim(),
      type,
      required,
      options: Object.keys(options).length > 0 ? options : undefined,
    })
  }

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
      <div>
        <Label className="text-xs font-medium text-gray-700">Field Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter field name"
          className="mt-1 h-8 text-sm"
        />
      </div>

      <div>
        <Label className="text-xs font-medium text-gray-700">Field Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as FieldType)}>
          <SelectTrigger className="mt-1 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELD_TYPES.map((ft) => (
              <SelectItem key={ft.type} value={ft.type}>
                {ft.label} {ft.isVirtual ? "(Virtual)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!isVirtual && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="new-required"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
            className="w-4 h-4"
          />
          <Label htmlFor="new-required" className="text-xs text-gray-700">
            Required
          </Label>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!name.trim()}
          className="flex-1 h-8 text-sm"
        >
          <Save className="h-3.5 w-3.5 mr-1.5" />
          Create
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onCancel}
          className="h-8 text-sm"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

function FieldItem({
  field,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  tableFields,
}: {
  field: TableField
  isEditing: boolean
  onEdit: () => void
  onSave: (updates: Partial<TableField>) => void
  onCancel: () => void
  onDelete: () => void
  tableFields: TableField[]
}) {
  const [name, setName] = useState(field.name)
  const [type, setType] = useState<FieldType>(field.type)
  const [required, setRequired] = useState(field.required || false)
  const [options, setOptions] = useState<FieldOptions>(field.options || {})

  const fieldTypeInfo = FIELD_TYPES.find(t => t.type === field.type)
  const isVirtual = fieldTypeInfo?.isVirtual || false

  useEffect(() => {
    if (isEditing) {
      setName(field.name)
      setType(field.type)
      setRequired(field.required || false)
      setOptions(field.options || {})
    }
  }, [isEditing, field])

  function handleSave() {
    onSave({
      name: name.trim(),
      type,
      required,
      options: Object.keys(options).length > 0 ? options : undefined,
    })
  }

  if (isEditing) {
    return (
      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
        <div>
          <Label className="text-xs font-medium text-gray-700">Field Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 h-8 text-sm"
          />
        </div>

        <div>
          <Label className="text-xs font-medium text-gray-700">Field Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as FieldType)}>
            <SelectTrigger className="mt-1 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((ft) => (
                <SelectItem key={ft.type} value={ft.type}>
                  {ft.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!isVirtual && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`required-${field.id}`}
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="w-4 h-4"
            />
            <Label htmlFor={`required-${field.id}`} className="text-xs text-gray-700">
              Required
            </Label>
          </div>
        )}

        {/* Type-specific options */}
        {type === "single_select" || type === "multi_select" ? (
          <div>
            <Label className="text-xs font-medium text-gray-700">Choices</Label>
            <div className="mt-1 space-y-2">
              {(options.choices || [""]).map((choice, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={choice}
                    onChange={(e) => {
                      const newChoices = [...(options.choices || [])]
                      newChoices[index] = e.target.value
                      setOptions({ ...options, choices: newChoices })
                    }}
                    className="h-8 text-sm"
                    placeholder="Option name"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const newChoices = (options.choices || []).filter((_, i) => i !== index)
                      setOptions({ ...options, choices: newChoices })
                    }}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setOptions({
                    ...options,
                    choices: [...(options.choices || []), ""],
                  })
                }}
                className="h-8 text-sm"
              >
                + Add choice
              </Button>
            </div>
          </div>
        ) : type === "formula" ? (
          <div>
            <Label className="text-xs font-medium text-gray-700">Formula</Label>
            <div className="mt-1">
              <FormulaEditor
                value={options.formula || ""}
                onChange={(formula) => setOptions({ ...options, formula })}
                tableFields={tableFields.filter(f => f.id !== field.id && f.type !== 'formula')}
              />
            </div>
          </div>
        ) : null}

        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex-1 h-8 text-sm"
          >
            <Check className="h-3.5 w-3.5 mr-1.5" />
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onCancel}
            className="h-8 text-sm"
          >
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 truncate">
              {field.name}
            </span>
            {field.required && (
              <span className="text-xs text-red-600">*</span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {FIELD_TYPES.find(t => t.type === field.type)?.label || field.type}
            </span>
            {isVirtual && (
              <span className="text-xs text-blue-600">(Virtual)</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={onEdit}
            className="h-7 w-7 p-0"
          >
            <Edit className="h-3.5 w-3.5 text-gray-500" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
