"use client"

import { useState, useEffect } from 'react'
import RichTextEditor from '@/components/fields/RichTextEditor'
import TextCellModal from '../TextCellModal'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/context-menu/ContextMenu'
import { Copy, Edit } from 'lucide-react'

interface LongTextCellProps {
  value: string | null
  fieldName: string
  editable?: boolean
  wrapText?: boolean // If true, allow max 2 lines; if false, single line with ellipsis
  rowHeight?: number // Row height in pixels
  onSave: (value: string) => Promise<void>
  placeholder?: string
  onCopy?: () => void // Optional callback for copy action
}

export default function LongTextCell({
  value,
  fieldName,
  editable = true,
  wrapText = false, // Default to single line
  rowHeight,
  onSave,
  placeholder = '—',
  onCopy,
}: LongTextCellProps) {
  const [editing, setEditing] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
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

  const handleCopy = async () => {
    const text = stripHtml(value)
    if (text) {
      try {
        await navigator.clipboard.writeText(text)
        if (onCopy) onCopy()
      } catch (err) {
        console.error('Failed to copy:', err)
      }
    }
  }

  const handleSingleClick = (e: React.MouseEvent) => {
    // Single click: copy value
    if (e.detail === 1) {
      const timer = setTimeout(() => {
        handleCopy()
      }, 200) // Small delay to detect double-click
      
      return () => clearTimeout(timer)
    }
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (editable) {
      // Double-click: open modal for editing
      setModalOpen(true)
    }
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

  // Controlled wrapping: single line with ellipsis by default, max 2 lines if wrapText enabled
  // CRITICAL: Row height must be fixed - cells must not resize rows
  const cellStyle: React.CSSProperties = {
    height: rowHeight ? `${rowHeight}px` : 'auto',
    minHeight: rowHeight ? `${rowHeight}px` : 'auto',
    maxHeight: rowHeight ? `${rowHeight}px` : 'none',
    overflow: 'hidden',
  }
  const contentMaxHeight = rowHeight ? `${Math.max(16, rowHeight - 8)}px` : 'none'

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            onClick={handleSingleClick}
            onDoubleClick={handleDoubleClick}
            className={`w-full h-full px-3 py-1 text-sm cursor-pointer hover:bg-gray-50/50 rounded-md transition-colors overflow-hidden flex ${
              wrapText ? 'items-start' : 'items-center'
            }`}
            style={cellStyle}
            title={plainText || undefined}
          >
            {value && value.trim() && value !== '<p></p>' ? (
              <div 
                className={`prose prose-sm max-w-none text-gray-900 ${wrapText ? 'line-clamp-2' : 'line-clamp-1'} overflow-hidden`}
                style={{ 
                  lineHeight: '1.25',
                  maxHeight: wrapText ? contentMaxHeight : 'none',
                }}
                dangerouslySetInnerHTML={{ __html: value }}
              />
            ) : (
              <span className={`text-gray-400 italic truncate w-full`}>
                {isPlaceholder ? placeholder : ''}
              </span>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </ContextMenuItem>
          {editable && (
            <ContextMenuItem onClick={() => setModalOpen(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit in modal
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
      
      {modalOpen && (
        <TextCellModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          value={value}
          fieldName={fieldName}
          onSave={async (newValue) => {
            await onSave(newValue)
            setModalOpen(false)
          }}
          isLongText={true}
        />
      )}
    </>
  )
}
