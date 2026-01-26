"use client"

import { useState, useEffect } from 'react'
import RichTextEditor from '@/components/fields/RichTextEditor'
import TextCellModal from '@/components/grid/TextCellModal'
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
    // Only update editValue from prop when NOT editing
    // This prevents the input from resetting while the user is typing
    if (!editing) {
      setEditValue(value || '')
    }
  }, [value, editing])

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
      // Double-click: start inline editing
      setEditing(true)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.shiftKey) {
      // Shift+Enter opens modal for rich text editing
      e.preventDefault()
      setModalOpen(true)
      setEditing(false)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setEditing(false)
      setEditValue(value || '')
    }
  }

  if (editing && editable) {
    // Inline editing with textarea for long text
    return (
      <div className="w-full h-full px-3 py-1">
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full px-2 py-1 text-sm border border-blue-400 outline-none bg-white focus:ring-2 focus:ring-blue-400/20 focus:ring-offset-1 rounded-md resize-none"
          style={{ 
            height: rowHeight ? `${Math.max(rowHeight - 16, 60)}px` : '120px',
            minHeight: '60px',
          }}
          disabled={saving}
          placeholder="Enter text... (Shift+Enter for rich text editor)"
          autoFocus
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
            className={`w-full h-full px-3 py-1 text-sm cursor-pointer hover:bg-gray-50/50 rounded-md transition-colors overflow-hidden flex relative group ${
              wrapText ? 'items-start' : 'items-center'
            }`}
            style={cellStyle}
            title={plainText || undefined}
            tabIndex={editable ? 0 : -1}
          >
            {value && value.trim() && value !== '<p></p>' ? (
              <div 
                className={`prose prose-sm max-w-none text-gray-900 ${wrapText ? 'line-clamp-2' : 'line-clamp-1'} overflow-hidden flex-1`}
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
            {/* Edit button that appears on hover - more prominent for long text */}
            {editable && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setModalOpen(true)
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700 bg-white shadow-sm border border-gray-200"
                title="Edit in rich text editor"
              >
                <Edit className="h-4 w-4" />
              </button>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </ContextMenuItem>
          {editable && (
            <>
              <ContextMenuItem onClick={() => setEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit inline
              </ContextMenuItem>
              <ContextMenuItem onClick={() => setModalOpen(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit in rich text editor
              </ContextMenuItem>
            </>
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
