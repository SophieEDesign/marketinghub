"use client"

import { useState, useRef, useEffect } from 'react'
import { Mail } from 'lucide-react'

interface EmailCellProps {
  value: string | null
  fieldName: string
  editable?: boolean
  wrapText?: boolean // Deprecated: kept for compatibility but ignored
  rowHeight?: number
  onSave: (value: string) => Promise<void>
  placeholder?: string
}

export default function EmailCell({
  value,
  fieldName,
  editable = true,
  wrapText = false, // Deprecated
  rowHeight,
  onSave,
  placeholder = '—',
}: EmailCellProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value || '')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const canEdit = editable

  useEffect(() => {
    setEditValue(value || '')
  }, [value])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  useEffect(() => {
    if (!canEdit && editing) {
      setEditing(false)
    }
  }, [canEdit, editing])

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      await onSave(editValue)
      setEditing(false)
    } catch (error) {
      console.error('Error saving email cell:', error)
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

  const rowHeightStyle = rowHeight
    ? {
        height: `${rowHeight}px`,
        minHeight: `${rowHeight}px`,
        maxHeight: `${rowHeight}px`,
      }
    : { minHeight: '36px' }

  if (editing && canEdit) {
    return (
      <input
        ref={inputRef}
        type="email"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="w-full h-full px-2 text-sm border-none outline-none bg-white focus:ring-2 focus:ring-blue-500 rounded box-border"
        style={rowHeightStyle}
        placeholder="email@example.com"
        disabled={saving}
      />
    )
  }

  if (!value) {
    return (
      <div
        onClick={canEdit ? () => setEditing(true) : undefined}
        className={`w-full h-full px-2 flex items-center gap-1 text-sm rounded transition-colors box-border ${
          canEdit ? 'text-gray-400 cursor-pointer hover:bg-blue-50' : 'text-gray-500 cursor-default'
        }`}
        style={rowHeightStyle}
      >
        <span>{placeholder}</span>
      </div>
    )
  }

  return (
    <div
      onClick={canEdit ? () => setEditing(true) : undefined}
      className={`w-full h-full px-2 gap-1 text-sm rounded transition-colors flex items-center box-border ${
        canEdit ? 'cursor-pointer hover:bg-blue-50 text-gray-900' : 'cursor-default text-gray-500'
      }`}
      style={rowHeightStyle}
      title={value || undefined}
    >
      <Mail className="h-3 w-3 text-gray-400 flex-shrink-0" />
      <span className="text-gray-900 truncate">{value}</span>
    </div>
  )
}
