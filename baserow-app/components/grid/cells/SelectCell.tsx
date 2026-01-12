"use client"

import { useState, useRef, useEffect, useMemo } from 'react'
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

// Primary color palette for single-select status (more vibrant)
const PRIMARY_COLORS = [
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

// Helper function to get a consistent primary color for a single-select choice
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
  // Use primary colors for single-select status
  let hash = 0
  for (let i = 0; i < choice.length; i++) {
    hash = choice.charCodeAt(i) + ((hash << 5) - hash)
  }
  return PRIMARY_COLORS[Math.abs(hash) % PRIMARY_COLORS.length]
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

  // Get color styling for the current value (must be before conditional return)
  const pillStyle = useMemo(() => {
    if (!value) return null
    
    const normalizedValue = String(value).trim()
    const hexColor = getColorForChoiceName(normalizedValue, choiceColors)
    const textColorClass = getTextColor(hexColor)
    
    // Ensure hex color has # prefix
    const bgColor = hexColor.startsWith('#') ? hexColor : `#${hexColor}`
    
    return {
      backgroundColor: bgColor,
      textColor: textColorClass,
    }
  }, [value, choiceColors])

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
