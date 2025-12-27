"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Link2, Plus, X, Calculator } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { TableField } from "@/types/fields"
import { useToast } from "@/components/ui/use-toast"

interface InlineFieldEditorProps {
  field: TableField
  value: any
  onChange: (value: any) => void
  isEditing: boolean
  onEditStart: () => void
  onEditEnd: () => void
  onLinkedRecordClick: (tableId: string, recordId: string) => void
  onAddLinkedRecord: (field: TableField) => void
}

export default function InlineFieldEditor({
  field,
  value,
  onChange,
  isEditing,
  onEditStart,
  onEditEnd,
  onLinkedRecordClick,
  onAddLinkedRecord,
}: InlineFieldEditorProps) {
  const { toast } = useToast()
  const [localValue, setLocalValue] = useState(value)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      if (inputRef.current instanceof HTMLInputElement || inputRef.current instanceof HTMLTextAreaElement) {
        inputRef.current.select()
      }
    }
  }, [isEditing])

  const debouncedSave = useCallback(
    (newValue: any) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = setTimeout(() => {
        onChange(newValue)
      }, 500) // 500ms debounce
    },
    [onChange]
  )

  const handleChange = (newValue: any) => {
    setLocalValue(newValue)
    debouncedSave(newValue)
  }

  const handleBlur = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    onChange(localValue)
    onEditEnd()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && field.type !== "long_text") {
      e.preventDefault()
      handleBlur()
    } else if (e.key === "Escape") {
      setLocalValue(value) // Reset to original value
      onEditEnd()
    }
  }

  const isVirtual = field.type === "formula" || field.type === "lookup"
  const isReadOnly = isVirtual || field.options?.read_only

  // Linked records
  if (field.type === "link_to_table") {
    const linkedTableId = field.options?.linked_table_id
    const linkedRecords = Array.isArray(value) ? value : value ? [value] : []

    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
          {field.name}
          {isVirtual && (
            <span title="Formula or lookup field">
              <Calculator className="h-3 w-3 text-gray-400" />
            </span>
          )}
        </label>
        <div className="space-y-2">
          {linkedRecords.map((recordId: string, index: number) => (
            <div
              key={index}
              className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors group"
            >
              <Link2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <button
                onClick={() => linkedTableId && onLinkedRecordClick(linkedTableId, recordId)}
                className="flex-1 text-left text-sm text-gray-900 hover:text-blue-600"
              >
                {recordId.substring(0, 8)}...
              </button>
              {!isReadOnly && (
                <button
                  onClick={() => {
                    const newRecords = linkedRecords.filter((_, i) => i !== index)
                    onChange(newRecords.length === 1 ? newRecords[0] : newRecords)
                  }}
                  className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 rounded transition-all"
                >
                  <X className="h-3 w-3 text-red-600" />
                </button>
              )}
            </div>
          ))}
          {!isReadOnly && linkedTableId && (
            <button
              onClick={() => onAddLinkedRecord(field)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-dashed border-gray-300 rounded-md transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add linked record
            </button>
          )}
        </div>
      </div>
    )
  }

  // Select fields
  if (field.type === "single_select" || field.type === "multi_select") {
    const choices = field.options?.choices || []
    const isMulti = field.type === "multi_select"
    const selectedValues = isMulti
      ? (Array.isArray(value) ? value : value ? [value] : [])
      : value
        ? [value]
        : []

    if (isEditing && !isReadOnly) {
      return (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">{field.name}</label>
          <div className="space-y-2">
            {choices.map((choice: string) => {
              const isSelected = selectedValues.includes(choice)
              return (
                <label
                  key={choice}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type={isMulti ? "checkbox" : "radio"}
                    checked={isSelected}
                    onChange={(e) => {
                      if (isMulti) {
                        const newValues = e.target.checked
                          ? [...selectedValues, choice]
                          : selectedValues.filter((v) => v !== choice)
                        handleChange(newValues)
                      } else {
                        handleChange(e.target.checked ? choice : null)
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-900">{choice}</span>
                </label>
              )
            })}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleBlur}
              className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
          {field.name}
          {isVirtual && (
            <span title="Formula or lookup field">
              <Calculator className="h-3 w-3 text-gray-400" />
            </span>
          )}
        </label>
        {isReadOnly ? (
          <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700 italic">
            {selectedValues.length > 0 ? selectedValues.join(", ") : "—"}
          </div>
        ) : (
          <div
            onClick={onEditStart}
            className="px-3 py-2 border border-gray-200 rounded-md hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer min-h-[38px] flex items-center flex-wrap gap-2"
          >
            {selectedValues.length > 0 ? (
              selectedValues.map((val: string) => (
                <span
                  key={val}
                  className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium"
                >
                  {val}
                </span>
              ))
            ) : (
              <span className="text-sm text-gray-400">Click to select...</span>
            )}
          </div>
        )}
      </div>
    )
  }

  // Date fields
  if (field.type === "date") {
    const dateValue = value ? new Date(value).toISOString().split("T")[0] : ""

    if (isEditing && !isReadOnly) {
      return (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">{field.name}</label>
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="date"
            value={dateValue}
            onChange={(e) => handleChange(e.target.value || null)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )
    }

    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
          {field.name}
          {isVirtual && (
            <span title="Formula or lookup field">
              <Calculator className="h-3 w-3 text-gray-400" />
            </span>
          )}
        </label>
        {isReadOnly ? (
          <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700 italic">
            {dateValue || "—"}
          </div>
        ) : (
          <div
            onClick={onEditStart}
            className="px-3 py-2 border border-gray-200 rounded-md hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer text-sm text-gray-900"
          >
            {dateValue || <span className="text-gray-400">Click to set date...</span>}
          </div>
        )}
      </div>
    )
  }

  // Checkbox
  if (field.type === "checkbox") {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
          {field.name}
          {isVirtual && (
            <span title="Formula or lookup field">
              <Calculator className="h-3 w-3 text-gray-400" />
            </span>
          )}
        </label>
        {isReadOnly ? (
          <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700 italic">
            {value ? "Yes" : "No"}
          </div>
        ) : (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
              className="w-4 h-4 cursor-pointer"
            />
            <span className="text-sm text-gray-700">{value ? "Yes" : "No"}</span>
          </label>
        )}
      </div>
    )
  }

  // Long text
  if (field.type === "long_text") {
    if (isEditing && !isReadOnly) {
      return (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">{field.name}</label>
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={localValue ?? ""}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={4}
            placeholder="Enter text..."
          />
          <div className="flex gap-2">
            <button
              onClick={handleBlur}
              className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
          {field.name}
          {isVirtual && (
            <span title="Formula or lookup field">
              <Calculator className="h-3 w-3 text-gray-400" />
            </span>
          )}
        </label>
        {isReadOnly ? (
          <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700 italic whitespace-pre-wrap">
            {value || "—"}
          </div>
        ) : (
          <div
            onClick={onEditStart}
            className="px-3 py-2 border border-gray-200 rounded-md hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer text-sm text-gray-900 min-h-[60px] whitespace-pre-wrap"
          >
            {value || <span className="text-gray-400">Click to add text...</span>}
          </div>
        )}
      </div>
    )
  }

  // Default: Text, Number, Email, URL, etc.
  if (isEditing && !isReadOnly) {
    const inputType =
      field.type === "number"
        ? "number"
        : field.type === "email"
          ? "email"
          : field.type === "url"
            ? "url"
            : "text"

    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">{field.name}</label>
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type={inputType}
          value={localValue ?? ""}
          onChange={(e) =>
            handleChange(inputType === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)
          }
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={`Enter ${field.name}...`}
        />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
        {field.name}
        {isVirtual && (
          <Calculator className="h-3 w-3 text-gray-400" title="Formula field" />
        )}
      </label>
      {isReadOnly ? (
        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700 italic">
          {value !== null && value !== undefined ? String(value) : "—"}
          {field.type === "formula" && field.options?.formula && (
            <div className="text-xs text-gray-500 mt-1 font-mono">
              = {field.options.formula}
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={onEditStart}
          className="px-3 py-2 border border-gray-200 rounded-md hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer text-sm text-gray-900 min-h-[38px] flex items-center"
        >
          {value !== null && value !== undefined ? (
            String(value)
          ) : (
            <span className="text-gray-400">Click to edit...</span>
          )}
        </div>
      )}
    </div>
  )
}

