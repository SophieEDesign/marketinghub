"use client"

import { useState, useRef, useEffect } from "react"
import { Calculator } from "lucide-react"

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

interface CellProps {
  value: any
  fieldName: string
  fieldType?: string
  fieldOptions?: any
  isVirtual?: boolean
  editable?: boolean // Whether the cell can be edited
  onSave: (value: any) => Promise<void>
  onCancel?: () => void
}

export default function Cell({ value, fieldName, fieldType, fieldOptions, isVirtual, editable = true, onSave, onCancel }: CellProps) {
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
  
  // Handle virtual fields (formula/lookup) - read-only
  if (isVirtual) {
    const displayValue = value !== null && value !== undefined 
      ? String(value) 
      : "—"
    const isError = typeof value === 'string' && value.startsWith('#')
    
    return (
      <div 
        className={`min-h-[32px] flex items-center gap-2 px-2 py-1 ${
          isError ? 'text-red-600' : 'text-gray-600'
        } italic`}
        title={fieldOptions?.formula ? `Formula: ${fieldOptions.formula}` : 'Formula field'}
      >
        <Calculator className="h-3 w-3 opacity-50" />
        <span>{displayValue}</span>
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
          className={`min-h-[32px] flex items-center px-2 py-1 rounded transition-colors ${
            editable ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'
          }`}
          title={editable ? "Click to edit" : "Read-only"}
        >
          <span className="text-gray-400 italic text-sm">—</span>
        </div>
      )
    }
    
    const hexColor = getColorForChoiceName(value as string, fieldOptions.choiceColors)
    const textColorClass = getTextColor(hexColor)
    const bgColor = hexColor.startsWith('#') ? hexColor : `#${hexColor}`
    
    return (
      <div
        onClick={handleStartEdit}
        className={`min-h-[32px] flex items-center px-2 py-1 rounded transition-colors ${
          editable ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'
        }`}
        title={editable ? "Click to edit" : "Read-only"}
      >
        <span 
          className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap shadow-sm ${textColorClass}`}
          style={{ backgroundColor: bgColor }}
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
        className={`min-h-[32px] flex items-center flex-wrap gap-1.5 px-2 py-1 rounded transition-colors ${
          editable ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'
        }`}
        title={editable ? "Click to edit" : "Read-only"}
      >
        {displayValues.length === 0 ? (
          <span className="text-gray-400 italic text-sm">—</span>
        ) : (
          displayValues.map((val: string) => {
            const hexColor = getColorForChoiceName(val, fieldOptions.choiceColors)
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
        )}
      </div>
    )
  }

  if (editing) {
    if (inputType === "checkbox") {
      return (
        <div className="flex items-center justify-center h-8">
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
          className="w-full h-20 px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
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
        className="w-full h-8 px-2 text-sm border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
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

  return (
    <div
      onClick={isVirtual || !editable ? undefined : handleStartEdit}
      className={`min-h-[32px] flex items-center px-2 py-1 rounded transition-colors ${
        isVirtual || !editable
          ? "text-gray-500 cursor-default" 
          : "cursor-pointer hover:bg-blue-50"
      }`}
      title={isVirtual ? "Virtual field (read-only)" : editable ? "Click to edit" : "Read-only"}
    >
      {displayValue || (
        <span className="text-gray-400 italic text-sm">Empty</span>
      )}
    </div>
  )
}
