"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Calculator, Link as LinkIcon } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { formatDateUK } from "@/lib/utils"
import type { TableField } from "@/types/fields"
import { useToast } from "@/components/ui/use-toast"
import LookupFieldPicker, { type LookupFieldConfig } from "@/components/fields/LookupFieldPicker"
import RichTextEditor from "@/components/fields/RichTextEditor"

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

export interface FieldEditorProps {
  field: TableField
  value: any
  onChange: (value: any) => void
  isReadOnly?: boolean // Override read-only state (for field-level permissions)
  showLabel?: boolean // Whether to show the field label (default: true)
  labelClassName?: string // Custom classes for the label
  inputClassName?: string // Custom classes for the input container
  onLinkedRecordClick?: (tableId: string, recordId: string) => void
  onCreateRecord?: (tableId: string) => Promise<string | null> // For linked fields with allowCreate
  autoFocus?: boolean // Auto-focus the input when mounted
  required?: boolean // Show required indicator
}

/**
 * Centralized FieldEditor component
 * 
 * This is the single source of truth for field rendering and editing.
 * All UI surfaces (modals, forms, record views, tables) should use this component
 * to ensure consistent field behavior across the application.
 * 
 * Features:
 * - Renders appropriate input based on field type
 * - Handles field options (choices, colors, etc.)
 * - Respects read-only status (formula, lookup, read_only option)
 * - Supports all field types consistently
 */
