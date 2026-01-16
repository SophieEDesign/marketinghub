"use client"

import { useState, useRef, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, MoreVertical, ArrowUpDown, ArrowUp, ArrowDown, WrapText } from 'lucide-react'
import type { TableField } from '@/types/fields'
import { getFieldIcon } from '@/lib/icons'
import { useIsMobile } from '@/hooks/useResponsive'
import { createClient } from '@/lib/supabase/client'

const COLUMN_MIN_WIDTH = 100

interface GridColumnHeaderProps {
  field: TableField
  width: number
  isResizing: boolean
  wrapText?: boolean
  isSelected?: boolean
  onResizeStart: (fieldName: string) => void
  onResize: (fieldName: string, width: number) => void
  onResizeEnd: () => void
  onEdit?: (fieldName: string) => void
  onToggleWrapText?: (fieldName: string) => void
  onSelect?: (fieldId: string) => void
  sortDirection?: 'asc' | 'desc' | null
  sortOrder?: number | null // Sort order number (1, 2, 3) for multi-sort
  onSort?: (fieldName: string, direction: 'asc' | 'desc' | null) => void
}

export default function GridColumnHeader({
  field,
  width,
  isResizing,
  wrapText = false,
  isSelected = false,
  onResizeStart,
  onResize,
  onResizeEnd,
  onEdit,
  onToggleWrapText,
  onSelect,
  sortDirection,
  sortOrder = null,
  onSort,
}: GridColumnHeaderProps) {
  const isMobile = useIsMobile()

  const isMirroredLinkedField =
    field.type === 'link_to_table' &&
    !!field.options?.read_only &&
    !!field.options?.linked_table_id

  const [linkedFromTableName, setLinkedFromTableName] = useState<string | null>(null)

  useEffect(() => {
    const linkedTableId = field.options?.linked_table_id
    if (!isMirroredLinkedField || !linkedTableId) {
      setLinkedFromTableName(null)
      return
    }

    let cancelled = false
    const supabase = createClient()

    ;(async () => {
      try {
        const { data } = await supabase
          .from('tables')
          .select('name')
          .eq('id', linkedTableId)
          .maybeSingle()

        if (cancelled) return
        setLinkedFromTableName(data?.name ?? null)
      } catch {
        if (cancelled) return
        setLinkedFromTableName(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isMirroredLinkedField, field.options?.linked_table_id])
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.name })

  const [isHovered, setIsHovered] = useState(false)
  const resizeRef = useRef<HTMLDivElement>(null)
  const resizeStartXRef = useRef(0)
  const resizeStartWidthRef = useRef(0)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    // Disable resize on mobile
    if (isMobile) return
    
    e.preventDefault()
    e.stopPropagation()
    resizeStartXRef.current = e.clientX
    resizeStartWidthRef.current = width
    onResizeStart(field.name)
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const diff = moveEvent.clientX - resizeStartXRef.current
      const newWidth = Math.max(COLUMN_MIN_WIDTH, Math.min(resizeStartWidthRef.current + diff, 1000))
      onResize(field.name, newWidth)
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      onResizeEnd()
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleSortClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onSort) {
      if (sortDirection === null || sortDirection === 'desc') {
        onSort(field.name, 'asc')
      } else if (sortDirection === 'asc') {
        onSort(field.name, 'desc')
      } else {
        onSort(field.name, null)
      }
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, width, minWidth: width, maxWidth: width }}
      className={`relative flex items-center border-r border-gray-100 bg-white hover:bg-gray-50/50 transition-colors group ${
        isSelected ? 'bg-blue-50/50 ring-1 ring-blue-400/30 ring-inset' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        // Select column on click (but not when clicking sort/resize buttons)
        if (onSelect && !e.defaultPrevented) {
          const target = e.target as HTMLElement
          if (!target.closest('button') && !target.closest('.resize-handle')) {
            onSelect(field.id)
          }
        }
      }}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="flex items-center justify-center w-4 h-full cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
      >
        <GripVertical className="h-3 w-3" />
      </div>

      {/* Field icon and name */}
      <div className="flex items-center gap-2 px-3 flex-1 min-w-0">
        <span className="text-gray-400 flex-shrink-0">
          {getFieldIcon(field.type)}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-700 truncate">
            {field.name}
          </div>
          {isMirroredLinkedField && (
            <div className="text-[11px] text-gray-400 truncate">
              Linked from {linkedFromTableName || 'linked table'}
            </div>
          )}
        </div>
      </div>

      {/* Wrap text button */}
      {onToggleWrapText && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleWrapText(field.name)
          }}
          className={`p-1.5 rounded transition-colors ${
            wrapText
              ? 'text-blue-600 bg-blue-50/50'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100/50'
          }`}
          title={wrapText ? 'Text wrapping enabled' : 'Enable text wrapping'}
        >
          <WrapText className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Sort button */}
      {onSort && (
        <button
          onClick={handleSortClick}
          className={`p-1.5 rounded transition-colors flex items-center gap-0.5 ${
            sortDirection
              ? 'text-blue-600 bg-blue-50/50'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100/50'
          }`}
          title={`Sort ${sortDirection === 'asc' ? 'ascending' : sortDirection === 'desc' ? 'descending' : 'none'}${sortOrder !== null ? ` (${sortOrder})` : ''}`}
        >
          {sortDirection === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : sortDirection === 'desc' ? (
            <ArrowDown className="h-3.5 w-3.5" />
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5" />
          )}
          {sortOrder !== null && (
            <span className="text-[10px] font-semibold leading-none">
              {sortOrder}
            </span>
          )}
        </button>
      )}

      {/* Edit menu button */}
      {onEdit && (
        <button
          onClick={() => onEdit(field.name)}
          className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-gray-100/50 rounded transition-opacity mr-1"
          title="Edit column"
        >
          <MoreVertical className="h-4 w-4 text-gray-400" />
        </button>
      )}

      {/* Resize handle - hidden on mobile */}
      {!isMobile && (
        <div
          ref={resizeRef}
          onMouseDown={handleMouseDown}
          className="resize-handle absolute right-0 top-0 bottom-0 cursor-col-resize z-20"
          style={{
            width: '6px',
            marginRight: '-3px', // Extend clickable area beyond column edge
            backgroundColor: isResizing ? 'rgb(96 165 250)' : isHovered ? 'rgba(96 165 250 / 0.3)' : 'transparent',
          }}
          title="Drag to resize column"
        />
      )}
    </div>
  )
}
