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
import type { FieldType, TableField, FieldOptions, ChoiceColorTheme, SelectOption } from "@/types/fields"
import { FIELD_TYPES } from "@/types/fields"
import { CHOICE_COLOR_THEME_LABELS, isChoiceColorTheme, resolveChoiceColor } from "@/lib/field-colors"
import FormulaEditor from "@/components/fields/FormulaEditor"
import { getFieldDisplayName } from "@/lib/fields/display"
import { normalizeSelectOptionsForUi } from "@/lib/fields/select-options"

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

  function safeId(): string {
    // Browser + modern runtimes
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return (crypto as any).randomUUID()
    }
    // Fallback: not cryptographically strong, but stable enough for option ids
    return `opt_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
  }

  function nowIso(): string {
    try {
      return new Date().toISOString()
    } catch {
      return ''
    }
  }

  function syncSelectOptionsPayload(
    base: FieldOptions,
    input: SelectOption[],
    { dropEmpty }: { dropEmpty: boolean }
  ): FieldOptions {
    const mapped = (Array.isArray(input) ? input : [])
      .map((o) => ({
        id: String(o?.id || '').trim() || safeId(),
        // Preserve in-progress typing (don't trim until save)
        label: typeof o?.label === 'string' ? o.label : String(o?.label ?? ''),
        color: (() => {
          if (typeof o?.color === 'string' && o.color) return o.color
          const label = typeof o?.label === 'string' ? o.label : String(o?.label ?? '')
          const m = (base?.choiceColors || {}) as Record<string, string>
          const direct = typeof m[label] === 'string' ? m[label] : undefined
          const trimmed = typeof m[label.trim()] === 'string' ? m[label.trim()] : undefined
          return direct || trimmed
        })(),
        sort_index:
          typeof o?.sort_index === 'number' && Number.isFinite(o.sort_index) ? Math.trunc(o.sort_index) : 0,
        created_at: typeof o?.created_at === 'string' && o.created_at ? o.created_at : nowIso(),
      }))
      .sort((a, b) => a.sort_index - b.sort_index)
      .map((o, idx) => ({ ...o, sort_index: idx }))

    const kept = dropEmpty ? mapped.filter((o) => String(o.label).trim().length > 0) : mapped
    const reindexed = kept.map((o, idx) => ({ ...o, sort_index: idx }))

    const choices = reindexed.map((o) => o.label)
    const choiceColors: Record<string, string> = {}
    for (const o of reindexed) {
      const key = String(o.label).trim()
      if (!key) continue
      if (o.color) choiceColors[key] = o.color
    }

    const next: FieldOptions = {
      ...base,
      selectOptions: reindexed,
      // Keep legacy keys in sync so older UI paths remain stable.
      choices,
      choiceColors: Object.keys(choiceColors).length > 0 ? choiceColors : undefined,
    }
    return next
  }

  useEffect(() => {
    if (field) {
      setName(getFieldDisplayName(field))
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

  // When editing select fields, ensure we always have a normalized selectOptions model in state.
  useEffect(() => {
    if (!isOpen) return
    if (type !== 'single_select' && type !== 'multi_select') return
    const { didRepair, repairedFieldOptions } = normalizeSelectOptionsForUi(type, options)
    if (didRepair && repairedFieldOptions) {
      setOptions(repairedFieldOptions)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, type])

  // Load tables for lookup and link_to_table fields
  useEffect(() => {
    if (isOpen && (type === 'lookup' || type === 'link_to_table')) {
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
    // Canonicalize select field options (ordering + colors) so the 3-dots editor
    // matches the Design-side editor behavior.
    const optionsForSave: FieldOptions = (() => {
      let opts: FieldOptions = { ...options }
      if (type === 'single_select' || type === 'multi_select') {
        const normalized = normalizeSelectOptionsForUi(type, opts)
        opts = normalized.repairedFieldOptions || opts
        const { selectOptions } = normalizeSelectOptionsForUi(type, opts)
        const ordered = [...selectOptions].sort((a, b) => a.sort_index - b.sort_index)
        const trimmed = ordered.map((o) => ({ ...o, label: String(o.label ?? '').trim() }))
        opts = syncSelectOptionsPayload(opts, trimmed, { dropEmpty: true })
      }
      // Filter out empty legacy choices (defensive)
      if (Array.isArray(opts.choices)) {
        opts.choices = opts.choices.filter((c) => String(c).trim().length > 0)
        if (opts.choices.length === 0) delete opts.choices
      }
      return opts
    })()

    const validation = validateFieldOptions(type, optionsForSave)
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
            label: name.trim(),
            type,
            required,
            default_value: defaultValue,
            options: optionsForSave,
          }
        : {
            label: name.trim(),
            type,
            required,
            default_value: defaultValue,
            options: optionsForSave,
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
                  setOptions(next)
                }}
              >
                <SelectTrigger className="bg-white">
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
            <div className="space-y-2">
              {(() => {
                const { selectOptions } = normalizeSelectOptionsForUi(type as any, options)
                const ordered = (
                  selectOptions.length > 0
                    ? selectOptions
                    : [{ id: safeId(), label: '', sort_index: 0, created_at: nowIso() }]
                )
                  .slice()
                  .sort((a, b) => a.sort_index - b.sort_index)

                const applyReindexed = (next: SelectOption[]) => {
                  const reindexed = next.map((o, idx) => ({ ...o, sort_index: idx }))
                  setOptions((prev) => syncSelectOptionsPayload(prev, reindexed, { dropEmpty: false }))
                }

                const sortByLabel = (dir: 1 | -1) => {
                  const sorted = ordered
                    .filter((o) => String(o.label || '').trim().length > 0)
                    .slice()
                    .sort((a, b) =>
                      dir * String(a.label).localeCompare(String(b.label), undefined, { sensitivity: 'base' })
                    )
                  applyReindexed(sorted)
                }

                const move = (from: number, to: number) => {
                  if (from === to) return
                  if (from < 0 || to < 0) return
                  if (from >= ordered.length || to >= ordered.length) return
                  const next = ordered.slice()
                  const [item] = next.splice(from, 1)
                  next.splice(to, 0, item)
                  applyReindexed(next)
                }

                return (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-gray-500">Drag to reorder, or sort alphabetically.</p>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => sortByLabel(1)}
                          disabled={ordered.filter((o) => String(o.label || '').trim().length > 0).length < 2}
                          className="h-8"
                          title="Sort A to Z (updates manual order)"
                        >
                          Sort A→Z
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => sortByLabel(-1)}
                          disabled={ordered.filter((o) => String(o.label || '').trim().length > 0).length < 2}
                          className="h-8"
                          title="Sort Z to A (updates manual order)"
                        >
                          Sort Z→A
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {ordered.map((opt, index) => {
                        const label = String(opt.label || '')
                        const defaultColor = resolveChoiceColor(
                          label,
                          type as 'single_select' | 'multi_select',
                          options,
                          type === 'single_select'
                        )
                        const colorValue = opt.color || options.choiceColors?.[label] || defaultColor

                        return (
                          <div
                            key={opt.id || `${index}`}
                            className="flex gap-2 items-center rounded-md border border-gray-200 bg-white px-2 py-2"
                            onDragOver={(e) => {
                              e.preventDefault()
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              const fromStr = e.dataTransfer.getData('text/plain')
                              const from = Number.parseInt(fromStr, 10)
                              if (Number.isFinite(from)) move(from, index)
                            }}
                          >
                            <button
                              type="button"
                              className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 select-none px-1"
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', String(index))
                                e.dataTransfer.effectAllowed = 'move'
                              }}
                              aria-label="Drag to reorder"
                              title="Drag to reorder"
                            >
                              ⋮⋮
                            </button>

                            <Input
                              type="text"
                              value={label}
                              onChange={(e) => {
                                const next = ordered.slice()
                                const preservedColor =
                                  next[index]?.color ||
                                  options.choiceColors?.[label] ||
                                  options.choiceColors?.[label.trim()] ||
                                  undefined
                                next[index] = {
                                  ...next[index],
                                  label: e.target.value,
                                  color: preservedColor,
                                  created_at: next[index]?.created_at || nowIso(),
                                }
                                applyReindexed(next)
                              }}
                              placeholder="Option name"
                              className="flex-1"
                            />

                            <input
                              type="color"
                              value={colorValue}
                              onChange={(e) => {
                                const next = ordered.slice()
                                next[index] = {
                                  ...next[index],
                                  color: e.target.value,
                                  created_at: next[index]?.created_at || nowIso(),
                                }
                                applyReindexed(next)
                              }}
                              className="h-10 w-10 rounded border border-gray-300 cursor-pointer"
                              title="Choose color for this option"
                            />

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const next = ordered.filter((_, i) => i !== index)
                                applyReindexed(next)
                              }}
                              className="h-10 w-10 p-0"
                              title="Delete"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )
              })()}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const { selectOptions } = normalizeSelectOptionsForUi(type as any, options)
                  const next = [...selectOptions].sort((a, b) => a.sort_index - b.sort_index)
                  next.push({
                    id: safeId(),
                    label: '',
                    sort_index: next.length,
                    created_at: nowIso(),
                  })
                  setOptions((prev) => syncSelectOptionsPayload(prev, next, { dropEmpty: false }))
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

      case "link_to_table":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="linked-table">Linked Table *</Label>
              <Select
                value={options.linked_table_id || undefined}
                onValueChange={(tableId) =>
                  setOptions({ 
                    ...options, 
                    linked_table_id: tableId || undefined,
                  })
                }
              >
                <SelectTrigger id="linked-table">
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
              <p className="text-xs text-gray-500">
                Select the table to link records from. Each row can contain one or more records from that table.
              </p>
            </div>
            
            {options.linked_table_id && (
              <div className="space-y-3 border-t pt-4">
                <div className="space-y-2">
                  <Label htmlFor="link-relationship-type" className="text-sm font-normal">
                    How many records can be selected
                  </Label>
                  <Select
                    value={options.relationship_type || 'one-to-many'}
                    onValueChange={(relType) =>
                      setOptions({ ...options, relationship_type: relType as any })
                    }
                  >
                    <SelectTrigger id="link-relationship-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one-to-one">One to One</SelectItem>
                      <SelectItem value="one-to-many">One to Many</SelectItem>
                      <SelectItem value="many-to-many">Many to Many</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    {(options.relationship_type || 'one-to-many') === 'one-to-one' 
                      ? 'Each row can link to a single record from the linked table.'
                      : 'Each row can link to multiple records from the linked table.'}
                  </p>
                </div>

                {(options.relationship_type === 'one-to-many' || options.relationship_type === 'many-to-many' || !options.relationship_type) && (
                  <div className="space-y-2">
                    <Label htmlFor="link-max-selections" className="text-sm font-normal">
                      Max Selections (optional)
                    </Label>
                    <Input
                      id="link-max-selections"
                      type="number"
                      min="1"
                      value={options.max_selections || ''}
                      onChange={(e) =>
                        setOptions({ 
                          ...options, 
                          max_selections: e.target.value ? parseInt(e.target.value) : undefined 
                        })
                      }
                      placeholder="No limit"
                    />
                    <p className="text-xs text-gray-500">
                      Limit the maximum number of linked records that can be selected.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
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
