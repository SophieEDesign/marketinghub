"use client"

import { useState, useEffect } from "react"
import { X, Save, Trash2, AlertTriangle } from "lucide-react"
import type { FieldType, TableField, FieldOptions } from "@/types/fields"
import { FIELD_TYPES } from "@/types/fields"
import { resolveChoiceColor } from "@/lib/field-colors"
import FormulaEditor from "@/components/fields/FormulaEditor"
import { getFieldDisplayName } from "@/lib/fields/display"
import { createClient } from "@/lib/supabase/client"

interface FieldBuilderDrawerProps {
  isOpen: boolean
  onClose: () => void
  tableId: string
  field?: TableField | null
  onSave: () => void
  tableFields?: TableField[]
}

export default function FieldBuilderDrawer({
  isOpen,
  onClose,
  tableId,
  field,
  onSave,
  tableFields = [],
}: FieldBuilderDrawerProps) {
  const [name, setName] = useState("")
  const [type, setType] = useState<FieldType>("text")
  const [required, setRequired] = useState(false)
  const [groupName, setGroupName] = useState<string>("")
  const [defaultValue, setDefaultValue] = useState<any>(null)
  const [options, setOptions] = useState<FieldOptions>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [tables, setTables] = useState<Array<{ id: string; name: string }>>([])
  const [loadingTables, setLoadingTables] = useState(false)
  const [lookupTableFields, setLookupTableFields] = useState<
    Array<{ id: string; name: string; type: string }>
  >([])
  const [loadingLookupFields, setLoadingLookupFields] = useState(false)

  const isEdit = !!field
  const fieldTypeInfo = FIELD_TYPES.find(t => t.type === type)
  const isVirtual = fieldTypeInfo?.isVirtual || false

  useEffect(() => {
    if (field) {
      setName(getFieldDisplayName(field))
      setType(field.type)
      setRequired(field.required || false)
      setGroupName(field.group_name || "")
      setDefaultValue(field.default_value)
      setOptions(field.options || {})
    } else {
      setName("")
      setType("text")
      setRequired(false)
      setGroupName("")
      setDefaultValue(null)
      setOptions({})
    }
    setError(null)
    setWarning(null)
    setShowDeleteConfirm(false)
  }, [field, isOpen])

  // Load tables for link_to_table and lookup fields.
  useEffect(() => {
    if (!isOpen) return
    if (type !== "link_to_table" && type !== "lookup") return
    loadTables()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, type])

  // Load fields for lookup table selection.
  useEffect(() => {
    if (!isOpen) return
    if (type !== "lookup" || !options.lookup_table_id) {
      setLookupTableFields([])
      return
    }
    loadLookupTableFields(options.lookup_table_id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, type, options.lookup_table_id])

  async function loadTables() {
    setLoadingTables(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("tables")
        .select("id, name")
        .order("name", { ascending: true })

      if (!error && data) {
        setTables(data)
      }
    } catch (e) {
      console.error("Error loading tables:", e)
    } finally {
      setLoadingTables(false)
    }
  }

  async function loadLookupTableFields(lookupTableId: string) {
    setLoadingLookupFields(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("table_fields")
        .select("id, name, type")
        .eq("table_id", lookupTableId)
        .order("position", { ascending: true })

      if (!error && data) {
        setLookupTableFields(data)
      } else {
        setLookupTableFields([])
      }
    } catch (e) {
      console.error("Error loading lookup table fields:", e)
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

    setLoading(true)
    setError(null)
    setWarning(null)

    try {
      const url = `/api/tables/${tableId}/fields`
      const method = isEdit ? "PATCH" : "POST"
      const body = isEdit
        ? {
            fieldId: field!.id,
            label: name.trim(),
            type,
            required,
            group_name: groupName.trim() || null,
            default_value: defaultValue,
            options,
          }
        : {
            label: name.trim(),
            type,
            required,
            group_name: groupName.trim() || null,
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
        if (data.warning) {
          setWarning(data.warning)
        }
        setLoading(false)
        return
      }

      if (data.warning) {
        setWarning(data.warning)
        // Still consider it a success, but show warning
      }

      onSave()
      onClose()
    } catch (err: any) {
      setError(err.message || "Failed to save field")
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!field || !showDeleteConfirm) {
      setShowDeleteConfirm(true)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/tables/${tableId}/fields?fieldId=${field.id}`,
        { method: "DELETE" }
      )

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to delete field")
        setLoading(false)
        return
      }

      onSave()
      onClose()
    } catch (err: any) {
      setError(err.message || "Failed to delete field")
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
            <label className="block text-sm font-medium">Choices</label>
            <div className="space-y-2">
              {(options.choices || [""]).map((choice, index) => {
                // Use centralized color system for default
                const choiceColor = options.choiceColors?.[choice] || resolveChoiceColor(
                  choice,
                  type as 'single_select' | 'multi_select',
                  options,
                  type === 'single_select'
                )
                return (
                  <div key={index} className="flex gap-2 items-center">
                    <input
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
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                      placeholder="Option name"
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
                    <button
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
                      className="px-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}
              <button
                onClick={() => {
                  setOptions({
                    ...options,
                    choices: [...(options.choices || []), ""],
                  })
                }}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                + Add choice
              </button>
            </div>
          </div>
        )

      case "link_to_table":
        return (
          <div className="space-y-4">
            <label className="block text-sm font-medium">Linked Table</label>
            <select
              value={options.linked_table_id || ""}
              onChange={(e) =>
                setOptions({
                  ...options,
                  linked_table_id: e.target.value || undefined,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
              disabled={loadingTables}
            >
              <option value="" disabled>
                {loadingTables ? "Loading tables..." : "Select a table"}
              </option>
              {tables
                .filter((t) => t.id !== tableId) // Don’t allow linking to self
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
            <p className="text-xs text-gray-500">
              Select the table to link records from. Each row can contain one or
              more records from that table.
            </p>
            
            {options.linked_table_id && (
              <div className="space-y-3 border-t pt-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium">
                    How many records can be selected
                  </label>
                  <select
                    value={options.relationship_type || 'one-to-many'}
                    onChange={(e) =>
                      setOptions({ ...options, relationship_type: e.target.value as any })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                  >
                    <option value="one-to-one">One to One</option>
                    <option value="one-to-many">One to Many</option>
                    <option value="many-to-many">Many to Many</option>
                  </select>
                  <p className="text-xs text-gray-500">
                    {(options.relationship_type || 'one-to-many') === 'one-to-one' 
                      ? 'Each row can link to a single record from the linked table.'
                      : 'Each row can link to multiple records from the linked table.'}
                  </p>
                </div>

                {(options.relationship_type === 'one-to-many' || options.relationship_type === 'many-to-many' || !options.relationship_type) && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium">
                      Max Selections (optional)
                    </label>
                    <input
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
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
        // Get linked fields from current table
        const linkedFields = tableFields.filter(
          (f) => f.type === 'link_to_table' && f.id !== field?.id
        )

        return (
          <div className="space-y-2">
            <label className="block text-sm font-medium">Linked Field *</label>
            <select
              value={options.lookup_field_id || ""}
              onChange={(e) => {
                const linkedFieldId = e.target.value || undefined
                // Find the selected linked field to get its linked_table_id
                const selectedLinkedField = linkedFields.find(f => f.id === linkedFieldId)
                const linkedTableId = selectedLinkedField?.options?.linked_table_id
                
                setOptions({
                  ...options,
                  lookup_field_id: linkedFieldId,
                  lookup_table_id: linkedTableId || undefined,
                  // Reset result field when linked field changes
                  lookup_result_field_id: undefined,
                })
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white mb-2"
            >
              <option value="" disabled>
                Select a linked field
              </option>
              {linkedFields.length === 0 ? (
                <option value="" disabled>
                  No linked fields found. Create a link field first.
                </option>
              ) : (
                linkedFields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {getFieldDisplayName(f)}
                  </option>
                ))
              )}
            </select>
            <p className="text-xs text-gray-500 mb-2">
              Select a linked field in this table that connects to the table you want to look up.
            </p>
            {options.lookup_table_id && (
              <>
                <label className="block text-sm font-medium">Display Field *</label>
                <select
                  value={options.lookup_result_field_id || ""}
                  onChange={(e) =>
                    setOptions({
                      ...options,
                      lookup_result_field_id: e.target.value || undefined,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                  disabled={loadingLookupFields}
                >
                  <option value="" disabled>
                    {loadingLookupFields
                      ? "Loading fields..."
                      : "Select a field to display"}
                  </option>
                  {lookupTableFields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.type})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  Select which field from the linked table to display in this lookup field.
                </p>
              </>
            )}
          </div>
        )

      case "number":
      case "currency":
      case "percent":
        return (
          <div className="space-y-2">
            <label className="block text-sm font-medium">Precision</label>
            <input
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            {type === "currency" && (
              <>
                <label className="block text-sm font-medium mt-2">
                  Currency Symbol
                </label>
                <input
                  type="text"
                  value={options.currency_symbol || "$"}
                  onChange={(e) =>
                    setOptions({ ...options, currency_symbol: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </>
            )}
          </div>
        )

      default:
        return null
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 h-full w-full md:w-[500px] bg-white shadow-xl z-50 flex flex-col transition-transform duration-300 ease-out"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {isEdit ? "Edit Field" : "Add Field"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {error}
            </div>
          )}

          {warning && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-700 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{warning}</span>
            </div>
          )}

          {/* Field Name */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Field Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter field name"
              disabled={loading}
            />
          </div>

          {/* Section Name */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Section Name (Optional)
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Social Media Fields, Press Fields"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Organize fields into sections. Fields with the same section name will be grouped together in pickers, modals, and canvas.
            </p>
          </div>

          {/* Field Type */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Field Type *
            </label>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as FieldType)
                // Reset options when type changes
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
              <p className="text-xs text-gray-500 mt-1">
                Virtual fields are calculated and do not store data in the database
              </p>
            )}
          </div>

          {/* Required */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="required"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="w-4 h-4"
              disabled={loading || isVirtual}
            />
            <label htmlFor="required" className="text-sm">
              Required
            </label>
            {isVirtual && (
              <span className="text-xs text-gray-500">(Not applicable for virtual fields)</span>
            )}
          </div>

          {/* Default Value */}
          {!isVirtual && (
            <div>
              <label className="block text-sm font-medium mb-1">
                Default Value
              </label>
              <input
                type={type === "number" ? "number" : type === "checkbox" ? "checkbox" : "text"}
                value={defaultValue ?? ""}
                onChange={(e) => {
                  if (type === "checkbox") {
                    setDefaultValue(e.target.checked)
                  } else if (type === "number") {
                    setDefaultValue(e.target.value ? Number(e.target.value) : null)
                  } else {
                    setDefaultValue(e.target.value || null)
                  }
                }}
                checked={type === "checkbox" ? !!defaultValue : undefined}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Default value (optional)"
                disabled={loading}
              />
            </div>
          )}

          {/* Type-specific Options */}
          {renderTypeSpecificOptions()}
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex items-center justify-between gap-2">
          {isEdit && (
            <button
              onClick={handleDelete}
              disabled={loading}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                showDeleteConfirm
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "text-red-600 hover:bg-red-50"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Trash2 className="h-4 w-4" />
              {showDeleteConfirm ? "Confirm Delete" : "Delete"}
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
