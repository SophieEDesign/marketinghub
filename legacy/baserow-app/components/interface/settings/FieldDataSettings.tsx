"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { X, Plus, ExternalLink, Save, AlertCircle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import type { BlockConfig } from "@/lib/interface/types"
import type { Table, TableField } from "@/types/database"
import type { FieldType, FieldOptions, ChoiceColorTheme } from "@/types/fields"
import { createClient } from "@/lib/supabase/client"
import { CHOICE_COLOR_THEME_LABELS, isChoiceColorTheme, resolveChoiceColor } from "@/lib/field-colors"
import { useSelectionContext } from "@/contexts/SelectionContext"
import { format as formatDate } from "date-fns"

const DATE_FORMAT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "yyyy-MM-dd", label: "ISO" },
  { value: "MM/dd/yyyy", label: "US" },
  { value: "dd/MM/yyyy", label: "UK" },
  { value: "MMM d, yyyy", label: "Short month" },
  { value: "MMMM d, yyyy", label: "Long month" },
  { value: "dd MMM yyyy", label: "Day first" },
]

interface FieldDataSettingsProps {
  config: BlockConfig
  tables: Table[]
  fields: TableField[]
  onUpdate: (updates: Partial<BlockConfig>) => void
  onTableChange?: (tableId: string) => void
  pageTableId?: string | null // Table ID from the page (for record_view pages)
}

