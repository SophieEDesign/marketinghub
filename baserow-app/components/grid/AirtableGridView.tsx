"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import type { FilterType } from '@/types/database'
import type { FilterConfig } from '@/lib/interface/filters'
import { buildGroupTree, flattenGroupTree } from '@/lib/grouping/groupTree'
import type { GroupRule } from '@/lib/grouping/types'
import { normalizeUuid } from '@/lib/utils/ids'
import type { LinkedField } from '@/types/fields'
import { resolveLinkedFieldDisplayMap } from '@/lib/dataView/linkedFields'
import FillHandle from './FillHandle'
import CellContextMenu from './CellContextMenu'
import { formatCellValue } from '@/lib/dataView/clipboard'
import FieldBuilderModal from './FieldBuilderModal'

type Sort = { field: string; direction: 'asc' | 'desc' }

export type AirtableGridActions = {
  createNewRow: () => Promise<GridRow | null>
}

interface AirtableGridViewProps {
  tableName: string
  tableId?: string // Table ID for opening records
  viewName?: string
  viewId?: string // View ID for saving/loading grid view settings
  viewFilters?: Array<{
    id?: string
    field_name: string
    operator: FilterType
    value?: string
  }>
  rowHeight?: 'short' | 'medium' | 'tall'
  editable?: boolean
  fields?: TableField[]
  onAddField?: () => void
  onEditField?: (fieldName: string) => void
  groupBy?: string
  /** Nested grouping rules (preferred). If omitted, falls back to `groupBy`. */
  groupByRules?: GroupRule[]
  userRole?: "admin" | "editor" | "viewer" | null
  disableRecordPanel?: boolean // If true, clicking rows won't open record panel
  onTableFieldsRefresh?: () => void // Refresh field metadata after option updates
  onActionsReady?: (actions: AirtableGridActions) => void
}

