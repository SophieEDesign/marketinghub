"use client"

import { useState, useEffect, useRef } from 'react'
import {
  DEFAULT_TEXT_LINE_HEIGHT,
  getRowHeightTextLineClamp,
} from '@/lib/grid/row-height-utils'

interface LongTextCellProps {
  value: string | null
  fieldName: string
  editable?: boolean
  wrapText?: boolean // If true, allow max 2 lines; if false, single line with ellipsis
  rowHeight?: number // Row height in pixels
  onSave: (value: string) => Promise<void>
  placeholder?: string
}

export default function LongTextCell({
  value,
  fieldName,
  editable = true,
  wrapText = false, // Default to single line
  rowHeight,
  onSave,
  placeholder = '—',
}: LongTextCellProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value || '')
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const canEdit = editable

  useEffect(() => {
    setEditValue(value || '')
  }, [value])

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
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          className="w-full h-full px-3 py-1 text-sm border border-blue-400 rounded-md outline-none bg-white focus:ring-2 focus:ring-blue-400/20 focus:ring-offset-1 box-border resize-none overflow-y-auto"
          placeholder="Enter notes..."
          style={rowHeightStyle}
        />
      </div>
    )
  }

  const displayValue = value || placeholder
  const isPlaceholder = !value
  const plainText = stripHtml(value)

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
      className={`w-full h-full px-3 py-1 text-sm rounded-md transition-colors overflow-hidden flex border border-transparent box-border ${
        wrapText ? 'items-start' : 'items-center'
      } ${canEdit ? 'cursor-pointer hover:bg-gray-50/50 text-gray-900' : 'cursor-default text-gray-500'}`}
      style={cellStyle}
      title={plainText || undefined}
    >
      {value && value.trim() && value !== '<p></p>' ? (
        <div
          className={`prose prose-sm max-w-none text-gray-900 leading-5 prose-p:leading-5 prose-li:leading-5 ${
            wrapText ? 'whitespace-normal break-words' : 'whitespace-nowrap'
          } overflow-hidden prose-p:my-0 prose-ul:my-0 prose-ol:my-0`}
          style={wrapStyle}
          dangerouslySetInnerHTML={{ __html: value }}
        />
      ) : (
        <span className="text-gray-400 italic whitespace-nowrap overflow-hidden w-full">
          {isPlaceholder ? placeholder : ''}
        </span>
      )}
    </div>
  )
}
