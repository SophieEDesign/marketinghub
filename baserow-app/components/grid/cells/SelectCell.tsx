"use client"

import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  resolveChoiceColor,
  getTextColorForBackground,
  normalizeHexColor,
} from "@/lib/field-colors"
import type { FieldOptions } from "@/types/fields"

interface SelectCellProps {
  value: string | null
  fieldName: string
  editable?: boolean
  onSave: (value: string | null) => Promise<void>
  placeholder?: string
  choices?: string[]
  choiceColors?: Record<string, string>
  fieldOptions?: FieldOptions // Full field options for field-level color override support
}

export default function SelectCell({
  value,
  fieldName,
  editable = true,
  onSave,
  placeholder = '—',
  choices = [],
  choiceColors,
  fieldOptions,
}: SelectCellProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value || '')
  const [saving, setSaving] = useState(false)
  const selectRef = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    setEditValue(value || '')
  }, [value])

  useEffect(() => {
    if (editing && selectRef.current) {
      selectRef.current.focus()
    }
  }, [editing])

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      await onSave(editValue || null)
      setEditing(false)
    } catch (error) {
      console.error('Error saving select cell:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditValue(value || '')
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  // Get color styling for the current value (must be before conditional return)
  // Merge choiceColors into fieldOptions for proper resolution precedence
  const mergedOptions: FieldOptions = useMemo(() => {
    return {
      ...fieldOptions,
      choiceColors: choiceColors || fieldOptions?.choiceColors,
    }
  }, [choiceColors, fieldOptions])

  const pillStyle = useMemo(() => {
    if (!value) return null
    
    const normalizedValue = String(value).trim()
    const hexColor = resolveChoiceColor(
      normalizedValue,
      'single_select',
      mergedOptions,
      true // Use semantic colors for single-select
    )
    const textColorClass = getTextColorForBackground(hexColor)
    const bgColor = normalizeHexColor(hexColor)
    
    return {
      backgroundColor: bgColor,
      textColor: textColorClass,
    }
  }, [value, mergedOptions])

  if (editing && editable) {
    return (
      <select
        ref={selectRef}
        value={editValue}
        onChange={(e) => {
          setEditValue(e.target.value)
          handleSave()
        }}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="w-full min-h-[36px] px-3 py-2 text-sm border border-blue-400 outline-none bg-white focus:ring-2 focus:ring-blue-400/20 focus:ring-offset-1 rounded-md appearance-none cursor-pointer"
        disabled={saving}
        autoFocus
      >
        <option value="">{placeholder}</option>
        {choices.map((choice) => (
          <option key={choice} value={choice}>
            {choice}
          </option>
        ))}
      </select>
    )
  }

  return (
    <div
      onClick={() => editable && setEditing(true)}
      className="w-full min-h-[36px] px-3 py-2 flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50/50 rounded transition-colors group"
    >
      {value && pillStyle ? (
        <span 
          className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all ${pillStyle.textColor} hover:opacity-80`}
          style={{ 
            backgroundColor: pillStyle.backgroundColor,
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
          }}
        >
          {value}
        </span>
      ) : (
        <span className="text-gray-400 italic text-sm">{placeholder}</span>
      )}
      {editable && value && (
        <ChevronDown className="h-3.5 w-3.5 text-gray-400 opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0" />
      )}
    </div>
  )
}
