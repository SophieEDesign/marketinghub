"use client"

import { useState, useEffect, useRef } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { TableField, FieldType, FieldOptions } from '@/types/fields'
import { FIELD_TYPES } from '@/types/fields'
import { canChangeType } from '@/lib/fields/validation'
import FormulaEditor from '@/components/fields/FormulaEditor'

interface FieldSettingsDrawerProps {
  field: TableField | null
  open: boolean
  onOpenChange: (open: boolean) => void
  tableId: string
  tableFields: TableField[]
  onSave: () => void
}

export default function FieldSettingsDrawer({
  field,
  open,
  onOpenChange,
  tableId,
  tableFields,
  onSave,
}: FieldSettingsDrawerProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<FieldType>('text')
  const [required, setRequired] = useState(false)
  const [readOnly, setReadOnly] = useState(false)
  const [groupName, setGroupName] = useState<string>('')
  const [defaultValue, setDefaultValue] = useState<any>(null)
  const [options, setOptions] = useState<FieldOptions>({})
  const [saving, setSaving] = useState(false)
  const [tables, setTables] = useState<Array<{ id: string; name: string }>>([])
  const [loadingTables, setLoadingTables] = useState(false)
  const [typeChangeWarning, setTypeChangeWarning] = useState<string | null>(null)

  // Load tables for link_to_table fields
  useEffect(() => {
    if (open && (type === 'link_to_table' || type === 'lookup')) {
      loadTables()
    }
  }, [open, type])

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

  // Reset form when field changes
  useEffect(() => {
    if (field && open) {
      setName(field.name)
      setType(field.type)
      setRequired(field.required || false)
      setReadOnly(field.options?.read_only || false)
      setGroupName(field.group_name || '')
      setDefaultValue(field.default_value || null)
      setOptions(field.options || {})
      setTypeChangeWarning(null)
    } else if (!open) {
      // Reset when drawer closes
      setName('')
      setType('text')
      setRequired(false)
      setReadOnly(false)
      setGroupName('')
      setDefaultValue(null)
      setOptions({})
      setTypeChangeWarning(null)
    }
  }, [field, open])

  // Check for type change warnings
  useEffect(() => {
    if (field && open && type !== field.type) {
      const typeCheck = canChangeType(field.type, type)
      if (!typeCheck.canChange) {
        setTypeChangeWarning(typeCheck.warning || 'Cannot change field type')
      } else if (typeCheck.warning) {
        setTypeChangeWarning(typeCheck.warning)
      } else {
        setTypeChangeWarning(null)
      }
    } else {
      setTypeChangeWarning(null)
    }
  }, [type, field, open])

  const fieldTypeInfo = FIELD_TYPES.find(t => t.type === type)
  const isVirtual = fieldTypeInfo?.isVirtual || false

  async function handleSave() {
    if (!field) return

    if (!name.trim()) {
      alert('Field name is required')
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/tables/${tableId}/fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldId: field.id,
          name: name.trim(),
          type,
          required,
          group_name: groupName.trim() || null,
          default_value: defaultValue || null,
          options: (() => {
            const opts: FieldOptions = { ...options }
            
            // Filter out empty choices
            if (opts.choices) {
              opts.choices = opts.choices.filter(c => c.trim() !== '')
              if (opts.choices.length === 0) {
                delete opts.choices
              }
            }
            
            // Handle read-only
            if (readOnly) {
              opts.read_only = true
            } else {
              delete opts.read_only
            }
            
            // Remove undefined/null values
            Object.keys(opts).forEach(key => {
              const value = opts[key as keyof FieldOptions]
              if (value === undefined || value === null || 
                  (Array.isArray(value) && value.length === 0)) {
                delete opts[key as keyof FieldOptions]
              }
            })
            
            return Object.keys(opts).length > 0 ? opts : undefined
          })(),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || 'Failed to update field')
        return
      }

      onSave()
      onOpenChange(false)
    } catch (error) {
      console.error('Error updating field:', error)
      alert('Failed to update field')
    } finally {
      setSaving(false)
    }
  }

  if (!field) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Field Settings</SheetTitle>
          <SheetDescription>
            Configure field properties and type-specific options
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Field Name */}
          <div className="space-y-2">
            <Label htmlFor="field-name">Field Name</Label>
            <Input
              id="field-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter field name"
            />
          </div>

          {/* Group Name */}
          <div className="space-y-2">
            <Label htmlFor="group-name">Group (Optional)</Label>
            <Input
              id="group-name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g., Personal Info, Contact Details"
            />
            <p className="text-xs text-muted-foreground">
              Group fields together in the sidebar
            </p>
          </div>

          {/* Field Type */}
          <div className="space-y-2">
            <Label htmlFor="field-type">Field Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as FieldType)}>
              <SelectTrigger id="field-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((ft) => (
                  <SelectItem key={ft.type} value={ft.type}>
                    {ft.label} {ft.isVirtual ? '(Virtual)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldTypeInfo && (
              <p className="text-xs text-muted-foreground">
                {fieldTypeInfo.isVirtual
                  ? 'Virtual fields are calculated and cannot store data directly'
                  : `Stored as ${fieldTypeInfo.postgresType || 'text'}`}
              </p>
            )}
            {typeChangeWarning && (
              <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">{typeChangeWarning}</p>
              </div>
            )}
          </div>

          {/* Type-specific Options */}
          {(type === 'single_select' || type === 'multi_select') && (
            <div className="space-y-2">
              <Label>Choices</Label>
              <div className="space-y-2">
                {(options.choices && options.choices.length > 0 ? options.choices : ['']).map((choice, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={choice}
                      onChange={(e) => {
                        const newChoices = [...(options.choices || [])]
                        newChoices[index] = e.target.value
                        setOptions({ ...options, choices: newChoices })
                      }}
                      placeholder="Option name"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const newChoices = (options.choices || []).filter(
                          (_, i) => i !== index
                        )
                        setOptions({ ...options, choices: newChoices })
                      }}
                      className="h-10 w-10 p-0"
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
                      choices: [...(options.choices || []), ''],
                    })
                  }}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Choice
                </Button>
              </div>
            </div>
          )}

          {type === 'formula' && (
            <div className="space-y-2">
              <Label>Formula</Label>
              <FormulaEditor
                value={options.formula || ''}
                onChange={(formula) => setOptions({ ...options, formula })}
                tableFields={tableFields.filter(
                  (f) => f.id !== field.id && f.type !== 'formula'
                )}
              />
            </div>
          )}

          {type === 'date' && (
            <div className="space-y-2">
              <Label htmlFor="date-format">Date Format</Label>
              <Select
                value={options.date_format || (field?.options?.date_format || 'MMM d, yyyy')}
                onValueChange={(format) =>
                  setOptions({ ...options, date_format: format })
                }
              >
                <SelectTrigger id="date-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yyyy-MM-dd">YYYY-MM-DD</SelectItem>
                  <SelectItem value="MM/dd/yyyy">MM/DD/YYYY</SelectItem>
                  <SelectItem value="dd/MM/yyyy">DD/MM/YYYY</SelectItem>
                  <SelectItem value="MMM d, yyyy">MMM D, YYYY</SelectItem>
                  <SelectItem value="MMMM d, yyyy">MMMM D, YYYY</SelectItem>
                  <SelectItem value="dd MMM yyyy">DD MMM YYYY</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {(type === 'number' || type === 'currency' || type === 'percent') && (
            <div className="space-y-2">
              <Label htmlFor="precision">Decimal Places</Label>
              <Input
                id="precision"
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
            </div>
          )}

          {type === 'currency' && (
            <div className="space-y-2">
              <Label htmlFor="currency-symbol">Currency Symbol</Label>
              <Input
                id="currency-symbol"
                value={options.currency_symbol || '$'}
                onChange={(e) =>
                  setOptions({ ...options, currency_symbol: e.target.value })
                }
                placeholder="$"
              />
            </div>
          )}

          {type === 'link_to_table' && (
            <div className="space-y-2">
              <Label htmlFor="linked-table">Linked Table</Label>
              <Select
                value={options.linked_table_id || ''}
                onValueChange={(tableId) =>
                  setOptions({ ...options, linked_table_id: tableId })
                }
              >
                <SelectTrigger id="linked-table">
                  <SelectValue placeholder="Select a table" />
                </SelectTrigger>
                <SelectContent>
                  {loadingTables ? (
                    <SelectItem value="" disabled>Loading tables...</SelectItem>
                  ) : (
                    <>
                      <SelectItem value="">Select a table</SelectItem>
                      {tables
                        .filter(t => t.id !== tableId) // Don't allow linking to self
                        .map((table) => (
                          <SelectItem key={table.id} value={table.id}>
                            {table.name}
                          </SelectItem>
                        ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {type === 'lookup' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="lookup-table">Lookup Table</Label>
                <Select
                  value={options.lookup_table_id || ''}
                  onValueChange={(tableId) =>
                    setOptions({ ...options, lookup_table_id: tableId })
                  }
                >
                  <SelectTrigger id="lookup-table">
                    <SelectValue placeholder="Select a table" />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingTables ? (
                      <SelectItem value="" disabled>Loading tables...</SelectItem>
                    ) : (
                      <>
                        <SelectItem value="">Select a table</SelectItem>
                        {tables
                          .filter(t => t.id !== tableId)
                          .map((table) => (
                            <SelectItem key={table.id} value={table.id}>
                              {table.name}
                            </SelectItem>
                          ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              {options.lookup_table_id && (
                <div className="space-y-2">
                  <Label htmlFor="lookup-field">Lookup Field</Label>
                  <Select
                    value={options.lookup_field_id || ''}
                    onValueChange={(fieldId) =>
                      setOptions({ ...options, lookup_field_id: fieldId })
                    }
                  >
                    <SelectTrigger id="lookup-field">
                      <SelectValue placeholder="Select a field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Select a field</SelectItem>
                      {/* TODO: Load fields from lookup table */}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          {/* Required Toggle */}
          {!isVirtual && (
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="required">Required</Label>
                <p className="text-xs text-muted-foreground">
                  Field must have a value
                </p>
              </div>
              <Switch
                id="required"
                checked={required}
                onCheckedChange={setRequired}
              />
            </div>
          )}

          {/* Read-only Toggle */}
          {!isVirtual && (
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="readonly">Read-only</Label>
                <p className="text-xs text-muted-foreground">
                  Field cannot be edited
                </p>
              </div>
              <Switch
                id="readonly"
                checked={readOnly}
                onCheckedChange={setReadOnly}
              />
            </div>
          )}

          {/* Default Value */}
          {!isVirtual && type !== 'attachment' && type !== 'json' && (
            <div className="space-y-2">
              <Label htmlFor="default-value">Default Value</Label>
              {type === 'checkbox' ? (
                <Select
                  value={defaultValue ? 'true' : 'false'}
                  onValueChange={(v) => setDefaultValue(v === 'true')}
                >
                  <SelectTrigger id="default-value">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">False</SelectItem>
                    <SelectItem value="true">True</SelectItem>
                  </SelectContent>
                </Select>
              ) : type === 'date' ? (
                <Input
                  id="default-value"
                  type="date"
                  value={
                    defaultValue
                      ? new Date(defaultValue).toISOString().split('T')[0]
                      : ''
                  }
                  onChange={(e) =>
                    setDefaultValue(
                      e.target.value ? new Date(e.target.value).toISOString() : null
                    )
                  }
                />
              ) : type === 'number' ||
                type === 'currency' ||
                type === 'percent' ? (
                <Input
                  id="default-value"
                  type="number"
                  value={defaultValue || ''}
                  onChange={(e) =>
                    setDefaultValue(
                      e.target.value ? parseFloat(e.target.value) : null
                    )
                  }
                />
              ) : (
                <Input
                  id="default-value"
                  value={defaultValue || ''}
                  onChange={(e) => setDefaultValue(e.target.value || null)}
                  placeholder="Default value"
                />
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 mt-8 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
