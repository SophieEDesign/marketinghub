"use client"

import { useState, useEffect } from "react"
import { X, Save } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { validateFieldOptions } from "@/lib/fields/validation"
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
  const [tables, setTables] = useState<Array<{ id: string; name: string }>>([])
  const [loadingTables, setLoadingTables] = useState(false)
  const [lookupTableFields, setLookupTableFields] = useState<Array<{ id: string; name: string; type: string }>>([])
  const [loadingLookupFields, setLoadingLookupFields] = useState(false)

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

  // Load tables for lookup fields
  useEffect(() => {
    if (isOpen && type === 'lookup') {
      loadTables()
    }
  }, [isOpen, type])

  // Load fields from lookup table when lookup_table_id changes
  useEffect(() => {
    if (isOpen && type === 'lookup' && options.lookup_table_id) {
      loadLookupTableFields(options.lookup_table_id)
    } else {
      setLookupTableFields([])
    }
  }, [isOpen, type, options.lookup_table_id])

  async function loadTables() {
    setLoadingTables(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('tables')
        .select('id, name')
        .order('name', { ascending: true })

      if (!error && data) {
        setTables(data)
      }
    } catch (error) {
      console.error('Error loading tables:', error)
    } finally {
      setLoadingTables(false)
    }
  }

  async function loadLookupTableFields(tableId: string) {
    setLoadingLookupFields(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('table_fields')
        .select('id, name, type')
        .eq('table_id', tableId)
        .order('position', { ascending: true })

      if (!error && data) {
        setLookupTableFields(data)
      }
    } catch (error) {
      console.error('Error loading lookup table fields:', error)
      setLookupTableFields([])
    } finally {
      setLoadingLookupFields(false)
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Field name is required")
      return
    }

    // Validate field options based on type
    const validation = validateFieldOptions(type, options)
    if (!validation.valid) {
      setError(validation.error || "Invalid field configuration")
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
              {(options.choices || [""]).map((choice, index) => {
                const choiceColor = options.choiceColors?.[choice] || '#3b82f6'
                return (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      type="text"
                      value={choice}
                      onChange={(e) => {
                        const newChoices = [...(options.choices || [])]
                        const oldChoice = newChoices[index]
                        newChoices[index] = e.target.value
                        // Preserve color when renaming choice
                        const newChoiceColors = { ...(options.choiceColors || {}) }
                        if (oldChoice && oldChoice !== e.target.value) {
                          if (newChoiceColors[oldChoice]) {
                            newChoiceColors[e.target.value] = newChoiceColors[oldChoice]
                            delete newChoiceColors[oldChoice]
                          }
                        }
                        setOptions({ 
                          ...options, 
                          choices: newChoices,
                          choiceColors: newChoiceColors
                        })
                      }}
                      placeholder="Option name"
                      className="flex-1"
                    />
                    <input
                      type="color"
                      value={choiceColor}
                      onChange={(e) => {
                        const newChoiceColors = { ...(options.choiceColors || {}) }
                        if (choice) {
                          newChoiceColors[choice] = e.target.value
                        }
                        setOptions({ ...options, choiceColors: newChoiceColors })
                      }}
                      className="h-10 w-10 rounded border border-gray-300 cursor-pointer"
                      title="Choose color for this option"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newChoices = (options.choices || []).filter((_, i) => i !== index)
                        const newChoiceColors = { ...(options.choiceColors || {}) }
                        // Remove color for deleted choice
                        if (choice) {
                          delete newChoiceColors[choice]
                        }
                        setOptions({ 
                          ...options, 
                          choices: newChoices,
                          choiceColors: newChoiceColors
                        })
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
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

      case "lookup":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lookup-table">Lookup Table *</Label>
              <Select
                value={options.lookup_table_id || undefined}
                onValueChange={(tableId) =>
                  setOptions({ 
                    ...options, 
                    lookup_table_id: tableId || undefined,
                    // Reset field when table changes
                    lookup_field_id: undefined,
                  })
                }
              >
                <SelectTrigger id="lookup-table">
                  <SelectValue placeholder="Select a table" />
                </SelectTrigger>
                <SelectContent>
                  {loadingTables ? (
                    <SelectItem value="__loading__" disabled>Loading tables...</SelectItem>
                  ) : (
                    tables
                      .filter(t => t.id !== tableId)
                      .map((table) => (
                        <SelectItem key={table.id} value={table.id}>
                          {table.name}
                        </SelectItem>
                      ))
                  )}
                </SelectContent>
              </Select>
            </div>
            {options.lookup_table_id && (
              <div className="space-y-2">
                <Label htmlFor="lookup-field">Lookup Field *</Label>
                <Select
                  value={options.lookup_field_id || undefined}
                  onValueChange={(fieldId) =>
                    setOptions({ ...options, lookup_field_id: fieldId || undefined })
                  }
                >
                  <SelectTrigger id="lookup-field">
                    <SelectValue placeholder="Select a field" />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingLookupFields ? (
                      <SelectItem value="__loading__" disabled>Loading fields...</SelectItem>
                    ) : (
                      lookupTableFields.map((field) => (
                        <SelectItem key={field.id} value={field.id}>
                          {field.name} ({field.type})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Select the field from the lookup table to display
                </p>
              </div>
            )}
          </div>
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Field" : "Add Field"}</DialogTitle>
          <DialogDescription>
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
