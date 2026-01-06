"use client"

import { useState, useEffect } from "react"
import { X, Save } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { FieldType, TableField, FieldOptions } from "@/types/fields"
import { FIELD_TYPES } from "@/types/fields"
import FormulaEditor from "@/components/fields/FormulaEditor"

interface FieldBuilderModalProps {
  isOpen: boolean
  onClose: () => void
  tableId: string
  field?: TableField | null
  onSave: () => void
  tableFields?: TableField[]
}

export default function FieldBuilderModal({
  isOpen,
  onClose,
  tableId,
  field,
  onSave,
  tableFields = [],
}: FieldBuilderModalProps) {
  const [name, setName] = useState("")
  const [type, setType] = useState<FieldType>("text")
  const [required, setRequired] = useState(false)
  const [defaultValue, setDefaultValue] = useState<any>(null)
  const [options, setOptions] = useState<FieldOptions>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEdit = !!field
  const fieldTypeInfo = FIELD_TYPES.find(t => t.type === type)
  const isVirtual = fieldTypeInfo?.isVirtual || false

  useEffect(() => {
    if (field) {
      setName(field.name)
      setType(field.type)
      setRequired(field.required || false)
      setDefaultValue(field.default_value)
      setOptions(field.options || {})
    } else {
      setName("")
      setType("text")
      setRequired(false)
      setDefaultValue(null)
      setOptions({})
    }
    setError(null)
  }, [field, isOpen])

  async function handleSave() {
    if (!name.trim()) {
      setError("Field name is required")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const url = `/api/tables/${tableId}/fields`
      const method = isEdit ? "PATCH" : "POST"
      const body = isEdit
        ? {
            fieldId: field!.id,
            name: name.trim(),
            type,
            required,
            default_value: defaultValue,
            options,
          }
        : {
            name: name.trim(),
            type,
            required,
            default_value: defaultValue,
            options,
          }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to save field")
        setLoading(false)
        return
      }

      onSave()
      onClose()
    } catch (err: any) {
      setError(err.message || "Failed to save field")
    } finally {
      setLoading(false)
    }
  }

  function renderTypeSpecificOptions() {
    switch (type) {
      case "single_select":
      case "multi_select":
        return (
          <div className="space-y-2">
            <Label>Choices</Label>
            <div className="space-y-2">
              {(options.choices || [""]).map((choice, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    type="text"
                    value={choice}
                    onChange={(e) => {
                      const newChoices = [...(options.choices || [])]
                      newChoices[index] = e.target.value
                      setOptions({ ...options, choices: newChoices })
                    }}
                    placeholder="Option name"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const newChoices = (options.choices || []).filter((_, i) => i !== index)
                      setOptions({ ...options, choices: newChoices })
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setOptions({
                    ...options,
                    choices: [...(options.choices || []), ""],
                  })
                }}
              >
                + Add choice
              </Button>
            </div>
          </div>
        )

      case "formula":
        return (
          <FormulaEditor
            value={options.formula || ""}
            onChange={(formula) =>
              setOptions({ ...options, formula })
            }
            tableFields={tableFields.filter(f => f.id !== field?.id && f.type !== 'formula')}
          />
        )

      case "number":
      case "currency":
      case "percent":
        return (
          <div className="space-y-2">
            <Label>Precision</Label>
            <Input
              type="number"
              min="0"
              max="10"
              value={options.precision ?? 2}
              onChange={(e) =>
                setOptions({
                  ...options,
                  precision: parseInt(e.target.value) || 0,
                })
              }
            />
            {type === "currency" && (
              <>
                <Label>Currency Symbol</Label>
                <Input
                  type="text"
                  value={options.currency_symbol || "$"}
                  onChange={(e) =>
                    setOptions({ ...options, currency_symbol: e.target.value })
                  }
                />
              </>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="field-builder-dialog-description">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Field" : "Add Field"}</DialogTitle>
          <DialogDescription id="field-builder-dialog-description">
            {isEdit ? "Update the field properties below." : "Create a new field for this table."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Field Name */}
          <div className="space-y-2">
            <Label htmlFor="field-name">Field Name *</Label>
            <Input
              id="field-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter field name"
              disabled={loading}
            />
          </div>

          {/* Field Type */}
          <div className="space-y-2">
            <Label htmlFor="field-type">Field Type *</Label>
            <select
              id="field-type"
              value={type}
              onChange={(e) => {
                setType(e.target.value as FieldType)
                setOptions({})
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              {FIELD_TYPES.map((ft) => (
                <option key={ft.type} value={ft.type}>
                  {ft.label} {ft.isVirtual ? "(Virtual)" : ""}
                </option>
              ))}
            </select>
            {isVirtual && (
              <p className="text-xs text-gray-500">
                Virtual fields are calculated and do not store data in the database
              </p>
            )}
          </div>

          {/* Required */}
          {!isVirtual && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="required"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
                className="w-4 h-4"
                disabled={loading}
              />
              <Label htmlFor="required">Required</Label>
            </div>
          )}

          {/* Default Value */}
          {!isVirtual && (
            <div className="space-y-2">
              <Label htmlFor="default-value">Default Value</Label>
              <Input
                id="default-value"
                type={type === "number" ? "number" : "text"}
                value={defaultValue ?? ""}
                onChange={(e) => {
                  if (type === "number") {
                    setDefaultValue(e.target.value ? Number(e.target.value) : null)
                  } else {
                    setDefaultValue(e.target.value || null)
                  }
                }}
                placeholder="Default value (optional)"
                disabled={loading}
              />
            </div>
          )}

          {/* Type-specific Options */}
          {renderTypeSpecificOptions()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={loading || !name.trim()}
          >
            <Save className="h-4 w-4 mr-2" />
            {loading ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
