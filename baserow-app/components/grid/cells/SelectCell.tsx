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
}

export default function SelectCell({
  value,
  fieldName,
  editable = true,
  onSave,
  placeholder = '—',
  choices = [],
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

  return (
    <div
      onClick={() => editable && setEditing(true)}
      className="w-full h-full px-2 flex items-center gap-1 text-sm cursor-pointer hover:bg-blue-50 rounded transition-colors group"
    >
      {value && (
        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">
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