const ROW_HEIGHT_SHORT = 32
const ROW_HEIGHT_MEDIUM = 40
const ROW_HEIGHT_TALL = 56
const HEADER_HEIGHT = 40
const COLUMN_MIN_WIDTH = 100
const COLUMN_DEFAULT_WIDTH = 200
const FROZEN_COLUMN_WIDTH = 50
const OPEN_RECORD_COLUMN_WIDTH = 32

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
  viewFilters = [],
  rowHeight = 'medium',
  editable = true,
  fields = [],
  onAddField,
  onEditField,
  groupBy,
  groupByRules,
  userRole = "editor",
  disableRecordPanel = false,
  onTableFieldsRefresh,
  onActionsReady,
}: AirtableGridViewProps) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const isTablet = useIsTablet()
  const [tableIdState, setTableIdState] = useState<string | null>(tableId || null)

  // `viewId` can be a composite like "<uuid>:<index>" in some contexts.
  // Only use a strict UUID when querying `grid_view_settings`.
  const viewUuid = useMemo(() => normalizeUuid(viewId), [viewId])

  // Load tableId from tableName if not provided
  useEffect(() => {
    // We need `tableId` for more than opening records (e.g. schema sync/self-heal in `useGridData`).
    // So we should resolve it even when the record panel is disabled.
    if (!tableIdState && tableName) {
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
  }, [tableIdState, tableName])

  const handleOpenRecord = useCallback((rowId: string) => {
    if (disableRecordPanel) return
    if (!tableIdState || !tableName) return
    // Core Data (Airtable grid): open record as a full page view.
    router.push(`/tables/${tableIdState}/records/${rowId}`)
  }, [disableRecordPanel, router, tableIdState, tableName])
  
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
  const [groupValueLabelMaps, setGroupValueLabelMaps] = useState<Record<string, Record<string, string>>>({})
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set())
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null)
  const layoutDirtyRef = useRef(false)
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({})
  const MIN_ROW_HEIGHT_PX = ROW_HEIGHT_SHORT
  const rowHeightsRef = useRef<Record<string, number>>({})
  const settingsLoadedRef = useRef<string | null>(null) // Track which fieldsContentKey we've loaded settings for
  
  // Drag-to-fill state
  const [fillSource, setFillSource] = useState<{ rowId: string; fieldName: string; value: any } | null>(null)
  const [fillTargetRowIds, setFillTargetRowIds] = useState<Set<string>>(new Set())
  
  // Track wrap text settings per column (from grid_view_settings)
  const [columnWrapTextSettings, setColumnWrapTextSettings] = useState<Record<string, boolean>>({})

  // Field builder modal state for insert left/right
  const [fieldBuilderOpen, setFieldBuilderOpen] = useState(false)
  const [insertTargetField, setInsertTargetField] = useState<{ fieldName: string; position: 'left' | 'right' } | null>(null)

  // Refs
  const gridRef = useRef<HTMLDivElement>(null)
  const headerScrollRef = useRef<HTMLDivElement>(null)
  const bodyScrollRef = useRef<HTMLDivElement>(null)
  const frozenColumnRef = useRef<HTMLDivElement>(null)
  const rowResizeActiveRef = useRef(false)
  const rowResizeRowIdRef = useRef<string | null>(null)
  const rowResizeStartYRef = useRef(0)
  const rowResizeStartHeightRef = useRef(0)

  useEffect(() => {
    rowHeightsRef.current = rowHeights
  }, [rowHeights])

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
  const standardizedFilters = useMemo<FilterConfig[]>(() => {
    const safe = asArray(viewFilters)
    return safe
      .filter((f) => !!f && typeof f.field_name === 'string' && typeof f.operator === 'string')
      .map((f) => ({
        field: f.field_name,
        operator: f.operator as any,
        value: f.value ?? '',
      }))
  }, [viewFilters])

  const { rows: allRows, loading, error, updateCell, refresh, insertRow, physicalColumns } = useGridData({
    tableName,
    tableId: tableIdState || tableId,
    fields,
    filters: standardizedFilters,
    sorts,
  })

  // CRITICAL: Normalize all inputs at grid entry point
  // Never trust upstream to pass correct types - always normalize
  // CRITICAL: Memoize to prevent new array references on every render (causes infinite loops)
  const safeRows = useMemo(() => asArray<GridRow>(allRows), [allRows])
  const safeFields = useMemo(() => asArray<TableField>(fields), [fields])
  const safeSorts = useMemo(() => asArray<Sort>(sorts), [sorts])

  // Upstream can recreate arrays each render; use a stable content key so our effects don't thrash.
  // Keep this order-insensitive to avoid loops if the same fields arrive in different orders.
  const fieldsContentKey = useMemo(() => {
    const minimal = Array.isArray(safeFields)
      ? safeFields
          .filter((f): f is TableField => Boolean(f && typeof f === 'object'))
          .map((f) => ({
            id: (f as any).id ?? null,
            name: (f as any).name ?? null,
            order_index: (f as any).order_index ?? (f as any).position ?? null,
            type: (f as any).type ?? null,
          }))
          .sort((a, b) => {
            const ak = String(a.id ?? a.name ?? '')
            const bk = String(b.id ?? b.name ?? '')
            return ak.localeCompare(bk)
          })
      : []
    return JSON.stringify(minimal)
  }, [safeFields])

  // Get visible fields in order (needed for search filtering and rendering)
  // CRITICAL: If columnOrder is empty, fall back to all fields sorted by order_index/position
  // CRITICAL: Filter out any fields that don't have valid names (defensive check)
  // CRITICAL: Filter out fields that don't exist in the physical table (if we know the physical columns)
  const visibleFields = useMemo(() => {
    // CRITICAL: Defensive guard - ensure safeFields is an array
    if (!Array.isArray(safeFields) || safeFields.length === 0) {
      return []
    }

    // Filter out any invalid fields first (defensive check)
    let validFields = safeFields.filter((f): f is TableField => 
      f !== null && 
      f !== undefined && 
      typeof f === 'object' && 
      !!f.name && 
      typeof f.name === 'string' &&
      f.name.trim().length > 0
    )

    // If we know the physical columns, filter out fields that don't exist physically
    // (except for virtual fields like formula/lookup which don't need physical columns)
    if (physicalColumns !== null) {
      validFields = validFields.filter((f) => {
        const isVirtual = f.type === 'formula' || f.type === 'lookup'
        if (isVirtual) return true // Virtual fields are OK
        if (!physicalColumns.has(f.name)) {
          console.warn(`[AirtableGridView] Filtering out field "${f.name}" - exists in metadata but not in physical table`)
          return false
        }
        return true
      })
    }

    // If columnOrder is empty or invalid, use all fields sorted by order_index/position
    if (!Array.isArray(columnOrder) || columnOrder.length === 0) {
      // Sort fields by order_index, then by position, then by name
      const sortedFields = [...validFields].sort((a, b) => {
        const aOrder = a.order_index ?? a.position ?? 0
        const bOrder = b.order_index ?? b.position ?? 0
        if (aOrder !== bOrder) return aOrder - bOrder
        return (a.name || '').localeCompare(b.name || '')
      })
      return sortedFields
    }

    // Use columnOrder if available
    const safeColumnOrder = asArray(columnOrder).filter((name): name is string => 
      typeof name === 'string' && name.length > 0
    )
    
    // Map column order to fields, filtering out any that don't exist
    return safeColumnOrder
      .map((fieldName) => {
        const field = validFields.find((f) => f.name === fieldName)
        return field
      })
      .filter((f): f is TableField => f !== null && f !== undefined && !!f.name)
  }, [columnOrder, safeFields, physicalColumns])

  // Filter rows by search query (only visible fields)
  const visibleFieldNames = useMemo(() => {
    return visibleFields.map((f) => f.name)
  }, [visibleFields])

  const filteredRows = useMemo(() => {
    return filterRowsBySearch(safeRows, safeFields, searchQuery, visibleFieldNames)
  }, [safeRows, safeFields, searchQuery, visibleFieldNames])

  const createNewRow = useCallback(async (): Promise<GridRow | null> => {
    const newRow = await insertRow({})

    // Spreadsheet-style UX: jump to the newly created row and select the first visible field
    if (newRow && visibleFields.length > 0) {
      setSelectedCell({ rowId: newRow.id, fieldName: visibleFields[0].name })
      setSelectedRowIds(new Set())
      setSelectedColumnId(null)

      requestAnimationFrame(() => {
        if (bodyScrollRef.current) {
          bodyScrollRef.current.scrollTop = bodyScrollRef.current.scrollHeight
        }
      })
    }

    return newRow
  }, [insertRow, visibleFields])

  // Expose actions to parent (toolbar lives outside this component)
  useEffect(() => {
    if (!onActionsReady) return
    onActionsReady({ createNewRow })
  }, [onActionsReady, createNewRow])

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
      
      // Show warnings if any (non-blocking)
      if (result.warnings && result.warnings.length > 0) {
        const warningMsg = result.warnings.slice(0, 3).join('\n')
        console.warn('Paste warnings:', warningMsg)
      }
      
      // Show errors if any (only if there are errors)
      if (result.errors.length > 0) {
        const errorCount = result.errors.length
        const appliedCount = result.appliedCount || 0
        
        // Build error message
        const errorMsg = result.errors
          .slice(0, 5)
          .map(e => {
            const fieldName = e.fieldName || 'Unknown field'
            const error = e.error || 'Validation failed'
            return `${fieldName}: ${error}`
          })
          .join('\n')
        
        const summary = appliedCount > 0
          ? `Successfully pasted ${appliedCount} value${appliedCount !== 1 ? 's' : ''}, but ${errorCount} error${errorCount !== 1 ? 's' : ''} occurred:\n\n`
          : `Failed to paste ${errorCount} value${errorCount !== 1 ? 's' : ''}:\n\n`
        
        const fullMessage = summary + errorMsg + (errorCount > 5 ? `\n... and ${errorCount - 5} more error${errorCount - 5 !== 1 ? 's' : ''}` : '')
        
        // Log structured error details for debugging (only in development or when explicitly enabled)
        const isDevelopment = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development'
        const errorLoggingEnabled = typeof window !== 'undefined' && (window as any).__enablePasteErrorLogging
        
        if (isDevelopment || errorLoggingEnabled) {
          console.group('Paste Errors')
          console.error(`Total errors: ${errorCount}, Applied: ${appliedCount}`)
          result.errors.forEach((error, index) => {
            console.error(`[${index + 1}] ${error.fieldName || 'Unknown field'}:`, {
              rowId: error.rowId,
              columnId: error.columnId,
              value: error.value,
              error: error.error,
            })
          })
          console.groupEnd()
        }
        
        alert(fullMessage)
      } else if (result.appliedCount > 0) {
        // Success feedback (optional - can be removed if too noisy)
        // Only log to console to avoid interrupting workflow
        console.log(`Successfully pasted ${result.appliedCount} value${result.appliedCount !== 1 ? 's' : ''}`)
      }
    },
    onError: (error) => {
      console.error('Data view error:', error)
      alert(`Error: ${error.message}`)
    },
  })

  // Update data view context when data changes
  // CRITICAL: Don't include dataView in dependencies - updateContext is stable via useCallback
  // Including dataView causes infinite loops because the object reference changes on every render
  const { updateContext } = dataView
  
  // Memoize rowOrder to prevent creating new array reference on every render
  const rowOrder = useMemo(() => {
    return filteredRows.map((r: any) => r.id)
  }, [filteredRows])
  
  // Use refs to track previous values and only update when content actually changes
  // This prevents infinite loops from reference changes
  const prevContextRef = useRef<string>('')
  const contextKey = useMemo(() => {
    return JSON.stringify({
      rowsLength: safeRows.length,
      rowsIds: safeRows.slice(0, 10).map(r => r?.id).filter(Boolean), // Sample of IDs
      fieldsLength: safeFields.length,
      fieldsNames: safeFields.map(f => f?.name).filter(Boolean).sort(),
      visibleFieldsLength: visibleFields.length,
      visibleFieldsNames: visibleFields.map(f => f?.name).filter(Boolean).sort(),
      rowOrderLength: rowOrder.length,
      rowOrderSample: rowOrder.slice(0, 10), // Sample of IDs
    })
  }, [safeRows, safeFields, visibleFields, rowOrder])
  
  useEffect(() => {
    // Only update if content actually changed (not just reference)
    if (prevContextRef.current === contextKey) {
      return
    }
    prevContextRef.current = contextKey
    
    updateContext({
      rows: safeRows,
      fields: safeFields,
      visibleFields: visibleFields,
      rowOrder: rowOrder,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // updateContext is stable via useCallback, but including it causes React to re-run unnecessarily
    // contextKey tracks actual content changes, preventing infinite loops from reference changes
  }, [contextKey])

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
    if (!viewUuid || safeFields.length === 0) return
    
    // CRITICAL: Prevent loading settings multiple times for the same fieldsContentKey
    // This prevents infinite loops when state updates trigger re-renders
    if (settingsLoadedRef.current === fieldsContentKey) {
      return
    }
    settingsLoadedRef.current = fieldsContentKey

    async function loadGridViewSettings() {
      try {
        const supabase = createClient()
        // IMPORTANT: Use `select('*')` so environments missing optional columns
        // (e.g. `column_wrap_text`, `row_heights`) don't fail with a 400.
        const { data, error } = await supabase
          .from('grid_view_settings')
          .select('*')
          .eq('view_id', viewUuid)
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
            // CRITICAL: Sanitize persisted column order - filter out null/undefined/empty strings
            const sanitizedOrder = (data.column_order as unknown[])
              .filter((name: unknown): name is string => typeof name === 'string' && name.trim().length > 0)
            
            // Get current field names
            const allFieldNames = Array.isArray(safeFields)
              ? safeFields
                  .filter((f) => f && typeof f === 'object' && f.name)
                  .map((f) => f.name)
                  .filter((name: unknown): name is string => typeof name === 'string' && name.length > 0)
              : []
            
            // Validate that all fields in persisted order still exist
            const validOrder = sanitizedOrder.filter((name: string) => allFieldNames.includes(name))
            
            if (validOrder.length > 0 && validOrder.length === sanitizedOrder.length) {
              // All fields in order are valid - use it
              // Add any missing fields to the end
              const missingFields = allFieldNames.filter(name => !validOrder.includes(name))
              setColumnOrder([...validOrder, ...missingFields])
            } else {
              // Some fields in order are stale - rebuild from current fields
              setColumnOrder(allFieldNames)
            }
          } else if (Array.isArray(safeFields) && safeFields.length > 0) {
            // No persisted order - initialize from fields
            const sortedFields = [...safeFields].sort((a, b) => {
              const aOrder = a.order_index ?? a.position ?? 0
              const bOrder = b.order_index ?? b.position ?? 0
              if (aOrder !== bOrder) return aOrder - bOrder
              return (a.name || '').localeCompare(b.name || '')
            })
            setColumnOrder(sortedFields.map((f) => f.name).filter((name): name is string => typeof name === 'string' && name.length > 0))
          }
          if (data.column_wrap_text && typeof data.column_wrap_text === 'object') {
            setColumnWrapText(data.column_wrap_text as Record<string, boolean>)
            setColumnWrapTextSettings(data.column_wrap_text as Record<string, boolean>)
          }
          if (data.row_heights && typeof data.row_heights === 'object') {
            const sanitized: Record<string, number> = {}
            for (const [k, v] of Object.entries(data.row_heights as any)) {
              if (typeof k !== 'string' || k.trim().length === 0) continue
              if (typeof v !== 'number' || !Number.isFinite(v)) continue
              sanitized[k] = Math.max(MIN_ROW_HEIGHT_PX, Math.round(v))
            }
            setRowHeights(sanitized)
          }
        } else {
          // Fallback to localStorage
          loadFromLocalStorage()
        }

        // Set default widths for fields without saved widths
        // CRITICAL: Only update if there are actually new widths to add to prevent infinite loops
        setColumnWidths((prev) => {
          let hasChanges = false
          const newWidths = { ...prev }
          safeFields.forEach((field) => {
            if (!newWidths[field.name]) {
              newWidths[field.name] = COLUMN_DEFAULT_WIDTH
              hasChanges = true
            }
          })
          // Only return new object if there were actual changes
          return hasChanges ? newWidths : prev
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
      const savedRowHeights = localStorage.getItem(`${storageKey}_rowHeights`)

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
          // CRITICAL: Sanitize localStorage order
          const sanitizedOrder = Array.isArray(order)
            ? order.filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
            : []
          
          const allFieldNames = Array.isArray(safeFields)
            ? safeFields
                .filter((f) => f && typeof f === 'object' && f.name)
                .map((f) => f.name)
                .filter((name): name is string => typeof name === 'string' && name.length > 0)
            : []
          
          if (sanitizedOrder.length > 0 && sanitizedOrder.every((name: string) => allFieldNames.includes(name))) {
            // All fields in order are valid - use it
            // Add any missing fields to the end
            const missingFields = allFieldNames.filter(name => !sanitizedOrder.includes(name))
            setColumnOrder([...sanitizedOrder, ...missingFields])
          } else {
            // Invalid order - rebuild from current fields
            setColumnOrder(allFieldNames)
          }
        } catch {
          // Fallback: initialize from fields
          if (Array.isArray(safeFields) && safeFields.length > 0) {
            const sortedFields = [...safeFields].sort((a, b) => {
              const aOrder = a.order_index ?? a.position ?? 0
              const bOrder = b.order_index ?? b.position ?? 0
              if (aOrder !== bOrder) return aOrder - bOrder
              return (a.name || '').localeCompare(b.name || '')
            })
            setColumnOrder(sortedFields.map((f) => f.name).filter((name): name is string => typeof name === 'string' && name.length > 0))
          } else {
            setColumnOrder([])
          }
        }
      } else {
        // No saved order - initialize from fields
        if (Array.isArray(safeFields) && safeFields.length > 0) {
          // Sort fields by order_index, then by position, then by name
          const sortedFields = [...safeFields].sort((a, b) => {
            const aOrder = a.order_index ?? a.position ?? 0
            const bOrder = b.order_index ?? b.position ?? 0
            if (aOrder !== bOrder) return aOrder - bOrder
            return (a.name || '').localeCompare(b.name || '')
          })
          setColumnOrder(sortedFields.map((f) => f.name).filter((name): name is string => typeof name === 'string' && name.length > 0))
        } else {
          setColumnOrder([])
        }
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

      if (savedRowHeights) {
        try {
          const parsed = JSON.parse(savedRowHeights) as Record<string, number>
          const sanitized: Record<string, number> = {}
          for (const [k, v] of Object.entries(parsed || {})) {
            if (typeof k !== 'string' || k.trim().length === 0) continue
            if (typeof v !== 'number' || !Number.isFinite(v)) continue
            sanitized[k] = Math.max(MIN_ROW_HEIGHT_PX, Math.round(v))
          }
          setRowHeights(sanitized)
        } catch {
          // ignore
        }
      }
    }

    loadGridViewSettings()
  }, [fieldsContentKey, tableName, viewName, viewUuid])

  // Save column widths, order, and wrap text to database and localStorage
  useEffect(() => {
    if (Object.keys(columnWidths).length === 0 || columnOrder.length === 0) return
    if (!layoutDirtyRef.current) return

    // Save to localStorage as backup
    const storageKey = `grid_${tableName}_${viewName}`
    localStorage.setItem(`${storageKey}_widths`, JSON.stringify(columnWidths))
    localStorage.setItem(`${storageKey}_order`, JSON.stringify(columnOrder))
    localStorage.setItem(`${storageKey}_wrapText`, JSON.stringify(columnWrapText))

    // Save to database if viewId is available
    if (viewUuid) {
      async function saveToDatabase() {
        try {
          const supabase = createClient()
          const { data: existing } = await supabase
            .from('grid_view_settings')
            .select('id')
            .eq('view_id', viewUuid)
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
              .eq('view_id', viewUuid)
          } else {
            await supabase
              .from('grid_view_settings')
              .insert([{
                view_id: viewUuid,
                ...settingsData,
                row_height: 'medium',
                frozen_columns: 0,
              }])
          }
        } catch (error) {
          console.error('Error saving grid view settings:', error)
          // Non-critical, continue
        } finally {
          layoutDirtyRef.current = false
        }
      }
      saveToDatabase()
    } else {
      layoutDirtyRef.current = false
    }
  }, [columnWidths, columnOrder, columnWrapText, tableName, viewName, viewUuid])

  const persistRowHeights = useCallback(async (next: Record<string, number>) => {
    // Always persist to localStorage as backup
    const storageKey = `grid_${tableName}_${viewName}`
    try {
      localStorage.setItem(`${storageKey}_rowHeights`, JSON.stringify(next))
    } catch {
      // ignore
    }

    if (!viewUuid) return
    try {
      const supabase = createClient()
      const { data: existing } = await supabase
        .from('grid_view_settings')
        .select('id')
        .eq('view_id', viewUuid)
        .maybeSingle()

      if (existing) {
        const res = await supabase
          .from('grid_view_settings')
          .update({ row_heights: next })
          .eq('view_id', viewUuid)
        // Backward compatibility: older schemas won't have row_heights yet.
        if (res.error && ((res.error as any)?.code === '42703' || String((res.error as any)?.message || '').includes('row_heights'))) {
          return
        }
      } else {
        const res = await supabase
          .from('grid_view_settings')
          .insert([{
            view_id: viewUuid,
            column_widths: columnWidths,
            column_order: columnOrder,
            column_wrap_text: columnWrapText,
            row_height: 'medium',
            frozen_columns: 0,
            row_heights: next,
          }])
        if (res.error && ((res.error as any)?.code === '42703' || String((res.error as any)?.message || '').includes('row_heights'))) {
          // Can't persist row heights in DB yet; localStorage still works.
          return
        }
      }
    } catch (error) {
      console.error('Error saving row heights:', error)
    }
  }, [columnOrder, columnWidths, columnWrapText, tableName, viewUuid, viewName])

  const getEffectiveRowHeight = useCallback((rowId: string | null | undefined) => {
    if (!rowId) return ROW_HEIGHT
    const override = rowHeights[rowId]
    if (typeof override === 'number' && Number.isFinite(override) && override > 0) {
      return Math.max(MIN_ROW_HEIGHT_PX, Math.round(override))
    }
    return ROW_HEIGHT
  }, [ROW_HEIGHT, rowHeights])

  const startRowResize = useCallback((rowId: string, startHeight: number, startClientY: number) => {
    if (isMobile) return
    if (!rowId) return
    rowResizeActiveRef.current = true
    rowResizeRowIdRef.current = rowId
    rowResizeStartYRef.current = startClientY
    rowResizeStartHeightRef.current = startHeight

    const prevCursor = document.body.style.cursor
    const prevUserSelect = document.body.style.userSelect
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'

    const handleMove = (e: MouseEvent) => {
      if (!rowResizeActiveRef.current || rowResizeRowIdRef.current !== rowId) return
      const diff = e.clientY - rowResizeStartYRef.current
      const nextH = Math.max(MIN_ROW_HEIGHT_PX, Math.round(rowResizeStartHeightRef.current + diff))
      setRowHeights((prev) => ({ ...prev, [rowId]: nextH }))
    }

    const handleUp = async () => {
      rowResizeActiveRef.current = false
      rowResizeRowIdRef.current = null
      document.body.style.cursor = prevCursor
      document.body.style.userSelect = prevUserSelect
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)

      // Persist once at the end (avoid spamming writes while dragging)
      const latest = rowHeightsRef.current || {}
      const current = latest[rowId]
      const height = typeof current === 'number' ? current : startHeight
      const final = { ...latest, [rowId]: Math.max(MIN_ROW_HEIGHT_PX, Math.round(height)) }
      await persistRowHeights(final)
    }

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
  }, [isMobile, persistRowHeights])

  const resetRowHeight = useCallback(async (rowId: string) => {
    if (!rowId) return
    const next = { ...rowHeights }
    delete next[rowId]
    setRowHeights(next)
    await persistRowHeights(next)
  }, [persistRowHeights, rowHeights])

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

  const effectiveGroupRules = useMemo<GroupRule[]>(() => {
    const safe = Array.isArray(groupByRules) ? groupByRules.filter(Boolean) : []
    if (safe.length > 0) return safe
    if (groupBy && typeof groupBy === 'string' && groupBy.trim()) return [{ type: 'field', field: groupBy.trim() }]
    return []
  }, [groupBy, groupByRules])

  const groupModel = useMemo(() => {
    if (effectiveGroupRules.length === 0) return null
    return buildGroupTree(asArray<GridRow>(filteredRows), safeFields, effectiveGroupRules, {
      emptyLabel: '(Empty)',
      emptyLast: true,
      valueLabelMaps: groupValueLabelMaps,
    })
  }, [effectiveGroupRules, filteredRows, safeFields, groupValueLabelMaps])

  // Resolve grouping labels for linked record fields (link_to_table).
  useEffect(() => {
    let cancelled = false

    const collectIds = (raw: any): string[] => {
      if (raw == null) return []
      if (Array.isArray(raw)) return raw.flatMap(collectIds)
      if (typeof raw === 'object') {
        if (raw && 'id' in raw) return [String((raw as any).id)]
        return []
      }
      const s = String(raw).trim()
      return s ? [s] : []
    }

    async function load() {
      const rules = Array.isArray(effectiveGroupRules) ? effectiveGroupRules : []
      if (rules.length === 0) {
        setGroupValueLabelMaps({})
        return
      }

      const fieldByNameOrId = new Map<string, TableField>()
      for (const f of safeFields) {
        if (!f) continue
        if (f.name) fieldByNameOrId.set(f.name, f)
        if ((f as any).id) fieldByNameOrId.set(String((f as any).id), f)
      }

      const groupedLinkFields: LinkedField[] = []
      for (const r of rules) {
        if (!r || r.type !== 'field') continue
        const f = fieldByNameOrId.get(r.field)
        if (f && f.type === 'link_to_table') groupedLinkFields.push(f as LinkedField)
      }

      if (groupedLinkFields.length === 0) {
        setGroupValueLabelMaps({})
        return
      }

      const next: Record<string, Record<string, string>> = {}
      for (const f of groupedLinkFields) {
        const ids = new Set<string>()
        for (const row of asArray<GridRow>(filteredRows)) {
          for (const id of collectIds((row as any)?.[f.name])) ids.add(id)
        }
        if (ids.size === 0) continue
        const map = await resolveLinkedFieldDisplayMap(f, Array.from(ids))
        next[f.name] = Object.fromEntries(map.entries())
        // Also key by field id for callers who group by id.
        next[(f as any).id] = next[f.name]
      }

      if (!cancelled) setGroupValueLabelMaps(next)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [effectiveGroupRules, filteredRows, safeFields])

  function toggleGroup(pathKey: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(pathKey)) next.delete(pathKey)
      else next.add(pathKey)
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
    if (groupModel && groupModel.rootGroups.length > 0) {
      const flat = flattenGroupTree<GridRow>(groupModel.rootGroups, collapsedGroups)
      return flat.map((it) => {
        if (it.type === 'group') {
          return { type: 'group' as const, node: it.node, level: it.level }
        }
        return {
          type: 'row' as const,
          data: it.item,
          level: it.level,
          groupPathKey: it.groupPathKey,
        }
      })
    }
    return asArray<GridRow>(filteredRows).map((row) => ({ type: 'row' as const, data: row, level: 0, groupPathKey: '' }))
  }, [collapsedGroups, filteredRows, groupModel])

  // Virtualization calculations
  const GROUP_HEADER_HEIGHT = 40
  const getItemHeight = (item: (typeof renderItems)[number]) => {
    if (item.type === 'group') return GROUP_HEADER_HEIGHT
    return getEffectiveRowHeight(item.data?.id)
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

  // Calculate total width (open chevron + checkbox + row number + columns + add button)
  const totalWidth = useMemo(() => {
    const columnsWidth = columnOrder.reduce((sum, fieldName) => {
      return sum + (columnWidths[fieldName] || COLUMN_DEFAULT_WIDTH)
    }, 0)
    return (
      OPEN_RECORD_COLUMN_WIDTH +
      (FROZEN_COLUMN_WIDTH * 2) +
      columnsWidth +
      (onAddField ? FROZEN_COLUMN_WIDTH : 0)
    )
  }, [columnOrder, columnWidths, onAddField])

  const markLayoutDirty = useCallback(() => {
    layoutDirtyRef.current = true
  }, [])

  // Handle wrap text toggle
  const handleToggleWrapText = useCallback((fieldName: string) => {
    markLayoutDirty()
    setColumnWrapText((prev) => ({
      ...prev,
      [fieldName]: !prev[fieldName],
    }))
  }, [markLayoutDirty])

  // Handle column resize
  // Disable resize on mobile (can enable long-press later if needed)
  const handleResizeStart = useCallback((fieldName: string) => {
    if (isMobile) return // Disable resize on mobile
    markLayoutDirty()
    setResizingColumn(fieldName)
  }, [isMobile, markLayoutDirty])

  const handleResize = useCallback(
    (fieldName: string, width: number) => {
      if (isMobile) return // Disable resize on mobile
      markLayoutDirty()
      setColumnWidths((prev) => ({
        ...prev,
        [fieldName]: Math.max(COLUMN_MIN_WIDTH, Math.min(width, 1000)), // Max width 1000px
      }))
    },
    [isMobile, markLayoutDirty]
  )

  const handleResizeEnd = useCallback(() => {
    if (isMobile) return // Disable resize on mobile
    setResizingColumn(null)
  }, [isMobile])

  // Handle column reorder
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      markLayoutDirty()
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
        // Let useGridData's updateCell handle schema sync automatically
        // It will attempt to sync the schema if the column is missing
        await updateCell(rowId, fieldName, value)
      } catch (error: any) {
        console.error('Error saving cell:', error)
        // Show user-friendly error message
        if (error?.message) {
          alert(error.message)
        }
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

  // Helper function to determine current selection
  const getCurrentSelection = useCallback((): Selection | null => {
    // Priority: column > row > cell
    if (selectedColumnId) {
      const field = safeFields.find(f => f.id === selectedColumnId)
      if (field && field.name) {
        return {
          type: 'column',
          columnId: field.id,
          fieldName: field.name,
        }
      }
    }
    
    if (selectedRowIds.size > 0) {
      // Filter out invalid row IDs
      const validRowIds = Array.from(selectedRowIds).filter((id): id is string => {
        return typeof id === 'string' && id.trim().length > 0 && safeRows.some(r => r.id === id)
      })
      
      if (validRowIds.length > 0) {
        return {
          type: 'row',
          rowIds: validRowIds,
        }
      }
    }
    
    if (selectedCell) {
      const field = safeFields.find(f => f.name === selectedCell.fieldName)
      if (field && field.id && selectedCell.rowId) {
        // Verify row exists
        const rowExists = safeRows.some(r => r.id === selectedCell.rowId)
        if (rowExists) {
          return {
            type: 'cell',
            rowId: selectedCell.rowId,
            columnId: field.id,
            fieldName: selectedCell.fieldName,
          }
        }
      }
    }
    
    return null
  }, [selectedCell, selectedRowIds, selectedColumnId, safeFields, safeRows])

  // Handle insert left/right
  const handleInsertLeft = useCallback((fieldName: string) => {
    if (!tableId) {
      console.warn('Cannot insert field: tableId is required')
      return
    }
    setInsertTargetField({ fieldName, position: 'left' })
    setFieldBuilderOpen(true)
  }, [tableId])

  const handleInsertRight = useCallback((fieldName: string) => {
    if (!tableId) {
      console.warn('Cannot insert field: tableId is required')
      return
    }
    setInsertTargetField({ fieldName, position: 'right' })
    setFieldBuilderOpen(true)
  }, [tableId])

  // Handle field save with position reordering
  const handleFieldSave = useCallback(async () => {
    if (!insertTargetField || !tableId) {
      // Regular field save (not from insert)
      if (onTableFieldsRefresh) {
        onTableFieldsRefresh()
      }
      setFieldBuilderOpen(false)
      setInsertTargetField(null)
      return
    }

    // Wait a bit for the field to be created and committed to the database
    await new Promise(resolve => setTimeout(resolve, 300))

    try {
      // Get all fields to find the newly created one and calculate position
      const supabase = createClient()
      const { data: allFields, error: fieldsError } = await supabase
        .from('table_fields')
        .select('*')
        .eq('table_id', tableId)
        .order('order_index', { ascending: true })

      if (fieldsError) {
        console.error('Error loading fields for reordering:', fieldsError)
        if (onTableFieldsRefresh) {
          onTableFieldsRefresh()
        }
        setFieldBuilderOpen(false)
        setInsertTargetField(null)
        return
      }

      // Find the target field
      const targetField = allFields?.find(f => f.name === insertTargetField.fieldName)
      if (!targetField) {
        console.warn('Target field not found for reordering')
        if (onTableFieldsRefresh) {
          onTableFieldsRefresh()
        }
        setFieldBuilderOpen(false)
        setInsertTargetField(null)
        return
      }

      // Find the newly created field (should be the one with the highest order_index)
      // The API always creates fields with maxOrderIndex + 1, so the new field will have the highest order_index
      const sortedFields = (allFields || []).sort((a, b) => {
        const aOrder = a.order_index ?? a.position ?? 0
        const bOrder = b.order_index ?? b.position ?? 0
        return bOrder - aOrder
      })
      // The new field should be the first one (highest order_index) that's not the target
      // If target is the first, then new field is the second
      const newField = sortedFields[0]?.id === targetField.id 
        ? sortedFields[1]  // Target is first, new field is second
        : sortedFields[0]   // New field is first (has highest order_index)

      if (!newField) {
        // Couldn't find new field - might have been created with a different name
        console.warn('Could not find newly created field for reordering')
        if (onTableFieldsRefresh) {
          onTableFieldsRefresh()
        }
        setFieldBuilderOpen(false)
        setInsertTargetField(null)
        return
      }

      // Calculate target order_index
      const targetOrderIndex = targetField.order_index ?? targetField.position ?? 0
      const newOrderIndex = insertTargetField.position === 'left' 
        ? targetOrderIndex  // Insert before: use target's order_index
        : targetOrderIndex + 1  // Insert after: use target's order_index + 1

      // Shift all fields with order_index >= newOrderIndex by 1 (except the new field)
      const fieldsToUpdate: Array<{ id: string; order_index: number }> = []
      
      // First, set the new field's order_index
      fieldsToUpdate.push({ id: newField.id, order_index: newOrderIndex })
      
      // Then, shift all other fields that need to move
      for (const field of allFields || []) {
        if (field.id === newField.id) continue // Already handled
        
        const fieldOrder = field.order_index ?? field.position ?? 0
        if (fieldOrder >= newOrderIndex) {
          // Shift this field to the right
          fieldsToUpdate.push({ id: field.id, order_index: fieldOrder + 1 })
        }
      }

      // Update all affected fields
      if (fieldsToUpdate.length > 0) {
        const response = await fetch(`/api/tables/${tableId}/fields/reorder`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: fieldsToUpdate }),
        })

        if (!response.ok) {
          const error = await response.json()
          console.error('Error reordering fields:', error)
        }
      }

      // Refresh fields
      if (onTableFieldsRefresh) {
        onTableFieldsRefresh()
      }
    } catch (error) {
      console.error('Error handling field save with reordering:', error)
    } finally {
      setFieldBuilderOpen(false)
      setInsertTargetField(null)
    }
  }, [insertTargetField, tableId, onTableFieldsRefresh])

  // Keyboard shortcuts for copy/paste
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Only handle if grid is focused or no input is focused
      const activeElement = document.activeElement
      const isInputFocused = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA'
      
      // Copy: Ctrl/Cmd + C
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !e.shiftKey && !isInputFocused) {
        e.preventDefault()
        
        const selection = getCurrentSelection()
        if (!selection) return
        
        try {
          // Use display resolution for better UX (human-readable labels for linked fields)
          // Check if we need async resolution (linked fields)
          const hasLinkedFields = selection.type === 'row' || selection.type === 'column'
            ? safeFields.some(f => f.type === 'link_to_table')
            : safeFields.some(f => f.name === selection.fieldName && f.type === 'link_to_table')
          
          let clipboardText: string
          if (hasLinkedFields && dataView.copyWithDisplayResolution) {
            // Use async display resolution for linked fields
            clipboardText = await dataView.copyWithDisplayResolution(selection)
          } else {
            // No linked fields, use synchronous copy
            clipboardText = dataView.copy(selection)
          }
          
          await navigator.clipboard.writeText(clipboardText)
        } catch (error) {
          console.error('Error copying to clipboard:', error)
          // Silently fail - clipboard access may be denied
        }
      }
      
      // Paste: Ctrl/Cmd + V
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !e.shiftKey && !isInputFocused) {
        e.preventDefault()
        
        const selection = getCurrentSelection()
        if (!selection) {
          // No selection - try to paste into currently selected cell if available
          if (selectedCell) {
            const field = safeFields.find(f => f.name === selectedCell.fieldName)
            if (field) {
              try {
                const clipboardText = await navigator.clipboard.readText()
                if (clipboardText.trim()) {
                  const cellSelection: Selection = {
                    type: 'cell',
                    rowId: selectedCell.rowId,
                    columnId: field.id,
                    fieldName: selectedCell.fieldName,
                  }
                  await dataView.paste(cellSelection, clipboardText)
                }
              } catch (error) {
                console.error('Error pasting:', error)
              }
            }
          }
          return
        }
        
        try {
          const clipboardText = await navigator.clipboard.readText()
          
          // Validate clipboard content
          if (!clipboardText) {
            return // Empty clipboard, do nothing
          }
          
          // Check if clipboard contains only whitespace
          const trimmed = clipboardText.trim()
          if (trimmed.length === 0) {
            return // Only whitespace, do nothing
          }
          
          // Validate selection is still valid
          const currentSelection = getCurrentSelection()
          if (!currentSelection) {
            console.warn('No valid selection for paste operation')
            return
          }
          
          // Additional validation: check if paste would affect too many cells
          // This is handled by DataViewService, but we can add pre-validation here
          const lines = trimmed.split(/\r?\n/)
          const estimatedCells = lines.reduce((sum, line) => {
            return sum + line.split('\t').filter(cell => cell.trim().length > 0).length
          }, 0)
          
          if (estimatedCells > 10000) {
            const proceed = confirm(
              `This paste operation will affect approximately ${estimatedCells.toLocaleString()} cells. ` +
              `This may take a while. Do you want to continue?`
            )
            if (!proceed) {
              return
            }
          }
          
          const result = await dataView.paste(currentSelection, clipboardText)
          
          // Result handling is done in onChangesApplied callback
          // Additional validation can be done here if needed
          if (result.appliedCount === 0 && result.errors.length === 0) {
            // No changes applied and no errors - likely empty or invalid clipboard
            console.warn('No data was pasted. Clipboard may be empty or contain only whitespace.')
          }
        } catch (error: any) {
          console.error('Error pasting:', error)
          
          // Provide user-friendly error message
          const errorMessage = error?.message || 'Failed to paste data'
          if (errorMessage.includes('clipboard') || errorMessage.includes('permission')) {
            // Clipboard permission denied - don't show alert, just log
            console.warn('Clipboard access denied. Please ensure clipboard permissions are granted.')
          } else if (errorMessage.includes('Too many changes')) {
            // Large paste operation - show user-friendly message
            alert(`Paste operation too large. Please paste smaller amounts of data at a time.`)
          } else {
            // Other errors - show user-friendly alert
            alert(`Failed to paste data: ${errorMessage}`)
          }
        }
      }
      
      // Undo: Ctrl/Cmd + Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && !isInputFocused) {
        e.preventDefault()
        if (dataView.canUndo) {
          try {
            await dataView.undo()
          } catch (error) {
            console.error('Error undoing:', error)
          }
        }
      }
      
      // Redo: Ctrl/Cmd + Shift + Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey && !isInputFocused) {
        e.preventDefault()
        if (dataView.canRedo) {
          try {
            await dataView.redo()
          } catch (error) {
            console.error('Error redoing:', error)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedCell, selectedRowIds, selectedColumnId, safeFields, dataView, getCurrentSelection])

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
        className="flex-shrink-0 border-b border-gray-200 bg-white overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
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
          {/* Record open column (chevron) - sticky */}
          <div
            className="flex-shrink-0 border-r border-gray-100 bg-gray-50 flex items-center justify-center sticky left-0 z-20"
            style={{ width: OPEN_RECORD_COLUMN_WIDTH, height: HEADER_HEIGHT }}
            aria-hidden="true"
          />

          {/* Checkbox column - sticky */}
          <div
            className="flex-shrink-0 border-r border-gray-100 bg-gray-50 flex items-center justify-center sticky z-20"
            style={{ width: FROZEN_COLUMN_WIDTH, height: HEADER_HEIGHT, left: OPEN_RECORD_COLUMN_WIDTH }}
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
              "flex-shrink-0 border-r border-gray-100 bg-gray-50 flex items-center justify-center text-xs font-medium text-gray-500 z-20",
              (isMobile || isTablet) && "sticky"
            )}
            style={{
              width: FROZEN_COLUMN_WIDTH,
              height: HEADER_HEIGHT,
              left: OPEN_RECORD_COLUMN_WIDTH + FROZEN_COLUMN_WIDTH,
            }}
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
                      // Toggle selection - if already selected, deselect; otherwise select
                      if (fieldId === '') {
                        setSelectedColumnId(null)
                      } else {
                        const newSelection = selectedColumnId === fieldId ? null : fieldId
                        setSelectedColumnId(newSelection)
                        // Don't copy on click - wait for Ctrl+C to copy all column values
                      }
                      setSelectedCell(null)
                      setSelectedRowIds(new Set())
                    }}
                    sortDirection={sort?.direction || null}
                    sortOrder={sortIndex >= 0 ? sortIndex + 1 : null}
                    onSort={handleSort}
                    tableId={tableId}
                    onInsertLeft={tableId ? handleInsertLeft : undefined}
                    onInsertRight={tableId ? handleInsertRight : undefined}
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
              const node = item.node
              const isCollapsed = collapsedGroups.has(node.pathKey)
              const ruleLabel =
                node.rule.type === 'date'
                  ? node.rule.granularity === 'year'
                    ? 'Year'
                    : 'Month'
                  : node.rule.field
              return (
                <div
                  key={`group-${node.pathKey}`}
                  className="flex border-b border-gray-100 bg-gray-50/50"
                  style={{ height: GROUP_HEADER_HEIGHT }}
                >
                  <div
                    className="flex items-center px-4 flex-1 cursor-pointer hover:bg-gray-100/50 transition-colors"
                    style={{ paddingLeft: 16 + (item.level || 0) * 16 }}
                    onClick={() => toggleGroup(node.pathKey)}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 mr-2 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 mr-2 text-gray-400" />
                    )}
                    <span className="font-medium text-sm text-gray-700">
                      {ruleLabel}: {node.label}
                    </span>
                    <span className="text-gray-500 ml-2 text-sm">
                      ({node.size} {node.size === 1 ? "row" : "rows"})
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
              const effectiveRowHeight = getEffectiveRowHeight(row.id)
              const stickyBgClass = isSelected
                ? 'bg-blue-50'
                : isEven
                  ? 'bg-white'
                  : 'bg-gray-50'
              const stickyHoverClass = isSelected
                ? 'group-hover:bg-blue-50'
                : isEven
                  ? 'group-hover:bg-gray-50'
                  : 'group-hover:bg-gray-100'
              
              return (
                <div
                  key={item.groupPathKey ? `${row.id}::${item.groupPathKey}` : row.id}
                  className={`group flex border-b border-gray-100/50 hover:bg-gray-50/30 transition-colors relative ${
                    'cursor-default'
                  } ${
                    isEven ? 'bg-white' : 'bg-gray-50/30'
                  } ${isSelected ? 'bg-blue-50/50' : ''}`}
                  style={{ height: effectiveRowHeight }}
                  data-group-level={item.level || 0}
                  onClick={(e) => {
                    const target = e.target as HTMLElement
                    // Contract: single click selects the row ONLY (never opens a record).
                    // Ignore clicks originating from cells/editors/open button/checkbox.
                    if (target.closest('[data-grid-open="true"]')) return
                    if (target.closest('[data-grid-cell="true"]')) return
                    if (target.closest('.cell-editor')) return
                    if (target.closest('input[type="checkbox"]')) return

                    handleRowSelect(row.id, rowIndex, e)
                    setSelectedColumnId(null)
                    setSelectedCell(null)
                  }}
                  onDoubleClick={(e) => {
                    // Never open records on row double-click (chevron-only).
                    e.stopPropagation()
                  }}
                >
                  {/* Row resize handle (between rows) */}
                  {!isMobile && (
                    <div
                      className="absolute left-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{
                        bottom: '-3px',
                        height: '6px',
                        cursor: 'row-resize',
                        pointerEvents: 'auto',
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        startRowResize(row.id, effectiveRowHeight, e.clientY)
                      }}
                      onDoubleClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        resetRowHeight(row.id)
                      }}
                      title="Drag to resize row (double-click to reset)"
                    >
                      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-blue-500/60" />
                    </div>
                  )}
                  {/* Record open chevron - FIRST column */}
                  <div
                    className={cn(
                      "flex-shrink-0 border-r border-gray-100 flex items-center justify-center sticky left-0 z-10",
                      stickyBgClass,
                      stickyHoverClass
                    )}
                    style={{ width: OPEN_RECORD_COLUMN_WIDTH, height: effectiveRowHeight }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      data-grid-open="true"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenRecord(row.id)
                      }}
                      className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50/50 rounded transition-colors"
                      title="Open record"
                      aria-label="Open record"
                      disabled={disableRecordPanel}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Checkbox - sticky on all screen sizes */}
                  <div
                    className={cn(
                      "flex-shrink-0 border-r border-gray-100 flex items-center justify-center sticky z-10",
                      stickyBgClass,
                      stickyHoverClass
                    )}
                    style={{ width: FROZEN_COLUMN_WIDTH, height: effectiveRowHeight, left: OPEN_RECORD_COLUMN_WIDTH }}
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
                    className={cn(
                      "flex-shrink-0 border-r border-gray-100 flex items-center justify-center text-xs text-gray-400 font-medium sticky z-10",
                      stickyBgClass,
                      stickyHoverClass
                    )}
                    style={{
                      width: FROZEN_COLUMN_WIDTH,
                      height: effectiveRowHeight,
                      left: OPEN_RECORD_COLUMN_WIDTH + FROZEN_COLUMN_WIDTH,
                    }}
                  >
                    {actualIndex + 1}
                  </div>

                  {/* Cells */}
                  {visibleFields.map((field) => {
                    const width = columnWidths[field.name] || COLUMN_DEFAULT_WIDTH
                    const isCellSelected =
                      selectedCell?.rowId === row.id && selectedCell?.fieldName === field.name
                    const isColumnSelected = selectedColumnId === field.id
                    const wrapText = columnWrapText[field.name] || false

                    return (
                      <div
                        key={field.name}
                        data-grid-cell="true"
                        data-row-id={row.id}
                        data-field-name={field.name}
                        className={`border-r border-gray-100/50 relative flex items-center overflow-hidden ${
                          isColumnSelected 
                            ? 'bg-blue-100/50 ring-1 ring-blue-400/30 ring-inset' 
                            : isCellSelected 
                              ? 'bg-blue-50/50 ring-1 ring-blue-400/30 ring-inset' 
                              : fillTargetRowIds.has(row.id) && fillSource?.fieldName === field.name
                                ? 'bg-green-50 ring-1 ring-green-400/30 ring-inset'
                                : ''
                        }`}
                        style={{ width, height: effectiveRowHeight, maxHeight: effectiveRowHeight }}
                        onClick={(e) => {
                          // Single click: select cell and copy value
                          setSelectedCell({ rowId: row.id, fieldName: field.name })
                          setSelectedColumnId(null)
                          
                          // Copy cell value to clipboard
                          const fieldObj = fields.find(f => f.name === field.name)
                          const textToCopy = formatCellValue(row[field.name], fieldObj)
                          if (textToCopy) {
                            navigator.clipboard.writeText(textToCopy).catch(err => {
                              console.error('Failed to copy:', err)
                            })
                          }
                          
                          // Store for drag-to-fill
                          setFillSource({ rowId: row.id, fieldName: field.name, value: row[field.name] })
                        }}
                        onDoubleClick={(e) => {
                          // Prevent row double-click from opening record when interacting with a cell.
                          e.stopPropagation()
                          // Double-click: start editing (handled by CellFactory)
                        }}
                      >
                        <CellContextMenu
                          value={row[field.name]}
                          fieldName={field.name}
                          editable={editable && !field.options?.read_only}
                          onCopy={() => {
                            const fieldObj = fields.find(f => f.name === field.name)
                            const textToCopy = formatCellValue(row[field.name], fieldObj)
                            if (textToCopy) {
                              navigator.clipboard.writeText(textToCopy)
                            }
                          }}
                          onPaste={async () => {
                            try {
                              const text = await navigator.clipboard.readText()
                              if (text) {
                                const fieldObj = fields.find(f => f.name === field.name)
                                const cellSelection: Selection = {
                                  type: 'cell',
                                  rowId: row.id,
                                  columnId: fieldObj?.id || '',
                                  fieldName: field.name,
                                }
                                await dataView.paste(cellSelection, text)
                              }
                            } catch (err) {
                              console.error('Failed to paste:', err)
                            }
                          }}
                          formatValue={(val) => formatCellValue(val, fields.find(f => f.name === field.name))}
                        >
                          <div className="w-full h-full flex items-center overflow-hidden relative group">
                            <CellFactory
                              field={field}
                              value={row[field.name]}
                              rowId={row.id}
                              tableName={tableName}
                              editable={editable && !field.options?.read_only}
                              wrapText={wrapText}
                              rowHeight={effectiveRowHeight}
                              onSave={(value) => handleCellSave(row.id, field.name, value)}
                              onFieldOptionsUpdate={onTableFieldsRefresh}
                              isCellSelected={isCellSelected}
                            />
                            {isCellSelected && editable && !field.options?.read_only && (
                              <FillHandle
                                sourceRowId={row.id}
                                fieldName={field.name}
                                isVisible={true}
                                onDragTargetsChange={setFillTargetRowIds}
                                onFill={async (targetRowIds) => {
                                  const sourceValue = row[field.name]
                                  const updates = targetRowIds.map(targetRowId => ({
                                    rowId: targetRowId,
                                    fieldName: field.name,
                                    value: sourceValue,
                                  }))
                                  
                                  try {
                                    await Promise.all(
                                      updates.map(update => handleCellSave(update.rowId, update.fieldName, update.value))
                                    )
                                    setFillTargetRowIds(new Set())
                                  } catch (err) {
                                    console.error('Error filling cells:', err)
                                  }
                                }}
                              />
                            )}
                          </div>
                        </CellContextMenu>
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

      {/* Field Builder Modal for Insert Left/Right */}
      {tableId && (
        <FieldBuilderModal
          isOpen={fieldBuilderOpen}
          onClose={() => {
            setFieldBuilderOpen(false)
            setInsertTargetField(null)
          }}
          tableId={tableId}
          field={null}
          onSave={handleFieldSave}
          tableFields={safeFields}
        />
      )}
    </div>
  )
}
