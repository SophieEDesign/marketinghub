"use client"

import { useState, useEffect } from 'react'
import RichTextEditor from '@/components/fields/RichTextEditor'

interface LongTextCellProps {
  value: string | null
  fieldName: string
  editable?: boolean
  wrapText?: boolean // Deprecated: kept for compatibility but ignored - always clamped
  onSave: (value: string) => Promise<void>
  placeholder?: string
}

export default function LongTextCell({
  value,
  fieldName,
  editable = true,
  wrapText = true, // Deprecated
  onSave,
  placeholder = '—',
}: LongTextCellProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setEditValue(value || '')
  }, [value])

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      await onSave(editValue)
      setEditing(false)
    } catch (error) {
      console.error('Error saving long text cell:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (newValue: string) => {
    setEditValue(newValue)
  }

  const handleBlur = () => {
    handleSave()
  }

  // Strip HTML tags for display preview
  const stripHtml = (html: string | null): string => {
    if (!html) return ''
    const tmp = document.createElement('DIV')
    tmp.innerHTML = html
    return tmp.textContent || tmp.innerText || ''
  }

  if (editing && editable) {
    return (
      <div className="w-full">
        <RichTextEditor
          value={editValue}
          onChange={handleChange}
          onBlur={handleBlur}
          editable={true}
          showToolbar={true}
          minHeight="120px"
          className="w-full"
        />
      </div>
    )
  }

  const displayValue = value || placeholder
  const isPlaceholder = !value
  const plainText = stripHtml(value)

  return (
    <div
      onClick={() => editable && setEditing(true)}
      className="w-full min-h-[36px] px-3 py-2 text-sm cursor-pointer hover:bg-gray-50/50 rounded-md transition-colors"
      title={plainText || undefined}
    >
      {value && value.trim() && value !== '<p></p>' ? (
        <div 
          className="prose prose-sm max-w-none text-gray-900 line-clamp-2"
          dangerouslySetInnerHTML={{ __html: value }}
        />
      ) : (
        <span className={`text-gray-400 italic`}>
          {isPlaceholder ? placeholder : ''}
        </span>
      )}
    </div>
  )
}
