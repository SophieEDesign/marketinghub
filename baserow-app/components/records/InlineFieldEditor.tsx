"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Link2, Plus, X, Calculator, Link as LinkIcon } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { formatDateUK } from "@/lib/utils"
import type { TableField } from "@/types/fields"
import { useToast } from "@/components/ui/use-toast"
import LookupFieldPicker, { type LookupFieldConfig } from "@/components/fields/LookupFieldPicker"
import RichTextEditor from "@/components/fields/RichTextEditor"

import {
  resolveChoiceColor,
  resolveFieldColor,
  getTextColorForBackground,
  normalizeHexColor,
} from "@/lib/field-colors"

interface InlineFieldEditorProps {
  field: TableField
  value: any
  onChange: (value: any) => void
  isEditing: boolean
  onEditStart: () => void
  onEditEnd: () => void
  onLinkedRecordClick: (tableId: string, recordId: string) => void
  onAddLinkedRecord: (field: TableField) => void
  isReadOnly?: boolean // Override read-only state (for field-level permissions)
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
  isReadOnly: propIsReadOnly,
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

  // Handle paste - block for lookup fields, allow for linked fields
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
    // For linked fields, paste is handled by LookupFieldPicker
  }, [field.type, toast])

  const isVirtual = field.type === "formula" || field.type === "lookup"
  // Use prop override first, then check field-level read-only, then virtual
  const isReadOnly = propIsReadOnly !== undefined ? propIsReadOnly : (isVirtual || field.options?.read_only)
  
  // Determine if this is a lookup field (derived) vs linked field (editable)
  const isLookupField = field.type === "lookup"
  const isLinkedField = field.type === "link_to_table"

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

    // LOOKUP FIELDS (derived, read-only) - Show as informational pills
    if (isLookupField) {
      return (
        <div className="space-y-2.5" onPaste={handlePaste}>
          <label className="block text-sm font-medium text-gray-600 flex items-center gap-2">
            {field.name}
            <span title="Derived field (read-only)" className="flex items-center gap-1 text-xs text-gray-400 font-normal">
              <LinkIcon className="h-3 w-3" />
              <span>Derived</span>
            </span>
          </label>
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
            <div className="px-3.5 py-2.5 bg-gray-50/50 border border-gray-200/50 rounded-md text-sm text-gray-500 italic">
              {value !== null && value !== undefined ? String(value) : "—"}
            </div>
          )}
        </div>
      )
    }

    // LINKED FIELDS (editable) - Show as editable with clear affordances
    return (
      <div className="space-y-2.5" onPaste={handlePaste}>
        <label className="block text-sm font-medium text-gray-700">
          {field.name}
        </label>
        {lookupConfig ? (
          <LookupFieldPicker
            field={field}
            value={value}
            onChange={onChange}
            config={lookupConfig}
            disabled={isReadOnly}
            placeholder={`Add ${field.name}...`}
            onRecordClick={onLinkedRecordClick}
            onCreateRecord={lookupConfig.allowCreate ? handleCreateRecord : undefined}
            isLookupField={false}
          />
        ) : (
          <div className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-500">
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

    if (isEditing && !isReadOnly) {
      return (
        <div className="space-y-2.5">
          <label className="block text-sm font-medium text-gray-700">{field.name}</label>
          <div className="space-y-2">
            {choices.map((choice: string) => {
              const isSelected = selectedValues.includes(choice)
              return (
                <label
                  key={choice}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
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
              className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-2.5">
        <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
          {field.name}
          {isVirtual && (
            <span title="Formula or lookup field">
              <Calculator className="h-3 w-3 text-gray-400" />
            </span>
          )}
        </label>
        {isReadOnly ? (
          <div className="px-3.5 py-2.5 bg-gray-50/50 border border-gray-200/50 rounded-md text-sm min-h-[40px] flex items-center flex-wrap gap-1.5">
            {selectedValues.length > 0 ? (
              selectedValues.map((val: string) => {
                const hexColor = resolveChoiceColor(
                  val,
                  isMulti ? 'multi_select' : 'single_select',
                  field.options,
                  !isMulti // Use semantic colors for single-select, muted for multi-select
                )
                const textColorClass = getTextColorForBackground(hexColor)
                const bgColor = normalizeHexColor(hexColor)
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
            className="px-3.5 py-2.5 border border-gray-200 rounded-md hover:border-blue-400 hover:bg-blue-50/30 transition-colors cursor-pointer min-h-[40px] flex items-center flex-wrap gap-2"
          >
            {selectedValues.length > 0 ? (
              selectedValues.map((val: string) => {
                const hexColor = resolveChoiceColor(
                  val,
                  isMulti ? 'multi_select' : 'single_select',
                  field.options,
                  !isMulti // Use semantic colors for single-select, muted for multi-select
                )
                const textColorClass = getTextColorForBackground(hexColor)
                const bgColor = normalizeHexColor(hexColor)
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
        <div className="space-y-2.5">
          <label className="block text-sm font-medium text-gray-700">{field.name}</label>
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="date"
            value={dateValueForInput}
            onChange={(e) => handleChange(e.target.value || null)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )
    }

    return (
      <div className="space-y-2.5">
        <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
          {field.name}
          {isVirtual && (
            <span title="Formula or lookup field">
              <Calculator className="h-3 w-3 text-gray-400" />
            </span>
          )}
        </label>
        {isReadOnly ? (
          <div className="px-3.5 py-2.5 bg-gray-50/50 border border-gray-200/50 rounded-md text-sm text-gray-600 italic">
            {dateValueForDisplay || "—"}
          </div>
        ) : (
          <div
            onClick={onEditStart}
            className="px-3.5 py-2.5 border border-gray-200 rounded-md hover:border-blue-400 hover:bg-blue-50/30 transition-colors cursor-pointer text-sm text-gray-900"
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
      <div className="space-y-2.5">
        <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
          {field.name}
          {isVirtual && (
            <span title="Formula or lookup field">
              <Calculator className="h-3 w-3 text-gray-400" />
            </span>
          )}
        </label>
        {isReadOnly ? (
          <div className="px-3.5 py-2.5 bg-gray-50/50 border border-gray-200/50 rounded-md text-sm text-gray-600 italic">
            {value ? "Yes" : "No"}
          </div>
        ) : (
          <label className="flex items-center gap-2.5 cursor-pointer">
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
        <div className="space-y-2.5">
          <label className="block text-sm font-medium text-gray-700">{field.name}</label>
          <RichTextEditor
            value={localValue ?? ""}
            onChange={handleChange}
            onBlur={handleBlur}
            editable={true}
            showToolbar={true}
            minHeight="150px"
          />
          <div className="flex gap-2">
            <button
              onClick={handleBlur}
              className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-2.5">
        <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
          {field.name}
          {isVirtual && (
            <span title="Formula or lookup field">
              <Calculator className="h-3 w-3 text-gray-400" />
            </span>
          )}
        </label>
        {isReadOnly ? (
          <div className="px-3.5 py-2.5 bg-gray-50/50 border border-gray-200/50 rounded-md text-sm text-gray-600 min-h-[60px]">
            {value ? (
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: value }}
              />
            ) : (
              <span className="italic">—</span>
            )}
          </div>
        ) : (
          <div
            onClick={onEditStart}
            className="px-3.5 py-2.5 border border-gray-200 rounded-md hover:border-blue-400 hover:bg-blue-50/30 transition-colors cursor-pointer text-sm text-gray-900 min-h-[60px]"
          >
            {value ? (
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: value }}
              />
            ) : (
              <span className="text-gray-400">Click to add text...</span>
            )}
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
      <div className="space-y-2.5">
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
          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={`Enter ${field.name}...`}
        />
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
        {field.name}
        {isVirtual && (
          <span title="Formula or lookup field">
            <Calculator className="h-3 w-3 text-gray-400" />
          </span>
        )}
      </label>
      {isReadOnly ? (
        <div className="px-3.5 py-2.5 bg-gray-50/50 border border-gray-200/50 rounded-md text-sm text-gray-600 italic">
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
          className="px-3.5 py-2.5 border border-gray-200 rounded-md hover:border-blue-400 hover:bg-blue-50/30 transition-colors cursor-pointer text-sm text-gray-900 min-h-[40px] flex items-center"
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

