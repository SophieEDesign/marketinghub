"use client"

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

interface SelectCellProps {
  value: string | null
  fieldName: string
  editable?: boolean
  onSave: (value: string | null) => Promise<void>
  placeholder?: string
  choices?: string[]
  choiceColors?: Record<string, string>
}

export default function SelectCell({
  value,
  fieldName,
  editable = true,
  onSave,
  placeholder = '—',
  choices = [],
  choiceColors,
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
        className="w-full h-full px-2 text-sm border-none outline-none bg-white focus:ring-2 focus:ring-blue-500 rounded appearance-none cursor-pointer"
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

  const displayValue = value || placeholder
  const isPlaceholder = !value
  
  // Normalize value for color lookup (trim whitespace, handle null/undefined)
  const normalizedValue = value ? String(value).trim() : null
  
  // Get color for the selected value
  const getColorForChoice = (choice: string | null): { bg: string; text: string } => {
    if (!choice || !choiceColors) {
      return { bg: 'bg-blue-100', text: 'text-blue-800' }
    }
    
    // Try exact match first
    let hexColor = choiceColors[choice]
    
    // If no exact match, try case-insensitive match
    if (!hexColor && choiceColors) {
      const matchingKey = Object.keys(choiceColors).find(
        key => key.toLowerCase() === choice.toLowerCase()
      )
      if (matchingKey) {
        hexColor = choiceColors[matchingKey]
      }
    }
    
    if (!hexColor) {
      return { bg: 'bg-blue-100', text: 'text-blue-800' }
    }
    
    // Ensure hex color is valid format
    if (!hexColor.startsWith('#')) {
      hexColor = `#${hexColor}`
    }
    
    // Convert hex to RGB for better contrast calculation
    try {
      const r = parseInt(hexColor.slice(1, 3), 16)
      const g = parseInt(hexColor.slice(3, 5), 16)
      const b = parseInt(hexColor.slice(5, 7), 16)
      
      if (isNaN(r) || isNaN(g) || isNaN(b)) {
        return { bg: 'bg-blue-100', text: 'text-blue-800' }
      }
      
      // Calculate luminance to determine if we need light or dark text
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
      
      return {
        bg: '', // Will use inline style
        text: luminance > 0.5 ? 'text-gray-900' : 'text-white'
      }
    } catch (error) {
      console.warn('Error parsing color:', hexColor, error)
      return { bg: 'bg-blue-100', text: 'text-blue-800' }
    }
  }
  
  // Find the matching color key (with fallback to case-insensitive)
  const getColorKey = (val: string | null): string | null => {
    if (!val || !choiceColors) return null
    
    const normalized = String(val).trim()
    
    // Try exact match first
    if (choiceColors[normalized]) {
      return normalized
    }
    
    // Try case-insensitive match
    const matchingKey = Object.keys(choiceColors).find(
      key => key.toLowerCase() === normalized.toLowerCase()
    )
    
    return matchingKey || null
  }
  
  const colorKey = getColorKey(normalizedValue)
  const colorValue = colorKey && choiceColors?.[colorKey]
  const colorStyle = colorValue
    ? { 
        backgroundColor: colorValue.startsWith('#') 
          ? colorValue 
          : `#${colorValue}` 
      }
    : undefined
  const textColor = normalizedValue ? getColorForChoice(normalizedValue).text : ''

  return (
    <div
      onClick={() => editable && setEditing(true)}
      className="w-full h-full px-2 flex items-center gap-1 text-sm cursor-pointer hover:bg-blue-50 rounded transition-colors group"
    >
      {value && (
        <span 
          className={`px-2 py-0.5 rounded text-xs font-medium ${textColor}`}
          style={colorStyle}
        >
          {value}
        </span>
      )}
      {!value && <span className="text-gray-400">{placeholder}</span>}
      {editable && (
        <ChevronDown className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  )
}
