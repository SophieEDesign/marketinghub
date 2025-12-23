"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { useGridData } from '@/lib/grid/useGridData'
import { CellFactory } from './CellFactory'
import GridColumnHeader from './GridColumnHeader'
import { filterRowsBySearch } from '@/lib/search/filterRows'
import type { TableField } from '@/types/fields'

interface AirtableGridViewProps {
  tableName: string
  viewName?: string
  rowHeight?: 'short' | 'medium' | 'tall'
  editable?: boolean
  fields?: TableField[]
  onAddField?: () => void
  onEditField?: (fieldName: string) => void
}

const ROW_HEIGHT_SHORT = 32
const ROW_HEIGHT_MEDIUM = 40
const ROW_HEIGHT_TALL = 56
const HEADER_HEIGHT = 40
const COLUMN_MIN_WIDTH = 100
const COLUMN_DEFAULT_WIDTH = 200
const FROZEN_COLUMN_WIDTH = 50

export default function AirtableGridView({
  tableName,
  viewName = 'default',
  rowHeight = 'medium',
  editable = true,
  fields = [],
  onAddField,
  onEditField,
}: AirtableGridViewProps) {
  const ROW_HEIGHT =
    rowHeight === 'short' ? ROW_HEIGHT_SHORT : rowHeight === 'tall' ? ROW_HEIGHT_TALL : ROW_HEIGHT_MEDIUM

  // State
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [columnOrder, setColumnOrder] = useState<string[]>([])
  const [resizingColumn, setResizingColumn] = useState<string | null>(null)
  const [selectedCell, setSelectedCell] = useState<{ rowId: string; fieldName: string } | null>(null)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(600)
  const [sorts, setSorts] = useState<Array<{ field: string; direction: 'asc' | 'desc' }>>([])

  // Refs
  const gridRef = useRef<HTMLDivElement>(null)
  const headerScrollRef = useRef<HTMLDivElement>(null)
  const bodyScrollRef = useRef<HTMLDivElement>(null)
  const frozenColumnRef = useRef<HTMLDivElement>(null)

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Get search query from URL
  const searchParams = useSearchParams()
  const searchQuery = searchParams.get("q") || ""

  // Load data
  const { rows: allRows, loading, error, updateCell } = useGridData({
    tableName,
    fields,
    sorts,
  })

  // Initialize column widths and order from localStorage or defaults
  useEffect(() => {
    if (fields.length === 0) return

    const storageKey = `grid_${tableName}_${viewName}`
    const savedWidths = localStorage.getItem(`${storageKey}_widths`)
    const savedOrder = localStorage.getItem(`${storageKey}_order`)

    if (savedWidths) {
      try {
        setColumnWidths(JSON.parse(savedWidths))
      } catch {
        // Fallback to defaults
      }
    }

    if (savedOrder) {
      try {
        const order = JSON.parse(savedOrder)
        // Validate order contains all fields
        const allFieldNames = fields.map((f) => f.name)
        if (order.every((name: string) => allFieldNames.includes(name))) {
          setColumnOrder(order)
        } else {
          setColumnOrder(allFieldNames)
        }
      } catch {
        setColumnOrder(fields.map((f) => f.name))
      }
    } else {
      // Sort fields by order_index, then by position, then by name
      const sortedFields = [...fields].sort((a, b) => {
        const aOrder = a.order_index ?? a.position ?? 0
        const bOrder = b.order_index ?? b.position ?? 0
        if (aOrder !== bOrder) return aOrder - bOrder
        return a.name.localeCompare(b.name)
      })
      setColumnOrder(sortedFields.map((f) => f.name))
    }

    // Set default widths for fields without saved widths
    setColumnWidths((prev) => {
      const newWidths = { ...prev }
      fields.forEach((field) => {
        if (!newWidths[field.name]) {
          newWidths[field.name] = COLUMN_DEFAULT_WIDTH
        }
      })
      return newWidths
    })
  }, [fields, tableName, viewName])

  // Save column widths and order to localStorage
  useEffect(() => {
    if (Object.keys(columnWidths).length === 0 || columnOrder.length === 0) return

    const storageKey = `grid_${tableName}_${viewName}`
    localStorage.setItem(`${storageKey}_widths`, JSON.stringify(columnWidths))
    localStorage.setItem(`${storageKey}_order`, JSON.stringify(columnOrder))
  }, [columnWidths, columnOrder, tableName, viewName])

  // Update container height
  useEffect(() => {
    if (!gridRef.current) return

    const updateHeight = () => {
      setContainerHeight(gridRef.current?.clientHeight || 600)
    }

    updateHeight()
    window.addEventListener('resize', updateHeight)
    return () => window.removeEventListener('resize', updateHeight)
  }, [])

  // Sync scroll between header and body
  useEffect(() => {
    if (headerScrollRef.current && bodyScrollRef.current) {
      bodyScrollRef.current.addEventListener('scroll', () => {
        if (bodyScrollRef.current) {
          const left = bodyScrollRef.current.scrollLeft
          const top = bodyScrollRef.current.scrollTop
          setScrollLeft(left)
          setScrollTop(top)
          if (headerScrollRef.current) {
            headerScrollRef.current.scrollLeft = left
          }
        }
      })
    }
  }, [])

  // Get visible fields in order (needed for search filtering and rendering)
  const visibleFields = useMemo(() => {
    if (columnOrder.length === 0) return []
    return columnOrder
      .map((fieldName) => fields.find((f) => f.name === fieldName))
      .filter((f): f is TableField => f !== undefined)
  }, [columnOrder, fields])

  // Filter rows by search query (only visible fields)
  const visibleFieldNames = useMemo(() => {
    return visibleFields.map((f) => f.name)
  }, [visibleFields])

  const rows = useMemo(() => {
    return filterRowsBySearch(allRows, fields, searchQuery, visibleFieldNames)
  }, [allRows, fields, searchQuery, visibleFieldNames])

  // Virtualization calculations
  const visibleRowCount = Math.ceil(containerHeight / ROW_HEIGHT) + 5
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 2)
  const endIndex = Math.min(rows.length, startIndex + visibleRowCount)
  const visibleRows = rows.slice(startIndex, endIndex)

  // Calculate total width
  const totalWidth = useMemo(() => {
    return columnOrder.reduce((sum, fieldName) => {
      return sum + (columnWidths[fieldName] || COLUMN_DEFAULT_WIDTH)
    }, FROZEN_COLUMN_WIDTH)
  }, [columnOrder, columnWidths])

  // Handle column resize
  const handleResizeStart = useCallback((fieldName: string) => {
    setResizingColumn(fieldName)
  }, [])

  const handleResize = useCallback(
    (fieldName: string, width: number) => {
      setColumnWidths((prev) => ({
        ...prev,
        [fieldName]: Math.max(COLUMN_MIN_WIDTH, width),
      }))
    },
    []
  )

  const handleResizeEnd = useCallback(() => {
    setResizingColumn(null)
  }, [])

  // Handle column reorder
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setColumnOrder((items) => {
        const oldIndex = items.indexOf(active.id as string)
        const newIndex = items.indexOf(over.id as string)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  // Handle cell save
  const handleCellSave = useCallback(
    async (rowId: string, fieldName: string, value: any) => {
      try {
        await updateCell(rowId, fieldName, value)
      } catch (error) {
        console.error('Error saving cell:', error)
        throw error
      }
    },
    [updateCell]
  )

  // Handle sort
  const handleSort = useCallback((fieldName: string, direction: 'asc' | 'desc' | null) => {
    setSorts((prev) => {
      const filtered = prev.filter((s) => s.field !== fieldName)
      if (direction) {
        return [...filtered, { field: fieldName, direction }]
      }
      return filtered
    })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Error: {error}</div>
      </div>
    )
  }

  // Empty state for search
  if (searchQuery && rows.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <div className="text-sm mb-2">No records match your search</div>
        <button
          onClick={() => {
            const params = new URLSearchParams(window.location.search)
            params.delete("q")
            window.history.replaceState({}, "", `?${params.toString()}`)
            window.location.reload()
          }}
          className="text-xs text-blue-600 hover:text-blue-700 underline"
        >
          Clear search
        </button>
      </div>
    )
  }

  return (
    <div ref={gridRef} className="flex flex-col h-full bg-gray-50 overflow-hidden">
      {/* Header */}
      <div
        ref={headerScrollRef}
        className="flex-shrink-0 border-b border-gray-300 bg-white shadow-sm overflow-x-auto overflow-y-hidden"
        style={{ height: HEADER_HEIGHT }}
        onScroll={(e) => {
          const left = e.currentTarget.scrollLeft
          setScrollLeft(left)
          if (bodyScrollRef.current) {
            bodyScrollRef.current.scrollLeft = left
          }
        }}
      >
        <div className="flex" style={{ width: totalWidth, minWidth: '100%' }}>
          {/* Frozen row number column */}
          <div
            className="flex-shrink-0 border-r border-gray-200 bg-gray-50 flex items-center justify-center text-xs font-medium text-gray-600 sticky left-0 z-20"
            style={{ width: FROZEN_COLUMN_WIDTH, height: HEADER_HEIGHT }}
          >
            #
          </div>

          {/* Column headers */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
              {visibleFields.map((field) => (
                <GridColumnHeader
                  key={field.name}
                  field={field}
                  width={columnWidths[field.name] || COLUMN_DEFAULT_WIDTH}
                  isResizing={resizingColumn === field.name}
                  onResizeStart={handleResizeStart}
                  onResize={handleResize}
                  onResizeEnd={handleResizeEnd}
                  onEdit={onEditField}
                  sortDirection={
                    sorts.find((s) => s.field === field.name)?.direction || null
                  }
                  onSort={handleSort}
                />
              ))}
            </SortableContext>
          </DndContext>

          {/* Add column button */}
          {onAddField && (
            <div
              className="flex-shrink-0 border-r border-gray-200 bg-gray-50 flex items-center justify-center"
              style={{ width: FROZEN_COLUMN_WIDTH, height: HEADER_HEIGHT }}
            >
              <button
                onClick={onAddField}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                title="Add column"
              >
                <Plus className="h-4 w-4 text-gray-500" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div
        ref={bodyScrollRef}
        className="flex-1 overflow-auto bg-white"
        onScroll={(e) => {
          const left = e.currentTarget.scrollLeft
          const top = e.currentTarget.scrollTop
          setScrollLeft(left)
          setScrollTop(top)
          if (headerScrollRef.current) {
            headerScrollRef.current.scrollLeft = left
          }
        }}
      >
        <div style={{ width: totalWidth, minWidth: '100%', position: 'relative' }}>
          {/* Virtualized rows */}
          <div style={{ height: startIndex * ROW_HEIGHT }} />
          {visibleRows.map((row, idx) => {
            const actualIndex = startIndex + idx
            const isEven = actualIndex % 2 === 0
            return (
              <div
                key={row.id}
                className={`flex border-b border-gray-100 hover:bg-blue-50 transition-colors ${
                  isEven ? 'bg-white' : 'bg-gray-50/50'
                }`}
                style={{ height: ROW_HEIGHT }}
              >
                {/* Frozen row number */}
                <div
                  ref={actualIndex === 0 ? frozenColumnRef : null}
                  className="flex-shrink-0 border-r border-gray-200 bg-gray-50 flex items-center justify-center text-xs text-gray-500 font-medium sticky left-0 z-10"
                  style={{ width: FROZEN_COLUMN_WIDTH, height: ROW_HEIGHT }}
                >
                  {actualIndex + 1}
                </div>

                {/* Cells */}
                {visibleFields.map((field) => {
                  const width = columnWidths[field.name] || COLUMN_DEFAULT_WIDTH
                  const isSelected =
                    selectedCell?.rowId === row.id && selectedCell?.fieldName === field.name

                  return (
                    <div
                      key={field.name}
                      className={`border-r border-gray-100 flex items-center relative ${
                        isSelected ? 'bg-blue-100 ring-2 ring-blue-500 ring-inset' : ''
                      }`}
                      style={{ width, height: ROW_HEIGHT }}
                      onClick={() => setSelectedCell({ rowId: row.id, fieldName: field.name })}
                    >
                      <CellFactory
                        field={field}
                        value={row[field.name]}
                        rowId={row.id}
                        tableName={tableName}
                        editable={editable && !field.options?.read_only}
                        onSave={(value) => handleCellSave(row.id, field.name, value)}
                      />
                    </div>
                  )
                })}
              </div>
            )
          })}
          <div style={{ height: (rows.length - endIndex) * ROW_HEIGHT }} />
        </div>
      </div>
    </div>
  )
}
