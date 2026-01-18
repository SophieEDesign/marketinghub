"use client"

import { useState, useRef, useEffect } from 'react'
import { format, parseISO, isValid } from 'date-fns'
import { formatDateUK, toISODateString } from '@/lib/utils'

interface DateCellProps {
  value: string | null
  fieldName: string
  editable?: boolean
  onSave: (value: string | null) => Promise<void>
  placeholder?: string
}

export default function DateCell({
  value,
  fieldName,
  editable = true,
  onSave,
  placeholder = '—',
}: DateCellProps) {
  const [editing, setEditing] = useState(false)
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

  if (editing && editable) {
    return (
      <input
        ref={inputRef}
        type="date"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="w-full min-h-[36px] px-3 py-2 text-sm border border-blue-400 outline-none bg-white focus:ring-2 focus:ring-blue-400/20 focus:ring-offset-1 rounded-md"
        disabled={saving}
      />
    )
  }

  return (
    <div
      onClick={() => editable && setEditing(true)}
      className="w-full min-h-[36px] px-3 py-2 flex items-center text-sm text-gray-900 cursor-pointer hover:bg-gray-50/50 rounded-md transition-colors"
    >
      <span className="truncate">
        {value ? formatDisplayValue(value) : <span className="text-gray-400 italic">{placeholder}</span>}
      </span>
    </div>
  )
}
