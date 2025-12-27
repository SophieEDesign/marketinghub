"use client"

import { useState, useRef, useEffect } from 'react'
import { Mail } from 'lucide-react'

interface EmailCellProps {
  value: string | null
  fieldName: string
  editable?: boolean
  wrapText?: boolean
  onSave: (value: string) => Promise<void>
  placeholder?: string
}

export default function EmailCell({
  value,
  fieldName,
  editable = true,
  wrapText = false,
  onSave,
  placeholder = '—',
}: EmailCellProps) {
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

  if (editing && editable) {
    return (
      <input
        ref={inputRef}
        type="email"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="w-full h-full px-2 text-sm border-none outline-none bg-white focus:ring-2 focus:ring-blue-500 rounded"
        placeholder="email@example.com"
        disabled={saving}
      />
    )
  }

  if (!value) {
    return (
      <div
        onClick={() => editable && setEditing(true)}
        className="w-full h-full px-2 flex items-center gap-1 text-sm text-gray-400 cursor-pointer hover:bg-blue-50 rounded transition-colors"
      >
        <span>{placeholder}</span>
      </div>
    )
  }

  return (
    <div
      onClick={() => editable && setEditing(true)}
      className={`w-full h-full px-2 gap-1 text-sm cursor-pointer hover:bg-blue-50 rounded transition-colors ${
        wrapText ? 'flex items-start' : 'flex items-center'
      }`}
    >
      <Mail className="h-3 w-3 text-gray-400 flex-shrink-0" />
      <a
        href={`mailto:${value}`}
        onClick={(e) => e.stopPropagation()}
        className={`text-blue-600 hover:text-blue-800 underline ${
          wrapText ? 'whitespace-pre-wrap break-words' : 'truncate'
        }`}
      >
        {value}
      </a>
    </div>
  )
}
