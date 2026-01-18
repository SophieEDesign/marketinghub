"use client"

import { useState, useRef, useEffect } from 'react'
import {
  DEFAULT_TEXT_LINE_HEIGHT,
  getRowHeightTextLineClamp,
} from '@/lib/grid/row-height-utils'
import { getSchemaSafeMessage, logSchemaWarning } from '@/lib/errors/schema'

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
      console.error('Error saving text cell:', error)
      logSchemaWarning('TextCell save', error)
      alert(getSchemaSafeMessage(error, 'Failed to save. Please check your permissions and try again.'))
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
    : undefined

  if (editing && canEdit) {
    return (
      <div className="relative w-full h-full" style={rowHeightStyle}>
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="w-full h-full px-3 py-1 text-sm border border-blue-400 outline-none bg-white focus:ring-2 focus:ring-blue-400/20 focus:ring-offset-1 rounded-md box-border"
          style={rowHeightStyle}
          disabled={saving}
        />
      </div>
    )
  }

  const displayValue = value || placeholder
  const isPlaceholder = !value

  // Controlled wrapping: single line with ellipsis by default, clamp lines when wrapText enabled
  const cellStyle: React.CSSProperties = rowHeight
    ? {
        minHeight: `${rowHeight}px`,
        maxHeight: `${rowHeight}px`,
        height: `${rowHeight}px`,
      }
    : {}

  const lineClamp = getRowHeightTextLineClamp(rowHeight, { wrapText })
  const wrapStyle: React.CSSProperties = {
    lineHeight: `${DEFAULT_TEXT_LINE_HEIGHT}px`,
    ...(lineClamp
      ? {
          display: '-webkit-box',
          WebkitLineClamp: lineClamp,
          WebkitBoxOrient: 'vertical',
        }
      : {}),
  }

  return (
    <div
      onClick={canEdit ? () => setEditing(true) : undefined}
      className={`w-full h-full px-3 py-1 text-sm rounded-md transition-colors flex overflow-hidden border border-transparent box-border ${
        wrapText ? 'items-start' : 'items-center'
      } ${canEdit ? 'text-gray-900 cursor-pointer hover:bg-gray-50/50' : 'text-gray-500 cursor-default'}`}
      style={cellStyle}
      title={value || undefined}
    >
      <span
        className={`${
          wrapText ? 'whitespace-normal break-words' : 'whitespace-nowrap'
        } overflow-hidden ${isPlaceholder ? 'text-gray-400 italic' : 'text-gray-900'} w-full`}
        style={wrapStyle}
      >
        {displayValue}
      </span>
    </div>
  )
}
