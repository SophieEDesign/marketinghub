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
}

export default function MultiSelectCell({
  value,
  fieldName,
  editable = true,
  onSave,
  placeholder = '—',
  choices = [],
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

  if (editing && editable) {
    return (
      <div
        ref={containerRef}
        onKeyDown={handleKeyDown}
        className="w-full min-h-[32px] px-2 py-1 flex flex-wrap gap-1 text-sm bg-white border border-blue-500 rounded focus-within:ring-2 focus-within:ring-blue-500"
      >
        {selectedValues.map((val) => (
          <span
            key={val}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium"
          >
            {val}
            <button
              onClick={(e) => handleRemove(val, e)}
              className="hover:bg-blue-200 rounded p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <div className="flex flex-wrap gap-1">
          {choices
            .filter((choice) => !selectedValues.includes(choice))
            .map((choice) => (
              <button
                key={choice}
                onClick={() => handleToggle(choice)}
                className="px-2 py-0.5 text-xs border border-gray-300 rounded hover:bg-gray-100"
              >
                <Plus className="h-3 w-3 inline mr-1" />
                {choice}
              </button>
            ))}
        </div>
      </div>
    )
  }

  const displayValues = value || []
  const isEmpty = displayValues.length === 0

  return (
    <div
      onClick={() => editable && setEditing(true)}
      className="w-full h-full px-2 py-1 flex flex-wrap gap-1 items-center text-sm cursor-pointer hover:bg-blue-50 rounded transition-colors min-h-[32px]"
    >
      {isEmpty ? (
        <span className="text-gray-400">{placeholder}</span>
      ) : (
        displayValues.map((val) => (
          <span
            key={val}
            className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium"
          >
            {val}
          </span>
        ))
      )}
    </div>
  )
}
