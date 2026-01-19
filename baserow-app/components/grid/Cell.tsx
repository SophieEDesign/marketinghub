"use client"

import { useState, useRef, useEffect } from "react"
import { Calculator } from "lucide-react"
import {
  resolveChoiceColor,
  resolveFieldColor,
  getTextColorForBackground,
  normalizeHexColor,
} from "@/lib/field-colors"
import type { FieldType, FieldOptions } from "@/types/fields"

interface CellProps {
  value: any
  fieldName: string
  fieldType?: FieldType | string
  fieldOptions?: FieldOptions
  isVirtual?: boolean
  editable?: boolean // Whether the cell can be edited
  wrapText?: boolean // Whether to wrap text (block-level setting)
  rowHeight?: number // Row height in pixels
  onSave: (value: any) => Promise<void>
  onCancel?: () => void
}

export default function Cell({ value, fieldName, fieldType, fieldOptions, isVirtual, editable = true, wrapText = false, rowHeight, onSave, onCancel }: CellProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value ?? "")
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    setEditValue(value ?? "")
  }, [value])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select()
      }
    }
  }, [editing])

  const handleStartEdit = () => {
    if (!editable || isVirtual) return
    setEditing(true)
    setEditValue(value ?? "")
  }

  const handleSave = async () => {
    if (saving) return
    
    setSaving(true)
    try {
      await onSave(editValue)
      setEditing(false)
    } catch (error) {
      console.error("Error saving cell:", error)
      // Keep editing on error
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditValue(value ?? "")
    setEditing(false)
    onCancel?.()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    } else if (e.key === "Escape") {
      e.preventDefault()
      handleCancel()
    }
  }

  // Determine input type based on field type or value
  const getInputType = () => {
    if (fieldType) {
      const lowerType = fieldType.toLowerCase()
      if (lowerType.includes("number") || lowerType.includes("int") || lowerType.includes("float")) {
        return "number"
      }
      if (lowerType.includes("bool")) {
        return "checkbox"
      }
      if (lowerType.includes("date") || lowerType.includes("time")) {
        return fieldType.includes("time") ? "datetime-local" : "date"
      }
      if (lowerType.includes("email")) {
        return "email"
      }
      if (lowerType.includes("url")) {
        return "url"
      }
    }
    return "text"
  }

  const inputType = getInputType()
  const isLongText = fieldType === "long_text"
  
  // Base cell style with row height constraint
  const cellStyle: React.CSSProperties = {
    height: rowHeight ? `${rowHeight}px` : 'auto',
    maxHeight: rowHeight ? `${rowHeight}px` : 'none',
    minHeight: rowHeight ? `${rowHeight}px` : '36px',
  }

  // Handle virtual fields (formula/lookup) - read-only
  if (isVirtual) {
    const displayValue = value !== null && value !== undefined 
      ? String(value) 
      : "—"
    const isError = typeof value === 'string' && value.startsWith('#')
    
    return (
      <div 
        className={`flex items-center gap-2 px-3 py-2 ${
          isError ? 'text-red-600' : 'text-gray-500'
        } italic overflow-hidden`}
        style={cellStyle}
        title={fieldOptions?.formula ? `Formula: ${fieldOptions.formula}` : 'Formula field'}
      >
        <Calculator className="h-3.5 w-3.5 opacity-40 flex-shrink-0" />
        <span className={`text-sm ${wrapText ? 'line-clamp-2' : 'truncate'}`}>{displayValue}</span>
      </div>
    )
  }
  
  // Handle select fields
  if (fieldType === "single_select" && fieldOptions?.choices) {
    if (editing) {
      return (
        <select
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="w-full h-8 px-2 text-sm border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          autoFocus
        >
          <option value="">Select...</option>
          {fieldOptions.choices.map((choice: string) => (
            <option key={choice} value={choice}>
              {choice}
            </option>
          ))}
        </select>
      )
    }
    
    // Display with pill styling
    if (!value) {
      return (
        <div
          onClick={handleStartEdit}
          className={`flex items-center px-3 py-2 rounded-md transition-colors overflow-hidden ${
            editable ? 'cursor-pointer hover:bg-gray-50/50' : 'cursor-default'
          }`}
          style={cellStyle}
          title={editable ? "Click to edit" : "Read-only"}
        >
          <span className="text-gray-400 italic text-sm">—</span>
        </div>
      )
    }
    
    const hexColor = resolveChoiceColor(
      value as string,
      'single_select',
      fieldOptions,
      true // Use semantic colors for single-select
    )
    const textColorClass = getTextColorForBackground(hexColor)
    const bgColor = normalizeHexColor(hexColor)
    
    return (
      <div
        onClick={handleStartEdit}
        className={`flex items-center px-3 py-2 rounded-md transition-colors overflow-hidden ${
          editable ? 'cursor-pointer hover:bg-gray-50/50' : 'cursor-default'
        }`}
        style={cellStyle}
        title={editable ? "Click to edit" : "Read-only"}
      >
        <span 
          className={`px-2.5 py-1 rounded-md text-xs font-medium ${wrapText ? '' : 'whitespace-nowrap'} transition-all ${textColorClass} hover:opacity-80`}
          style={{ 
            backgroundColor: bgColor,
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
          }}
        >
          {value}
        </span>
      </div>
    )
  }
  
  if (fieldType === "multi_select" && fieldOptions?.choices) {
    const displayValues = Array.isArray(value) ? value : []
    
    return (
      <div
        onClick={handleStartEdit}
        className={`flex items-center flex-wrap gap-1.5 px-3 py-2 rounded-md transition-colors overflow-hidden ${
          editable ? 'cursor-pointer hover:bg-gray-50/50' : 'cursor-default'
        }`}
        style={cellStyle}
        title={editable ? "Click to edit" : "Read-only"}
      >
        {displayValues.length === 0 ? (
          <span className="text-gray-400 italic text-sm">—</span>
        ) : (
          displayValues.map((val: string) => {
            const hexColor = resolveChoiceColor(
              val,
              'multi_select',
              fieldOptions,
              false // Use muted colors for multi-select
            )
            const textColorClass = getTextColorForBackground(hexColor)
            const bgColor = normalizeHexColor(hexColor)
            return (
              <span
                key={val}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all ${textColorClass} hover:opacity-80`}
                style={{ 
                  backgroundColor: bgColor,
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                }}
              >
                {val}
              </span>
            )
          })
        )}
      </div>
    )
  }

  if (editing) {
    if (inputType === "checkbox") {
      return (
        <div className="flex items-center justify-center h-full">
          <input
            type="checkbox"
            checked={!!editValue}
            onChange={(e) => setEditValue(e.target.checked)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="w-4 h-4 cursor-pointer"
            ref={inputRef as React.RefObject<HTMLInputElement>}
          />
        </div>
      )
    }

    if (isLongText) {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="w-full h-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          placeholder="Enter text..."
        />
      )
    }

    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={inputType}
        value={editValue}
        onChange={(e) => {
          const newValue = inputType === "number" 
            ? (e.target.value === "" ? null : Number(e.target.value))
            : e.target.value
          setEditValue(newValue)
        }}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="w-full h-full px-2 text-sm border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        placeholder="Enter value..."
        disabled={saving}
      />
    )
  }

  // Format display value based on field type
  let displayValue: string = ""
  if (value !== null && value !== undefined) {
    if (typeof value === "boolean") {
      displayValue = value ? "✓" : ""
    } else if (fieldType === "multi_select" && Array.isArray(value)) {
      displayValue = value.join(", ")
    } else if (fieldType === "currency" && typeof value === "number") {
      const symbol = fieldOptions?.currency_symbol || "$"
      const precision = fieldOptions?.precision ?? 2
      displayValue = `${symbol}${value.toFixed(precision)}`
    } else if (fieldType === "percent" && typeof value === "number") {
      const precision = fieldOptions?.precision ?? 2
      displayValue = `${(value * 100).toFixed(precision)}%`
    } else {
      displayValue = String(value)
    }
  }

  // Apply text wrapping for text-based fields
  const textWrapClass = wrapText && (fieldType === 'text' || fieldType === 'long_text' || !fieldType)
    ? 'line-clamp-2' 
    : 'truncate'

  return (
    <div
      onClick={isVirtual || !editable ? undefined : handleStartEdit}
      className={`flex items-center px-3 py-2 rounded-md transition-colors overflow-hidden ${
        isVirtual || !editable
          ? "text-gray-500 cursor-default" 
          : "cursor-pointer hover:bg-gray-50/50"
      }`}
      style={cellStyle}
      title={isVirtual ? "Virtual field (read-only)" : editable ? "Click to edit" : "Read-only"}
    >
      {displayValue ? (
        <span className={`text-sm ${textWrapClass} w-full`}>{displayValue}</span>
      ) : (
        <span className="text-gray-400 italic text-sm">—</span>
      )}
    </div>
  )
}
