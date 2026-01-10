"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Link2, Plus, X, Calculator } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { formatDateUK } from "@/lib/utils"
import type { TableField } from "@/types/fields"
import { useToast } from "@/components/ui/use-toast"
import LookupFieldPicker, { type LookupFieldConfig } from "@/components/fields/LookupFieldPicker"

// Default color scheme for select options (vibrant, accessible colors)
const DEFAULT_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#A855F7', // Violet
]

// Helper function to get a consistent color for a choice
const getColorForChoiceName = (choice: string, customColors?: Record<string, string>): string => {
  if (customColors?.[choice]) {
    return customColors[choice]
  }
  
  // Try case-insensitive match
  if (customColors) {
    const matchingKey = Object.keys(customColors).find(
      key => key.toLowerCase() === choice.toLowerCase()
    )
    if (matchingKey) {
      return customColors[matchingKey]
    }
  }
  
  // Generate consistent color from choice name (hash-based)
  let hash = 0
  for (let i = 0; i < choice.length; i++) {
    hash = choice.charCodeAt(i) + ((hash << 5) - hash)
  }
  return DEFAULT_COLORS[Math.abs(hash) % DEFAULT_COLORS.length]
}

// Calculate text color based on background luminance
const getTextColor = (hexColor: string): string => {
  try {
    const r = parseInt(hexColor.slice(1, 3), 16)
    const g = parseInt(hexColor.slice(3, 5), 16)
    const b = parseInt(hexColor.slice(5, 7), 16)
    
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      return 'text-gray-900'
    }
    
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5 ? 'text-gray-900' : 'text-white'
  } catch {
    return 'text-gray-900'
  }
}

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

  // Linked records and lookup fields - use LookupFieldPicker
  if (field.type === "link_to_table" || field.type === "lookup") {
    const linkedTableId = field.type === "link_to_table" 
      ? field.options?.linked_table_id 
      : field.options?.lookup_table_id

    // Build lookup config from field options
    const lookupConfig: LookupFieldConfig | undefined = linkedTableId ? {
      lookupTableId: linkedTableId,
      primaryLabelField: field.options?.primary_label_field || 'name',
      secondaryLabelFields: field.options?.secondary_label_fields || [],
      relationshipType: field.options?.relationship_type || (field.type === "link_to_table" ? 'one-to-many' : 'one-to-one'),
      maxSelections: field.options?.max_selections,
      required: field.required,
      allowCreate: field.options?.allow_create,
    } : undefined

    // Handle create new record
    const handleCreateRecord = async (tableId: string): Promise<string | null> => {
      try {
        const supabase = createClient()
        
        // Get table info
        const { data: table } = await supabase
          .from("tables")
          .select("supabase_table")
          .eq("id", tableId)
          .single()

        if (!table) return null

        // Get fields to create a minimal record
        const { data: fields } = await supabase
          .from("table_fields")
          .select("*")
          .eq("table_id", tableId)
          .order("position", { ascending: true })
          .limit(5) // Just get first few fields

        // Create minimal record with default values
        const newRecord: Record<string, any> = {}
        fields?.forEach(f => {
          if (f.default_value !== null && f.default_value !== undefined) {
            newRecord[f.name] = f.default_value
          }
        })

        const { data, error } = await supabase
          .from(table.supabase_table)
          .insert([newRecord])
          .select()
          .single()

        if (error) {
          console.error("Error creating record:", error)
          toast({
            title: "Failed to create record",
            description: error.message || "Please try again",
            variant: "destructive",
          })
          return null
        }

        return data?.id || null
      } catch (error: any) {
        console.error("Error in handleCreateRecord:", error)
        return null
      }
    }

    if (isReadOnly && field.type === "lookup") {
      // Lookup fields are read-only, show display value
      return (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
            {field.name}
            <span title="Lookup field (read-only)">
              <Calculator className="h-3 w-3 text-gray-400" />
            </span>
          </label>
          <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700 italic">
            {value !== null && value !== undefined ? String(value) : "—"}
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
        {lookupConfig ? (
          <LookupFieldPicker
            field={field}
            value={value}
            onChange={onChange}
            config={lookupConfig}
            disabled={isReadOnly}
            placeholder={`Select ${field.name}...`}
            onRecordClick={onLinkedRecordClick}
            onCreateRecord={lookupConfig.allowCreate ? handleCreateRecord : undefined}
          />
        ) : (
          <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-500">
            Configure lookup table in field settings
          </div>
        )}
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
          <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm min-h-[38px] flex items-center flex-wrap gap-1.5">
            {selectedValues.length > 0 ? (
              selectedValues.map((val: string) => {
                const hexColor = getColorForChoiceName(val, field.options?.choiceColors)
                const textColorClass = getTextColor(hexColor)
                const bgColor = hexColor.startsWith('#') ? hexColor : `#${hexColor}`
                return (
                  <span
                    key={val}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap shadow-sm ${textColorClass}`}
                    style={{ backgroundColor: bgColor }}
                  >
                    {val}
                  </span>
                )
              })
            ) : (
              <span className="text-gray-400 italic">—</span>
            )}
          </div>
        ) : (
          <div
            onClick={onEditStart}
            className="px-3 py-2 border border-gray-200 rounded-md hover:border-blue-500 hover:bg-gray-50 transition-colors cursor-pointer min-h-[38px] flex items-center flex-wrap gap-1.5"
          >
            {selectedValues.length > 0 ? (
              selectedValues.map((val: string) => {
                const hexColor = getColorForChoiceName(val, field.options?.choiceColors)
                const textColorClass = getTextColor(hexColor)
                const bgColor = hexColor.startsWith('#') ? hexColor : `#${hexColor}`
                return (
                  <span
                    key={val}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap shadow-sm ${textColorClass}`}
                    style={{ backgroundColor: bgColor }}
                  >
                    {val}
                  </span>
                )
              })
            ) : (
              <span className="text-sm text-gray-400 italic">Click to select...</span>
            )}
          </div>
        )}
      </div>
    )
  }

  // Date fields
  if (field.type === "date") {
    // For input: use ISO format (YYYY-MM-DD) - HTML5 date input requires this
    const dateValueForInput = value ? new Date(value).toISOString().split("T")[0] : ""
    // For display: use UK format (DD/MM/YYYY)
    const dateValueForDisplay = value ? formatDateUK(value, "—") : ""

    if (isEditing && !isReadOnly) {
      return (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">{field.name}</label>
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="date"
            value={dateValueForInput}
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
            {dateValueForDisplay || "—"}
          </div>
        ) : (
          <div
            onClick={onEditStart}
            className="px-3 py-2 border border-gray-200 rounded-md hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer text-sm text-gray-900"
          >
            {dateValueForDisplay || <span className="text-gray-400">Click to set date...</span>}
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
          <span title="Formula or lookup field">
            <Calculator className="h-3 w-3 text-gray-400" />
          </span>
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

