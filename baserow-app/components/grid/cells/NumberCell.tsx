"use client"

import { useState, useRef, useEffect } from 'react'

interface NumberCellProps {
  value: number | null
  fieldName: string
  editable?: boolean
  onSave: (value: number | null) => Promise<void>
  placeholder?: string
  precision?: number
}

export default function NumberCell({
  value,
  fieldName,
  editable = true,
  onSave,
  placeholder = '—',
  precision,
}: NumberCellProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value?.toString() || '')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setEditValue(value?.toString() || '')
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
      const numValue = editValue === '' ? null : parseFloat(editValue)
      await onSave(numValue)
      setEditing(false)
    } catch (error) {
      console.error('Error saving number cell:', error)
      alert((error as any)?.message || 'Failed to save. Please check your permissions and try again.')
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

  if (editing && editable) {
    return (
      <input
        ref={inputRef}
        type="number"
        step={precision !== undefined ? Math.pow(10, -precision) : 'any'}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="w-full min-h-[36px] px-3 py-2 text-sm border border-blue-400 outline-none bg-white focus:ring-2 focus:ring-blue-400/20 focus:ring-offset-1 rounded-md text-right"
        disabled={saving}
      />
    )
  }

  return (
    <div
      onClick={() => editable && setEditing(true)}
      className="w-full min-h-[36px] px-3 py-2 flex items-center justify-end text-sm text-gray-900 cursor-pointer hover:bg-gray-50/50 rounded-md transition-colors"
    >
      <span className="truncate text-right">
        {value !== null && value !== undefined ? formatDisplayValue(value) : <span className="text-gray-400 italic">{placeholder}</span>}
      </span>
    </div>
  )
}
