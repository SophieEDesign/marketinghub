"use client"

import { useState, useEffect } from "react"
import { X, Save, Trash2, AlertTriangle } from "lucide-react"
import type { FieldType, TableField, FieldOptions } from "@/types/fields"
import { FIELD_TYPES } from "@/types/fields"
import FormulaEditor from "@/components/fields/FormulaEditor"

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
}: FieldBuilderDrawerProps) {
  const [name, setName] = useState("")
  const [type, setType] = useState<FieldType>("text")
  const [required, setRequired] = useState(false)
  const [defaultValue, setDefaultValue] = useState<any>(null)
  const [options, setOptions] = useState<FieldOptions>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

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
    setWarning(null)
    setShowDeleteConfirm(false)
  }, [field, isOpen])

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
              {(options.choices || [""]).map((choice, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={choice}
                    onChange={(e) => {
                      const newChoices = [...(options.choices || [])]
                      newChoices[index] = e.target.value
                      setOptions({ ...options, choices: newChoices })
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="Option name"
                  />
                  <button
                    onClick={() => {
                      const newChoices = (options.choices || []).filter((_, i) => i !== index)
                      setOptions({ ...options, choices: newChoices })
                    }}
                    className="px-2 text-red-600 hover:bg-red-50 rounded"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
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
          <div className="space-y-2">
            <label className="block text-sm font-medium">Linked Table</label>
            <input
              type="text"
              value={options.linked_table_id || ""}
              onChange={(e) =>
                setOptions({ ...options, linked_table_id: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder="Table ID"
            />
            <p className="text-xs text-gray-500">
              Enter the ID of the table to link to
            </p>
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
          <div className="space-y-2">
            <label className="block text-sm font-medium">Lookup Table</label>
            <input
              type="text"
              value={options.lookup_table_id || ""}
              onChange={(e) =>
                setOptions({ ...options, lookup_table_id: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-2"
              placeholder="Table ID"
            />
            <label className="block text-sm font-medium">Lookup Field</label>
            <input
              type="text"
              value={options.lookup_field_id || ""}
              onChange={(e) =>
                setOptions({ ...options, lookup_field_id: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder="Field ID"
            />
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