export default function FieldEditor({
  field,
  value,
  onChange,
  isReadOnly: propIsReadOnly,
  showLabel = true,
  labelClassName = "block text-sm font-medium text-gray-700",
  inputClassName = "",
  onLinkedRecordClick,
  onCreateRecord,
  autoFocus = false,
  required = false,
}: FieldEditorProps) {
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null)

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  const isVirtual = field.type === "formula" || field.type === "lookup"
  // Use prop override first, then check field-level read-only, then virtual
  const isReadOnly = propIsReadOnly !== undefined ? propIsReadOnly : (isVirtual || field.options?.read_only)
  
  // Determine if this is a lookup field (derived) vs linked field (editable)
  const isLookupField = field.type === "lookup"
  const isLinkedField = field.type === "link_to_table"

  // Handle paste - block for lookup fields
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (field.type === "lookup") {
      e.preventDefault()
      toast({
        title: "Cannot edit derived field",
        description: "This field is derived and can't be edited.",
        variant: "destructive",
      })
      return
    }
  }, [field.type, toast])

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
      required: field.required || required,
      allowCreate: field.options?.allow_create,
    } : undefined

    // LOOKUP FIELDS (derived, read-only) - Show as informational pills
    if (isLookupField) {
      return (
        <div className="space-y-2.5" onPaste={handlePaste}>
          {showLabel && (
            <label className={`${labelClassName} flex items-center gap-2`}>
              {field.name}
              {required && <span className="text-red-500">*</span>}
              <span title="Derived field (read-only)" className="flex items-center gap-1 text-xs text-gray-400 font-normal">
                <LinkIcon className="h-3 w-3" />
                <span>Derived</span>
              </span>
            </label>
          )}
          {lookupConfig ? (
            <LookupFieldPicker
              field={field}
              value={value}
              onChange={() => {}} // No-op for lookup fields
              config={lookupConfig}
              disabled={true}
              placeholder="No linked records"
              onRecordClick={onLinkedRecordClick}
              isLookupField={true}
            />
          ) : (
            <div className={`px-3.5 py-2.5 bg-gray-50/50 border border-gray-200/50 rounded-md text-sm text-gray-500 italic ${inputClassName}`}>
              {value !== null && value !== undefined ? String(value) : "—"}
            </div>
          )}
        </div>
      )
    }

    // LINKED FIELDS (editable) - Show as editable with clear affordances
    return (
      <div className="space-y-2.5" onPaste={handlePaste}>
        {showLabel && (
          <label className={`${labelClassName} flex items-center gap-2`}>
            {field.name}
            {required && <span className="text-red-500">*</span>}
          </label>
        )}
        {lookupConfig ? (
          <LookupFieldPicker
            field={field}
            value={value}
            onChange={onChange}
            config={lookupConfig}
            disabled={isReadOnly}
            placeholder={`Select ${field.name}...`}
            onRecordClick={onLinkedRecordClick}
            onCreateRecord={onCreateRecord || (lookupConfig.allowCreate ? async (tableId: string) => {
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
                  .limit(5)

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
            } : undefined)}
            isLookupField={false}
          />
        ) : (
          <div className={`px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-500 ${inputClassName}`}>
            Configure linked table in field settings
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

    if (isReadOnly) {
      return (
        <div className="space-y-2.5">
          {showLabel && (
            <label className={`${labelClassName} flex items-center gap-2`}>
              {field.name}
              {required && <span className="text-red-500">*</span>}
              {isVirtual && (
                <span title="Formula or lookup field">
                  <Calculator className="h-3 w-3 text-gray-400" />
                </span>
              )}
            </label>
          )}
          <div className={`px-3.5 py-2.5 bg-gray-50/50 border border-gray-200/50 rounded-md text-sm min-h-[40px] flex items-center flex-wrap gap-1.5 ${inputClassName}`}>
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
        </div>
      )
    }

    // Editable select - use dropdown for single, multi-select with checkboxes
    return (
      <div className="space-y-2.5">
        {showLabel && (
          <label className={`${labelClassName} flex items-center gap-2`}>
            {field.name}
            {required && <span className="text-red-500">*</span>}
          </label>
        )}
        {isMulti ? (
          // Multi-select: show color pills that can be toggled
          <div className={`flex flex-wrap gap-2 ${inputClassName}`}>
            {choices.length === 0 ? (
              <div className="text-sm text-gray-500 italic px-2 py-1">No options configured</div>
            ) : (
              choices.map((choice: string) => {
                const isSelected = selectedValues.includes(choice)
                const hexColor = getColorForChoiceName(choice, field.options?.choiceColors)
                const textColorClass = getTextColor(hexColor)
                const bgColor = hexColor.startsWith('#') ? hexColor : `#${hexColor}`
                
                return (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => {
                      const newValues = isSelected
                        ? selectedValues.filter((v) => v !== choice)
                        : [...selectedValues, choice]
                      onChange(newValues)
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shadow-sm transition-all ${
                      isSelected 
                        ? `${textColorClass} ring-2 ring-offset-1 ring-gray-400` 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    style={isSelected ? { backgroundColor: bgColor } : {}}
                  >
                    {choice}
                  </button>
                )
              })
            )}
          </div>
        ) : (
          // Single select: show color pills that can be clicked
          <div className={`flex flex-wrap gap-2 ${inputClassName}`}>
            {choices.length === 0 ? (
              <div className="text-sm text-gray-500 italic px-2 py-1">No options configured</div>
            ) : (
              <>
                {choices.map((choice: string) => {
                  const isSelected = selectedValues.includes(choice)
                  const hexColor = getColorForChoiceName(choice, field.options?.choiceColors)
                  const textColorClass = getTextColor(hexColor)
                  const bgColor = hexColor.startsWith('#') ? hexColor : `#${hexColor}`
                  
                  return (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => onChange(choice)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shadow-sm transition-all ${
                        isSelected 
                          ? `${textColorClass} ring-2 ring-offset-1 ring-gray-400` 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      style={isSelected ? { backgroundColor: bgColor } : {}}
                    >
                      {choice}
                    </button>
                  )
                })}
                {value && (
                  <button
                    type="button"
                    onClick={() => onChange(null)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-300"
                  >
                    Clear
                  </button>
                )}
              </>
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

    if (isReadOnly) {
      const dateValueForDisplay = value ? formatDateUK(value, "—") : ""
      return (
        <div className="space-y-2.5">
          {showLabel && (
            <label className={`${labelClassName} flex items-center gap-2`}>
              {field.name}
              {required && <span className="text-red-500">*</span>}
              {isVirtual && (
                <span title="Formula or lookup field">
                  <Calculator className="h-3 w-3 text-gray-400" />
                </span>
              )}
            </label>
          )}
          <div className={`px-3.5 py-2.5 bg-gray-50/50 border border-gray-200/50 rounded-md text-sm text-gray-600 italic ${inputClassName}`}>
            {dateValueForDisplay || "—"}
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-2.5">
        {showLabel && (
          <label className={`${labelClassName} flex items-center gap-2`}>
            {field.name}
            {required && <span className="text-red-500">*</span>}
          </label>
        )}
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="date"
          value={dateValueForInput}
          onChange={(e) => onChange(e.target.value || null)}
          className={`w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputClassName}`}
          required={required}
        />
      </div>
    )
  }

  // Checkbox
  if (field.type === "checkbox") {
    return (
      <div className="space-y-2.5">
        {showLabel ? (
          <label className={`${labelClassName} flex items-center gap-2 cursor-pointer`}>
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
              disabled={isReadOnly}
              className="w-4 h-4 cursor-pointer"
              required={required}
            />
            <span>
              {field.name}
              {required && <span className="text-red-500 ml-1">*</span>}
            </span>
            {isVirtual && (
              <span title="Formula or lookup field">
                <Calculator className="h-3 w-3 text-gray-400" />
              </span>
            )}
          </label>
        ) : (
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            disabled={isReadOnly}
            className="w-4 h-4 cursor-pointer"
            required={required}
          />
        )}
      </div>
    )
  }

  // Long text
  if (field.type === "long_text") {
    if (isReadOnly) {
      return (
        <div className="space-y-2.5">
          {showLabel && (
            <label className={`${labelClassName} flex items-center gap-2`}>
              {field.name}
              {required && <span className="text-red-500">*</span>}
              {isVirtual && (
                <span title="Formula or lookup field">
                  <Calculator className="h-3 w-3 text-gray-400" />
                </span>
              )}
            </label>
          )}
          <div className={`px-3.5 py-2.5 bg-gray-50/50 border border-gray-200/50 rounded-md text-sm text-gray-600 min-h-[60px] ${inputClassName}`}>
            {value ? (
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: value }}
              />
            ) : (
              <span className="italic">—</span>
            )}
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-2.5">
        {showLabel && (
          <label className={`${labelClassName} flex items-center gap-2`}>
            {field.name}
            {required && <span className="text-red-500">*</span>}
          </label>
        )}
        <RichTextEditor
          value={value ?? ""}
          onChange={onChange}
          editable={true}
          showToolbar={true}
          minHeight="150px"
        />
      </div>
    )
  }

  // Default: Text, Number, Email, URL, etc.
  const inputType =
    field.type === "number" || field.type === "percent" || field.type === "currency"
      ? "number"
      : field.type === "email"
        ? "email"
        : field.type === "url"
          ? "url"
          : "text"

  if (isReadOnly) {
    return (
      <div className="space-y-2.5">
        {showLabel && (
          <label className={`${labelClassName} flex items-center gap-2`}>
            {field.name}
            {required && <span className="text-red-500">*</span>}
            {isVirtual && (
              <span title="Formula or lookup field">
                <Calculator className="h-3 w-3 text-gray-400" />
              </span>
            )}
          </label>
        )}
        <div className={`px-3.5 py-2.5 bg-gray-50/50 border border-gray-200/50 rounded-md text-sm text-gray-600 italic ${inputClassName}`}>
          {value !== null && value !== undefined ? String(value) : "—"}
          {field.type === "formula" && field.options?.formula && (
            <div className="text-xs text-gray-500 mt-1 font-mono">
              = {field.options.formula}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {showLabel && (
        <label className={`${labelClassName} flex items-center gap-2`}>
          {field.name}
          {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={inputType}
        value={value ?? ""}
        onChange={(e) =>
          onChange(inputType === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)
        }
        className={`w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputClassName}`}
        placeholder={`Enter ${field.name}...`}
        required={required}
      />
    </div>
  )
}
