"use client"

import { useState, useRef, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, MoreVertical, ArrowUpDown, ArrowUp, ArrowDown, WrapText, ChevronDown, Edit, Copy, ArrowLeft, ArrowRight, Link, Info, Lock, Filter, Group, Eye, EyeOff, Trash2 } from 'lucide-react'
import type { TableField } from '@/types/fields'
import { getFieldIcon } from '@/lib/icons'
import { useIsMobile } from '@/hooks/useResponsive'
import { createClient } from '@/lib/supabase/client'
import { getFieldDisplayName } from '@/lib/fields/display'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
  tableId?: string // Table ID for copy URL functionality
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
  tableId,
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
  const [dropdownOpen, setDropdownOpen] = useState(false)
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

      {/* Field icon and name - clickable to select column */}
      <div 
        className={`flex items-center gap-2 px-3 flex-1 min-w-0 cursor-pointer ${isSelected ? 'bg-blue-50/50' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          // Select column when clicking on the name area
          if (onSelect) {
            onSelect(field.id)
            // Copy field name to clipboard when selected
            navigator.clipboard.writeText(field.name).then(() => {
              // Could show toast notification here
            }).catch(err => {
              console.error('Failed to copy column name:', err)
            })
          }
        }}
        title="Click to select column"
      >
        <span className="text-gray-400 flex-shrink-0">
          {getFieldIcon(field.type)}
        </span>
        <div className="min-w-0">
          <div 
            className="text-sm font-medium text-gray-700 truncate"
            title={getFieldDisplayName(field)}
          >
            {getFieldDisplayName(field)}
          </div>
          {isMirroredLinkedField && (
            <div 
              className="text-[11px] text-gray-400 truncate"
              title={`Linked from ${linkedFromTableName || 'linked table'}`}
            >
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

      {/* Chevron dropdown trigger - separate clickable area with padding for easier clicking */}
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className="px-1.5 py-1 rounded hover:bg-gray-100/50 transition-colors flex items-center justify-center flex-shrink-0 mr-1"
            onClick={(e) => {
              e.stopPropagation()
            }}
            title="Click to open column menu"
          >
            <ChevronDown className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 transition-colors" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {onEdit && (
            <DropdownMenuItem onClick={() => { onEdit(field.name); setDropdownOpen(false); }}>
              <Edit className="h-4 w-4 mr-2" />
              Edit field
            </DropdownMenuItem>
          )}
          {field.type !== 'formula' && field.type !== 'lookup' && (
            <DropdownMenuItem onClick={() => { 
              // TODO: Implement duplicate
              console.log('Duplicate field:', field.name)
              setDropdownOpen(false)
            }}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate field
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => { 
            // TODO: Implement insert left
            console.log('Insert left:', field.name)
            setDropdownOpen(false)
          }}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Insert left
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { 
            // TODO: Implement insert right
            console.log('Insert right:', field.name)
            setDropdownOpen(false)
          }}>
            <ArrowRight className="h-4 w-4 mr-2" />
            Insert right
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { 
            // Copy field URL
            const tableIdForUrl = tableId || field.table_id
            if (tableIdForUrl) {
              const url = `${window.location.origin}/data/${tableIdForUrl}?field=${encodeURIComponent(field.name)}`
              navigator.clipboard.writeText(url).then(() => {
                setDropdownOpen(false)
              }).catch(err => {
                console.error('Failed to copy URL:', err)
              })
            } else {
              setDropdownOpen(false)
            }
          }}>
            <Link className="h-4 w-4 mr-2" />
            Copy field URL
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { 
            // TODO: Edit field description
            onEdit?.(field.name)
            setDropdownOpen(false)
          }}>
            <Info className="h-4 w-4 mr-2" />
            Edit field description
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { 
            // TODO: Edit field permissions
            console.log('Edit permissions:', field.name)
            setDropdownOpen(false)
          }}>
            <Lock className="h-4 w-4 mr-2" />
            Edit field permissions
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {onSort && (
            <>
              <DropdownMenuItem onClick={() => { onSort(field.name, 'asc'); setDropdownOpen(false); }}>
                <ArrowUpDown className="h-4 w-4 mr-2" />
                Sort First → Last
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { onSort(field.name, 'desc'); setDropdownOpen(false); }}>
                <ArrowUpDown className="h-4 w-4 mr-2" />
                Sort Last → First
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem onClick={() => { 
            // TODO: Filter by this field
            console.log('Filter by:', field.name)
            setDropdownOpen(false)
          }}>
            <Filter className="h-4 w-4 mr-2" />
            Filter by this field
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { 
            // TODO: Group by this field
            console.log('Group by:', field.name)
            setDropdownOpen(false)
          }}>
            <Group className="h-4 w-4 mr-2" />
            Group by this field
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { 
            // TODO: Hide field
            console.log('Hide field:', field.name)
            setDropdownOpen(false)
          }}>
            <EyeOff className="h-4 w-4 mr-2" />
            Hide field
          </DropdownMenuItem>
          {field.type !== 'formula' && field.type !== 'lookup' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => { 
                  // TODO: Delete field
                  console.log('Delete field:', field.name)
                  setDropdownOpen(false)
                }}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete field
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

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
