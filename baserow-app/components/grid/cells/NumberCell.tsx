"use client"

import { useState, useRef, useEffect } from 'react'
import { getSchemaSafeMessage, logSchemaWarning } from '@/lib/errors/schema'

interface NumberCellProps {
  value: number | null
  fieldName: string
  editable?: boolean
  rowHeight?: number
  onSave: (value: number | null) => Promise<void>
  placeholder?: string
  precision?: number
}

export default function NumberCell({
  value,
  fieldName,
  editable = true,
  rowHeight,
  onSave,
  placeholder = '—',
  precision,
}: NumberCellProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value?.toString() || '')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const canEdit = editable

  useEffect(() => {
    setEditValue(value?.toString() || '')
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
      const numValue = editValue === '' ? null : parseFloat(editValue)
      await onSave(numValue)
      setEditing(false)
    } catch (error) {
      console.error('Error saving number cell:', error)
      logSchemaWarning('NumberCell save', error)
      alert(getSchemaSafeMessage(error, 'Failed to save. Please check your permissions and try again.'))
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditValue(value?.toString() || '')
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

  const formatDisplayValue = (val: number | null): string => {
    if (val === null || val === undefined) return placeholder
    if (precision !== undefined) {
      return val.toFixed(precision)
    }
    return val.toString()
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
        type="number"
        step={precision !== undefined ? Math.pow(10, -precision) : 'any'}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="w-full h-full px-3 py-2 text-sm border border-blue-400 outline-none bg-white focus:ring-2 focus:ring-blue-400/20 focus:ring-offset-1 rounded-md text-right box-border"
        style={rowHeightStyle}
        disabled={saving}
      />
    )
  }

  return (
    <div
      onClick={canEdit ? () => setEditing(true) : undefined}
      className={`w-full h-full px-3 py-2 flex items-center justify-end text-sm rounded-md transition-colors box-border ${
        canEdit ? 'text-gray-900 cursor-pointer hover:bg-gray-50/50' : 'text-gray-500 cursor-default'
      }`}
      style={rowHeightStyle}
    >
      <span className="truncate text-right">
        {value !== null && value !== undefined ? formatDisplayValue(value) : <span className="text-gray-400 italic">{placeholder}</span>}
      </span>
    </div>
  )
}
