"use client"

import { useState, useRef, useEffect } from 'react'

interface TextCellProps {
  value: string | null
  fieldName: string
  editable?: boolean
  wrapText?: boolean // Deprecated: kept for compatibility but ignored
  onSave: (value: string) => Promise<void>
  placeholder?: string
}

export default function TextCell({
  value,
  fieldName,
  editable = true,
  wrapText = false, // Deprecated
  onSave,
  placeholder = '—',
}: TextCellProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value || '')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setEditValue(value || '')
  }, [value])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      await onSave(editValue)
      setEditing(false)
    } catch (error) {
      console.error('Error saving text cell:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditValue(value || '')
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  if (editing && editable) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="w-full h-full px-2 text-sm border-none outline-none bg-white focus:ring-2 focus:ring-blue-500 rounded"
        disabled={saving}
      />
    )
  }

  const displayValue = value || placeholder
  const isPlaceholder = !value

  return (
    <div
      onClick={() => editable && setEditing(true)}
      className="w-full h-full px-2 text-sm text-gray-900 cursor-pointer hover:bg-blue-50 rounded transition-colors flex items-center"
      title={value || undefined}
    >
      <span className={`truncate ${isPlaceholder ? 'text-gray-400 italic' : ''}`}>
        {displayValue}
      </span>
    </div>
  )
}
