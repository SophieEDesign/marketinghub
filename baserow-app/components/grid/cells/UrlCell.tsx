"use client"

import { useState, useRef, useEffect } from 'react'
import { ExternalLink } from 'lucide-react'

interface UrlCellProps {
  value: string | null
  fieldName: string
  editable?: boolean
  wrapText?: boolean // Deprecated: kept for compatibility but ignored
  onSave: (value: string) => Promise<void>
  placeholder?: string
}

export default function UrlCell({
  value,
  fieldName,
  editable = true,
  wrapText = false, // Deprecated
  onSave,
  placeholder = '—',
}: UrlCellProps) {
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
      console.error('Error saving URL cell:', error)
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

  const formatUrl = (url: string): string => {
    if (!url) return ''
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
      return urlObj.hostname.replace('www.', '')
    } catch {
      return url
    }
  }

  const getFullUrl = (url: string): string => {
    if (!url) return ''
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }
    return `https://${url}`
  }

  if (editing && editable) {
    return (
      <input
        ref={inputRef}
        type="url"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="w-full h-full px-2 text-sm border-none outline-none bg-white focus:ring-2 focus:ring-blue-500 rounded"
        placeholder="https://example.com"
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
      className="w-full h-full px-2 gap-1 text-sm cursor-pointer hover:bg-blue-50 rounded transition-colors group flex items-center"
      title={value || undefined}
    >
      <a
        href={getFullUrl(value)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1 truncate"
      >
        {formatUrl(value)}
        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      </a>
    </div>
  )
}
