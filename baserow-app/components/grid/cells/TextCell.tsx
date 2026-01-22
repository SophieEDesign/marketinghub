"use client"

import { useState, useRef, useEffect } from 'react'

interface TextCellProps {
  // CellFactory passes `any` at runtime; be defensive here.
  value: unknown
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
  const toDisplayString = (v: unknown): string => {
    if (v === null || v === undefined) return ''
    if (typeof v === 'string') return v
    if (typeof v === 'number' || typeof v === 'boolean') return String(v)
    try {
      return JSON.stringify(v)
    } catch {
      return String(v)
    }
  }

  const [editValue, setEditValue] = useState(toDisplayString(value))
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setEditValue(toDisplayString(value))
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
      alert((error as any)?.message || 'Failed to save. Please check your permissions and try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditValue(toDisplayString(value))
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
    // Container to properly constrain the input within the cell
    const containerStyle: React.CSSProperties = {
      height: rowHeight ? `${rowHeight}px` : '100%',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
    }

    return (
      <div style={containerStyle}>
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="w-full px-3 py-1 text-sm border border-blue-400 outline-none bg-white focus:ring-2 focus:ring-blue-400/20 focus:ring-offset-1 rounded-md"
          style={{ 
            height: rowHeight ? `${rowHeight - 2}px` : 'calc(100% - 2px)',
            minHeight: rowHeight ? `${rowHeight - 2}px` : 'auto',
            maxHeight: rowHeight ? `${rowHeight - 2}px` : 'none',
          }}
          disabled={saving}
        />
      </div>
    )
  }

  // IMPORTANT: don't treat 0/false as empty (previously: `value || placeholder`)
  const rawText = toDisplayString(value)
  const isEmpty = rawText.trim().length === 0
  const displayValue = isEmpty ? placeholder : rawText
  const isPlaceholder = isEmpty

  // Controlled wrapping: single line with ellipsis by default, max 2 lines if wrapText enabled
  // CRITICAL: Row height must be fixed - cells must not resize rows
  const cellStyle: React.CSSProperties = {
    height: rowHeight ? `${rowHeight}px` : 'auto',
    minHeight: rowHeight ? `${rowHeight}px` : 'auto',
    maxHeight: rowHeight ? `${rowHeight}px` : 'none',
    overflow: 'hidden',
  }
  const contentMaxHeight = rowHeight ? `${Math.max(16, rowHeight - 8)}px` : 'none'

  return (
    <div
      onClick={() => editable && setEditing(true)}
      className={`w-full h-full px-3 py-1 text-sm text-gray-900 cursor-pointer hover:bg-gray-50/50 rounded-md transition-colors flex overflow-hidden ${
        wrapText ? 'items-start' : 'items-center'
      }`}
      style={cellStyle}
      title={!isEmpty ? rawText : undefined}
    >
      <span 
        className={`${wrapText ? 'line-clamp-2' : 'truncate'} ${isPlaceholder ? 'text-gray-400 italic' : 'text-gray-900'} w-full`}
        style={{ 
          lineHeight: '1.25',
          maxHeight: wrapText ? contentMaxHeight : 'none',
        }}
      >
        {displayValue}
      </span>
    </div>
  )
}
