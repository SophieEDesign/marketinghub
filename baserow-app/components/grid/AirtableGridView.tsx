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
import { useGridData, type GridRow } from '@/lib/grid/useGridData'
import { CellFactory } from './CellFactory'
import GridColumnHeader from './GridColumnHeader'
import BulkActionBar from './BulkActionBar'
import { filterRowsBySearch } from '@/lib/search/filterRows'
import { useRecordPanel } from '@/contexts/RecordPanelContext'
import { createClient } from '@/lib/supabase/client'
import type { TableField } from '@/types/fields'
import { asArray } from '@/lib/utils/asArray'
import { useDataView } from '@/lib/dataView/useDataView'
import type { Selection } from '@/lib/dataView/types'
import { useIsMobile, useIsTablet } from '@/hooks/useResponsive'
import { cn } from '@/lib/utils'

type Sort = { field: string; direction: 'asc' | 'desc' }

interface AirtableGridViewProps {
  tableName: string
  tableId?: string // Table ID for opening records
  viewName?: string
  viewId?: string // View ID for saving/loading grid view settings
  rowHeight?: 'short' | 'medium' | 'tall'
  editable?: boolean
  fields?: TableField[]
  onAddField?: () => void
  onEditField?: (fieldName: string) => void
  groupBy?: string
  userRole?: "admin" | "editor" | "viewer" | null
  disableRecordPanel?: boolean // If true, clicking rows won't open record panel
}

const ROW_HEIGHT_SHORT = 32
const ROW_HEIGHT_MEDIUM = 40
const ROW_HEIGHT_TALL = 56
const HEADER_HEIGHT = 40
const COLUMN_MIN_WIDTH = 100
const COLUMN_DEFAULT_WIDTH = 200
const FROZEN_COLUMN_WIDTH = 50

// Map row height values: 'compact' -> 'short', 'comfortable' -> 'tall'
const mapRowHeightToAirtable = (height: string): 'short' | 'medium' | 'tall' => {
  if (height === 'compact') return 'short'
  if (height === 'comfortable') return 'tall'
  return 'medium'
}

