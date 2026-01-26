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
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    // Only update editValue from prop when NOT editing
    // This prevents the input from resetting while the user is typing
    if (!isMountedRef.current) return
    if (!editing) {
      if (value) {
        try {
          setEditValue(format(parseISO(value), 'yyyy-MM-dd'))
        } catch {
          if (isMountedRef.current) setEditValue('')
        }
      } else {
        setEditValue('')
      }
    }
  }, [value, editing])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.showPicker?.()
    }
  }, [editing])

  const handleSave = async () => {
    if (saving || !isMountedRef.current) return
    setSaving(true)
    try {
      // editValue is in YYYY-MM-DD format (from HTML5 date input)
      // Convert to ISO string for storage (ensures proper format)
      const dateValue = editValue ? toISODateString(editValue) : null
      await onSave(dateValue)
      if (isMountedRef.current) {
        setEditing(false)
      }
    } catch (error) {
      console.error('Error saving date cell:', error)
      // Don't update state if component is unmounted
      if (!isMountedRef.current) return
    } finally {
      if (isMountedRef.current) {
        setSaving(false)
      }
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

  const containerStyle: React.CSSProperties = rowHeight ? { height: `${rowHeight}px` } : {}

  if (editing && editable) {
    return (
      <input
        ref={inputRef}
        type="date"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="w-full h-full px-3 text-sm border border-blue-400 outline-none bg-white focus:ring-2 focus:ring-blue-400/20 focus:ring-offset-1 rounded-md"
        style={containerStyle}
        disabled={saving}
      />
    )
  }

  return (
    <div
      onClick={() => editable && setEditing(true)}
      className="w-full h-full px-3 flex items-center text-sm text-gray-900 cursor-pointer hover:bg-gray-50/50 rounded-md transition-colors overflow-hidden"
      style={containerStyle}
    >
      <span className="truncate">
        {value ? formatDisplayValue(value) : <span className="text-gray-400 italic">{placeholder}</span>}
      </span>
    </div>
  )
}
