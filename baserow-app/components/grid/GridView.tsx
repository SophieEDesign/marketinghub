"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import React from "react"
import { supabase } from "@/lib/supabase/client"
import { Plus, ChevronDown, ChevronRight } from "lucide-react"
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
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import Cell from "./Cell"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import type { TableField } from "@/types/fields"
import RecordModal from "./RecordModal"
import { computeFormulaFields } from "@/lib/formulas/computeFormulaFields"
import { applyFiltersToQuery, type FilterConfig } from "@/lib/interface/filters"
import { asArray } from "@/lib/utils/asArray"
import { sortRowsByFieldType, shouldUseClientSideSorting } from "@/lib/sorting/fieldTypeAwareSort"
import { resolveChoiceColor, normalizeHexColor } from '@/lib/field-colors'
import { getRowHeightPixels } from "@/lib/grid/row-height-utils"
import { useIsMobile } from "@/hooks/useResponsive"
import { createClient } from "@/lib/supabase/client"

interface BlockPermissions {
  mode?: 'view' | 'edit'
  allowInlineCreate?: boolean
  allowInlineDelete?: boolean
  allowOpenRecord?: boolean
}

interface GridViewProps {
  tableId: string
  viewId: string
  supabaseTableName: string
  viewFields: Array<{
    field_name: string
    visible: boolean
    position: number
  }>
  viewFilters?: Array<{
    field_name: string
    operator: string
    value?: string
  }>
  filters?: FilterConfig[] // Standardized FilterConfig format (takes precedence over viewFilters)
  viewSorts?: Array<{
    field_name: string
    direction: string
  }>
  searchTerm?: string
  groupBy?: string
  tableFields?: TableField[]
  onAddField?: () => void
  onEditField?: (fieldName: string) => void
  isEditing?: boolean // When false, hide builder controls (add row, add field)
  onRecordClick?: (recordId: string) => void // Emit recordId on row click
  rowHeight?: string // Row height: 'compact', 'standard', 'comfortable' (or legacy 'medium')
  wrapText?: boolean // Whether to wrap cell text (block-level setting)
  permissions?: BlockPermissions // Block-level permissions
  colorField?: string // Field name to use for row colors (single-select field)
  imageField?: string // Field name to use for row images
  fitImageSize?: boolean // Whether to fit image to container size
  hideEmptyState?: boolean // Hide "No columns configured" UI (for record view contexts)
  enableRecordOpen?: boolean // Enable record opening (default: true)
  recordOpenStyle?: 'side_panel' | 'modal' // How to open records (default: 'side_panel')
  modalFields?: string[] // Fields to show in modal (if empty, show all)
}

const ITEMS_PER_PAGE = 100

// Draggable column header component with resize
function DraggableColumnHeader({
  fieldName,
  tableField,
  isVirtual,
  onEdit,
  width,
  isResizing,
  onResizeStart,
  onResize,
  onResizeEnd,
}: {
  fieldName: string
  tableField?: TableField
  isVirtual: boolean
  onEdit?: (fieldName: string) => void
  width: number
  isResizing: boolean
  onResizeStart: (fieldName: string) => void
  onResize: (fieldName: string, width: number) => void
  onResizeEnd: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: fieldName })

  const resizeRef = useRef<HTMLDivElement>(null)
  const resizeStartXRef = useRef(0)
  const resizeStartWidthRef = useRef(0)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    width: `${width}px`,
    minWidth: `${width}px`,
    maxWidth: `${width}px`,
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    resizeStartXRef.current = e.clientX
    resizeStartWidthRef.current = width
    onResizeStart(fieldName)
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const diff = moveEvent.clientX - resizeStartXRef.current
      const newWidth = Math.max(100, Math.min(resizeStartWidthRef.current + diff, 1000))
      onResize(fieldName, newWidth)
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      onResizeEnd()
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <th
      ref={setNodeRef}
      style={style}
      className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider sticky top-0 bg-gray-50 z-10 group hover:bg-gray-100 transition-colors relative"
    >
      <div className="flex items-center justify-between gap-2">
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="flex items-center justify-center w-4 h-full cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
        >
          <GripVertical className="h-3 w-3" />
        </div>
        <span
          onClick={() => onEdit?.(fieldName)}
          className={`flex-1 ${onEdit ? 'cursor-pointer hover:text-blue-600' : ''}`}
          title={tableField?.type === 'formula' && tableField?.options?.formula 
            ? `Formula: ${tableField.options.formula}` 
            : undefined}
        >
          {fieldName}
          {isVirtual && (
            <span className="ml-1 text-xs text-gray-400" title="Formula field">(fx)</span>
          )}
        </span>
        {tableField?.required && (
          <span className="text-red-500 text-xs ml-1">*</span>
        )}
      </div>
      {/* Resize handle */}
      <div
        ref={resizeRef}
        onMouseDown={handleMouseDown}
        className="absolute right-0 top-0 bottom-0 cursor-col-resize z-20 w-1 hover:bg-blue-500 transition-colors"
        style={{
          width: '6px',
          marginRight: '-3px',
          backgroundColor: isResizing ? 'rgb(96 165 250)' : 'transparent',
        }}
        title="Drag to resize column"
      />
    </th>
  )
}