export default function FieldDataSettings({
  config,
  tables,
  fields,
  onUpdate,
  onTableChange,
  pageTableId = null,
}: FieldDataSettingsProps) {
  const [availableFields, setAvailableFields] = useState<TableField[]>([])
  const [selectedField, setSelectedField] = useState<TableField | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()
  const { setSelectedContext } = useSelectionContext()
  const tableId = config.table_id || pageTableId

  // Load fields when table changes
  useEffect(() => {
    if (tableId) {
      loadFields(tableId)
    } else {
      setAvailableFields([])
      setSelectedField(null)
    }
  }, [tableId])

  // Load selected field when field_id changes
  useEffect(() => {
    if (config.field_id && tableId) {
      loadSelectedField(config.field_id, tableId)
    } else {
      setSelectedField(null)
    }
  }, [config.field_id, tableId])

  async function loadFields(tableId: string) {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", tableId)
        .order("order_index", { ascending: true })

      if (!error && data) {
        setAvailableFields(data as TableField[])
      }
    } catch (error) {
      console.error("Error loading fields:", error)
      setAvailableFields([])
    }
  }

  async function loadSelectedField(fieldId: string, tableId: string) {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("table_fields")
        .select("*")
        .eq("id", fieldId)
        .eq("table_id", tableId)
        .single()

      if (!error && data) {
        setSelectedField(data as TableField)
      } else {
        setSelectedField(null)
      }
    } catch (error) {
      console.error("Error loading selected field:", error)
      setSelectedField(null)
    }
  }

  const handleTableChange = (newTableId: string) => {
    onUpdate({ table_id: newTableId, field_id: undefined }) // Clear field_id when table changes
    onTableChange?.(newTableId)
    setSelectedField(null)
  }

  const handleFieldChange = (fieldId: string) => {
    onUpdate({ field_id: fieldId })
  }

  async function handleFieldUpdate(updates: {
    name?: string
    type?: FieldType
    required?: boolean
    options?: FieldOptions
    group_name?: string | null
    default_value?: any
  }) {
    if (!selectedField || !tableId) return

    setSaving(true)
    try {
      const response = await fetch(`/api/tables/${tableId}/fields`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldId: selectedField.id,
          ...updates,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to update field")
      }

      // Reload the field to get updated data
      await loadSelectedField(selectedField.id, tableId)
      await loadFields(tableId) // Refresh field list

      toast({
        title: "Field updated",
        description: "Changes apply to this field everywhere it's used.",
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update field",
      })
    } finally {
      setSaving(false)
    }
  }

  function renderFieldSettings() {
    if (!selectedField) return null

    const field = selectedField
    const options = field.options || {}

    return (
      <div className="space-y-4">
        <div className="border-t border-gray-200 pt-4">
        
        {/* Field Settings Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Field Settings</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Changes apply to this field everywhere it&apos;s used
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => tableId && selectedField && setSelectedContext({ type: "field", fieldId: selectedField.id, tableId })}
              className="text-xs"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Full Editor
            </Button>
          </div>
        </div>

        {/* Field Name */}
        <div className="space-y-2">
          <Label htmlFor="field-name">Field Name</Label>
          <Input
            id="field-name"
            value={field.name}
            onChange={(e) => {
              handleFieldUpdate({ name: e.target.value })
            }}
            disabled={saving}
            className="text-sm"
          />
        </div>

        {/* Section Name */}
        <div className="space-y-2">
          <Label htmlFor="section-name">Section Name (Optional)</Label>
          <Input
            id="section-name"
            value={field.group_name || ''}
            onChange={(e) => {
              handleFieldUpdate({ group_name: e.target.value.trim() || null })
            }}
            disabled={saving}
            className="text-sm"
            placeholder="e.g., Social Media Fields, Press Fields"
          />
          <p className="text-xs text-gray-500">
            Organize fields into sections. Fields with the same section name will be grouped together.
          </p>
        </div>

        {/* Field Type (read-only display) */}
        <div className="space-y-2">
          <Label>Field Type</Label>
          <div className="px-3 py-2 bg-gray-50 rounded-md text-sm text-gray-700">
            {field.type.replace('_', ' ')}
            {field.type === 'formula' || field.type === 'lookup' ? ' (Virtual)' : ''}
          </div>
          <p className="text-xs text-gray-500">
            Type changes must be made in the full field editor
          </p>
        </div>

        {/* Type-specific settings */}
        {(field.type === 'single_select' || field.type === 'multi_select') && (
          <div className="space-y-2">
            <Label>Options</Label>
            <div className="space-y-2">
              {/* Pill colour theme */}
              <div className="space-y-2 rounded-md border border-gray-200 p-3 bg-gray-50/50">
                <Label className="text-xs text-gray-700">Colour theme</Label>
                <Select
                  value={
                    (isChoiceColorTheme(options.choiceColorTheme)
                      ? options.choiceColorTheme
                      : 'vibrant') as ChoiceColorTheme
                  }
                  onValueChange={(theme) => {
                    const next: FieldOptions = { ...options }
                    if (theme === 'vibrant') {
                      delete next.choiceColorTheme
                    } else {
                      next.choiceColorTheme = theme as ChoiceColorTheme
                    }
                    handleFieldUpdate({ options: next })
                  }}
                  disabled={saving}
                >
                  <SelectTrigger className="text-sm bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CHOICE_COLOR_THEME_LABELS) as ChoiceColorTheme[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {CHOICE_COLOR_THEME_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Applies to pills without a custom colour.
                </p>
              </div>

              {(options.choices && options.choices.length > 0 ? options.choices : []).map((choice, index) => {
                const choiceColor = options.choiceColors?.[choice] || resolveChoiceColor(
                  choice,
                  field.type as 'single_select' | 'multi_select',
                  options,
                  field.type === 'single_select'
                )
                return (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      value={choice}
                      onChange={(e) => {
                        const newChoices = [...(options.choices || [])]
                        const oldChoice = newChoices[index]
                        newChoices[index] = e.target.value
                        const newChoiceColors = { ...(options.choiceColors || {}) }
                        if (oldChoice && oldChoice !== e.target.value) {
                          if (newChoiceColors[oldChoice]) {
                            newChoiceColors[e.target.value] = newChoiceColors[oldChoice]
                            delete newChoiceColors[oldChoice]
                          }
                        }
                        handleFieldUpdate({
                          options: {
                            ...options,
                            choices: newChoices,
                            choiceColors: newChoiceColors,
                          },
                        })
                      }}
                      placeholder="Option name"
                      className="flex-1 text-sm"
                      disabled={saving}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={choiceColor}
                        onChange={(e) => {
                          const newChoiceColors = { ...(options.choiceColors || {}) }
                          if (choice) {
                            newChoiceColors[choice] = e.target.value
                          }
                          handleFieldUpdate({
                            options: {
                              ...options,
                              choiceColors: newChoiceColors,
                            },
                          })
                        }}
                        className="h-8 w-8 rounded border border-gray-300 cursor-pointer"
                        title="Choose color for this option"
                        disabled={saving}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const newChoices = (options.choices || []).filter((_, i) => i !== index)
                          const newChoiceColors = { ...(options.choiceColors || {}) }
                          if (choice) {
                            delete newChoiceColors[choice]
                          }
                          handleFieldUpdate({
                            options: {
                              ...options,
                              choices: newChoices,
                              choiceColors: newChoiceColors,
                            },
                          })
                        }}
                        className="h-8 w-8 p-0"
                        disabled={saving}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )
              })}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  handleFieldUpdate({
                    options: {
                      ...options,
                      choices: [...(options.choices || []), ''],
                    },
                  })
                }}
                className="w-full text-xs"
                disabled={saving}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Option
              </Button>
            </div>
          </div>
        )}

        {field.type === 'link_to_table' && options.linked_table_id && (
          <div className="space-y-2">
            <Label>Linked Table</Label>
            <div className="px-3 py-2 bg-gray-50 rounded-md text-sm text-gray-700">
              {tables.find(t => t.id === options.linked_table_id)?.name || 'Unknown table'}
            </div>
            <p className="text-xs text-gray-500">
              Link configuration must be edited in the full field editor
            </p>
          </div>
        )}

        {field.type === 'lookup' && options.lookup_table_id && (
          <div className="space-y-2">
            <Label>Lookup Configuration</Label>
            <div className="px-3 py-2 bg-gray-50 rounded-md text-sm text-gray-700 space-y-1">
              <div>Source: {tables.find(t => t.id === options.lookup_table_id)?.name || 'Unknown'}</div>
              {options.lookup_result_field_id && (
                <div className="text-xs text-gray-500">
                  Result field: {options.lookup_result_field_id}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Lookup configuration must be edited in the full field editor
            </p>
          </div>
        )}

        {(field.type === 'number' || field.type === 'currency' || field.type === 'percent') && (
          <div className="space-y-2">
            <Label htmlFor="precision">Decimal Places</Label>
            <Input
              id="precision"
              type="number"
              min="0"
              max="10"
              value={options.precision ?? 2}
              onChange={(e) =>
                handleFieldUpdate({
                  options: {
                    ...options,
                    precision: parseInt(e.target.value) || 0,
                  },
                })
              }
              className="text-sm"
              disabled={saving}
            />
          </div>
        )}

        {field.type === 'currency' && (
          <div className="space-y-2">
            <Label htmlFor="currency-symbol">Currency Symbol</Label>
            <Input
              id="currency-symbol"
              value={options.currency_symbol || '$'}
              onChange={(e) =>
                handleFieldUpdate({
                  options: {
                    ...options,
                    currency_symbol: e.target.value,
                  },
                })
              }
              placeholder="$"
              className="text-sm"
              disabled={saving}
            />
          </div>
        )}

        {field.type === 'date' && (
          <div className="space-y-2">
            <Label htmlFor="date-format">Date Format</Label>
            <Select
              value={options.date_format || 'MMM d, yyyy'}
              onValueChange={(format) =>
                handleFieldUpdate({
                  options: {
                    ...options,
                    date_format: format,
                  },
                })
              }
              disabled={saving}
            >
              <SelectTrigger id="date-format" className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMAT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label} ({formatDate(new Date(2026, 0, 15), opt.value)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Required and Read-only */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="required">Required</Label>
              <p className="text-xs text-gray-500">Field must have a value</p>
            </div>
            <Switch
              id="required"
              checked={field.required || false}
              onCheckedChange={(checked) =>
                handleFieldUpdate({ required: checked })
              }
              disabled={saving}
            />
          </div>

          {(field.type === 'formula' || field.type === 'lookup' || options.read_only) && (
            <div className="flex items-start gap-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-800">
                {field.type === 'formula' || field.type === 'lookup'
                  ? 'This is a virtual field and is read-only'
                  : 'This field is marked as read-only'}
              </p>
            </div>
          )}
        </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {/* Table Selection */}
        <div className="space-y-2">
          <Label>Table *</Label>
          <Select
            value={tableId || ""}
            onValueChange={handleTableChange}
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
          {pageTableId && !config.table_id && (
            <p className="text-xs text-gray-500">
              Using table from page settings
            </p>
          )}
        </div>

        {/* Field Selection */}
        {tableId && (
          <div className="space-y-2">
            <Label>Field *</Label>
            <Select
              value={config.field_id || ""}
              onValueChange={handleFieldChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a field" />
              </SelectTrigger>
              <SelectContent>
                {availableFields.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-gray-500">Loading fields...</div>
                ) : (
                  availableFields.map((field) => (
                    <SelectItem key={field.id} value={field.id}>
                      {field.name} ({field.type})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {availableFields.length === 0 && tableId && (
              <p className="text-xs text-gray-500">
                No fields found in this table
              </p>
            )}
          </div>
        )}

        {!tableId && (
          <p className="text-sm text-gray-500">
            Select a table to choose a field
          </p>
        )}

        {/* Field Settings Section */}
        {selectedField && renderFieldSettings()}
      </div>

    </>
  )
}
