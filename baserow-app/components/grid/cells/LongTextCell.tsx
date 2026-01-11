"use client"

import { useState, useRef, useEffect } from 'react'

interface LongTextCellProps {
  value: string | null
  fieldName: string
  editable?: boolean
  wrapText?: boolean // Deprecated: kept for compatibility but ignored - always clamped
  onSave: (value: string) => Promise<void>
  placeholder?: string
}

export default function LongTextCell({
  value,
  fieldName,
  editable = true,
  wrapText = true, // Deprecated
  onSave,
  placeholder = '—',
}: LongTextCellProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value || '')
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setEditValue(value || '')
  }, [value])

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.select()
    }
  }, [editing])

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      await onSave(editValue)
      setEditing(false)
    } catch (error) {
      console.error('Error saving long text cell:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditValue(value || '')
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  if (editing && editable) {
    return (
      <textarea
        ref={textareaRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="w-full min-h-[60px] px-2 py-1 text-sm border-none outline-none bg-white focus:ring-2 focus:ring-blue-500 rounded resize-none"
        disabled={saving}
        rows={3}
      />
    )
  }

  const displayValue = value || placeholder
  const isPlaceholder = !value

  return (
    <div
      onClick={() => editable && setEditing(true)}
      className="w-full h-full px-2 text-sm cursor-pointer hover:bg-blue-50 rounded transition-colors flex items-center"
      title={value || undefined}
    >
      <span className={`truncate ${isPlaceholder ? 'text-gray-400 italic' : 'text-gray-900'}`}>
        {displayValue}
      </span>
    </div>
  )
}
