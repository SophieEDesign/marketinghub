"use client"

import { useState, useRef, useEffect } from 'react'

interface TextCellProps {
  value: string | null
  fieldName: string
  editable?: boolean
  wrapText?: boolean // If true, allow max 2 lines; if false, single line with ellipsis
  rowHeight?: number // Row height in pixels
  onSave: (value: string) => Promise<void>
  placeholder?: string
}

export default function TextCell({
  value,
  fieldName,
  editable = true,
  wrapText = false,
  rowHeight,
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
        className="w-full h-full px-3 py-1 text-sm border border-blue-400 outline-none bg-white focus:ring-2 focus:ring-blue-400/20 focus:ring-offset-1 rounded-md"
        style={{ height: rowHeight ? `${rowHeight}px` : 'auto' }}
        disabled={saving}
      />
    )
  }

  const displayValue = value || placeholder
  const isPlaceholder = !value

  // Controlled wrapping: single line with ellipsis by default, max 2 lines if wrapText enabled
  const cellStyle: React.CSSProperties = {
    height: rowHeight ? `${rowHeight}px` : 'auto',
    maxHeight: rowHeight ? `${rowHeight}px` : 'none',
  }

  return (
    <div
      onClick={() => editable && setEditing(true)}
      className="w-full h-full px-3 py-1 text-sm text-gray-900 cursor-pointer hover:bg-gray-50/50 rounded-md transition-colors flex items-center overflow-hidden"
      style={cellStyle}
      title={value || undefined}
    >
      <span 
        className={`${wrapText ? 'line-clamp-2' : 'truncate'} ${isPlaceholder ? 'text-gray-400 italic' : 'text-gray-900'} w-full`}
        style={{ 
          lineHeight: rowHeight ? `${Math.max(16, rowHeight - 8)}px` : '1.5',
          maxHeight: wrapText && rowHeight ? `${rowHeight - 8}px` : 'none',
        }}
      >
        {displayValue}
      </span>
    </div>
  )
}
