"use client"

import { useState, useRef, useEffect } from "react"
import { Calculator } from "lucide-react"

interface CellProps {
  value: any
  fieldName: string
  fieldType?: string
  fieldOptions?: any
  isVirtual?: boolean
  onSave: (value: any) => Promise<void>
  onCancel?: () => void
}

export default function Cell({ value, fieldName, fieldType, fieldOptions, isVirtual, onSave, onCancel }: CellProps) {
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
    
    // Display with color coding
    const choiceColor = fieldOptions.choiceColors?.[value as string]
    const getTextColor = (hexColor?: string) => {
      if (!hexColor) return 'text-blue-800'
      const r = parseInt(hexColor.slice(1, 3), 16)
      const g = parseInt(hexColor.slice(3, 5), 16)
      const b = parseInt(hexColor.slice(5, 7), 16)
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
      return luminance > 0.5 ? 'text-gray-900' : 'text-white'
    }
    
    return (
      <div
        onClick={handleStartEdit}
        className="min-h-[32px] flex items-center px-2 py-1 cursor-pointer hover:bg-blue-50 rounded transition-colors"
        title="Click to edit"
      >
        {value ? (
          <span 
            className={`px-2 py-0.5 rounded text-xs font-medium ${getTextColor(choiceColor)}`}
            style={choiceColor ? { backgroundColor: choiceColor } : undefined}
          >
            {value}
          </span>
        ) : (
          <span className="text-gray-400 italic text-sm">Empty</span>
        )}
      </div>
    )
  }
  
  if (fieldType === "multi_select" && fieldOptions?.choices) {
    const getColorForChoice = (choice: string) => {
      const hexColor = fieldOptions.choiceColors?.[choice]
      if (!hexColor) return { bg: 'bg-blue-100', text: 'text-blue-800' }
      const r = parseInt(hexColor.slice(1, 3), 16)
      const g = parseInt(hexColor.slice(3, 5), 16)
      const b = parseInt(hexColor.slice(5, 7), 16)
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
      return {
        style: { backgroundColor: hexColor },
        text: luminance > 0.5 ? 'text-gray-900' : 'text-white'
      }
    }
    
    const displayValues = Array.isArray(value) ? value : []
    
    return (
      <div
        onClick={handleStartEdit}
        className="min-h-[32px] flex items-center flex-wrap gap-1 px-2 py-1 cursor-pointer hover:bg-blue-50 rounded transition-colors"
        title="Click to edit"
      >
        {displayValues.length === 0 ? (
          <span className="text-gray-400 italic text-sm">Empty</span>
        ) : (
          displayValues.map((val: string) => {
            const colorInfo = getColorForChoice(val)
            return (
              <span
                key={val}
                className={`px-2 py-0.5 rounded text-xs font-medium ${colorInfo.text}`}
                style={colorInfo.style}
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
      onClick={isVirtual ? undefined : handleStartEdit}
      className={`min-h-[32px] flex items-center px-2 py-1 rounded transition-colors ${
        isVirtual 
          ? "text-gray-500 italic cursor-default" 
          : "cursor-pointer hover:bg-blue-50"
      }`}
      title={isVirtual ? "Virtual field (read-only)" : "Click to edit"}
    >
      {displayValue || (
        <span className="text-gray-400 italic text-sm">Empty</span>
      )}
    </div>
  )
}
