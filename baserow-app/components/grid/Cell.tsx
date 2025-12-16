"use client"

import { useState, useRef, useEffect } from "react"

interface CellProps {
  value: any
  fieldName: string
  fieldType?: string
  onSave: (value: any) => Promise<void>
  onCancel?: () => void
}

export default function Cell({ value, fieldName, fieldType, onSave, onCancel }: CellProps) {
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
  const isLongText = fieldType?.toLowerCase().includes("text") && 
                     (fieldType.toLowerCase().includes("long") || 
                      fieldType.toLowerCase().includes("textarea"))

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

  const displayValue = value === null || value === undefined 
    ? "" 
    : typeof value === "boolean" 
      ? value ? "✓" : "" 
      : String(value)

  return (
    <div
      onClick={handleStartEdit}
      className="min-h-[32px] flex items-center px-2 py-1 cursor-pointer hover:bg-blue-50 rounded transition-colors"
      title="Click to edit"
    >
      {displayValue || (
        <span className="text-gray-400 italic text-sm">Empty</span>
      )}
    </div>
  )
}
