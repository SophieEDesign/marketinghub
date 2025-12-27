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
import { Plus, ChevronDown, ChevronRight, Check } from 'lucide-react'
import { useGridData } from '@/lib/grid/useGridData'
import { CellFactory } from './CellFactory'
import GridColumnHeader from './GridColumnHeader'
import BulkActionBar from './BulkActionBar'
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
  groupBy?: string
  userRole?: "admin" | "editor" | "viewer" | null
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
  groupBy,
  userRole = "editor",
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
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set())
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)

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

  const filteredRows = useMemo(() => {
    return filterRowsBySearch(allRows, fields, searchQuery, visibleFieldNames)
  }, [allRows, fields, searchQuery, visibleFieldNames])

  // Group rows if groupBy is set
  const groupedRows = useMemo(() => {
    if (!groupBy) return null

    const groups: Record<string, typeof filteredRows> = {}

    filteredRows.forEach((row) => {
      const groupValue = row[groupBy] ?? "Uncategorized"
      const groupKey = String(groupValue)
      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(row)
    })

    // Sort group keys
    const sortedGroupKeys = Object.keys(groups).sort()

    return sortedGroupKeys.map((key) => ({
      key,
      value: groups[key][0][groupBy],
      rows: groups[key],
    }))
  }, [filteredRows, groupBy])

  function toggleGroup(groupKey: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }
      return next
    })
  }

  // Row selection logic
  const allVisibleRowIds = useMemo(() => {
    return new Set(filteredRows.map((row: any) => row.id))
  }, [filteredRows])

  const isAllSelected = allVisibleRowIds.size > 0 && Array.from(allVisibleRowIds).every(id => selectedRowIds.has(id))
  const isIndeterminate = selectedRowIds.size > 0 && !isAllSelected

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRowIds(new Set(allVisibleRowIds))
    } else {
      setSelectedRowIds(new Set())
    }
    setLastSelectedIndex(null)
  }

  const handleRowSelect = (rowId: string, index: number, event: React.MouseEvent) => {
    event.stopPropagation()
    
    if (event.shiftKey && lastSelectedIndex !== null) {
      // Range selection
      const start = Math.min(lastSelectedIndex, index)
      const end = Math.max(lastSelectedIndex, index)
      const rowsArray = Array.isArray(filteredRows) ? filteredRows : []
      const rangeIds = rowsArray.slice(start, end + 1).map((row: any) => row.id)
      setSelectedRowIds((prev) => {
        const next = new Set(prev)
        rangeIds.forEach(id => next.add(id))
        return next
      })
    } else {
      // Toggle single row
      setSelectedRowIds((prev) => {
        const next = new Set(prev)
        if (next.has(rowId)) {
          next.delete(rowId)
        } else {
          next.add(rowId)
        }
        return next
      })
      setLastSelectedIndex(index)
    }
  }

  const handleClearSelection = () => {
    setSelectedRowIds(new Set())
    setLastSelectedIndex(null)
  }

  // Build render items (groups + rows or just rows)
  const renderItems = useMemo(() => {
    if (groupBy && groupedRows) {
      const items: Array<{ type: 'group' | 'row'; data: any; groupKey?: string }> = []
      groupedRows.forEach((group) => {
        items.push({ type: 'group', data: group, groupKey: group.key })
        if (!collapsedGroups.has(group.key)) {
          group.rows.forEach((row: any) => {
            items.push({ type: 'row', data: row })
          })
        }
      })
      return items
    }
    return filteredRows.map((row) => ({ type: 'row' as const, data: row }))
  }, [groupBy, groupedRows, collapsedGroups, filteredRows])

  // Virtualization calculations
  const GROUP_HEADER_HEIGHT = 40
  const getItemHeight = (item: typeof renderItems[0]) => {
    return item.type === 'group' ? GROUP_HEADER_HEIGHT : ROW_HEIGHT
  }
  
  let currentHeight = 0
  let startIndex = 0
  let endIndex = renderItems.length
  
  for (let i = 0; i < renderItems.length; i++) {
    const itemHeight = getItemHeight(renderItems[i])
    if (currentHeight + itemHeight > scrollTop - 100) {
      startIndex = Math.max(0, i - 2)
      break
    }
    currentHeight += itemHeight
  }
  
  currentHeight = 0
  for (let i = startIndex; i < renderItems.length; i++) {
    currentHeight += getItemHeight(renderItems[i])
    if (currentHeight > containerHeight + 200) {
      endIndex = i + 1
      break
    }
  }
  
  const visibleItems = renderItems.slice(startIndex, endIndex)
  const offsetTop = renderItems.slice(0, startIndex).reduce((sum, item) => sum + getItemHeight(item), 0)

  // Calculate total width (checkbox + row number + columns + add button)
  const totalWidth = useMemo(() => {
    const columnsWidth = columnOrder.reduce((sum, fieldName) => {
      return sum + (columnWidths[fieldName] || COLUMN_DEFAULT_WIDTH)
    }, 0)
    return FROZEN_COLUMN_WIDTH * 2 + columnsWidth + (onAddField ? FROZEN_COLUMN_WIDTH : 0)
  }, [columnOrder, columnWidths, onAddField])

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
  if (searchQuery && filteredRows.length === 0 && !loading) {
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
        className="flex-shrink-0 border-b border-gray-300 bg-white shadow-sm overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
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
          {/* Checkbox column */}
          <div
            className="flex-shrink-0 border-r border-gray-200 bg-gray-50 flex items-center justify-center sticky left-0 z-20"
            style={{ width: FROZEN_COLUMN_WIDTH, height: HEADER_HEIGHT }}
            onClick={(e) => {
              e.stopPropagation()
              handleSelectAll(!isAllSelected)
            }}
          >
            <div className="relative">
              <input
                type="checkbox"
                checked={isAllSelected}
                ref={(el) => {
                  if (el) el.indeterminate = isIndeterminate
                }}
                onChange={() => handleSelectAll(!isAllSelected)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Frozen row number column */}
          <div
            className="flex-shrink-0 border-r border-gray-200 bg-gray-50 flex items-center justify-center text-xs font-medium text-gray-600 sticky left-[50px] z-20"
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
          {/* Virtualized items */}
          <div style={{ height: offsetTop }} />
          {visibleItems.map((item, idx) => {
            if (item.type === 'group') {
              const group = item.data
              const isCollapsed = collapsedGroups.has(item.groupKey!)
              return (
                <div
                  key={`group-${item.groupKey}`}
                  className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-20"
                  style={{ height: GROUP_HEADER_HEIGHT }}
                >
                  <div
                    className="flex items-center px-4 flex-1 cursor-pointer hover:bg-gray-100"
                    onClick={() => toggleGroup(item.groupKey!)}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 mr-2 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 mr-2 text-gray-500" />
                    )}
                    <span className="font-semibold text-sm text-gray-700">
                      {groupBy}: {String(group.value ?? "Uncategorized")}
                    </span>
                    <span className="text-gray-500 ml-2 text-sm">
                      ({group.rows.length} {group.rows.length === 1 ? "row" : "rows"})
                    </span>
                  </div>
                </div>
              )
            } else {
              const row = item.data
              const actualIndex = startIndex + idx
              const isEven = actualIndex % 2 === 0
              const isSelected = selectedRowIds.has(row.id)
              const rowIndex = filteredRows.findIndex((r: any) => r.id === row.id)
              
              return (
                <div
                  key={row.id}
                  className={`flex border-b border-gray-100 hover:bg-blue-50 transition-colors ${
                    isEven ? 'bg-white' : 'bg-gray-50/50'
                  } ${isSelected ? 'bg-blue-100' : ''}`}
                  style={{ height: ROW_HEIGHT }}
                >
                  {/* Checkbox */}
                  <div
                    className="flex-shrink-0 border-r border-gray-200 bg-gray-50 flex items-center justify-center sticky left-0 z-10"
                    style={{ width: FROZEN_COLUMN_WIDTH, height: ROW_HEIGHT }}
                    onClick={(e) => handleRowSelect(row.id, rowIndex, e)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRowSelect(row.id, rowIndex, e)
                      }}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                    />
                  </div>

                  {/* Frozen row number */}
                  <div
                    ref={actualIndex === 0 ? frozenColumnRef : null}
                    className="flex-shrink-0 border-r border-gray-200 bg-gray-50 flex items-center justify-center text-xs text-gray-500 font-medium sticky left-[50px] z-10"
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
            }
          })}
          <div style={{ height: renderItems.slice(endIndex).reduce((sum, item) => sum + getItemHeight(item), 0) }} />
        </div>
      </div>

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedRowIds.size}
        tableName={tableName}
        tableFields={fields}
        userRole={userRole}
        onClearSelection={handleClearSelection}
        onBulkUpdate={async (updates) => {
          const recordIds = Array.from(selectedRowIds)
          const response = await fetch('/api/records/bulk-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table: tableName,
              recordIds,
              updates,
            }),
          })
          
          if (!response.ok) {
            const data = await response.json()
            throw new Error(data.error || 'Failed to update records')
          }
          
          // Refresh data
          window.location.reload()
        }}
        onBulkDelete={async () => {
          if (!confirm(`Are you sure you want to delete ${selectedRowIds.size} record${selectedRowIds.size !== 1 ? 's' : ''}? This action cannot be undone.`)) {
            return
          }
          
          const recordIds = Array.from(selectedRowIds)
          const response = await fetch('/api/records/bulk-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table: tableName,
              recordIds,
            }),
          })
          
          if (!response.ok) {
            const data = await response.json()
            throw new Error(data.error || 'Failed to delete records')
          }
          
          handleClearSelection()
          window.location.reload()
        }}
      />
    </div>
  )
}
