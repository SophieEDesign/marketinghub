"use client"

import { useState, useRef, useEffect } from 'react'
import { X, Plus } from 'lucide-react'

interface MultiSelectCellProps {
  value: string[] | null
  fieldName: string
  editable?: boolean
  onSave: (value: string[]) => Promise<void>
  placeholder?: string
  choices?: string[]
  choiceColors?: Record<string, string>
}

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

export default function MultiSelectCell({
  value,
  fieldName,
  editable = true,
  onSave,
  placeholder = '—',
  choices = [],
  choiceColors,
}: MultiSelectCellProps) {
  const [editing, setEditing] = useState(false)
  const [selectedValues, setSelectedValues] = useState<string[]>(value || [])
  const [saving, setSaving] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSelectedValues(value || [])
  }, [value])

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      await onSave(selectedValues)
      setEditing(false)
    } catch (error) {
      console.error('Error saving multi-select cell:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = (choice: string) => {
    setSelectedValues((prev) => {
      if (prev.includes(choice)) {
        return prev.filter((v) => v !== choice)
      } else {
        return [...prev, choice]
      }
    })
  }

  const handleRemove = (choice: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedValues((prev) => prev.filter((v) => v !== choice))
    handleSave()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setSelectedValues(value || [])
      setEditing(false)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (editing) {
          handleSave()
        }
      }
    }

    if (editing) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, selectedValues, value])

  // Helper to get color styling for a choice
  const getColorForChoice = (choice: string): { backgroundColor: string; textColor: string } => {
    const hexColor = getColorForChoiceName(choice, choiceColors)
    const textColorClass = getTextColor(hexColor)
    const bgColor = hexColor.startsWith('#') ? hexColor : `#${hexColor}`
    
    return {
      backgroundColor: bgColor,
      textColor: textColorClass,
    }
  }

  if (editing && editable) {
    return (
      <div
        ref={containerRef}
        onKeyDown={handleKeyDown}
        className="w-full min-h-[32px] px-2 py-1.5 flex flex-wrap gap-1.5 text-sm bg-white border border-blue-500 rounded-lg focus-within:ring-2 focus-within:ring-blue-500"
      >
        {selectedValues.map((val) => {
          const colorInfo = getColorForChoice(val)
          return (
            <span
              key={val}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap shadow-sm ${colorInfo.textColor}`}
              style={{ backgroundColor: colorInfo.backgroundColor }}
            >
              {val}
              <button
                onClick={(e) => handleRemove(val, e)}
                className={`rounded-full p-0.5 hover:bg-black/10 transition-colors ${colorInfo.textColor}`}
                aria-label={`Remove ${val}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )
        })}
        <div className="flex flex-wrap gap-1.5">
          {choices
            .filter((choice) => !selectedValues.includes(choice))
            .map((choice) => {
              const colorInfo = getColorForChoice(choice)
              return (
                <button
                  key={choice}
                  onClick={() => handleToggle(choice)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-gray-300 hover:shadow-sm transition-all ${colorInfo.textColor}`}
                  style={{ backgroundColor: colorInfo.backgroundColor, opacity: 0.7 }}
                >
                  <Plus className="h-3 w-3" />
                  {choice}
                </button>
              )
            })}
        </div>
      </div>
    )
  }

  const displayValues = value || []
  const isEmpty = displayValues.length === 0

  return (
    <div
      onClick={() => editable && setEditing(true)}
      className="w-full h-full px-2 py-1 flex flex-wrap gap-1.5 items-center text-sm cursor-pointer hover:bg-gray-50 rounded transition-colors min-h-[32px] group"
    >
      {isEmpty ? (
        <span className="text-gray-400 italic">{placeholder}</span>
      ) : (
        displayValues.map((val) => {
          const colorInfo = getColorForChoice(val)
          return (
            <span
              key={val}
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap shadow-sm ${colorInfo.textColor}`}
              style={{ backgroundColor: colorInfo.backgroundColor }}
            >
              {val}
            </span>
          )
        })
      )}
    </div>
  )
}