export default function GridView({
  tableId,
  viewId,
  supabaseTableName,
  viewFields,
  viewFilters = [],
  filters = [], // Standardized filters (preferred)
  viewSorts = [],
  searchTerm = "",
  groupBy,
  tableFields = [],
  onAddField,
  onEditField,
  isEditing = false,
  onRecordClick,
  rowHeight = 'standard',
  wrapText = false,
  permissions,
  colorField,
  imageField,
  fitImageSize = false,
  hideEmptyState = false,
  enableRecordOpen = true,
  recordOpenStyle = 'side_panel',
  modalFields,
}: GridViewProps) {
  const { openRecord } = useRecordPanel()
  const isMobile = useIsMobile()
  const [rows, setRows] = useState<Record<string, any>[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [tableError, setTableError] = useState<string | null>(null)
  const [initializingFields, setInitializingFields] = useState(false)
  const [columnOrder, setColumnOrder] = useState<string[]>([])
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [resizingColumn, setResizingColumn] = useState<string | null>(null)
  const [modalRecord, setModalRecord] = useState<{ tableId: string; recordId: string; tableName: string } | null>(null)

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const COLUMN_DEFAULT_WIDTH = 200
  const COLUMN_MIN_WIDTH = 100

  // CRITICAL: Normalize all inputs at grid entry point
  // Never trust upstream to pass correct types - always normalize
  type ViewFieldType = {
    field_name: string
    visible: boolean
    position: number
  }
  const safeViewFields = asArray<ViewFieldType>(viewFields)
  const safeTableFields = asArray<TableField>(tableFields)

  // Helper to get color from color field
  const getRowColor = useCallback((row: Record<string, any>): string | null => {
    if (!colorField) return null
    
    const colorFieldObj = safeTableFields.find(f => f.name === colorField || f.id === colorField)
    if (!colorFieldObj || (colorFieldObj.type !== 'single_select' && colorFieldObj.type !== 'multi_select')) {
      return null
    }
    
    const colorValue = row[colorField]
    if (!colorValue || !(colorFieldObj.type === 'single_select' || colorFieldObj.type === 'multi_select')) return null
    
    const normalizedValue = String(colorValue).trim()
    return normalizeHexColor(
      resolveChoiceColor(
        normalizedValue,
        colorFieldObj.type,
        colorFieldObj.options,
        colorFieldObj.type === 'single_select'
      )
    )
  }, [colorField, safeTableFields])

  // Helper to get image from image field
  const getRowImage = useCallback((row: Record<string, any>): string | null => {
    if (!imageField) return null
    
    const imageValue = row[imageField]
    if (!imageValue) return null
    
    // Handle attachment field (array of URLs) or URL field (single URL)
    if (Array.isArray(imageValue) && imageValue.length > 0) {
      return imageValue[0]
    }
    if (typeof imageValue === 'string' && (imageValue.startsWith('http') || imageValue.startsWith('/'))) {
      return imageValue
    }
    
    return null
  }, [imageField])

  type ViewFilterType = {
    field_name: string
    operator: string
    value?: string
  }
  const safeViewFilters = asArray<ViewFilterType>(viewFilters)
  const safeFilters = asArray<FilterConfig>(filters)
  type ViewSortType = {
    field_name: string
    direction: string
  }
  const safeViewSorts = asArray<ViewSortType>(viewSorts)

  // Calculate row height in pixels from string setting
  const rowHeightPixels = useMemo(() => getRowHeightPixels(rowHeight), [rowHeight])

  // Defensive logging (temporary - remove after fixing all upstream issues)
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('GridView input types', {
      rows: Array.isArray(rows),
      viewFields: Array.isArray(viewFields),
      tableFields: Array.isArray(tableFields),
      viewFilters: Array.isArray(viewFilters),
      filters: Array.isArray(filters),
      viewSorts: Array.isArray(viewSorts),
    })
  }

  // Load column order and widths from grid_view_settings
  useEffect(() => {
    if (!viewId || safeTableFields.length === 0) return

    async function loadColumnSettings() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('grid_view_settings')
          .select('column_order, column_widths')
          .eq('view_id', viewId)
          .maybeSingle()

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading column settings:', error)
          return
        }

        // Load column widths
        if (data?.column_widths && typeof data.column_widths === 'object') {
          setColumnWidths(data.column_widths as Record<string, number>)
        }

        if (data?.column_order && Array.isArray(data.column_order)) {
          const allFieldNames = safeViewFields
            .filter((f) => f && f.visible)
            .map((f) => f.field_name)
          
          // Validate that all fields in order exist
          if (data.column_order.every((name: string) => allFieldNames.includes(name))) {
            // Add any missing fields to the end
            const missingFields = allFieldNames.filter(name => !data.column_order.includes(name))
            setColumnOrder([...data.column_order, ...missingFields])
          } else {
            // Invalid order, use default
            initializeColumnOrder()
          }
        } else {
          initializeColumnOrder()
        }
      } catch (error) {
        console.error('Error loading column settings:', error)
        initializeColumnOrder()
      }
    }

    function initializeColumnOrder() {
      const visibleFieldNames = safeViewFields
        .filter((f) => f && f.visible)
        .map((vf) => {
          const tableField = safeTableFields.find((tf) => tf.name === vf.field_name)
          return {
            field_name: vf.field_name,
            order_index: tableField?.order_index ?? tableField?.position ?? vf.position,
          }
        })
        .sort((a, b) => a.order_index - b.order_index)
        .map((f) => f.field_name)
      
      setColumnOrder(visibleFieldNames)
    }

    loadColumnSettings()
  }, [viewId, safeViewFields, safeTableFields])

  // Save column order and widths to grid_view_settings
  useEffect(() => {
    if (!viewId || columnOrder.length === 0) return

    async function saveColumnSettings() {
      try {
        const supabase = createClient()
        const { data: existing } = await supabase
          .from('grid_view_settings')
          .select('id')
          .eq('view_id', viewId)
          .maybeSingle()

        const settingsData = {
          column_order: columnOrder,
          column_widths: columnWidths,
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
              column_wrap_text: {},
              row_height: 'medium',
              frozen_columns: 0,
            }])
        }
      } catch (error) {
        console.error('Error saving column settings:', error)
      }
    }

    // Debounce saves to avoid too many database calls
    const timeoutId = setTimeout(saveColumnSettings, 500)
    return () => clearTimeout(timeoutId)
  }, [columnOrder, columnWidths, viewId])

  // Handle column resize
  const handleResizeStart = useCallback((fieldName: string) => {
    if (isMobile) return
    setResizingColumn(fieldName)
  }, [isMobile])

  const handleResize = useCallback((fieldName: string, width: number) => {
    setColumnWidths((prev) => ({
      ...prev,
      [fieldName]: Math.max(COLUMN_MIN_WIDTH, Math.min(width, 1000)),
    }))
  }, [])

  const handleResizeEnd = useCallback(() => {
    setResizingColumn(null)
  }, [])

  // Get visible fields ordered by column order (if set) or by order_index
  const visibleFields = useMemo(() => {
    if (columnOrder.length > 0) {
      // Use column order if available
      return columnOrder
        .map((fieldName) => {
          const vf = safeViewFields.find((f) => f && f.field_name === fieldName && f.visible)
          if (!vf) return null
          const tableField = safeTableFields.find((tf) => tf.name === fieldName)
          return {
            ...vf,
            order_index: tableField?.order_index ?? tableField?.position ?? vf.position,
          }
        })
        .filter((f): f is NonNullable<typeof f> => f !== null)
    }
    
    // Fallback to order_index sorting
    return safeViewFields
      .filter((f) => f && f.visible)
      .map((vf) => {
        const tableField = safeTableFields.find((tf) => tf.name === vf.field_name)
        return {
          ...vf,
          order_index: tableField?.order_index ?? tableField?.position ?? vf.position,
        }
      })
      .sort((a, b) => a.order_index - b.order_index)
  }, [safeViewFields, safeTableFields, columnOrder])

  // Handle column reorder
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setColumnOrder((items) => {
        const oldIndex = items.indexOf(active.id as string)
        const newIndex = items.indexOf(over.id as string)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }, [])

  useEffect(() => {
    loadRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseTableName, filters, viewFilters, viewSorts, tableFields])

  async function loadRows() {
    if (!supabaseTableName) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      let query = supabase.from(supabaseTableName).select("*")

      // Use standardized filters if provided, otherwise fall back to viewFilters format
      if (safeFilters.length > 0) {
        // Convert tableFields to format expected by applyFiltersToQuery
        const normalizedFields = safeTableFields.map(f => ({ name: f.name, type: f.type }))
        query = applyFiltersToQuery(query, safeFilters, normalizedFields)
      } else if (safeViewFilters.length > 0) {
        // Legacy: Convert viewFilters format to FilterConfig format
        const legacyFilters: FilterConfig[] = safeViewFilters.map(f => ({
          field: f.field_name,
          operator: f.operator as FilterConfig['operator'],
          value: f.value,
        }))
        const normalizedFields = safeTableFields.map(f => ({ name: f.name, type: f.type }))
        query = applyFiltersToQuery(query, legacyFilters, normalizedFields)
      }

      // Check if we need client-side sorting (for single_select by order, multi_select by first value)
      const needsClientSideSort = safeViewSorts.length > 0 && shouldUseClientSideSorting(
        safeViewSorts.map(s => ({ field_name: s.field_name, direction: s.direction as 'asc' | 'desc' })),
        safeTableFields
      )

      // Apply sorting at query level (for fields that don't need client-side sorting)
      if (safeViewSorts.length > 0 && !needsClientSideSort) {
        // Apply multiple sorts if needed
        for (let i = 0; i < safeViewSorts.length; i++) {
          const sort = safeViewSorts[i]
          if (i === 0) {
            query = query.order(sort.field_name, {
              ascending: sort.direction === "asc",
            })
          } else {
            // For additional sorts, we'd need to chain them
            // Supabase supports multiple order() calls
            query = query.order(sort.field_name, {
              ascending: sort.direction === "asc",
            })
          }
        }
      } else if (safeViewSorts.length === 0) {
        // Default sort by id descending
        query = query.order("id", { ascending: false })
      }
      // If needsClientSideSort is true, we'll sort after fetching (don't apply DB sorting)

      // For client-side sorting, we need to fetch more rows to sort properly
      // Otherwise, limit results for performance
      if (!needsClientSideSort) {
        query = query.limit(ITEMS_PER_PAGE)
      } else {
        // Fetch more rows for client-side sorting (will limit after sorting)
        query = query.limit(ITEMS_PER_PAGE * 2)
      }

      const { data, error } = await query

      if (error) {
        console.error("Error loading rows:", error)
        // Check if table doesn't exist - check multiple error patterns
        const errorMessage = error.message || ''
        const isTableNotFound = 
          error.code === "42P01" || 
          error.code === "PGRST116" ||
          errorMessage.includes("does not exist") || 
          errorMessage.includes("relation") ||
          errorMessage.includes("schema cache") ||
          errorMessage.includes("Could not find the table")
        
        if (isTableNotFound) {
          setTableError(`The table "${supabaseTableName}" does not exist. Attempting to create it...`)
          
          // Try to create the table automatically
          try {
            const createResponse = await fetch('/api/tables/create-table', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tableName: supabaseTableName })
            })
            
            const createResult = await createResponse.json()
            
            if (createResult.success) {
              // Table created, reload rows after a short delay to allow schema cache to update
              setTimeout(() => {
                setTableError(null)
                loadRows()
              }, 1000)
              return
            } else {
              // Show the SQL needed to create the table
              const errorMsg = createResult.message || createResult.error || `Table "${supabaseTableName}" does not exist.`
              const sqlMsg = createResult.sql ? `\n\nRun this SQL in Supabase:\n${createResult.sql}` : ''
              setTableError(errorMsg + sqlMsg)
            }
          } catch (createError) {
            console.error('Failed to create table:', createError)
            setTableError(`The table "${supabaseTableName}" does not exist and could not be created automatically. Please create it manually in Supabase.`)
          }
        } else {
          setTableError(`Error loading data: ${error.message}`)
        }
        setRows([])
      } else {
        // CRITICAL: Normalize data to array - API might return single record or null
        let dataArray = asArray<Record<string, any>>(data)
        
        // Compute formula fields for each row
        const formulaFields = safeTableFields.filter(f => f.type === 'formula')
        let computedRows = dataArray.map(row => 
          computeFormulaFields(row, formulaFields, safeTableFields)
        )
        
        // Apply client-side sorting if needed (for single_select by order, multi_select by first value)
        if (needsClientSideSort && safeViewSorts.length > 0) {
          computedRows = sortRowsByFieldType(
            computedRows,
            safeViewSorts.map(s => ({ field_name: s.field_name, direction: s.direction as 'asc' | 'desc' })),
            safeTableFields
          )
          // Limit after sorting
          computedRows = computedRows.slice(0, ITEMS_PER_PAGE)
        }
        
        setTableError(null)
        setRows(computedRows)
      }
    } catch (error) {
      console.error("Error loading rows:", error)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  async function handleCellSave(rowId: string, fieldName: string, value: any) {
    // Don't allow saving if view-only
    if (isViewOnly) return
    if (!rowId || !supabaseTableName) return

    try {
      const { error } = await supabase
        .from(supabaseTableName)
        .update({ [fieldName]: value })
        .eq("id", rowId)

      if (error) {
        console.error("Error saving cell:", error)
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          setTableError(`The table "${supabaseTableName}" does not exist in Supabase.`)
        }
        throw error
      }

      // Update local state immediately for better UX
      setRows((prevRows) =>
        prevRows.map((row) =>
          row.id === rowId ? { ...row, [fieldName]: value } : row
        )
      )
    } catch (error) {
      throw error
    }
  }

  async function handleAddRow() {
    if (!supabaseTableName) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const newRow: Record<string, any> = {}

      // Initialize visible fields with empty values
      visibleFields.forEach((field) => {
        newRow[field.field_name] = null
      })

      const { data, error } = await supabase
        .from(supabaseTableName)
        .insert([newRow])
        .select()
        .single()

      if (error) {
        console.error("Error adding row:", error)
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          setTableError(`The table "${supabaseTableName}" does not exist in Supabase.`)
        }
      } else {
        await loadRows()
        // Open the new record in the global panel
        if (data && data.id) {
          openRecord(tableId, data.id, supabaseTableName)
        }
      }
    } catch (error: any) {
      console.error("Error adding row:", error)
      if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
        setTableError(`The table "${supabaseTableName}" does not exist in Supabase.`)
      }
    }
  }

  // Determine permissions
  const isViewOnly = permissions?.mode === 'view'
  const allowInlineCreate = permissions?.allowInlineCreate ?? true
  const allowInlineDelete = permissions?.allowInlineDelete ?? true
  const allowOpenRecord = permissions?.allowOpenRecord ?? true
  // Allow editing in live view if not view-only (even when not in edit mode)
  const canEdit = !isViewOnly

  function handleRowClick(rowId: string) {
    // Don't open record if not allowed or disabled
    if (!allowOpenRecord || !enableRecordOpen) return

    // If onRecordClick callback provided, use it (for blocks)
    if (onRecordClick) {
      onRecordClick(rowId)
    } else if (recordOpenStyle === 'modal') {
      // Open in modal if configured
      setModalRecord({ tableId, recordId: rowId, tableName: supabaseTableName })
    } else {
      // Otherwise, use RecordPanel context (for views)
      openRecord(tableId, rowId, supabaseTableName, modalFields)
    }
  }

  function handleOpenRecordClick(e: React.MouseEvent, rowId: string) {
    e.stopPropagation() // Prevent row click
    handleRowClick(rowId)
  }

  // Apply client-side search
  // CRITICAL: Normalize rows to array before filtering
  const safeRows = asArray<Record<string, any>>(rows)
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return safeRows

    const searchLower = searchTerm.toLowerCase()
    return safeRows.filter((row) => {
      return visibleFields.some((field) => {
        const value = row[field.field_name]
        if (value === null || value === undefined) return false
        return String(value).toLowerCase().includes(searchLower)
      })
    })
  }, [safeRows, searchTerm, visibleFields])

  // Group rows if groupBy is set
  // CRITICAL: Normalize filteredRows before grouping
  const groupedRows = useMemo(() => {
    if (!groupBy) return null

    const groups: Record<string, Record<string, any>[]> = {}

    // filteredRows is already normalized, but guard for safety
    filteredRows.forEach((row) => {
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
      rows: asArray(groups[key]), // Ensure rows is always an array
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!supabaseTableName) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Table not configured</div>
      </div>
    )
  }

  if (tableError) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="max-w-md p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">Table Not Found</h3>
          <p className="text-sm text-yellow-700 mb-4">{tableError}</p>
          <p className="text-xs text-yellow-600">
            The table <code className="bg-yellow-100 px-1 py-0.5 rounded">{supabaseTableName}</code> needs to be created in your Supabase database.
            You can create it manually in the Supabase dashboard or use a migration.
          </p>
        </div>
      </div>
    )
  }

  // Function to initialize view fields
  async function handleInitializeFields() {
    if (!viewId || initializingFields) return // Prevent duplicate calls
    
    setInitializingFields(true)
    try {
      const response = await fetch(`/api/views/${viewId}/initialize-fields`, {
        method: 'POST',
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        // Don't show error for expected cases (table not found, already configured, etc.)
        const isExpectedError = data.error_code === 'TABLE_NOT_FOUND' || 
                                data.error_code === 'NO_FIELDS' ||
                                data.message?.includes('already') ||
                                data.message?.includes('already configured')
        
        if (isExpectedError) {
          // These are expected - just log and return
          console.log('Fields initialization skipped (expected):', data.message || data.error)
          return
        }
        
        // Show detailed error message for unexpected errors
        const errorMessage = data.details 
          ? `${data.error || 'Failed to initialize fields'}: ${data.details}`
          : data.error || 'Failed to initialize fields'
        
        // Log full error details for debugging
        console.error('Error initializing fields:', {
          status: response.status,
          error: data.error,
          error_code: data.error_code,
          details: data.details,
          viewId,
          fullResponse: data,
        })
        
        throw new Error(errorMessage)
      }
      
      // Show success message if partial success or warning
      if (data.warning) {
        console.log('Fields initialization warning:', data.warning)
      }
      
      // Only reload if fields were actually added
      if (data.added > 0) {
        // Reload the page to refresh viewFields
        window.location.reload()
      } else if (data.message) {
        // Just log if no fields were added (already configured)
        console.log('Fields initialization:', data.message)
      }
    } catch (error: any) {
      console.error('Error initializing fields:', error)
      // Only show alert for unexpected errors
      const errorMessage = error.message || 'Failed to initialize fields. Please try again.'
      alert(`Error: ${errorMessage}\n\nIf this problem persists, please check:\n1. You have permission to modify this view\n2. The view is properly connected to a table\n3. The table has fields configured`)
    } finally {
      setInitializingFields(false)
    }
  }

  // Show message when no visible fields are configured
  // CRITICAL: In record view context, don't show "No columns configured" UI
  // Record view uses field blocks, not grid columns, so this UI is not applicable
  if (visibleFields.length === 0 && !hideEmptyState) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="max-w-md p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No columns configured</h3>
          <p className="text-sm text-gray-600 mb-4">
            This view has no visible fields configured. Add fields to the view to display data.
          </p>
          <div className="flex flex-col gap-2 items-center">
            {safeTableFields.length > 0 && (
              <button
                onClick={handleInitializeFields}
                disabled={initializingFields}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md transition-colors inline-flex items-center gap-2"
              >
                {initializingFields ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Adding fields...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Add All Fields ({safeTableFields.length})
                  </>
                )}
              </button>
            )}
            {isEditing && onAddField && (
              <button
                onClick={onAddField}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors inline-flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Create New Field
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }
  
  // In record view context with no visible fields, return empty state (no UI)
  if (visibleFields.length === 0 && hideEmptyState) {
    return null
  }

  return (
    <div className="w-full h-full flex flex-col relative" style={{ paddingBottom: isEditing ? '60px' : '0' }}>
      {/* Toolbar - Only show builder controls in edit mode */}
      {isEditing && (
        <div className="flex-shrink-0 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Only show Add Row button if inline create is allowed */}
            {allowInlineCreate && (
              <button
                onClick={handleAddRow}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Row
              </button>
            )}
            {onAddField && (
              <button
                onClick={onAddField}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Field
              </button>
            )}
          </div>
          <div className="text-sm text-gray-500">
            {filteredRows.length} {filteredRows.length === 1 ? "row" : "rows"}
            {searchTerm && filteredRows.length !== safeRows.length && (
              <span className="ml-1">(filtered from {safeRows.length})</span>
            )}
          </div>
        </div>
      )}

      {/* Grid Table - Takes remaining space and scrolls */}
      <div className="flex-1 min-h-0 border border-gray-200 rounded-lg overflow-hidden bg-white flex flex-col relative">
        <div className="flex-1 overflow-auto" style={{ paddingBottom: isEditing ? '20px' : '0' }}>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {/* Row action column header (for record opening) */}
                {enableRecordOpen && allowOpenRecord && (
                  <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-8 sticky top-0 bg-gray-50 z-10"></th>
                )}
                {/* Image column header if image field is configured */}
                {imageField && (
                  <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-12 sticky top-0 bg-gray-50 z-10"></th>
                )}
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={columnOrder.length > 0 ? columnOrder : visibleFields.map(f => f.field_name)} strategy={horizontalListSortingStrategy}>
                    {visibleFields.map((field) => {
                      const tableField = safeTableFields.find(f => f.name === field.field_name)
                      const isVirtual = tableField?.type === 'formula' || tableField?.type === 'lookup'
                      const columnWidth = columnWidths[field.field_name] || COLUMN_DEFAULT_WIDTH
                      return (
                        <DraggableColumnHeader
                          key={field.field_name}
                          fieldName={field.field_name}
                          tableField={tableField}
                          isVirtual={isVirtual}
                          onEdit={onEditField}
                          width={columnWidth}
                          isResizing={resizingColumn === field.field_name}
                          onResizeStart={handleResizeStart}
                          onResize={handleResize}
                          onResizeEnd={handleResizeEnd}
                        />
                      )
                    })}
                  </SortableContext>
                </DndContext>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={
                      visibleFields.length +
                      (enableRecordOpen && allowOpenRecord ? 1 : 0) +
                      (imageField ? 1 : 0)
                    }
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    {searchTerm ? "No rows match your search" : "No rows found"}
                  </td>
                </tr>
              ) : groupBy && groupedRows && Array.isArray(groupedRows) ? (
                // Render grouped rows
                // CRITICAL: groupedRows is already verified as array, but use type annotation for safety
                (groupedRows as Array<{ key: string; value: any; rows: Record<string, any>[] }>).map((group) => {
                  const isCollapsed = collapsedGroups.has(group.key)
                  const groupRows = asArray<Record<string, any>>(group.rows)
                  return (
                    <React.Fragment key={group.key}>
                      {/* Group header */}
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <td
                          colSpan={
                            visibleFields.length +
                            (enableRecordOpen && allowOpenRecord ? 1 : 0) +
                            (imageField ? 1 : 0)
                          }
                          className="px-4 py-2"
                        >
                          <button
                            onClick={() => toggleGroup(group.key)}
                            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 w-full text-left"
                          >
                            {isCollapsed ? (
                              <ChevronRight className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                            <span className="font-semibold">
                              {groupBy}: {String(group.value ?? "Uncategorized")}
                            </span>
                            <span className="text-gray-500 ml-2">
                              ({groupRows.length} {groupRows.length === 1 ? "row" : "rows"})
                            </span>
                          </button>
                        </td>
                      </tr>
                      {/* Group rows */}
                      {!isCollapsed &&
                        groupRows.map((row) => {
                          const rowColor = getRowColor ? getRowColor(row) : null
                          const rowImage = getRowImage ? getRowImage(row) : null
                          const borderColor = rowColor ? { borderLeftColor: rowColor, borderLeftWidth: '4px' } : {}
                          const canOpenRecord = enableRecordOpen && allowOpenRecord
                          const shouldRowClickOpen = isMobile && canOpenRecord // Mobile: entire row opens
                          
                          return (
                          <tr
                            key={row.id}
                            className={`border-b border-gray-100 ${shouldRowClickOpen ? 'hover:bg-blue-50 transition-colors cursor-pointer' : 'cursor-default'}`}
                            style={{ ...borderColor, height: `${rowHeightPixels}px` }}
                            onClick={shouldRowClickOpen ? () => handleRowClick(row.id) : undefined}
                          >
                            {/* Row action indicator (desktop only) */}
                            {canOpenRecord && (
                              <td
                                className="px-2 py-1 w-8"
                                onClick={(e) => !isMobile && handleOpenRecordClick(e, row.id)}
                              >
                                {!isMobile && (
                                  <button
                                    className="w-full h-full flex items-center justify-center text-gray-400 hover:text-blue-600 transition-colors rounded"
                                    title="Open record"
                                    aria-label="Open record"
                                  >
                                    <ChevronRight className="h-4 w-4" />
                                  </button>
                                )}
                              </td>
                            )}
                            {/* Image cell if image field is configured */}
                            {rowImage && (
                              <td
                                className="px-2 py-1 w-12"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className={`w-8 h-8 rounded overflow-hidden bg-gray-100 ${fitImageSize ? 'object-contain' : 'object-cover'}`}>
                                  <img
                                    src={rowImage}
                                    alt=""
                                    className={`w-full h-full ${fitImageSize ? 'object-contain' : 'object-cover'}`}
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none'
                                    }}
                                  />
                                </div>
                              </td>
                            )}
                            {visibleFields.map((field) => {
                              const tableField = safeTableFields.find(f => f.name === field.field_name)
                              const isVirtual = tableField?.type === 'formula' || tableField?.type === 'lookup'
                              const columnWidth = columnWidths[field.field_name] || COLUMN_DEFAULT_WIDTH
                              return (
                                <td
                                  key={field.field_name}
                                  className="px-0 py-0"
                                  style={{ width: `${columnWidth}px`, minWidth: `${columnWidth}px`, maxWidth: `${columnWidth}px` }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Cell
                                    value={row[field.field_name]}
                                    fieldName={field.field_name}
                                    fieldType={tableField?.type}
                                    fieldOptions={tableField?.options}
                                    isVirtual={isVirtual}
                                    editable={canEdit && !isVirtual}
                                    wrapText={wrapText}
                                    rowHeight={rowHeightPixels}
                                    onSave={async (value) => {
                                      if (!isVirtual) {
                                        await handleCellSave(row.id, field.field_name, value)
                                      }
                                    }}
                                  />
                                </td>
                              )
                            })}
                          </tr>
                          )
                        })}
                    </React.Fragment>
                  )
                })
              ) : (
                // Render ungrouped rows
                // CRITICAL: filteredRows is already normalized, but guard for safety
                filteredRows.map((row) => {
                  const rowColor = getRowColor ? getRowColor(row) : null
                  const rowImage = getRowImage ? getRowImage(row) : null
                  const borderColor = rowColor ? { borderLeftColor: rowColor, borderLeftWidth: '4px' } : {}
                  const canOpenRecord = enableRecordOpen && allowOpenRecord
                  const shouldRowClickOpen = isMobile && canOpenRecord // Mobile: entire row opens
                  
                  return (
                  <tr
                    key={row.id}
                    className={`border-b border-gray-100 ${shouldRowClickOpen ? 'hover:bg-blue-50 transition-colors cursor-pointer' : 'cursor-default'}`}
                    style={{ ...borderColor, height: `${rowHeightPixels}px` }}
                    onClick={shouldRowClickOpen ? () => handleRowClick(row.id) : undefined}
                  >
                    {/* Row action indicator (desktop only) */}
                    {canOpenRecord && (
                      <td
                        className="px-2 py-1 w-8"
                        onClick={(e) => !isMobile && handleOpenRecordClick(e, row.id)}
                      >
                        {!isMobile && (
                          <button
                            className="w-full h-full flex items-center justify-center text-gray-400 hover:text-blue-600 transition-colors rounded"
                            title="Open record"
                            aria-label="Open record"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    )}
                    {/* Image cell if image field is configured */}
                    {rowImage && (
                      <td
                        className="px-2 py-1 w-12"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className={`w-8 h-8 rounded overflow-hidden bg-gray-100 ${fitImageSize ? 'object-contain' : 'object-cover'}`}>
                          <img
                            src={rowImage}
                            alt=""
                            className={`w-full h-full ${fitImageSize ? 'object-contain' : 'object-cover'}`}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        </div>
                      </td>
                    )}
                    {visibleFields.map((field) => {
                      const tableField = safeTableFields.find(f => f.name === field.field_name)
                      const isVirtual = tableField?.type === 'formula' || tableField?.type === 'lookup'
                      const columnWidth = columnWidths[field.field_name] || COLUMN_DEFAULT_WIDTH
                      return (
                        <td
                          key={field.field_name}
                          className="px-0 py-0"
                          style={{ width: `${columnWidth}px`, minWidth: `${columnWidth}px`, maxWidth: `${columnWidth}px` }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Cell
                            value={row[field.field_name]}
                            fieldName={field.field_name}
                            fieldType={tableField?.type}
                            fieldOptions={tableField?.options}
                            isVirtual={isVirtual}
                            editable={canEdit && !isVirtual}
                            wrapText={wrapText}
                            rowHeight={rowHeightPixels}
                            onSave={async (value) => {
                              if (!isVirtual) {
                                await handleCellSave(row.id, field.field_name, value)
                              }
                            }}
                          />
                        </td>
                      )
                    })}
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fixed bottom toolbar - Always visible */}
      {isEditing && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Only show Add Row button if inline create is allowed */}
            {allowInlineCreate && (
              <button
                onClick={handleAddRow}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Row
              </button>
            )}
            {onAddField && (
              <button
                onClick={onAddField}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Field
              </button>
            )}
          </div>
          <div className="text-sm text-gray-500">
            {filteredRows.length} {filteredRows.length === 1 ? "row" : "rows"}
            {searchTerm && filteredRows.length !== safeRows.length && (
              <span className="ml-1">(filtered from {safeRows.length})</span>
            )}
          </div>
        </div>
      )}

      {/* Record modal */}
      {modalRecord && (
        <RecordModal
          isOpen={!!modalRecord}
          onClose={() => setModalRecord(null)}
          tableId={modalRecord.tableId}
          recordId={modalRecord.recordId}
          tableName={modalRecord.tableName}
          modalFields={modalFields}
        />
      )}
    </div>
  )
}
