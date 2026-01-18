"use client"

import { useState, useRef, useEffect } from 'react'
import { format, parseISO, isValid } from 'date-fns'
import { formatDateUK, toISODateString } from '@/lib/utils'

interface DateCellProps {
  value: string | null
  fieldName: string
  editable?: boolean
  rowHeight?: number
  onSave: (value: string | null) => Promise<void>
  placeholder?: string
}

export default function DateCell({
  value,
  fieldName,
  editable = true,
  rowHeight,
  onSave,
  placeholder = '—',
}: DateCellProps) {
  const [editing, setEditing] = useState(false)
  const canEdit = editable
  const getInitialEditValue = () => {
    if (!value) return ''
    try {
      const date = parseISO(value)
      if (!isValid(date)) return ''
      return format(date, 'yyyy-MM-dd')
    } catch {
      return ''
    }
  }
  const [editValue, setEditValue] = useState(getInitialEditValue())
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (value) {
      try {
        setEditValue(format(parseISO(value), 'yyyy-MM-dd'))
      } catch {
        setEditValue('')
      }
    } else {
      setEditValue('')
    }
  }, [value])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.showPicker?.()
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
      // editValue is in YYYY-MM-DD format (from HTML5 date input)
      // Convert to ISO string for storage (ensures proper format)
      const dateValue = editValue ? toISODateString(editValue) : null
      await onSave(dateValue)
      setEditing(false)
    } catch (error) {
      console.error('Error saving date cell:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (value) {
      try {
        setEditValue(format(parseISO(value), 'yyyy-MM-dd'))
      } catch {
        setEditValue('')
      }
    } else {
      setEditValue('')
    }
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

  const formatDisplayValue = (val: string | null): string => {
    return formatDateUK(val, placeholder)
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
        type="date"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="w-full h-full px-3 py-2 text-sm border border-blue-400 outline-none bg-white focus:ring-2 focus:ring-blue-400/20 focus:ring-offset-1 rounded-md box-border"
        style={rowHeightStyle}
        disabled={saving}
      />
    )
  }

  return (
    <div
      onClick={canEdit ? () => setEditing(true) : undefined}
      className={`w-full h-full px-3 py-2 flex items-center text-sm rounded-md transition-colors box-border ${
        canEdit ? 'text-gray-900 cursor-pointer hover:bg-gray-50/50' : 'text-gray-500 cursor-default'
      }`}
      style={rowHeightStyle}
    >
      <span className="truncate">
        {value ? formatDisplayValue(value) : <span className="text-gray-400 italic">{placeholder}</span>}
      </span>
    </div>
  )
}
