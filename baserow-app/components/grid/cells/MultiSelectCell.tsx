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

// Muted color palette for multi-select tags (Airtable-style)
// These are desaturated, calmer colors suitable for tags
const MUTED_COLORS = [
  '#94A3B8', // Slate (muted blue-gray)
  '#86EFAC', // Light green
  '#FCD34D', // Light amber
  '#FCA5A5', // Light red
  '#C4B5FD', // Light purple
  '#F9A8D4', // Light pink
  '#67E8F9', // Light cyan
  '#D9F99D', // Light lime
  '#FED7AA', // Light orange
  '#A5B4FC', // Light indigo
  '#5EEAD4', // Light teal
  '#C084FC', // Light violet
]

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

// Helper function to get a consistent muted color for multi-select tags
const getColorForChoiceName = (choice: string, customColors?: Record<string, string>, useMuted = true): string => {
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
  // Use muted palette for tags, primary for status
  let hash = 0
  for (let i = 0; i < choice.length; i++) {
    hash = choice.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colors = useMuted ? MUTED_COLORS : PRIMARY_COLORS
  return colors[Math.abs(hash) % colors.length]
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

  // Helper to get color styling for a choice (using muted palette for tags)
  const getColorForChoice = (choice: string): { backgroundColor: string; textColor: string } => {
    const hexColor = getColorForChoiceName(choice, choiceColors, true) // true = use muted colors
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
        className="w-full min-h-[36px] px-3 py-2 flex flex-wrap gap-1.5 text-sm bg-white border border-blue-400 rounded-md focus-within:ring-2 focus-within:ring-blue-400/20 focus-within:ring-offset-1"
      >
        {selectedValues.map((val) => {
          const colorInfo = getColorForChoice(val)
          return (
            <span
              key={val}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all ${colorInfo.textColor}`}
              style={{ 
                backgroundColor: colorInfo.backgroundColor,
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
              }}
            >
              {val}
              <button
                onClick={(e) => handleRemove(val, e)}
                className={`ml-0.5 rounded p-0.5 hover:bg-black/10 transition-colors ${colorInfo.textColor} opacity-70 hover:opacity-100`}
                aria-label={`Remove ${val}`}
                title="Remove"
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
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all bg-white text-gray-700 hover:bg-gray-50`}
                  title={`Add ${choice}`}
                >
                  <Plus className="h-3 w-3 text-gray-500" />
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
      onClick={(e) => {
        // Only trigger edit if clicking the cell background, not pills
        if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.cell-background')) {
          editable && setEditing(true)
        }
      }}
      className="w-full min-h-[36px] px-3 py-2 flex items-center flex-wrap gap-1.5 text-sm cursor-pointer hover:bg-gray-50/50 rounded transition-colors group cell-background"
      title={isEmpty ? undefined : displayValues.join(', ')}
    >
      {isEmpty ? (
        <span className="text-gray-400 italic text-sm">{placeholder}</span>
      ) : (
        <>
          {displayValues.map((val) => {
            const colorInfo = getColorForChoice(val)
            return (
              <span
                key={val}
                className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all ${colorInfo.textColor} hover:opacity-80 hover:scale-[1.02]`}
                style={{ 
                  backgroundColor: colorInfo.backgroundColor,
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  // Pills are not clickable in view mode - clicking cell background edits
                }}
              >
                {val}
              </span>
            )
          })}
        </>
      )}
    </div>
  )
}
