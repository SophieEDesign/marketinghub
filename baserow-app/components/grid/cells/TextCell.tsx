"use client"

import { useState, useRef, useEffect } from 'react'
import TextCellModal from '../TextCellModal'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/context-menu/ContextMenu'
import { Copy, Edit } from 'lucide-react'

interface TextCellProps {
  // CellFactory passes `any` at runtime; be defensive here.
  value: unknown
  fieldName: string
  editable?: boolean
  wrapText?: boolean // If true, allow max 2 lines; if false, single line with ellipsis
  rowHeight?: number // Row height in pixels
  onSave: (value: string) => Promise<void>
  placeholder?: string
  onCopy?: () => void // Optional callback for copy action
}

export default function TextCell({
  value,
  fieldName,
  editable = true,
  wrapText = false,
  rowHeight,
  onSave,
  placeholder = '—',
  onCopy,
}: TextCellProps) {
  const [editing, setEditing] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const toDisplayString = (v: unknown): string => {
    if (v === null || v === undefined) return ''
    if (typeof v === 'string') return v
    if (typeof v === 'number' || typeof v === 'boolean') return String(v)
    try {
      return JSON.stringify(v)
    } catch {
      return String(v)
    }
  }

  const [editValue, setEditValue] = useState(toDisplayString(value))
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const cellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setEditValue(toDisplayString(value))
  }, [value])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      // Select all text if there's existing text, otherwise just focus
      if (editValue) {
        inputRef.current.select()
      }
    }
  }, [editing, editValue])

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      await onSave(editValue)
      setEditing(false)
    } catch (error: any) {
      // Don't show errors for aborted requests (expected during navigation/unmount)
      if (error?.name === 'AbortError' || error?.message?.includes('signal is aborted')) {
        return
      }
      console.error('Error saving text cell:', error)
      alert(error?.message || 'Failed to save. Please check your permissions and try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditValue(toDisplayString(value))
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Enter' && e.shiftKey) {
      // Shift+Enter opens modal for longer editing
      e.preventDefault()
      setModalOpen(true)
      setEditing(false)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  const handleCopy = async () => {
    const text = toDisplayString(value)
    if (text) {
      try {
        await navigator.clipboard.writeText(text)
        if (onCopy) onCopy()
      } catch (err) {
        console.error('Failed to copy:', err)
      }
    }
  }

  const clickTimerRef = useRef<NodeJS.Timeout | null>(null)

  const handleSingleClick = (e: React.MouseEvent) => {
    // Single click: copy value (with delay to detect double-click)
    if (e.detail === 1) {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current)
      }
      clickTimerRef.current = setTimeout(() => {
        handleCopy()
      }, 200) // Small delay to detect double-click
    }
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    // Clear the single-click timer
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
    }
    if (editable) {
      // Double-click: start inline editing
      setEditing(true)
    }
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current)
      }
    }
  }, [])

  if (editing && editable) {
    // Container to properly constrain the input within the cell
    const containerStyle: React.CSSProperties = {
      height: rowHeight ? `${rowHeight}px` : '100%',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
    }

    return (
      <div style={containerStyle}>
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="w-full px-3 py-1 text-sm border border-blue-400 outline-none bg-white focus:ring-2 focus:ring-blue-400/20 focus:ring-offset-1 rounded-md"
          style={{ 
            height: rowHeight ? `${rowHeight - 2}px` : 'calc(100% - 2px)',
            minHeight: rowHeight ? `${rowHeight - 2}px` : 'auto',
            maxHeight: rowHeight ? `${rowHeight - 2}px` : 'none',
          }}
          disabled={saving}
        />
      </div>
    )
  }

  // IMPORTANT: don't treat 0/false as empty (previously: `value || placeholder`)
  const rawText = toDisplayString(value)
  const isEmpty = rawText.trim().length === 0
  const displayValue = isEmpty ? placeholder : rawText
  const isPlaceholder = isEmpty

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
            ref={cellRef}
            onClick={handleSingleClick}
            onDoubleClick={handleDoubleClick}
            className={`w-full h-full px-3 py-1 text-sm text-gray-900 cursor-pointer hover:bg-gray-50/50 rounded-md transition-colors flex overflow-hidden relative group ${
              wrapText ? 'items-start' : 'items-center'
            }`}
            style={cellStyle}
            title={!isEmpty ? rawText : undefined}
            tabIndex={editable ? 0 : -1}
          >
            <span 
              className={`${wrapText ? 'line-clamp-2' : 'truncate'} ${isPlaceholder ? 'text-gray-400 italic' : 'text-gray-900'} w-full`}
              style={{ 
                lineHeight: '1.25',
                maxHeight: wrapText ? contentMaxHeight : 'none',
              }}
            >
              {displayValue}
            </span>
            {/* Edit button that appears on hover */}
            {editable && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setModalOpen(true)
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700"
                title="Edit in larger editor"
              >
                <Edit className="h-3.5 w-3.5" />
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
                Edit in modal
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
      
      {modalOpen && (
        <TextCellModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          value={toDisplayString(value)}
          fieldName={fieldName}
          onSave={async (newValue) => {
            await onSave(newValue)
            setModalOpen(false)
          }}
          isLongText={false}
        />
      )}
    </>
  )
}