export default function AirtableGridView({
  tableName,
  tableId,
  viewName = 'default',
  viewId,
  rowHeight = 'medium',
  editable = true,
  fields = [],
  onAddField,
  onEditField,
  groupBy,
  userRole = "editor",
  disableRecordPanel = false,
}: AirtableGridViewProps) {
  const { openRecord } = useRecordPanel()
  const isMobile = useIsMobile()
  const isTablet = useIsTablet()
  const [tableIdState, setTableIdState] = useState<string | null>(tableId || null)

  // Load tableId from tableName if not provided
  useEffect(() => {
    if (!tableIdState && tableName && !disableRecordPanel) {
      const loadTableId = async () => {
        try {
          const supabase = createClient()
          const { data } = await supabase
            .from("tables")
            .select("id")
            .eq("supabase_table", tableName)
            .single()
          if (data) {
            setTableIdState(data.id)
          }
        } catch (error) {
          console.warn("Could not load table ID:", error)
        }
      }
      loadTableId()
    }
  }, [tableIdState, tableName, disableRecordPanel])

  const handleRowClick = useCallback((rowId: string) => {
    if (!disableRecordPanel && tableIdState && tableName) {
      openRecord(tableIdState, rowId, tableName)
    }
  }, [tableIdState, tableName, openRecord, disableRecordPanel])
  
  // Map row height from props to internal format
  // On mobile, cap row height to medium for better usability
  const mappedRowHeight = mapRowHeightToAirtable(rowHeight)
  const ROW_HEIGHT = isMobile
    ? ROW_HEIGHT_MEDIUM // Cap at medium on mobile
    : mappedRowHeight === 'short' ? ROW_HEIGHT_SHORT : mappedRowHeight === 'tall' ? ROW_HEIGHT_TALL : ROW_HEIGHT_MEDIUM

  // State
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [columnOrder, setColumnOrder] = useState<string[]>([])
  const [columnWrapText, setColumnWrapText] = useState<Record<string, boolean>>({})
  const [resizingColumn, setResizingColumn] = useState<string | null>(null)
  const [selectedCell, setSelectedCell] = useState<{ rowId: string; fieldName: string } | null>(null)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(600)
  const [sorts, setSorts] = useState<Array<{ field: string; direction: 'asc' | 'desc' }>>([])
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set())
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null)
  
  // Track wrap text settings per column (from grid_view_settings)
  const [columnWrapTextSettings, setColumnWrapTextSettings] = useState<Record<string, boolean>>({})

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
  const { rows: allRows, loading, error, updateCell, refresh } = useGridData({
    tableName,
    fields,
    sorts,
  })

  // CRITICAL: Normalize all inputs at grid entry point
  // Never trust upstream to pass correct types - always normalize
  const safeRows = asArray<GridRow>(allRows)
  const safeFields = asArray<TableField>(fields)
  const safeSorts = asArray<Sort>(sorts)

  // Get visible fields in order (needed for search filtering and rendering)
  const visibleFields = useMemo(() => {
    if (columnOrder.length === 0) return []
    const safeColumnOrder = asArray(columnOrder)
    return safeColumnOrder
      .map((fieldName) => safeFields.find((f) => f.name === fieldName))
      .filter((f): f is TableField => f !== undefined)
  }, [columnOrder, safeFields])

  // Filter rows by search query (only visible fields)
  const visibleFieldNames = useMemo(() => {
    return visibleFields.map((f) => f.name)
  }, [visibleFields])

  const filteredRows = useMemo(() => {
    return filterRowsBySearch(safeRows, safeFields, searchQuery, visibleFieldNames)
  }, [safeRows, safeFields, searchQuery, visibleFieldNames])

  // Data view service for copy/paste/duplicate
  const dataView = useDataView({
    context: {
      tableId: tableId || '',
      supabaseTableName: tableName,
      rows: safeRows,
      fields: safeFields,
      visibleFields: visibleFields,
      rowOrder: filteredRows.map((r: any) => r.id),
    },
    onChangesApplied: async (result) => {
      // Refresh data after changes
      await refresh()
      
      // Show errors if any
      if (result.errors.length > 0) {
        const errorMsg = result.errors
          .slice(0, 5)
          .map(e => `${e.fieldName}: ${e.error}`)
          .join('\n')
        alert(`Some values could not be pasted:\n\n${errorMsg}${result.errors.length > 5 ? `\n... and ${result.errors.length - 5} more` : ''}`)
      }
    },
    onError: (error) => {
      console.error('Data view error:', error)
      alert(`Error: ${error.message}`)
    },
  })

  // Update data view context when data changes
  useEffect(() => {
    dataView.updateContext({
      rows: safeRows,
      fields: safeFields,
      visibleFields: visibleFields,
      rowOrder: filteredRows.map((r: any) => r.id),
    })
  }, [safeRows, safeFields, visibleFields, filteredRows, dataView])

  // Defensive logging (temporary - remove after fixing all upstream issues)
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('AirtableGridView input types', {
      rows: Array.isArray(allRows),
      fields: Array.isArray(fields),
      sorts: Array.isArray(sorts),
    })
  }

  // Load grid view settings from database (column widths, order, wrap text)
  useEffect(() => {
    if (!viewId || safeFields.length === 0) return

    async function loadGridViewSettings() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('grid_view_settings')
          .select('column_widths, column_order, column_wrap_text')
          .eq('view_id', viewId)
          .maybeSingle()

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading grid view settings:', error)
          // Fallback to localStorage
          loadFromLocalStorage()
          return
        }

        if (data) {
          // Use database settings if available
          if (data.column_widths && typeof data.column_widths === 'object') {
            setColumnWidths(data.column_widths as Record<string, number>)
          }
          if (data.column_order && Array.isArray(data.column_order)) {
            const allFieldNames = safeFields.map((f) => f.name)
            if (data.column_order.every((name: string) => allFieldNames.includes(name))) {
              setColumnOrder(data.column_order)
            } else {
              setColumnOrder(allFieldNames)
            }
          }
          if (data.column_wrap_text && typeof data.column_wrap_text === 'object') {
            setColumnWrapText(data.column_wrap_text as Record<string, boolean>)
            setColumnWrapTextSettings(data.column_wrap_text as Record<string, boolean>)
          }
        } else {
          // Fallback to localStorage
          loadFromLocalStorage()
        }

        // Set default widths for fields without saved widths
        setColumnWidths((prev) => {
          const newWidths = { ...prev }
          safeFields.forEach((field) => {
            if (!newWidths[field.name]) {
              newWidths[field.name] = COLUMN_DEFAULT_WIDTH
            }
          })
          return newWidths
        })
      } catch (error) {
        console.error('Error loading grid view settings:', error)
        loadFromLocalStorage()
      }
    }

    function loadFromLocalStorage() {
      const storageKey = `grid_${tableName}_${viewName}`
      const savedWidths = localStorage.getItem(`${storageKey}_widths`)
      const savedOrder = localStorage.getItem(`${storageKey}_order`)
      const savedWrapText = localStorage.getItem(`${storageKey}_wrapText`)

      if (savedWidths) {
        try {
          const parsed = JSON.parse(savedWidths) as Record<string, number>
          setColumnWidths(parsed)
        } catch {
          // Fallback to defaults
        }
      }

      if (savedOrder) {
        try {
          const order = JSON.parse(savedOrder)
          const allFieldNames = safeFields.map((f) => f.name)
          if (Array.isArray(order) && order.every((name: string) => allFieldNames.includes(name))) {
            setColumnOrder(order)
          } else {
            setColumnOrder(allFieldNames)
          }
        } catch {
          setColumnOrder(safeFields.map((f) => f.name))
        }
      } else {
        // Sort fields by order_index, then by position, then by name
        const sortedFields = [...safeFields].sort((a, b) => {
          const aOrder = a.order_index ?? a.position ?? 0
          const bOrder = b.order_index ?? b.position ?? 0
          if (aOrder !== bOrder) return aOrder - bOrder
          return a.name.localeCompare(b.name)
        })
        setColumnOrder(sortedFields.map((f) => f.name))
      }
      
      if (savedWrapText) {
        try {
          const parsed = JSON.parse(savedWrapText) as Record<string, boolean>
          setColumnWrapText(parsed)
          setColumnWrapTextSettings(parsed)
        } catch {
          // Fallback to defaults
        }
      }
    }

    loadGridViewSettings()
  }, [safeFields, tableName, viewName, viewId])

  // Save column widths, order, and wrap text to database and localStorage
  useEffect(() => {
    if (Object.keys(columnWidths).length === 0 || columnOrder.length === 0) return

    // Save to localStorage as backup
    const storageKey = `grid_${tableName}_${viewName}`
    localStorage.setItem(`${storageKey}_widths`, JSON.stringify(columnWidths))
    localStorage.setItem(`${storageKey}_order`, JSON.stringify(columnOrder))
    localStorage.setItem(`${storageKey}_wrapText`, JSON.stringify(columnWrapText))

    // Save to database if viewId is available
    if (viewId) {
      async function saveToDatabase() {
        try {
          const supabase = createClient()
          const { data: existing } = await supabase
            .from('grid_view_settings')
            .select('id')
            .eq('view_id', viewId)
            .maybeSingle()

          const settingsData = {
            column_widths: columnWidths,
            column_order: columnOrder,
            column_wrap_text: columnWrapText,
          }

          if (existing) {
            await supabase
              .from('grid_view_settings')
              .update(settingsData)
              .eq('view_id', viewId)
          } else {
            await supabase
              .from('grid_view_settings')
              .insert([{
                view_id: viewId,
                ...settingsData,
                row_height: 'medium',
                frozen_columns: 0,
              }])
          }
        } catch (error) {
          console.error('Error saving grid view settings:', error)
          // Non-critical, continue
        }
      }
      saveToDatabase()
    }
  }, [columnWidths, columnOrder, columnWrapText, tableName, viewName, viewId])

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

  // Group rows if groupBy is set
  // CRITICAL: Normalize filteredRows before grouping
  const groupedRows = useMemo(() => {
    if (!groupBy) return null

    const safeFilteredRows = asArray<GridRow>(filteredRows)
    const groups: Record<string, GridRow[]> = {}

    safeFilteredRows.forEach((row) => {
      if (!row) return // Skip null/undefined rows
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
      value: groups[key][0]?.[groupBy],
      rows: groups[key], // Already an array
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
      // CRITICAL: Normalize rows before slicing
      const rowsArray = asArray<GridRow>(filteredRows)
      const rangeIds = rowsArray.slice(start, end + 1).map((row) => row?.id).filter((id): id is string => Boolean(id))
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

  // Handle wrap text toggle
  const handleToggleWrapText = useCallback((fieldName: string) => {
    setColumnWrapText((prev) => ({
      ...prev,
      [fieldName]: !prev[fieldName],
    }))
  }, [])

  // Handle column resize
  // Disable resize on mobile (can enable long-press later if needed)
  const handleResizeStart = useCallback((fieldName: string) => {
    if (isMobile) return // Disable resize on mobile
    setResizingColumn(fieldName)
  }, [isMobile])

  const handleResize = useCallback(
    (fieldName: string, width: number) => {
      if (isMobile) return // Disable resize on mobile
      setColumnWidths((prev) => ({
        ...prev,
        [fieldName]: Math.max(COLUMN_MIN_WIDTH, Math.min(width, 1000)), // Max width 1000px
      }))
    },
    [isMobile]
  )

  const handleResizeEnd = useCallback(() => {
    if (isMobile) return // Disable resize on mobile
    setResizingColumn(null)
  }, [isMobile])

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

  // Keyboard shortcuts for copy/paste
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Only handle if grid is focused or no input is focused
      const activeElement = document.activeElement
      const isInputFocused = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA'
      
      // Copy: Ctrl/Cmd + C
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !e.shiftKey && !isInputFocused) {
        e.preventDefault()
        
        // Determine selection type (priority: column > row > cell)
        let selection: Selection | null = null
        
        if (selectedColumnId) {
          // Column selection
          const field = safeFields.find(f => f.id === selectedColumnId)
          if (field) {
            selection = {
              type: 'column',
              columnId: field.id,
              fieldName: field.name,
            }
          }
        } else if (selectedRowIds.size > 0) {
          // Row selection
          selection = {
            type: 'row',
            rowIds: Array.from(selectedRowIds),
          }
        } else if (selectedCell) {
          // Cell selection
          const field = safeFields.find(f => f.name === selectedCell.fieldName)
          if (field) {
            selection = {
              type: 'cell',
              rowId: selectedCell.rowId,
              columnId: field.id,
              fieldName: selectedCell.fieldName,
            }
          }
        }
        
        if (selection) {
          const clipboardText = dataView.copy(selection)
          await navigator.clipboard.writeText(clipboardText)
        }
      }
      
      // Paste: Ctrl/Cmd + V
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !e.shiftKey && !isInputFocused) {
        e.preventDefault()
        
        try {
          const clipboardText = await navigator.clipboard.readText()
          
          // Determine selection type (priority: column > row > cell)
          let selection: Selection | null = null
          
          if (selectedColumnId) {
            // Column selection
            const field = safeFields.find(f => f.id === selectedColumnId)
            if (field) {
              selection = {
                type: 'column',
                columnId: field.id,
                fieldName: field.name,
              }
            }
          } else if (selectedRowIds.size > 0) {
            // Row selection
            selection = {
              type: 'row',
              rowIds: Array.from(selectedRowIds),
            }
          } else if (selectedCell) {
            // Cell selection
            const field = safeFields.find(f => f.name === selectedCell.fieldName)
            if (field) {
              selection = {
                type: 'cell',
                rowId: selectedCell.rowId,
                columnId: field.id,
                fieldName: selectedCell.fieldName,
              }
            }
          }
          
          if (selection) {
            await dataView.paste(selection, clipboardText)
          }
        } catch (error) {
          console.error('Error pasting:', error)
        }
      }
      
      // Undo: Ctrl/Cmd + Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && !isInputFocused) {
        e.preventDefault()
        if (dataView.canUndo) {
          await dataView.undo()
        }
      }
      
      // Redo: Ctrl/Cmd + Shift + Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey && !isInputFocused) {
        e.preventDefault()
        if (dataView.canRedo) {
          await dataView.redo()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedCell, selectedRowIds, selectedColumnId, safeFields, dataView, refresh])

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
    <div ref={gridRef} className="flex flex-col h-full bg-gray-50 overflow-hidden w-full">
      {/* Header */}
      <div
        ref={headerScrollRef}
        className="flex-shrink-0 border-b border-gray-200 bg-white overflow-x-auto overflow-y-hidden"
        style={{ height: HEADER_HEIGHT }}
        onScroll={(e) => {
          const left = e.currentTarget.scrollLeft
          setScrollLeft(left)
          if (bodyScrollRef.current) {
            bodyScrollRef.current.scrollLeft = left
          }
        }}
      >
        <div className="flex" style={{ width: Math.max(totalWidth, 100), minWidth: 'max-content' }}>
          {/* Checkbox column - sticky on all screen sizes */}
          <div
            className="flex-shrink-0 border-r border-gray-100 bg-gray-50/50 flex items-center justify-center sticky left-0 z-20"
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
                className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-400/20 cursor-pointer"
              />
            </div>
          </div>

          {/* Frozen row number column - sticky on mobile/tablet for better navigation */}
          <div
            className={cn(
              "flex-shrink-0 border-r border-gray-100 bg-gray-50/50 flex items-center justify-center text-xs font-medium text-gray-500 z-20",
              (isMobile || isTablet) && "sticky left-[50px]"
            )}
            style={{ width: FROZEN_COLUMN_WIDTH, height: HEADER_HEIGHT }}
          >
            #
          </div>

          {/* Column headers */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
              {visibleFields.map((field) => {
                const sortIndex = sorts.findIndex((s) => s.field === field.name)
                const sort = sortIndex >= 0 ? sorts[sortIndex] : null
                return (
                  <GridColumnHeader
                    key={field.name}
                    field={field}
                    width={columnWidths[field.name] || COLUMN_DEFAULT_WIDTH}
                    isResizing={resizingColumn === field.name}
                    wrapText={columnWrapText[field.name] || false}
                    isSelected={selectedColumnId === field.id}
                    onResizeStart={handleResizeStart}
                    onResize={handleResize}
                    onResizeEnd={handleResizeEnd}
                    onEdit={onEditField}
                    onToggleWrapText={handleToggleWrapText}
                    onSelect={(fieldId) => {
                      setSelectedColumnId(fieldId)
                      setSelectedCell(null)
                      setSelectedRowIds(new Set())
                    }}
                    sortDirection={sort?.direction || null}
                    sortOrder={sortIndex >= 0 ? sortIndex + 1 : null}
                    onSort={handleSort}
                  />
                )
              })}
            </SortableContext>
          </DndContext>

          {/* Add column button */}
          {onAddField && (
            <div
              className="flex-shrink-0 border-r border-gray-100 bg-gray-50/50 flex items-center justify-center"
              style={{ width: FROZEN_COLUMN_WIDTH, height: HEADER_HEIGHT }}
            >
              <button
                onClick={onAddField}
                className="p-1.5 hover:bg-gray-100/50 rounded transition-colors text-gray-400 hover:text-gray-600"
                title="Add column"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div
        ref={bodyScrollRef}
        className="flex-1 overflow-x-auto overflow-y-auto bg-white grid-scroll-container w-full"
        style={{ maxWidth: '100%' }}
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
        <div style={{ width: Math.max(totalWidth, 100), minWidth: 'max-content', position: 'relative' }}>
          {/* Virtualized items */}
          <div style={{ height: offsetTop }} />
          {visibleItems.map((item, idx) => {
            if (item.type === 'group') {
              const group = item.data
              const isCollapsed = collapsedGroups.has(item.groupKey!)
              return (
                <div
                  key={`group-${item.groupKey}`}
                  className="flex border-b border-gray-100 bg-gray-50/50 sticky top-0 z-20"
                  style={{ height: GROUP_HEADER_HEIGHT }}
                >
                  <div
                    className="flex items-center px-4 flex-1 cursor-pointer hover:bg-gray-100/50 transition-colors"
                    onClick={() => toggleGroup(item.groupKey!)}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 mr-2 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 mr-2 text-gray-400" />
                    )}
                    <span className="font-medium text-sm text-gray-700">
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
                  className={`flex border-b border-gray-100/50 hover:bg-gray-50/30 transition-colors ${
                    disableRecordPanel ? '' : 'cursor-pointer'
                  } ${
                    isEven ? 'bg-white' : 'bg-gray-50/30'
                  } ${isSelected ? 'bg-blue-50/50' : ''}`}
                  style={{ height: ROW_HEIGHT }}
                  onClick={(e) => {
                    // Don't open panel if clicking checkbox or cell editor
                    const target = e.target as HTMLElement
                    if (!disableRecordPanel && !target.closest('input[type="checkbox"]') && !target.closest('.cell-editor')) {
                      handleRowClick(row.id)
                    }
                  }}
                >
                  {/* Checkbox - sticky on all screen sizes */}
                  <div
                    className="flex-shrink-0 border-r border-gray-100 bg-gray-50/30 flex items-center justify-center sticky left-0 z-10"
                    style={{ width: FROZEN_COLUMN_WIDTH, height: ROW_HEIGHT }}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRowSelect(row.id, rowIndex, e)
                      setSelectedColumnId(null)
                      setSelectedCell(null)
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRowSelect(row.id, rowIndex, e)
                      }}
                      className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-400/20 cursor-pointer"
                    />
                  </div>

                  {/* Frozen row number */}
                  <div
                    ref={actualIndex === 0 ? frozenColumnRef : null}
                    className="flex-shrink-0 border-r border-gray-100 bg-gray-50/30 flex items-center justify-center text-xs text-gray-400 font-medium sticky left-[50px] z-10"
                    style={{ width: FROZEN_COLUMN_WIDTH, height: ROW_HEIGHT }}
                  >
                    {actualIndex + 1}
                  </div>

                  {/* Cells */}
                  {visibleFields.map((field) => {
                    const width = columnWidths[field.name] || COLUMN_DEFAULT_WIDTH
                    const isSelected =
                      selectedCell?.rowId === row.id && selectedCell?.fieldName === field.name
                    const wrapText = columnWrapText[field.name] || false

                    return (
                      <div
                        key={field.name}
                        className={`border-r border-gray-100/50 relative flex items-center overflow-hidden ${
                          isSelected ? 'bg-blue-50/50 ring-1 ring-blue-400/30 ring-inset' : ''
                        }`}
                        style={{ width, height: ROW_HEIGHT, maxHeight: ROW_HEIGHT }}
                        onClick={() => {
                          setSelectedCell({ rowId: row.id, fieldName: field.name })
                          setSelectedColumnId(null)
                        }}
                      >
                        <div className="w-full h-full flex items-center overflow-hidden">
                          <CellFactory
                            field={field}
                            value={row[field.name]}
                            rowId={row.id}
                            tableName={tableName}
                            editable={editable && !field.options?.read_only}
                            wrapText={wrapText}
                            rowHeight={ROW_HEIGHT}
                            onSave={(value) => handleCellSave(row.id, field.name, value)}
                          />
                        </div>
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
