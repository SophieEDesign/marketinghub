"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import React from "react"
import { supabase } from "@/lib/supabase/client"
import { Plus, ChevronDown, ChevronRight, Edit, Copy, ArrowLeft, ArrowRight, Link, Info, Lock, Filter, Group, Eye, EyeOff, Trash2, ArrowUpDown, GripVertical } from "lucide-react"
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
import Cell from "./Cell"
import { CellFactory } from "./CellFactory"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import type { TableField } from "@/types/fields"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import { SkeletonLoader } from "@/components/ui/SkeletonLoader"
import EmptyTableState from "@/components/empty-states/EmptyTableState"
import { computeFormulaFields } from "@/lib/formulas/computeFormulaFields"
import { applyFiltersToQuery, deriveDefaultValuesFromFilters, type FilterConfig } from "@/lib/interface/filters"
import type { FilterTree } from "@/lib/filters/canonical-model"
import { asArray } from "@/lib/utils/asArray"
import { sortRowsByFieldType, shouldUseClientSideSorting } from "@/lib/sorting/fieldTypeAwareSort"
import { resolveChoiceColor, normalizeHexColor } from '@/lib/field-colors'
import { getRowHeightPixels } from "@/lib/grid/row-height-utils"
import { useIsMobile } from "@/hooks/useResponsive"
import { createClient } from "@/lib/supabase/client"
import { buildSelectClause, toPostgrestColumn } from "@/lib/supabase/postgrest"
import { generateAddColumnSQL } from "@/lib/fields/sqlGenerator"
import { buildGroupTree, flattenGroupTree } from "@/lib/grouping/groupTree"
import type { GroupRule } from "@/lib/grouping/types"
import { isAbortError } from "@/lib/api/error-handling"
import { normalizeUuid } from "@/lib/utils/ids"
import type { LinkedField } from "@/types/fields"
import { resolveLinkedFieldDisplayMap } from "@/lib/dataView/linkedFields"
import { debugLog, debugWarn, debugError } from "@/lib/interface/debug-flags"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
  filterTree?: FilterTree // Canonical filter tree from filter blocks (supports groups/OR)
  viewSorts?: Array<{
    field_name: string
    direction: string
  }>
  searchTerm?: string
  groupBy?: string
  /** Nested grouping rules (preferred). If omitted, falls back to `groupBy`. */
  groupByRules?: GroupRule[]
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
  onTableFieldsRefresh?: () => void // Refresh tableFields after option updates (select/multi-select)
  /** Bump to force a refetch (e.g. after external record creation). */
  reloadKey?: number
  /** When grouping, should groups start collapsed? Default: true (closed). */
  defaultGroupsCollapsed?: boolean
  /** Optional callback to create a filter (for "Filter by this field" action) */
  onFilterCreate?: (filter: { field_name: string; operator: string; value?: string }) => Promise<void>
  /** Optional callback to change groupBy (for "Group by this field" action) */
  onGroupByChange?: (fieldName: string | null) => Promise<void>
  /** Callback when block content height changes (for grouped blocks) */
  onHeightChange?: (height: number) => void
  /** Row height in pixels (for height calculation) */
  rowHeight?: number
}

const ITEMS_PER_PAGE = 100

function shallowEqualRecordNumber(a: Record<string, number>, b: Record<string, number>): boolean {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (const k of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false
    if (a[k] !== b[k]) return false
  }
  return true
}

function arrayShallowEqual(a: string[], b: string[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function collectLinkedIds(raw: unknown): string[] {
  if (raw == null) return []
  if (Array.isArray(raw)) return raw.flatMap(collectLinkedIds)
  if (typeof raw === "object") {
    if (raw && "id" in raw) return [String((raw as { id: unknown }).id)]
    return []
  }
  const s = String(raw).trim()
  return s ? [s] : []
}

function extractCurlyFieldRefs(formula: string): string[] {
  if (!formula || typeof formula !== 'string') return []
  const refs: string[] = []
  try {
    for (const match of formula.matchAll(/\{([^}]+)\}/g)) {
      const ref = (match[1] || '').trim()
      if (ref) refs.push(ref)
    }
  } catch {
    // ignore
  }
  return refs
}

function extractMissingColumnFromError(err: unknown): string | null {
  const errorObj = err as { message?: string; details?: string; hint?: string; error?: { message?: string }; error_description?: string; cause?: { message?: string } } | null
  const candidates = [
    errorObj?.message,
    errorObj?.details,
    errorObj?.hint,
    errorObj?.error?.message,
    errorObj?.error_description,
    errorObj?.cause?.message,
  ]
    .filter(Boolean)
    .map((x) => String(x).trim())
    .filter((x) => x.length > 0)

  const msg = candidates.join("\n").trim()
  if (!msg) return null

  // Postgres:
  // - column "theme" does not exist
  // - column table_x.theme does not exist
  // - column table_x."Theme" does not exist
  const m1 = msg.match(/column\s+["]?([a-zA-Z0-9_]+)["]?\s+does\s+not\s+exist/i)
  if (m1?.[1]) return m1[1]
  const m2 = msg.match(/column\s+[a-zA-Z0-9_]+\.(?:"([^"]+)"|([a-zA-Z0-9_]+))\s+does\s+not\s+exist/i)
  if (m2?.[1] || m2?.[2]) return m2[1] || m2[2]

  // PostgREST:
  // - Could not find the 'name' column of 'table_x' in the schema cache
  const m3 = msg.match(/Could not find the '([^']+)' column/i)
  if (m3?.[1]) return m3[1]

  // Additional patterns for 400 errors:
  // - column reference "column_name" is ambiguous
  // - invalid input syntax for type
  // - syntax error at or near
  const m4 = msg.match(/column\s+["']?([a-zA-Z0-9_]+)["']?/i)
  if (m4?.[1] && (msg.includes('does not exist') || msg.includes('not found') || msg.includes('invalid'))) {
    return m4[1]
  }

  return null
}

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
  isFrozen = false,
  frozenLeft,
  isFirstColumn = false,
  onSort,
  onFilter,
  onGroup,
  onHide,
  onDuplicate,
  onInsertLeft,
  onInsertRight,
  onDelete,
  onCopyUrl,
  onEditDescription,
  onEditPermissions,
  onChangePrimary,
  currentSortDirection,
  isGroupedBy,
  isFilteredBy,
  isHidden,
  onSelect,
  isSelected = false,
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
  isFrozen?: boolean
  frozenLeft?: number
  isFirstColumn?: boolean
  onSort?: (fieldName: string, direction: 'asc' | 'desc' | null) => void
  onFilter?: (fieldName: string) => void
  onGroup?: (fieldName: string) => void
  onHide?: (fieldName: string) => void
  onDuplicate?: (fieldName: string) => void
  onInsertLeft?: (fieldName: string) => void
  onInsertRight?: (fieldName: string) => void
  onDelete?: (fieldName: string) => void
  onCopyUrl?: (fieldName: string) => void
  onEditDescription?: (fieldName: string) => void
  onEditPermissions?: (fieldName: string) => void
  onChangePrimary?: (fieldName: string) => void
  currentSortDirection?: 'asc' | 'desc' | null
  isGroupedBy?: boolean
  isFilteredBy?: boolean
  isHidden?: boolean
  onSelect?: (fieldName: string) => void
  isSelected?: boolean
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

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    width: `${width}px`,
    minWidth: `${width}px`,
    maxWidth: `${width}px`,
  }
  
  // Apply frozen column sticky positioning
  if (isFrozen && frozenLeft !== undefined) {
    style.position = 'sticky'
    style.left = `${frozenLeft}px`
    style.zIndex = 20
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

  const [dropdownOpen, setDropdownOpen] = useState(false)

  return (
    <th
      ref={setNodeRef}
      style={style}
      className={`px-2 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider sticky top-0 transition-colors relative ${
        isFrozen ? 'z-20' : 'z-10'
      } group ${
        isSelected 
          ? 'bg-blue-100 ring-2 ring-blue-500' 
          : 'bg-gray-50 hover:bg-gray-100'
      }`}
    >
      <div className="flex items-center justify-between gap-1 w-full">
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="flex items-center justify-center w-4 h-full cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 flex-shrink-0"
        >
          <GripVertical className="h-3 w-3" />
        </div>
        
        {/* Column name - clickable to select column (entire area) */}
        <div
          className={`flex-1 text-left px-2 py-1 rounded transition-colors flex items-center gap-1 min-w-0 cursor-pointer ${
            isSelected 
              ? 'bg-blue-100 ring-2 ring-blue-500 font-semibold' 
              : 'hover:bg-gray-100/50'
          }`}
          onClick={(e) => {
            e.stopPropagation()
            // Select column when clicking anywhere on the name area
            if (onSelect) {
              onSelect(fieldName)
            }
          }}
          title={
            tableField && 
            typeof tableField === 'object' &&
            tableField.type === 'formula' && 
            tableField.options && 
            typeof tableField.options === 'object' &&
            tableField.options.formula &&
            typeof tableField.options.formula === 'string'
              ? `Formula: ${tableField.options.formula}` 
              : 'Click to select column'
          }
        >
          <span className="truncate font-medium">
            {fieldName || 'Unknown Field'}
          </span>
          {isVirtual && (
            <span className="ml-1 text-xs text-gray-400 flex-shrink-0" title="Formula field">(fx)</span>
          )}
          {tableField && 
           typeof tableField === 'object' &&
           tableField.required === true && (
            <span className="text-red-500 text-xs ml-1 flex-shrink-0">*</span>
          )}
        </div>

        {/* Chevron dropdown trigger - separate clickable area with padding for easier clicking */}
        <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <button
              className="px-1.5 py-1 rounded hover:bg-gray-100/50 transition-colors flex items-center justify-center flex-shrink-0"
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
              <DropdownMenuItem onClick={() => { onEdit(fieldName); setDropdownOpen(false); }}>
                <Edit className="h-4 w-4 mr-2" />
                Edit field
              </DropdownMenuItem>
            )}
            {onDuplicate && !isVirtual && (
              <DropdownMenuItem onClick={() => { onDuplicate(fieldName); setDropdownOpen(false); }}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate field
              </DropdownMenuItem>
            )}
            {onInsertLeft && (
              <DropdownMenuItem onClick={() => { onInsertLeft(fieldName); setDropdownOpen(false); }}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Insert left
              </DropdownMenuItem>
            )}
            {onInsertRight && (
              <DropdownMenuItem onClick={() => { onInsertRight(fieldName); setDropdownOpen(false); }}>
                <ArrowRight className="h-4 w-4 mr-2" />
                Insert right
              </DropdownMenuItem>
            )}
            {onCopyUrl && (
              <DropdownMenuItem onClick={() => { onCopyUrl(fieldName); setDropdownOpen(false); }}>
                <Link className="h-4 w-4 mr-2" />
                Copy field URL
              </DropdownMenuItem>
            )}
            {onEditDescription && (
              <DropdownMenuItem onClick={() => { onEditDescription(fieldName); setDropdownOpen(false); }}>
                <Info className="h-4 w-4 mr-2" />
                Edit field description
              </DropdownMenuItem>
            )}
            {onEditPermissions && (
              <DropdownMenuItem onClick={() => { onEditPermissions(fieldName); setDropdownOpen(false); }}>
                <Lock className="h-4 w-4 mr-2" />
                Edit field permissions
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {onSort && (
              <>
                <DropdownMenuItem onClick={() => { onSort(fieldName, 'asc'); setDropdownOpen(false); }}>
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  Sort First → Last
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { onSort(fieldName, 'desc'); setDropdownOpen(false); }}>
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  Sort Last → First
                </DropdownMenuItem>
              </>
            )}
            {onFilter && (
              <DropdownMenuItem onClick={() => { onFilter(fieldName); setDropdownOpen(false); }}>
                <Filter className="h-4 w-4 mr-2" />
                Filter by this field
              </DropdownMenuItem>
            )}
            {onGroup && (
              <DropdownMenuItem onClick={() => { onGroup(fieldName); setDropdownOpen(false); }}>
                <Group className="h-4 w-4 mr-2" />
                Group by this field
              </DropdownMenuItem>
            )}
            {onHide && (
              <DropdownMenuItem onClick={() => { onHide(fieldName); setDropdownOpen(false); }}>
                {isHidden ? (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Show field
                  </>
                ) : (
                  <>
                    <EyeOff className="h-4 w-4 mr-2" />
                    Hide field
                  </>
                )}
              </DropdownMenuItem>
            )}
            {onDelete && !isVirtual && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => { onDelete(fieldName); setDropdownOpen(false); }}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete field
                </DropdownMenuItem>
              </>
            )}
            {onChangePrimary && isFirstColumn && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { onChangePrimary(fieldName); setDropdownOpen(false); }}>
                  Change primary field
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
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
  filterTree = null,
  viewSorts = [],
  searchTerm = "",
  groupBy,
  groupByRules,
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
  onTableFieldsRefresh,
  reloadKey,
  defaultGroupsCollapsed = true,
  onFilterCreate,
  onGroupByChange,
  onHeightChange,
  rowHeight = 30,
}: GridViewProps) {
  const { openRecord } = useRecordPanel()
  const isMobile = useIsMobile()
  const [rows, setRows] = useState<Record<string, any>[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [tableError, setTableError] = useState<string | null>(null)
  // Non-fatal warnings (e.g. view references columns that no longer exist, but we can still load rows)
  const [tableWarning, setTableWarning] = useState<string | null>(null)
  // Whether the underlying physical table is missing (as opposed to a view/column mismatch)
  const [isMissingPhysicalTable, setIsMissingPhysicalTable] = useState(false)
  const [initializingFields, setInitializingFields] = useState(false)
  const [columnOrder, setColumnOrder] = useState<string[]>([])
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [resizingColumn, setResizingColumn] = useState<string | null>(null)
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({})
  const [hoverResizeRowId, setHoverResizeRowId] = useState<string | null>(null)
  const [resizeLineTop, setResizeLineTop] = useState<number | null>(null)
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [selectedColumnName, setSelectedColumnName] = useState<string | null>(null)
  const [frozenColumns, setFrozenColumns] = useState<number>(0) // Number of columns to freeze (typically 1 for first column)
  const [showRequiredFieldsConfirm, setShowRequiredFieldsConfirm] = useState(false)
  const [showDeleteFieldConfirm, setShowDeleteFieldConfirm] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null)
  const [fieldToDelete, setFieldToDelete] = useState<string | null>(null)
  const [missingRequiredFields, setMissingRequiredFields] = useState<string[]>([])

  // Track previous groupBy to detect changes
  const prevGroupByRef = useRef<string | undefined>(groupBy)
  // Track whether we've initialized collapsed groups for the current groupBy
  const didInitGroupCollapseRef = useRef(false)
  // Ref for measuring content height
  const contentRef = useRef<HTMLDivElement>(null)

  // Prevent runaway "create table" loops on repeated errors.
  // (E.g. when the error is actually a missing column, not a missing table.)
  const createTableAttemptedRef = useRef<Set<string>>(new Set())
  // If we detect a schema mismatch (e.g. view references a missing column), force future loads to use `select('*')`
  // to avoid repeated failing "minimal select" attempts on every re-render.
  const forceStarSelectRef = useRef<Set<string>>(new Set())
  // Track schema sync attempts to avoid repeated calls
  const schemaSyncAttemptedRef = useRef<Set<string>>(new Set())
  // Some environments created tables with `record_id` instead of `id`.
  // Track the actual row identifier column per physical table to avoid hard-coding `id` everywhere.
  const rowIdColumnByTableRef = useRef<Map<string, string>>(new Map())

  const getRowIdColumn = useCallback(() => {
    const key = String(supabaseTableName || '').trim()
    if (!key) return 'id'
    return rowIdColumnByTableRef.current.get(key) || 'id'
  }, [supabaseTableName])

  const normalizeRowsWithId = useCallback(
    (data: Record<string, any>[]) => {
      const rowIdColumn = getRowIdColumn()
      if (!Array.isArray(data) || data.length === 0) return data

      // Detect id column from returned data (most reliable).
      const sample = data[0] || {}
      const detected =
        typeof sample === 'object' && sample
          ? ('id' in sample ? 'id' : 'record_id' in sample ? 'record_id' : rowIdColumn)
          : rowIdColumn

      const key = String(supabaseTableName || '').trim()
      if (key) rowIdColumnByTableRef.current.set(key, detected)

      // Ensure callers can rely on `row.id` for UI identity.
      if (detected !== 'id') {
        return data.map((r) => {
          if (r && typeof r === 'object' && r.id == null && (r as any)[detected] != null) {
            return { ...r, id: (r as any)[detected] }
          }
          return r
        })
      }

      return data
    },
    [getRowIdColumn, supabaseTableName]
  )

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const COLUMN_DEFAULT_WIDTH = 200
  const COLUMN_MIN_WIDTH = 100
  const MIN_ROW_HEIGHT_PX = 32
  const RESIZE_HITBOX_PX = 4

  const rowHeightsStorageKey = useMemo(() => {
    // Per-view when available; otherwise per table instance (still not global).
    if (viewId && String(viewId).trim().length > 0) return `mh:gridRowHeights:view:${viewId}`
    const t = tableId || 'unknown-table'
    const n = supabaseTableName || 'unknown-name'
    return `mh:gridRowHeights:table:${t}:${n}`
  }, [supabaseTableName, tableId, viewId])

  // IMPORTANT: `viewId` can sometimes be a composite like "<uuid>:<index>".
  // Only use a real UUID for DB queries; otherwise fall back to localStorage-only behaviour.
  const viewUuid = useMemo(() => normalizeUuid(viewId), [viewId])

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isResizingRowRef = useRef(false)
  const resizingRowIdRef = useRef<string | null>(null)
  const resizeStartYRef = useRef(0)
  const resizeStartHeightRef = useRef(0)

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
  // CRITICAL: Optional-safe access to field options and metadata
  const getRowColor = useCallback((row: Record<string, any>): string | null => {
    if (!colorField || typeof colorField !== 'string') return null
    
    if (!Array.isArray(safeTableFields) || safeTableFields.length === 0) return null
    
    const colorFieldObj = safeTableFields.find(f => 
      f && 
      typeof f === 'object' && 
      (f.name === colorField || f.id === colorField)
    )
    
    if (!colorFieldObj || 
        typeof colorFieldObj !== 'object' ||
        (colorFieldObj.type !== 'single_select' && colorFieldObj.type !== 'multi_select')) {
      return null
    }
    
    const colorValue = row && typeof row === 'object' ? row[colorField] : undefined
    if (!colorValue || 
        !(colorFieldObj.type === 'single_select' || colorFieldObj.type === 'multi_select')) {
      return null
    }
    
    const normalizedValue = String(colorValue).trim()
    
    // CRITICAL: Optional-safe access to options
    const fieldOptions = colorFieldObj.options && typeof colorFieldObj.options === 'object'
      ? colorFieldObj.options
      : undefined
    
    return normalizeHexColor(
      resolveChoiceColor(
        normalizedValue,
        colorFieldObj.type,
        fieldOptions,
        colorFieldObj.type === 'single_select'
      )
    )
  }, [colorField, safeTableFields])

  // Helper to get image from image field
  // CRITICAL: Optional-safe access to row data
  const getRowImage = useCallback((row: Record<string, any>): string | null => {
    if (!imageField || typeof imageField !== 'string') return null
    
    if (!row || typeof row !== 'object') return null
    
    const imageValue = row[imageField]
    if (!imageValue) return null
    
    // Handle attachment field (array of URLs) or URL field (single URL)
    if (Array.isArray(imageValue) && imageValue.length > 0) {
      const firstValue = imageValue[0]
      if (typeof firstValue === 'string' && firstValue.length > 0) {
        return firstValue
      }
      return null
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

  const getEffectiveRowHeight = useCallback((rowId: string | null | undefined) => {
    if (!rowId) return rowHeightPixels
    const override = rowHeights[rowId]
    if (typeof override === 'number' && Number.isFinite(override) && override > 0) {
      return Math.max(MIN_ROW_HEIGHT_PX, Math.round(override))
    }
    return rowHeightPixels
  }, [rowHeights, rowHeightPixels])

  // Defensive logging (temporary - remove after fixing all upstream issues)
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    // Removed debug console.log - use React DevTools to inspect props
    //   rows: Array.isArray(rows),
    //   viewFields: Array.isArray(viewFields),
    //   tableFields: Array.isArray(tableFields),
    //   viewFilters: Array.isArray(viewFilters),
    //   filters: Array.isArray(filters),
    //   viewSorts: Array.isArray(viewSorts),
    // })
  }

  // Load column order and widths from grid_view_settings
  // NOTE: upstream props can be recreated each render (new array identities).
  // Use a stable "content key" to avoid an update loop (React error #185).
  const columnSettingsKey = useMemo(() => {
    // IMPORTANT: Make this key order-insensitive.
    // Some upstream queries can return the same rows in different orders; if we bake that order into
    // a key used by a setState effect, we can create an infinite render loop (React #185).
    const visible = Array.isArray(safeViewFields)
      ? safeViewFields
          .filter((f) => f && typeof f === 'object' && f.visible === true && typeof f.field_name === 'string')
          .map((f) => String(f.field_name))
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b))
      : []

    const fieldsMinimal = Array.isArray(safeTableFields)
      ? safeTableFields
          .map((f: TableField) => ({
            id: f?.id ?? null,
            name: f?.name ?? null,
            order_index: f?.order_index ?? f?.position ?? null,
          }))
          .sort((a, b) => {
            const ak = String(a.id ?? a.name ?? '')
            const bk = String(b.id ?? b.name ?? '')
            return ak.localeCompare(bk)
          })
      : []

    return JSON.stringify({ viewId, visible, fieldsMinimal })
  }, [viewId, safeViewFields, safeTableFields])

  useEffect(() => {
    if (safeTableFields.length === 0) return

    // Local fallback when viewId is not set (e.g. block-backed tables without views enabled).
    if (!viewUuid) {
      try {
        const raw = localStorage.getItem(rowHeightsStorageKey)
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, number>
          const sanitized: Record<string, number> = {}
          for (const [k, v] of Object.entries(parsed || {})) {
            if (typeof k !== 'string' || k.trim().length === 0) continue
            if (typeof v !== 'number' || !Number.isFinite(v)) continue
            sanitized[k] = Math.max(MIN_ROW_HEIGHT_PX, Math.round(v))
          }
          setRowHeights(sanitized)
        }
      } catch {
        // ignore
      }
      return
    }

    async function loadColumnSettings() {
      try {
        const supabase = createClient()
        let { data, error } = await supabase
          .from('grid_view_settings')
          .select('column_order, column_widths, row_heights, frozen_columns')
          .eq('view_id', viewUuid)
          .maybeSingle()

        // Backward compatibility: older schemas won't have row_heights or frozen_columns yet.
        if (error && ((error as any)?.code === '42703' || String((error as any)?.message || '').includes('row_heights') || String((error as any)?.message || '').includes('frozen_columns'))) {
          const retry = await supabase
            .from('grid_view_settings')
            .select('column_order, column_widths')
            .eq('view_id', viewUuid)
            .maybeSingle()
          data = retry.data as any
          error = retry.error as any
        }

        if (error && error.code !== 'PGRST116') {
          debugError('LAYOUT', 'Error loading column settings:', error)
          return
        }

        // Load column widths - CRITICAL: Sanitize persisted state
        if (data?.column_widths && typeof data.column_widths === 'object' && data.column_widths !== null) {
          // Filter out invalid entries (non-string keys, non-number values)
          const sanitizedWidths: Record<string, number> = {}
          for (const [key, value] of Object.entries(data.column_widths)) {
            if (typeof key === 'string' && key.length > 0 && typeof value === 'number' && value > 0) {
              sanitizedWidths[key] = value
            }
          }
          setColumnWidths((prev) => (shallowEqualRecordNumber(prev, sanitizedWidths) ? prev : sanitizedWidths))
        }

        // Load row heights - CRITICAL: Sanitize persisted state
        if (data?.row_heights && typeof data.row_heights === 'object' && data.row_heights !== null) {
          const sanitizedHeights: Record<string, number> = {}
          for (const [key, value] of Object.entries(data.row_heights as any)) {
            if (typeof key !== 'string' || key.trim().length === 0) continue
            if (typeof value !== 'number' || !Number.isFinite(value)) continue
            // Clamp to minimum; leave upper bound unconstrained (Airtable-like).
            sanitizedHeights[key] = Math.max(MIN_ROW_HEIGHT_PX, Math.round(value))
          }
          setRowHeights((prev) => (shallowEqualRecordNumber(prev, sanitizedHeights) ? prev : sanitizedHeights))
          try {
            localStorage.setItem(rowHeightsStorageKey, JSON.stringify(sanitizedHeights))
          } catch {
            // ignore
          }
        }

        // Load frozen columns
        if (typeof data?.frozen_columns === 'number' && data.frozen_columns >= 0) {
          setFrozenColumns(data.frozen_columns)
        }

        // Load column order - CRITICAL: Validate against current fields
        if (data?.column_order && Array.isArray(data.column_order)) {
          // Sanitize: filter out null/undefined/empty strings
          const sanitizedOrder = data.column_order
            .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
          
          // Get current visible field names
          const allFieldNames = Array.isArray(safeViewFields)
            ? safeViewFields
                .filter((f) => f && typeof f === 'object' && f.visible === true && f.field_name)
                .map((f) => f.field_name)
                .filter((name): name is string => typeof name === 'string' && name.length > 0)
            : []
          
          // Validate that all fields in persisted order still exist
          const validOrder = sanitizedOrder.filter(name => allFieldNames.includes(name))
          
          if (validOrder.length > 0 && validOrder.length === sanitizedOrder.length) {
            // All fields in order are valid - use it
            // Add any missing fields to the end
            const missingFields = allFieldNames.filter(name => !validOrder.includes(name))
            const nextOrder = [...validOrder, ...missingFields]
            setColumnOrder((prev) => (arrayShallowEqual(prev, nextOrder) ? prev : nextOrder))
          } else {
            // Some fields in order are stale - rebuild from current fields
            initializeColumnOrder()
          }
        } else {
          initializeColumnOrder()
        }
      } catch (error) {
        debugError('LAYOUT', 'Error loading column settings:', error)
        initializeColumnOrder()
      }
    }

    function initializeColumnOrder() {
      // CRITICAL: Defensive initialization - filter out invalid fields
      if (!Array.isArray(safeViewFields) || safeViewFields.length === 0) {
        setColumnOrder((prev) => (prev.length === 0 ? prev : []))
        return
      }
      
      const safeFields = Array.isArray(safeTableFields) ? safeTableFields : []
      
      const visibleFieldNames = safeViewFields
        .filter((f) => {
          // Filter out null/undefined and ensure field has required properties
          return f && 
                 typeof f === 'object' && 
                 f.visible === true && 
                 f.field_name && 
                 typeof f.field_name === 'string'
        })
        .map((vf) => {
          // Find table field for order_index
          const tableField = safeFields.find((tf) => 
            tf && 
            typeof tf === 'object' && 
            (tf.name === vf.field_name || tf.id === vf.field_name)
          )
          
          return {
            field_name: vf.field_name,
            order_index: tableField?.order_index ?? tableField?.position ?? vf.position ?? 0,
          }
        })
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
        .map((f) => f.field_name)
        .filter((name): name is string => typeof name === 'string' && name.length > 0)
      
      setColumnOrder((prev) => (arrayShallowEqual(prev, visibleFieldNames) ? prev : visibleFieldNames))
    }

    loadColumnSettings()
  }, [viewUuid, columnSettingsKey, rowHeightsStorageKey])

  // Persist row heights locally as a safety net (and as primary store when viewId is absent).
  useEffect(() => {
    try {
      localStorage.setItem(rowHeightsStorageKey, JSON.stringify(rowHeights))
    } catch {
      // ignore
    }
  }, [rowHeights, rowHeightsStorageKey])

  // Save column order and widths to grid_view_settings
  useEffect(() => {
    if (!viewUuid || columnOrder.length === 0) return

    async function saveColumnSettings() {
      try {
        const supabase = createClient()
        const { data: existing } = await supabase
          .from('grid_view_settings')
          .select('id')
          .eq('view_id', viewUuid)
          .maybeSingle()

        const settingsData = {
          column_order: columnOrder,
          column_widths: columnWidths,
          row_heights: rowHeights,
          frozen_columns: frozenColumns,
        }

        const tryUpdateOrInsert = async (payload: Record<string, unknown>) => {
          if (existing) {
            return await supabase.from('grid_view_settings').update(payload).eq('view_id', viewUuid)
          }
          return await supabase.from('grid_view_settings').insert([{
            view_id: viewUuid,
            ...payload,
            column_wrap_text: {},
            row_height: 'medium',
            frozen_columns: frozenColumns,
          }])
        }

        const res = await tryUpdateOrInsert(settingsData)
        // Backward compatibility: older schemas won't have row_heights yet.
        const errorObj = res?.error as { code?: string; message?: string } | null
        if (res?.error && (errorObj?.code === '42703' || String(errorObj?.message || '').includes('row_heights'))) {
          const { row_heights, ...withoutRowHeights } = settingsData as Record<string, unknown>
          await tryUpdateOrInsert(withoutRowHeights)
        }
      } catch (error) {
        debugError('LAYOUT', 'Error saving column settings:', error)
      }
    }

    // Debounce saves to avoid too many database calls
    const timeoutId = setTimeout(saveColumnSettings, 500)
    return () => clearTimeout(timeoutId)
  }, [columnOrder, columnWidths, rowHeights, frozenColumns, viewUuid])

  const startRowResize = useCallback((rowId: string, startHeight: number, startClientY: number) => {
    if (isMobile) return
    if (!rowId) return

    isResizingRowRef.current = true
    resizingRowIdRef.current = rowId
    resizeStartYRef.current = startClientY
    resizeStartHeightRef.current = startHeight

    const prevCursor = document.body.style.cursor
    const prevUserSelect = document.body.style.userSelect
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRowRef.current || resizingRowIdRef.current !== rowId) return
      const diff = e.clientY - resizeStartYRef.current
      const next = Math.max(MIN_ROW_HEIGHT_PX, Math.round(resizeStartHeightRef.current + diff))
      setRowHeights((prev) => ({ ...prev, [rowId]: next }))
    }

    const handleMouseUp = () => {
      isResizingRowRef.current = false
      resizingRowIdRef.current = null
      document.body.style.cursor = prevCursor
      document.body.style.userSelect = prevUserSelect
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [isMobile])

  const resetRowHeight = useCallback((rowId: string) => {
    if (!rowId) return
    setRowHeights((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, rowId)) return prev
      const next = { ...prev }
      delete next[rowId]
      return next
    })
  }, [])

  const handleRowResizeHover = useCallback((e: React.MouseEvent) => {
    if (isMobile) return
    if (isResizingRowRef.current) return
    const container = scrollContainerRef.current
    if (!container) return

    const target = e.target as HTMLElement | null
    const tr = target?.closest?.('tr[data-rowid="true"]') as HTMLTableRowElement | null
    if (!tr) {
      if (hoverResizeRowId) setHoverResizeRowId(null)
      if (resizeLineTop != null) setResizeLineTop(null)
      return
    }

    const rowId = tr.getAttribute('data-row-key') || ''
    if (!rowId) return

    const rowRect = tr.getBoundingClientRect()
    const distToBottom = Math.abs(e.clientY - rowRect.bottom)
    if (distToBottom > RESIZE_HITBOX_PX) {
      if (hoverResizeRowId) setHoverResizeRowId(null)
      if (resizeLineTop != null) setResizeLineTop(null)
      return
    }

    const containerRect = container.getBoundingClientRect()
    const topWithinScroll = (rowRect.bottom - containerRect.top) + container.scrollTop

    if (hoverResizeRowId !== rowId) setHoverResizeRowId(rowId)
    if (resizeLineTop !== topWithinScroll) setResizeLineTop(topWithinScroll)
  }, [hoverResizeRowId, isMobile, resizeLineTop])

  const handleRowResizeMouseLeave = useCallback(() => {
    if (isResizingRowRef.current) return
    setHoverResizeRowId(null)
    setResizeLineTop(null)
  }, [])

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
  // CRITICAL: Always return an array, filter out null/undefined, ensure field_name exists
  // IMPORTANT: Only include fields that exist in tableFields to prevent querying non-existent columns
  const visibleFields = useMemo(() => {
    // Defensive guard: Ensure safeViewFields is an array
    if (!Array.isArray(safeViewFields) || safeViewFields.length === 0) {
      return []
    }

    // Defensive guard: Ensure safeTableFields is an array
    const safeFields = Array.isArray(safeTableFields) ? safeTableFields : []
    
    // Build a set of valid field names from tableFields for fast lookup
    const validFieldNames = new Set<string>()
    const validFieldIds = new Set<string>()
    for (const tf of safeFields) {
      if (tf && typeof tf === 'object') {
        if (tf.name && typeof tf.name === 'string') {
          validFieldNames.add(tf.name)
        }
        if (tf.id && typeof tf.id === 'string') {
          validFieldIds.add(tf.id)
        }
      }
    }
    
    // Helper to check if a field exists in tableFields
    const fieldExists = (fieldName: string): boolean => {
      return validFieldNames.has(fieldName) || validFieldIds.has(fieldName)
    }

    // Use column order if available AND valid.
    // CRITICAL: Treat a corrupt/empty order as "no order" and fall back to order_index sorting.
    const sanitizedOrder = asArray<string>(columnOrder).filter(
      (fieldName): fieldName is string => typeof fieldName === 'string' && fieldName.trim().length > 0
    )

    if (sanitizedOrder.length > 0) {
      return sanitizedOrder
        .map((fieldName) => {
          // Find view field - ensure it exists and is visible
          const vf = safeViewFields.find((f) =>
            f &&
            typeof f === 'object' &&
            f.field_name === fieldName &&
            f.visible === true
          )
          if (!vf || !vf.field_name) return null
          
          // CRITICAL: Only include fields that exist in tableFields
          if (!fieldExists(vf.field_name)) {
            debugWarn('LAYOUT', '[GridView] Filtering out view field that does not exist in tableFields:', vf.field_name)
            return null
          }

          // Find table field for metadata
          const tableField = safeFields.find((tf) =>
            tf &&
            typeof tf === 'object' &&
            (tf.name === fieldName || tf.id === fieldName)
          )

          return {
            ...vf,
            order_index: tableField?.order_index ?? tableField?.position ?? vf.position ?? 0,
          }
        })
        .filter((f): f is NonNullable<typeof f> => f !== null && f !== undefined && !!f.field_name)
    }
    
    // Fallback to order_index sorting
    // CRITICAL: Filter out null/undefined fields and ensure field_name exists
    return safeViewFields
      .filter((f) => {
        // Filter out null, undefined, and ensure field has required properties
        if (!f || typeof f !== 'object' || f.visible !== true || !f.field_name || typeof f.field_name !== 'string') {
          return false
        }
        // CRITICAL: Only include fields that exist in tableFields
        if (!fieldExists(f.field_name)) {
          debugWarn('LAYOUT', '[GridView] Filtering out view field that does not exist in tableFields:', f.field_name)
          return false
        }
        return true
      })
      .map((vf) => {
        // Find table field for metadata
        const tableField = safeFields.find((tf) => 
          tf && 
          typeof tf === 'object' && 
          (tf.name === vf.field_name || tf.id === vf.field_name)
        )
        
        return {
          ...vf,
          order_index: tableField?.order_index ?? tableField?.position ?? vf.position ?? 0,
        }
      })
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
  }, [safeViewFields, safeTableFields, columnOrder])

  // In live mode, upstream props can be recreated each render (new array identities),
  // which would repeatedly re-trigger `loadRows()` even when content is unchanged.
  // Use stable "content keys" so we only refetch when the actual data changes.
  // IMPORTANT: These keys must be order-insensitive; upstream arrays can legitimately reorder between renders
  // (e.g. due to different DB ordering, Map iteration order, or "same data different order" queries).
  // If we bake order into the key, we can create a fetch → setState → rerender → key changes → fetch loop (React #185).
  const filtersKey = useMemo(() => {
    const canonical = (safeFilters ?? [])
      .map((f: FilterConfig) => {
        const field = typeof f?.field === "string" ? f.field : ""
        const operator = typeof f?.operator === "string" ? f.operator : ""
        const valueRaw = f?.value
        const value =
          valueRaw == null
            ? ""
            : Array.isArray(valueRaw)
              ? valueRaw.map((v) => String(v)).sort().join("|")
              : String(valueRaw)
        return { field, operator, value }
      })
      .filter((f) => f.field || f.operator || f.value)
      .sort((a, b) => {
        const ak = `${a.field}\u0000${a.operator}\u0000${a.value}`
        const bk = `${b.field}\u0000${b.operator}\u0000${b.value}`
        return ak.localeCompare(bk)
      })
    return JSON.stringify(canonical)
  }, [safeFilters])

  const viewFiltersKey = useMemo(() => {
    const canonical = (safeViewFilters ?? [])
      .map((f: { field_name?: string; operator?: string; value?: unknown }) => {
        const field_name = typeof f?.field_name === "string" ? f.field_name : ""
        const operator = typeof f?.operator === "string" ? f.operator : ""
        const valueRaw = f?.value
        const value =
          valueRaw == null
            ? ""
            : Array.isArray(valueRaw)
              ? valueRaw.map((v) => String(v)).sort().join("|")
              : String(valueRaw)
        return { field_name, operator, value }
      })
      .filter((f) => f.field_name || f.operator || f.value)
      .sort((a, b) => {
        const ak = `${a.field_name}\u0000${a.operator}\u0000${a.value}`
        const bk = `${b.field_name}\u0000${b.operator}\u0000${b.value}`
        return ak.localeCompare(bk)
      })
    return JSON.stringify(canonical)
  }, [safeViewFilters])

  const viewSortsKey = useMemo(() => {
    const canonical = (safeViewSorts ?? [])
      .map((s: { field_name?: string; direction?: string }) => {
        const field_name = typeof s?.field_name === "string" ? s.field_name : ""
        const direction = typeof s?.direction === "string" ? s.direction : ""
        return { field_name, direction }
      })
      .filter((s) => s.field_name || s.direction)
      .sort((a, b) => {
        const ak = `${a.field_name}\u0000${a.direction}`
        const bk = `${b.field_name}\u0000${b.direction}`
        return ak.localeCompare(bk)
      })
    return JSON.stringify(canonical)
  }, [safeViewSorts])

  const tableFieldsKey = useMemo(() => {
    const canonical = (safeTableFields ?? [])
      .map((f: TableField) => ({
        id: f?.id ?? null,
        name: f?.name ?? null,
        type: f?.type ?? null,
      }))
      .sort((a, b) => {
        const ak = String(a.id ?? a.name ?? "")
        const bk = String(b.id ?? b.name ?? "")
        return ak.localeCompare(bk)
      })
    return JSON.stringify(canonical)
  }, [safeTableFields])

  // Prevent request storms (e.g. repeated mount/unmount in dev/StrictMode).
  // - Only allow one in-flight load at a time.
  // - If a load is requested while in-flight, queue exactly one more.
  // - After failures, apply a short exponential backoff to avoid hammering Supabase.
  const loadingRowsRef = useRef(false)
  const pendingLoadRowsRef = useRef(false)
  const loadBackoffRef = useRef<{ nextAllowedAt: number; delayMs: number }>({
    nextAllowedAt: 0,
    delayMs: 0,
  })
  // Track retry attempts per table to prevent infinite retry loops
  const retryAttemptsRef = useRef<Map<string, number>>(new Map())
  // Maximum number of retry attempts before giving up
  const MAX_RETRY_ATTEMPTS = 3

  // Handle column reorder
  // CRITICAL: Never allow drag to corrupt order (e.g. arrayMove([], -1, -1) -> [undefined]).
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event

    const activeId = typeof active?.id === 'string' ? active.id : null
    const overId = typeof over?.id === 'string' ? over.id : null
    if (!activeId || !overId || activeId === overId) return

    setColumnOrder((items) => {
      const current = asArray<string>(items).filter(
        (n): n is string => typeof n === 'string' && n.trim().length > 0
      )
      const fallback = asArray(visibleFields)
        .map((f: { field_name?: string }) => (typeof f?.field_name === 'string' ? f.field_name : ''))
        .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
      const base = current.length > 0 ? current : fallback

      if (base.length === 0) return current

      const oldIndex = base.indexOf(activeId)
      const newIndex = base.indexOf(overId)
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return base

      return arrayMove(base, oldIndex, newIndex)
    })
  }, [visibleFields])

  useEffect(() => {
    // Reset retry counter when table changes
    if (supabaseTableName) {
      const currentRetries = retryAttemptsRef.current.get(supabaseTableName)
      if (currentRetries === undefined) {
        // New table - reset retry counter
        retryAttemptsRef.current.delete(supabaseTableName)
      }
    }
    loadRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseTableName, filtersKey, viewFiltersKey, viewSortsKey, tableFieldsKey, reloadKey])

  async function loadRows() {
    // De-dupe in-flight loads (prevents hundreds of parallel requests).
    if (loadingRowsRef.current) {
      pendingLoadRowsRef.current = true
      return
    }
    const now = Date.now()
    if (loadBackoffRef.current.nextAllowedAt > now) {
      // Respect backoff window.
      return
    }

    if (!supabaseTableName) {
      setLoading(false)
      return
    }

    loadingRowsRef.current = true
    pendingLoadRowsRef.current = false
    setLoading(true)

    const bumpLoadBackoff = () => {
      const prev = loadBackoffRef.current.delayMs || 0
      const next = Math.min(prev > 0 ? prev * 2 : 500, 10_000)
      loadBackoffRef.current = {
        delayMs: next,
        nextAllowedAt: Date.now() + next,
      }
    }

    try {
      // Build a minimal select list: visible fields + any fields referenced by filters/sorts/grouping/appearance,
      // plus underlying dependencies needed to compute formula fields client-side.
      const fieldByName = new Map<string, TableField>()
      const fieldByLowerName = new Map<string, TableField>()
      for (const f of safeTableFields) {
        if (f && typeof f === 'object' && typeof f.name === 'string' && f.name.trim()) {
          fieldByName.set(f.name, f)
          fieldByLowerName.set(f.name.toLowerCase(), f)
        }
      }

      const requiredNames = new Set<string>()
      // Visible columns
      visibleFields.forEach((vf) => {
        if (vf?.field_name) requiredNames.add(vf.field_name)
      })
      // Filters / sorts / grouping
      safeFilters.forEach((f) => {
        if (f?.field) requiredNames.add(f.field)
      })
      safeViewFilters.forEach((f) => {
        if (f?.field_name) requiredNames.add(f.field_name)
      })
      safeViewSorts.forEach((s) => {
        if (s?.field_name) requiredNames.add(s.field_name)
      })
      if (groupBy) requiredNames.add(groupBy)
      if (colorField) requiredNames.add(colorField)
      if (imageField) requiredNames.add(imageField)

      // Expand formula dependencies (brace refs) for formulas that are actually needed.
      const neededFormulaNames = new Set<string>()
      const baseColumnNames = new Set<string>()

      const addBase = (name: string) => {
        if (!name) return
        const field = fieldByName.get(name) || fieldByLowerName.get(name.toLowerCase())
        // If we don't have metadata, we canâ€™t safely decide if it's virtual; skip to avoid select errors.
        // (Fields should normally be in tableFields.)
        if (!field) return
        if (field.type === 'formula') {
          neededFormulaNames.add(field.name)
          return
        }
        if (field.type === 'lookup') {
          return
        }
        baseColumnNames.add(field.name)
      }

      requiredNames.forEach(addBase)

      const visitedFormula = new Set<string>()
      const expandFormula = (formulaFieldName: string) => {
        if (!formulaFieldName || visitedFormula.has(formulaFieldName)) return
        visitedFormula.add(formulaFieldName)
        const formulaField = fieldByName.get(formulaFieldName) || fieldByLowerName.get(formulaFieldName.toLowerCase())
        const formula = formulaField?.options?.formula
        if (!formulaField || formulaField.type !== 'formula' || typeof formula !== 'string') return

        const refs = extractCurlyFieldRefs(formula)
        for (const ref of refs) {
          const refField = fieldByName.get(ref) || fieldByLowerName.get(ref.toLowerCase())
          if (!refField) continue
          if (refField.type === 'formula') {
            neededFormulaNames.add(refField.name)
            expandFormula(refField.name)
          } else if (refField.type !== 'lookup') {
            baseColumnNames.add(refField.name)
          }
        }
      }

      // Closure: formulas referenced by needed formulas
      Array.from(neededFormulaNames).forEach(expandFormula)

      // Always fetch the row identifier column (usually `id`, sometimes `record_id`).
      baseColumnNames.add(getRowIdColumn())

      // Safety fallback: if we know we need specific fields but can't map them to metadata yet,
      // fall back to "*" to avoid rendering empty cells due to under-fetching.
      const isOnlyIdSelected = baseColumnNames.size === 1 && baseColumnNames.has('id')
      const shouldFallbackToStar = isOnlyIdSelected && requiredNames.size > 0
      const forceStarSelect = forceStarSelectRef.current.has(supabaseTableName)

      const selectClause = (shouldFallbackToStar || forceStarSelect)
        ? '*'
        : Array.from(baseColumnNames)
            .filter((n) => typeof n === 'string' && n.trim().length > 0)
            .map((n) => String(n))
            .join(',')

      // PostgREST expects unquoted identifiers in `select=...`; validate and strip anything unsafe.
      const safeSelectClause = (shouldFallbackToStar || forceStarSelect)
        ? '*'
        : buildSelectClause(selectClause.split(','), { includeId: getRowIdColumn(), fallback: '*' })

      let query = supabase.from(supabaseTableName).select(safeSelectClause || '*')

      // Apply filter-block tree first (supports groups/OR).
      if (filterTree) {
        const normalizedFields = safeTableFields.map((f) => ({ name: f.name, type: f.type }))
        query = applyFiltersToQuery(query, filterTree, normalizedFields)
      }

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
          const orderColumn = toPostgrestColumn(sort.field_name)
          if (!orderColumn) {
            debugWarn('LAYOUT', 'Skipping sort on invalid column:', sort.field_name)
            continue
          }
          if (i === 0) {
            query = query.order(orderColumn, {
              ascending: sort.direction === "asc",
            })
          } else {
            // For additional sorts, we'd need to chain them
            // Supabase supports multiple order() calls
            query = query.order(orderColumn, {
              ascending: sort.direction === "asc",
            })
          }
        }
      } else if (safeViewSorts.length === 0) {
        // Default sort by row identifier descending (fallback to created_at if needed).
        const rowIdColumn = getRowIdColumn()
        query = query.order(rowIdColumn, { ascending: false })
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
        // If the request was aborted (navigation/unmount), ignore it.
        if (isAbortError(error)) {
          return
        }
        
        // Log detailed error information for debugging 400 errors
        if ((error as any)?.code === '400' || (error as any)?.status === 400) {
          debugError('LAYOUT', '[GridView] 400 Bad Request error:', {
            tableName: supabaseTableName,
            message: (error as any)?.message,
            details: (error as any)?.details,
            hint: (error as any)?.hint,
            code: (error as any)?.code,
            attemptedSelect: safeSelectClause,
            requiredFields: Array.from(requiredNames),
            error: error,
          })
        }
        
        bumpLoadBackoff()

        // If a view references a column that no longer exists in the physical table,
        // Postgres returns 42703 (undefined_column). PostgREST can also surface this as a 400
        // with a schema-cache message. Recover by retrying with `select('*')` and removing
        // any filters/sorts that reference non-physical columns.
        //
        // IMPORTANT: missing physical table is 42P01 and must be handled separately.
        const missingColumn = extractMissingColumnFromError(error)
        const errorMsg = String((error as any)?.message || (error as any)?.details || '').trim()
        const errorCode = (error as any)?.code || (error as any)?.status
        const isMissingColumnLike =
          errorCode === '42703' ||
          (errorCode === 400 && (
            !!missingColumn ||
            /(does\s+not\s+exist)/i.test(errorMsg) ||
            /(Could not find the ')/i.test(errorMsg) ||
            /(schema cache)/i.test(errorMsg) ||
            /(column.*not found)/i.test(errorMsg) ||
            /(invalid.*column)/i.test(errorMsg)
          )) ||
          (!!missingColumn &&
            (/(does\s+not\s+exist)/i.test(errorMsg) ||
              /(Could not find the ')/i.test(errorMsg) ||
              /(schema cache)/i.test(errorMsg)))

        if (isMissingColumnLike) {
          debugWarn('LAYOUT', '[GridView] Column missing for view; retrying with "*" select.', {
            tableName: supabaseTableName,
            message: (error as any)?.message,
            details: (error as any)?.details,
            code: (error as any)?.code,
            missingColumn,
            attemptedSelect: safeSelectClause,
            requiredFields: Array.from(requiredNames),
          })

          // Attempt schema sync once per table to create missing columns
          if (tableId && !schemaSyncAttemptedRef.current.has(supabaseTableName)) {
            schemaSyncAttemptedRef.current.add(supabaseTableName)
            try {
              debugWarn('LAYOUT', '[GridView] Attempting schema sync to fix missing columns...', {
                tableName: supabaseTableName,
                tableId,
                missingColumn,
              })
              const syncRes = await fetch(`/api/tables/${tableId}/sync-schema`, { method: 'POST' })
              const syncResult = await syncRes.json().catch(() => ({}))
              if (syncRes.ok && syncResult.success) {
                debugWarn('LAYOUT', '[GridView] Schema sync completed, columns may have been added.', {
                  tableName: supabaseTableName,
                  addedColumns: syncResult.addedColumns,
                  missingColumns: syncResult.missingPhysicalColumns,
                })
                // Wait longer for PostgREST cache to refresh (schema cache reload can take 1-2 seconds)
                await new Promise(resolve => setTimeout(resolve, 2000))
                // Clear the force star select flag so we can retry with proper column selection
                forceStarSelectRef.current.delete(supabaseTableName)
              } else {
                debugWarn('LAYOUT', '[GridView] Schema sync failed or no columns added.', {
                  tableName: supabaseTableName,
                  status: syncRes.status,
                  result: syncResult,
                })
              }
            } catch (syncError) {
              debugWarn('LAYOUT', '[GridView] Schema sync error:', syncError)
            }
          }

          // From this point on, avoid repeating the failing "minimal select" for this table.
          // This prevents endless 400s in live mode when parent props cause re-renders.
          forceStarSelectRef.current.add(supabaseTableName)

          // If the missing column is our row identifier, switch to the alternate id column and retry.
          // This keeps legacy tables (record_id pk) working.
          const currentRowIdColumn = getRowIdColumn()
          if (missingColumn && String(missingColumn).toLowerCase() === String(currentRowIdColumn).toLowerCase()) {
            const key = String(supabaseTableName || '').trim()
            if (key) {
              const next = currentRowIdColumn === 'id' ? 'record_id' : 'id'
              rowIdColumnByTableRef.current.set(key, next)
            }
          }

          const isMissingMatch = (fieldName?: string | null) => {
            if (!missingColumn || !fieldName) return false
            const normalized = String(fieldName).toLowerCase()
            const missingNormalized = String(missingColumn).toLowerCase()
            return normalized === missingNormalized
          }

          // If we couldn't extract the exact missing column, probe the physical schema by fetching 1 row.
          // This lets us safely drop sorts/filters that reference non-existent columns.
          let physicalColumnsLower: Set<string> | null = null
          if (!missingColumn) {
            try {
              const probe = await supabase.from(supabaseTableName).select('*').limit(1)
              const sample = Array.isArray(probe.data) ? probe.data[0] : probe.data
              if (sample && typeof sample === 'object') {
                physicalColumnsLower = new Set(Object.keys(sample).map((k) => String(k).toLowerCase()))
              }
            } catch {
              // ignore: we'll fall back to dropping only invalid identifiers below
            }
          }

          const isPhysical = (maybeCol: string | null): boolean => {
            if (!maybeCol) return false
            if (!physicalColumnsLower) return true
            return physicalColumnsLower.has(String(maybeCol).toLowerCase())
          }

          const filteredRetryFilters =
            missingColumn || physicalColumnsLower
              ? safeFilters.filter((f) => {
                  const col = toPostgrestColumn(f.field)
                  if (missingColumn && isMissingMatch(col)) return false
                  // If we know physical columns, drop filters on non-physical cols to avoid 400 loops.
                  if (physicalColumnsLower && col && !isPhysical(col)) return false
                  return true
                })
              : safeFilters

          const filteredRetryViewFilters =
            missingColumn || physicalColumnsLower
              ? safeViewFilters.filter((f) => {
                  const col = toPostgrestColumn(f.field_name)
                  if (missingColumn && isMissingMatch(col)) return false
                  if (physicalColumnsLower && col && !isPhysical(col)) return false
                  return true
                })
              : safeViewFilters

          const filteredRetrySorts =
            missingColumn || physicalColumnsLower
              ? safeViewSorts.filter((s) => {
                  const col = toPostgrestColumn(s.field_name)
                  if (missingColumn && isMissingMatch(col)) return false
                  if (physicalColumnsLower && col && !isPhysical(col)) return false
                  return true
                })
              : safeViewSorts

          let retryQuery = supabase.from(supabaseTableName).select('*')

          if (filteredRetryFilters.length > 0) {
            const normalizedFields = safeTableFields.map(f => ({ name: f.name, type: f.type }))
            retryQuery = applyFiltersToQuery(retryQuery, filteredRetryFilters, normalizedFields)
          } else if (filteredRetryViewFilters.length > 0) {
            const legacyFilters: FilterConfig[] = filteredRetryViewFilters.map(f => ({
              field: f.field_name,
              operator: f.operator as FilterConfig['operator'],
              value: f.value,
            }))
            const normalizedFields = safeTableFields.map(f => ({ name: f.name, type: f.type }))
            retryQuery = applyFiltersToQuery(retryQuery, legacyFilters, normalizedFields)
          }

          const retryNeedsClientSideSort =
            filteredRetrySorts.length > 0 &&
            shouldUseClientSideSorting(
              filteredRetrySorts.map(s => ({ field_name: s.field_name, direction: s.direction as 'asc' | 'desc' })),
              safeTableFields
            )

          if (filteredRetrySorts.length > 0 && !retryNeedsClientSideSort) {
            for (let i = 0; i < filteredRetrySorts.length; i++) {
              const sort = filteredRetrySorts[i]
              const orderColumn = toPostgrestColumn(sort.field_name)
              if (!orderColumn) {
                debugWarn('LAYOUT', 'Skipping sort on invalid column:', sort.field_name)
                continue
              }
              retryQuery = retryQuery.order(orderColumn, {
                ascending: sort.direction === "asc",
              })
            }
          } else if (filteredRetrySorts.length === 0) {
            const rowIdColumn = getRowIdColumn()
            retryQuery = retryQuery.order(rowIdColumn, { ascending: false })
          }

          retryQuery = retryQuery.limit(retryNeedsClientSideSort ? ITEMS_PER_PAGE * 2 : ITEMS_PER_PAGE)

          const retry = await retryQuery
          if (!retry.error) {
            let dataArray = normalizeRowsWithId(asArray<Record<string, any>>(retry.data))
            setIsMissingPhysicalTable(false)
            setTableError(null)
            setTableWarning(
              'This view references one or more fields that no longer exist in the underlying table. Showing records with a fallback query.'
            )
            // Successful recovery: clear backoff and reset retry counter.
            loadBackoffRef.current = { nextAllowedAt: 0, delayMs: 0 }
            retryAttemptsRef.current.delete(supabaseTableName)
            if (retryNeedsClientSideSort && filteredRetrySorts.length > 0) {
              dataArray = sortRowsByFieldType(
                dataArray,
                filteredRetrySorts.map(s => ({ field_name: s.field_name, direction: s.direction as 'asc' | 'desc' })),
                safeTableFields
              ).slice(0, ITEMS_PER_PAGE)
            }
            setRows(dataArray)
            setLoading(false)
            return
          }

          // Retry also failed: treat as schema mismatch (do NOT try to create the table).
          bumpLoadBackoff()
          let sqlHint = ''
          let syncHint = ''
          if (missingColumn) {
            const field = safeTableFields.find(
              (f) => f && typeof f === 'object' && typeof f.name === 'string' && f.name === missingColumn
            )
            // Only generate SQL for physical fields (formula/lookup are virtual).
            if (field && field.type !== 'formula' && field.type !== 'lookup') {
              try {
                const sql = generateAddColumnSQL(supabaseTableName, missingColumn, field.type as any, field.options as any)
                sqlHint = `\n\nRun this SQL in Supabase to add the missing column:\n${sql}`
              } catch {
                // ignore (we'll show generic message)
              }
            }
            // Suggest schema sync if tableId is available
            if (tableId) {
              syncHint = `\n\nAlternatively, the schema sync API can automatically add missing columns. Refresh the page to trigger automatic sync, or call: POST /api/tables/${tableId}/sync-schema`
            }
          }
          setIsMissingPhysicalTable(false)
          setTableWarning(null)
          setTableError(
            `This table is missing a column required by the view${missingColumn ? `: "${missingColumn}"` : ''}.` +
              `\n\nThis is a schema mismatch (error code 42703), not a missing table.` +
              syncHint +
              sqlHint
          )
          setRows([])
          setLoading(false)
          return
        }

        // Fallback: For 400 errors that don't match missing column patterns,
        // but we haven't already forced star select, mark for star select and let next render retry
        const fallbackErrorCode = (error as any)?.code || (error as any)?.status
        if (fallbackErrorCode === 400 || fallbackErrorCode === '400') {
          const alreadyForcedStar = forceStarSelectRef.current.has(supabaseTableName)
          const currentRetries = retryAttemptsRef.current.get(supabaseTableName) || 0
          
          if (!alreadyForcedStar && currentRetries < MAX_RETRY_ATTEMPTS) {
            debugWarn('LAYOUT', '[GridView] 400 error not matching column patterns; will retry with "*" select on next load.', {
              tableName: supabaseTableName,
              message: (error as any)?.message,
              details: (error as any)?.details,
              retryAttempt: currentRetries + 1,
              maxRetries: MAX_RETRY_ATTEMPTS,
            })
            forceStarSelectRef.current.add(supabaseTableName)
            retryAttemptsRef.current.set(supabaseTableName, currentRetries + 1)
            // Apply exponential backoff even for star select retries to prevent resource exhaustion
            const backoffDelay = Math.min(500 * Math.pow(2, currentRetries), 5000)
            loadBackoffRef.current = {
              nextAllowedAt: Date.now() + backoffDelay,
              delayMs: backoffDelay,
            }
            // Mark that we have a pending load to retry
            pendingLoadRowsRef.current = true
            setLoading(false)
            // The effect will trigger a reload when dependencies change or on next render
            return
          } else if (currentRetries >= MAX_RETRY_ATTEMPTS) {
            // Max retries reached - stop retrying and show error
            debugError('LAYOUT', '[GridView] Max retry attempts reached for table. Stopping retries.', {
              tableName: supabaseTableName,
              retryAttempts: currentRetries,
            })
            setIsMissingPhysicalTable(false)
            setTableError(
              `Failed to load data after ${MAX_RETRY_ATTEMPTS} attempts. The table may have schema issues. Please check the table structure.`
            )
            setRows([])
            setLoading(false)
            return
          }
        }

        debugError('LAYOUT', "Error loading rows:", {
          code: (error as any)?.code,
          message: (error as any)?.message,
          details: (error as any)?.details,
          hint: (error as any)?.hint,
          raw: error,
        })
        // Check if table doesn't exist - check multiple error patterns
        const errorMessage = (error as any)?.message || ''
        // IMPORTANT: be strict here. "column ... does not exist" is NOT a missing table.
        const isTableNotFound =
          error.code === "42P01" ||
          error.code === "PGRST205" ||
          (typeof errorMessage === 'string' && (
            errorMessage.includes("Could not find the table") ||
            /relation\s+.+\s+does not exist/i.test(errorMessage)
          ))
        
        if (isTableNotFound) {
          bumpLoadBackoff()
          setIsMissingPhysicalTable(true)
          setTableWarning(null)
          setTableError(`The table "${supabaseTableName}" does not exist. Attempting to create it...`)
          
          // Try to create the table automatically
          try {
            // Only try once per tableName to avoid infinite loops / resource exhaustion.
            if (createTableAttemptedRef.current.has(supabaseTableName)) {
              setTableError(`The table "${supabaseTableName}" does not exist and could not be created automatically.`)
              setRows([])
              setLoading(false)
              return
            }
            createTableAttemptedRef.current.add(supabaseTableName)

            const createResponse = await fetch('/api/tables/create-table', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tableName: supabaseTableName })
            })
            
            const createResult = await createResponse.json()
            
            if (createResult.success) {
              // Table created, reload rows after a short delay to allow schema cache to update
              setTimeout(() => {
                setIsMissingPhysicalTable(false)
                setTableError(null)
                setTableWarning(null)
                // Clear backoff since we are explicitly retrying after a successful create.
                loadBackoffRef.current = { nextAllowedAt: 0, delayMs: 0 }
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
            debugError('LAYOUT', 'Failed to create table:', createError)
            setTableError(`The table "${supabaseTableName}" does not exist and could not be created automatically. Please create it manually in Supabase.`)
          }
        } else {
          setIsMissingPhysicalTable(false)
          const msg = (error as any)?.message || 'Unknown error'
          setTableError(`Error loading data: ${msg}`)
        }
        setRows([])
      } else {
        // Success: clear backoff and reset retry counter.
        loadBackoffRef.current = { nextAllowedAt: 0, delayMs: 0 }
        retryAttemptsRef.current.delete(supabaseTableName)

        // CRITICAL: Normalize data to array - API might return single record or null
        const dataArray = normalizeRowsWithId(asArray<Record<string, any>>(data))
        
        // Compute only formula fields that are actually needed by the view (visible/sort/filter/grouping/appearance),
        // plus any formula-to-formula dependencies (computed via the closure above).
        const formulaFieldsToCompute = safeTableFields.filter(
          (f) => f.type === 'formula' && neededFormulaNames.has(f.name)
        )
        let computedRows =
          formulaFieldsToCompute.length > 0
            ? dataArray.map((row) => computeFormulaFields(row, formulaFieldsToCompute, safeTableFields))
            : dataArray

        computedRows = normalizeRowsWithId(computedRows)
        
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
        
        setIsMissingPhysicalTable(false)
        setTableError(null)
        setTableWarning(null)
        setRows(computedRows)
      }
    } catch (error) {
      if (isAbortError(error)) return
      bumpLoadBackoff()
      debugError('LAYOUT', "Error loading rows:", error)
      const msg =
        (error as any)?.message ||
        (typeof error === 'string' ? error : '') ||
        String(error)
      setIsMissingPhysicalTable(false)
      setTableError(`Error loading data: ${msg}`)
      setTableWarning(null)
      setRows([])
    } finally {
      setLoading(false)
      loadingRowsRef.current = false

      // If we queued another load while in-flight, run it once.
      if (pendingLoadRowsRef.current) {
        pendingLoadRowsRef.current = false
        // Schedule next tick to avoid deep recursion and to allow React to flush state.
        setTimeout(() => {
          void loadRows()
        }, 0)
      }
    }
  }

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  async function handleCellSave(rowId: string, fieldName: string, value: unknown) {
    // Don't allow saving if view-only
    if (isViewOnly) return
    if (!rowId || !supabaseTableName) return
    if (!isMountedRef.current) return // Prevent updates after unmount

    try {
      // Prevent 400 spam when the view references a field that no longer exists physically.
      const fieldMeta = safeTableFields.find(
        (f) =>
          f &&
          typeof f === 'object' &&
          (f.name === fieldName ||
            f.id === fieldName ||
            (typeof f.name === 'string' && f.name.toLowerCase() === String(fieldName).toLowerCase()))
      )
      if (!fieldMeta) {
        const error = new Error(
          `Cannot update "${fieldName}" because it does not exist in the underlying table schema. ` +
            `Refresh the view fields or re-add/rename the column in Supabase.`
        )
        debugError('LAYOUT', "Error saving cell:", error)
        throw error
      }
      if (fieldMeta.type === 'formula' || fieldMeta.type === 'lookup') {
        const error = new Error(`Cannot update "${fieldName}" because it is a ${fieldMeta.type} field.`)
        debugError('LAYOUT', "Error saving cell:", error)
        throw error
      }

      // Normalize values to match the physical column type expectations.
      // This prevents common inline-edit crashes (especially for linked record fields).
      const normalizeUpdateValue = (field: TableField, raw: unknown): unknown => {
        // Avoid sending `undefined` (PostgREST can treat it as an empty body).
        let v: unknown = raw === undefined ? null : raw
        if (typeof v === 'number' && (!Number.isFinite(v) || Number.isNaN(v))) v = null

        if (field.type !== 'link_to_table') return v

        const maybeParseJsonArrayString = (s: string): unknown[] | null => {
          const trimmed = s.trim()
          if (!(trimmed.startsWith('[') && trimmed.endsWith(']'))) return null
          try {
            const parsed = JSON.parse(trimmed)
            return Array.isArray(parsed) ? parsed : null
          } catch {
            return null
          }
        }

        const toId = (x: unknown): string | null => {
          if (x == null || x === '') return null
          if (typeof x === 'string') {
            // Some UI paths accidentally stringify arrays for link fields, e.g. `["uuid"]`.
            const parsedArr = maybeParseJsonArrayString(x)
            if (parsedArr && parsedArr.length > 0) {
              const first = parsedArr[0]
              if (first == null || first === '') return null
              return String(first)
            }
            return x
          }
            if (typeof x === 'object' && x && 'id' in x) return String((x as { id: unknown }).id)
          return String(x)
        }

        const relationshipType = (field.options as { relationship_type?: 'one-to-one' | 'one-to-many' | 'many-to-many' })?.relationship_type
        const maxSelections = (field.options as { max_selections?: number })?.max_selections
        const isMulti =
          relationshipType === 'one-to-many' ||
          relationshipType === 'many-to-many' ||
          (typeof maxSelections === 'number' && maxSelections > 1)

        if (isMulti) {
          if (v == null) return null
          if (Array.isArray(v)) return v.map(toId).filter(Boolean)
          const id = toId(v)
          return id ? [id] : null
        }

        // Single-link: always normalize to a single UUID (or null).
        if (Array.isArray(v)) return toId(v[0])
        return toId(v)
      }

      const safeColumn = toPostgrestColumn(fieldName)
      if (!safeColumn) {
        const error = new Error(
          `This field cannot be updated because its column name is not a safe identifier: "${fieldName}". ` +
            `Rename the field to a simple snake_case name (letters/numbers/_), or ensure your backend supports quoted column updates.`
        )
        debugError('LAYOUT', "Error saving cell:", error)
        throw error
      }

      let finalSavedValue: unknown = normalizeUpdateValue(fieldMeta, value)

      const doUpdate = async (val: unknown) => {
        const rowIdColumn = getRowIdColumn()
        return await supabase.from(supabaseTableName).update({ [safeColumn]: val }).eq(rowIdColumn, rowId)
      }

      let { error } = await doUpdate(finalSavedValue)

      // Compatibility rescue: if Postgres reports uuid cast errors for arrays, retry with scalar for single selections.
      if (
        error?.code === '22P02' &&
        Array.isArray(finalSavedValue) &&
        String((error as { message?: string })?.message || '').toLowerCase().includes('invalid input syntax for type uuid')
      ) {
        if (finalSavedValue.length <= 1) {
          finalSavedValue = finalSavedValue[0] ?? null
          const retry = await doUpdate(finalSavedValue)
          error = retry.error
        }
      }

      if (error) {
        // Don't log abort errors (expected during navigation/unmount)
        if (!isAbortError(error)) {
          debugError('LAYOUT', "Error saving cell:", {
            tableName: supabaseTableName,
            rowId,
            fieldName,
            column: safeColumn,
            error: error,
            code: error.code,
            message: error.message,
          })
        }
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          if (isMountedRef.current) {
            setTableError(`The table "${supabaseTableName}" does not exist in Supabase.`)
          }
        }
        throw error
      }

      // Update local state immediately for better UX (only if still mounted)
      if (isMountedRef.current) {
        setRows((prevRows) =>
          prevRows.map((row) =>
            row.id === rowId ? { ...row, [fieldName]: finalSavedValue } : row
          )
        )
      }
    } catch (error) {
      // Re-throw error so calling code can handle it (e.g., show toast)
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

      // Apply Airtable-like defaults from the *effective* active filters.
      // Prefer standardized `filters`; fall back to legacy `viewFilters` when needed.
      const legacyFilters: FilterConfig[] = safeViewFilters.map(f => ({
        field: f.field_name,
        operator: f.operator as FilterConfig['operator'],
        value: f.value,
      }))
      const effectiveFiltersForDefaults = safeFilters.length > 0 ? safeFilters : legacyFilters

      const defaultsFromFilters = deriveDefaultValuesFromFilters(effectiveFiltersForDefaults, safeTableFields)
      if (Object.keys(defaultsFromFilters).length > 0) {
        Object.assign(newRow, defaultsFromFilters)
      }

      // Validate required fields before inserting
      const requiredFields = safeTableFields.filter(f => 
        f && 
        typeof f === 'object' && 
        f.required === true &&
        f.name // Ensure field has a name
      )

      if (requiredFields.length > 0) {
        const missingRequired: string[] = []
        
        for (const field of requiredFields) {
          const fieldName = field.name
          const fieldValue = newRow[fieldName]
          
          // Check if field is missing or empty (null, undefined, empty string, empty array)
          const isEmpty = 
            fieldValue == null || 
            fieldValue === '' || 
            (Array.isArray(fieldValue) && fieldValue.length === 0)
          
          if (isEmpty) {
            // Check if field has a default value
            const hasDefault = field.default_value != null && field.default_value !== ''
            
            if (!hasDefault) {
              missingRequired.push(field.label || field.name)
            }
          }
        }

        if (missingRequired.length > 0) {
          // Warn user about missing required fields, but allow creation for spreadsheet-style UX
          // Database NOT NULL constraints will prevent the insert if they're configured
          setMissingRequiredFields(missingRequired)
          setPendingAction(async () => {
            // Action will proceed after confirmation - insert the row
            const { data, error } = await supabase
              .from(supabaseTableName)
              .insert([newRow])
              .select()
              .single()

            if (error) {
              debugError('LAYOUT', "Error adding row:", error)
              if (error.code === "42P01" || error.message?.includes("does not exist")) {
                setTableError(`The table "${supabaseTableName}" does not exist in Supabase.`)
              } else if (error.code === "23502" || error.message?.includes("null value") || error.message?.includes("violates not-null constraint")) {
                // PostgreSQL NOT NULL constraint violation
                alert(`Cannot create record: Required fields must have values. Please fill in all required fields.`)
              } else {
                alert(`Failed to create record: ${error.message || 'Unknown error'}`)
              }
            } else {
              await loadRows()
            }
          })
          setShowRequiredFieldsConfirm(true)
          return // Wait for user confirmation
        }
      }

      const { data, error } = await supabase
        .from(supabaseTableName)
        .insert([newRow])
        .select()
        .single()

      if (error) {
        debugError('LAYOUT', "Error adding row:", error)
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          setTableError(`The table "${supabaseTableName}" does not exist in Supabase.`)
        } else if (error.code === "23502" || error.message?.includes("null value") || error.message?.includes("violates not-null constraint")) {
          // PostgreSQL NOT NULL constraint violation
          alert(`Cannot create record: Required fields must have values. Please fill in all required fields.`)
        } else {
          alert(`Failed to create record: ${error.message || 'Unknown error'}`)
        }
      } else {
        await loadRows()
        // Contract: creating a row must NOT auto-open the record.
        // User can open via the dedicated chevron (or optional row double-click).
      }
    } catch (error: unknown) {
      debugError('LAYOUT', "Error adding row:", error)
      const errorObj = error as { code?: string; message?: string } | null
      if (errorObj?.code === "42P01" || errorObj?.message?.includes("does not exist")) {
        setTableError(`The table "${supabaseTableName}" does not exist in Supabase.`)
      } else if (errorObj?.code === "23502" || errorObj?.message?.includes("null value") || errorObj?.message?.includes("violates not-null constraint")) {
        alert(`Cannot create record: Required fields must have values. Please fill in all required fields.`)
      } else if (errorObj?.message) {
        alert(`Failed to create record: ${errorObj.message}`)
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

  function openRecordUI(rowId: string) {
    // Don't open record if not allowed or disabled
    if (!allowOpenRecord || !enableRecordOpen) return
    if (!rowId) return

    // Otherwise, if an integration callback is provided, use it.
    if (onRecordClick) {
      onRecordClick(rowId)
      return
    }

    // Default: use RecordPanel context (for views)
    openRecord(tableId, rowId, supabaseTableName, modalFields)
  }

  function handleOpenRecordClick(e: React.MouseEvent, rowId: string) {
    e.stopPropagation() // Prevent row click
    openRecordUI(rowId)
  }

  function handleRowSelect(rowId: string) {
    if (!rowId) return
    setSelectedRowId(rowId)
  }

  function handleRowDoubleClick(rowId: string) {
    // Optional secondary behaviour: double-click row background opens record.
    // Cell contents should stopPropagation on double click to prevent accidental opens.
    if (!allowOpenRecord || !enableRecordOpen) return
    openRecordUI(rowId)
  }

  // Column header dropdown handlers
  function handleColumnSort(fieldName: string, direction: 'asc' | 'desc' | null) {
    // TODO: Implement column-level sort (currently handled by toolbar)
    debugLog('LAYOUT', 'Column sort:', { fieldName, direction })
  }

  async function handleColumnFilter(fieldName: string) {
    if (onFilterCreate) {
      try {
        // Create a basic "is not empty" filter for the field
        // User can modify it in the filter editor
        await onFilterCreate({
          field_name: fieldName,
          operator: 'is_not_empty',
        })
        debugLog('LAYOUT', 'Filter created for field:', fieldName)
      } catch (error) {
        debugError('LAYOUT', 'Failed to create filter:', error)
        alert('Failed to create filter')
      }
    } else {
      debugLog('LAYOUT', 'Column filter (no callback):', { fieldName })
      // Future: Could open filter dialog or navigate to filter settings
    }
  }

  async function handleColumnGroup(fieldName: string) {
    if (onGroupByChange) {
      try {
        // Toggle: if already grouped by this field, ungroup; otherwise group by it
        const newGroupBy = groupBy === fieldName ? null : fieldName
        await onGroupByChange(newGroupBy)
        debugLog('LAYOUT', 'GroupBy changed:', { fieldName, newGroupBy })
      } catch (error) {
        debugError('LAYOUT', 'Failed to change groupBy:', error)
        alert('Failed to change grouping')
      }
    } else {
      debugLog('LAYOUT', 'Column group (no callback):', { fieldName })
      // Future: Could navigate to group settings
    }
  }

  function handleColumnHide(fieldName: string) {
    // TODO: Implement column hide/show
    debugLog('LAYOUT', 'Column hide:', { fieldName })
  }

  async function handleColumnDuplicate(fieldName: string) {
    try {
      const field = tableFields.find((f) => f.name === fieldName)
      if (!field) {
        debugWarn('LAYOUT', 'Field not found for duplication:', fieldName)
        return
      }

      // Skip formula fields (read-only, computed)
      if (field.type === 'formula') {
        alert(`Cannot duplicate formula field "${fieldName}" (read-only, computed)`)
        return
      }

      // Generate duplicate field name
      const existingNames = tableFields.map(f => f.name.toLowerCase())
      let duplicateName = `${fieldName}_copy`
      let counter = 1
      while (existingNames.includes(duplicateName.toLowerCase())) {
        duplicateName = `${fieldName}_copy_${counter}`
        counter++
      }

      // Create duplicate field via API
      const response = await fetch(`/api/tables/${tableId}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: duplicateName,
          label: duplicateName, // Use name as label for duplicate
          type: field.type,
          required: field.required || false,
          default_value: field.default_value || null,
          options: field.options || {},
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || 'Failed to duplicate field')
        return
      }

      debugLog('LAYOUT', 'Field duplicated successfully:', { fieldName, duplicateName })
      // Refresh table fields and reload page
      onTableFieldsRefresh?.()
      window.location.reload()
    } catch (error) {
      debugError('LAYOUT', 'Error duplicating field:', error)
      alert('Failed to duplicate field')
    }
  }

  function handleColumnInsertLeft(fieldName: string) {
    // Open field builder - user can create field, then we'll position it
    // Note: Full positioning automation would require field builder coordination
    // For now, this opens the builder and user positions manually after creation
    debugLog('LAYOUT', 'Insert left:', { fieldName })
    if (onAddField) {
      onAddField()
      // Future enhancement: Store target position and reorder after field creation
      // This would require coordination with field builder to know which field was created
    }
  }

  function handleColumnInsertRight(fieldName: string) {
    // Open field builder - user can create field, then we'll position it
    // Note: Full positioning automation would require field builder coordination
    // For now, this opens the builder and user positions manually after creation
    debugLog('LAYOUT', 'Insert right:', { fieldName })
    if (onAddField) {
      onAddField()
      // Future enhancement: Store target position and reorder after field creation
      // This would require coordination with field builder to know which field was created
    }
  }

  async function handleColumnDelete(fieldName: string) {
    setFieldToDelete(fieldName)
    setShowDeleteFieldConfirm(true)
  }

  async function confirmDeleteField() {
    if (!fieldToDelete) {
      setShowDeleteFieldConfirm(false)
      return
    }

    try {
      const field = tableFields.find((f) => f.name === fieldToDelete)
      if (!field) {
        debugWarn('LAYOUT', 'Field not found for deletion:', fieldToDelete)
        setShowDeleteFieldConfirm(false)
        setFieldToDelete(null)
        return
      }

      const response = await fetch(`/api/tables/${tableId}/fields?fieldId=${field.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || 'Failed to delete field')
        return
      }

      debugLog('LAYOUT', 'Field deleted successfully:', fieldToDelete)
      // Refresh table fields and reload page
      onTableFieldsRefresh?.()
      window.location.reload()
    } catch (error) {
      debugError('LAYOUT', 'Error deleting field:', error)
      alert('Failed to delete field')
    }
  }

  function handleColumnCopyUrl(fieldName: string) {
    // Copy field URL to clipboard
    const url = `${window.location.origin}/tables/${tableId}?field=${encodeURIComponent(fieldName)}`
    navigator.clipboard.writeText(url).then(() => {
      // Could show toast notification here
    }).catch(err => {
      debugError('LAYOUT', 'Failed to copy URL:', err)
    })
  }

  function handleColumnEditDescription(fieldName: string) {
    // TODO: Open field description editor
    onEditField?.(fieldName)
  }

  function handleColumnEditPermissions(fieldName: string) {
    // TODO: Open field permissions editor
    debugLog('LAYOUT', 'Edit permissions:', fieldName)
  }

  function handleChangePrimaryField(fieldName: string) {
    // TODO: Change primary field
    debugLog('LAYOUT', 'Change primary field:', fieldName)
  }

  function handleColumnSelect(fieldName: string) {
    // Toggle selection - if already selected, deselect; otherwise select
    const newSelection = selectedColumnName === fieldName ? null : fieldName
    setSelectedColumnName(newSelection)
    
    if (newSelection) {
      // Copy column name to clipboard when selected
      navigator.clipboard.writeText(fieldName).then(() => {
        debugLog('LAYOUT', 'Column selected and copied:', { fieldName })
      }).catch(err => {
        debugError('LAYOUT', 'Failed to copy column name:', err)
      })
    }
  }

  // Apply client-side search
  // CRITICAL: Normalize rows to array before filtering
  const safeRows = asArray<Record<string, any>>(rows)
  const filteredRows = useMemo(() => {
    if (!searchTerm || typeof searchTerm !== 'string' || !searchTerm.trim()) {
      return safeRows
    }

    // CRITICAL: Ensure visibleFields is an array before using it
    if (!Array.isArray(visibleFields) || visibleFields.length === 0) {
      return safeRows
    }

    const searchLower = searchTerm.toLowerCase()
    return safeRows.filter((row) => {
      if (!row || typeof row !== 'object') return false
      
      return visibleFields.some((field) => {
        if (!field || typeof field !== 'object' || !field.field_name) return false
        
        const value = row[field.field_name]
        if (value === null || value === undefined) return false
        return String(value).toLowerCase().includes(searchLower)
      })
    })
  }, [safeRows, searchTerm, visibleFields])

  const effectiveGroupRules = useMemo<GroupRule[]>(() => {
    const safe = Array.isArray(groupByRules) ? groupByRules.filter(Boolean) : []
    if (safe.length > 0) return safe
    if (groupBy && typeof groupBy === 'string' && groupBy.trim()) return [{ type: 'field', field: groupBy.trim() }]
    return []
  }, [groupBy, groupByRules])

  const [groupValueLabelMaps, setGroupValueLabelMaps] = useState<Record<string, Record<string, string>>>({})

  const groupModel = useMemo(() => {
    if (effectiveGroupRules.length === 0) return null
    return buildGroupTree(asArray<Record<string, any>>(filteredRows), safeTableFields, effectiveGroupRules, {
      emptyLabel: '(Empty)',
      emptyLast: true,
      valueLabelMaps: groupValueLabelMaps,
    })
  }, [effectiveGroupRules, filteredRows, safeTableFields, groupValueLabelMaps])

  // Resolve grouping labels for linked record fields (link_to_table).
  useEffect(() => {
    let cancelled = false

    async function load() {
      const rules = Array.isArray(effectiveGroupRules) ? effectiveGroupRules : []
      if (rules.length === 0) {
        setGroupValueLabelMaps({})
        return
      }

      const safeFields = asArray<TableField>(safeTableFields as any)
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
        for (const row of asArray<Record<string, any>>(filteredRows)) {
          for (const id of collectLinkedIds((row as any)?.[f.name])) ids.add(id)
        }
        if (ids.size === 0) continue
        const map = await resolveLinkedFieldDisplayMap(f, Array.from(ids))
        next[f.name] = Object.fromEntries(map.entries())
        next[(f as any).id] = next[f.name]
      }

      if (!cancelled) setGroupValueLabelMaps(next)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [effectiveGroupRules, filteredRows, safeTableFields])

  const flattenedGroups = useMemo(() => {
    if (!groupModel || groupModel.rootGroups.length === 0) return null
    return flattenGroupTree(groupModel.rootGroups, collapsedGroups)
  }, [collapsedGroups, groupModel])

  // When grouping, allow "start collapsed" behavior (default: collapsed).
  // This is intentionally applied only on initial load / when the groupBy field changes / when the setting flips,
  // so we don't override the user's manual expand/collapse interactions mid-session.
  useEffect(() => {
    const groupByChanged = prevGroupByRef.current !== groupBy
    prevGroupByRef.current = groupBy

    if (groupByChanged) {
      didInitGroupCollapseRef.current = false
      setCollapsedGroups(new Set())
    }

    // No grouping: always open (nothing to collapse)
    if (effectiveGroupRules.length === 0) {
      didInitGroupCollapseRef.current = false
      return
    }

    // If the setting is "open", force-expand (clear collapsed set).
    if (!defaultGroupsCollapsed) {
      didInitGroupCollapseRef.current = false
      setCollapsedGroups(new Set())
      return
    }

    // Setting is "closed": collapse all groups once, when we have keys.
    if (didInitGroupCollapseRef.current) return
    const top = groupModel?.rootGroups || []
    if (top.length === 0) return
    setCollapsedGroups(new Set(top.map((n) => n.pathKey)))
    didInitGroupCollapseRef.current = true
  }, [groupBy, defaultGroupsCollapsed, effectiveGroupRules.length, groupModel?.rootGroups])

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

  // Measure content height when grouping changes (expand/collapse or enable/disable)
  // Only trigger on group state changes, not on data refresh, inline editing, etc.
  useEffect(() => {
    if (!onHeightChange || !contentRef.current) return
    
    const isGrouped = effectiveGroupRules.length > 0
    if (!isGrouped) return // No grouping, skip measurement

    // Debounce measurement to avoid excessive updates
    const timeoutId = setTimeout(() => {
      if (!contentRef.current) return
      
      // Measure the actual scroll height of the content
      const pixelHeight = contentRef.current.scrollHeight || contentRef.current.clientHeight || 0
      
      // Convert to grid units (round up to ensure content fits)
      const heightInGridUnits = Math.ceil(pixelHeight / rowHeight)
      
      // Minimum height of 2 grid units to prevent blocks from being too small
      const finalHeight = Math.max(heightInGridUnits, 2)
      
      onHeightChange(finalHeight)
    }, 100) // Small debounce to allow DOM to update

    return () => clearTimeout(timeoutId)
  }, [collapsedGroups, effectiveGroupRules.length, groupBy, onHeightChange, rowHeight])

  // CRITICAL: Defensive guards - ensure we have required data before rendering
  // These checks happen AFTER all hooks are called (React rules compliance)
  
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <LoadingSpinner size="lg" text="Loading grid data..." />
        <div className="w-full max-w-4xl px-4 space-y-2">
          <SkeletonLoader count={3} height="h-10" className="w-full" />
          <SkeletonLoader count={5} height="h-8" className="w-full" />
        </div>
      </div>
    )
  }

  // Guard: Table name must exist
  if (!supabaseTableName || typeof supabaseTableName !== 'string') {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="max-w-md p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Table Not Configured</h3>
          <p className="text-sm text-gray-600">This view is not connected to a table.</p>
        </div>
      </div>
    )
  }

  // Guard: Table fields must be an array (even if empty)
  if (!Array.isArray(safeTableFields)) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="max-w-md p-6 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">Invalid Table Configuration</h3>
          <p className="text-sm text-yellow-700">Table fields are not properly configured.</p>
        </div>
      </div>
    )
  }

  if (tableError) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="max-w-md p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">
            {isMissingPhysicalTable ? "Table Not Found" : "Unable to Load Data"}
          </h3>
          <p className="text-sm text-yellow-700 mb-4">{tableError}</p>
          {isMissingPhysicalTable && (
            <p className="text-xs text-yellow-600">
              The table{" "}
              <code className="bg-yellow-100 px-1 py-0.5 rounded">{supabaseTableName}</code>{" "}
              needs to be created in your Supabase database.
              You can create it manually in the Supabase dashboard or use a migration.
            </p>
          )}
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
          debugLog('LAYOUT', 'Fields initialization skipped (expected):', data.message || data.error)
          return
        }
        
        // Show detailed error message for unexpected errors
        const errorMessage = data.details 
          ? `${data.error || 'Failed to initialize fields'}: ${data.details}`
          : data.error || 'Failed to initialize fields'
        
        // Log full error details for debugging
        debugError('LAYOUT', 'Error initializing fields:', {
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
        debugWarn('LAYOUT', 'Fields initialization warning:', data.warning)
      }
      
      // Only reload if fields were actually added
      if (data.added > 0) {
        // Reload the page to refresh viewFields
        window.location.reload()
      } else if (data.message) {
        // Just log if no fields were added (already configured)
        debugLog('LAYOUT', 'Fields initialization:', data.message)
      }
    } catch (error: unknown) {
      debugError('LAYOUT', 'Error initializing fields:', error)
      // Only show alert for unexpected errors
      const errorMessage = (error as { message?: string })?.message || 'Failed to initialize fields. Please try again.'
      alert(`Error: ${errorMessage}\n\nIf this problem persists, please check:\n1. You have permission to modify this view\n2. The view is properly connected to a table\n3. The table has fields configured`)
    } finally {
      setInitializingFields(false)
    }
  }

  // CRITICAL: Guard against invalid visibleFields before rendering
  // Ensure visibleFields is an array (even if empty)
  const safeVisibleFields = Array.isArray(visibleFields) ? visibleFields : []
  
  // Show message when no visible fields are configured
  // CRITICAL: In record view context, don't show "No columns configured" UI
  // Record view uses field blocks, not grid columns, so this UI is not applicable
  if (safeVisibleFields.length === 0 && !hideEmptyState) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="max-w-md p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No columns configured</h3>
          <p className="text-sm text-gray-600 mb-4">
            This view has no visible fields configured. Add fields to the view to display data.
          </p>
          <div className="flex flex-col gap-2 items-center">
            {Array.isArray(safeTableFields) && safeTableFields.length > 0 && (
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
  if (safeVisibleFields.length === 0 && hideEmptyState) {
    return null
  }
  
  // CRITICAL: Final safety check - if we still don't have valid fields, show fallback
  if (!Array.isArray(safeVisibleFields) || safeVisibleFields.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="max-w-md p-6 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">Unable to Load Grid</h3>
          <p className="text-sm text-yellow-700">
            The grid view could not be rendered. Please check that fields are properly configured.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={contentRef}
      className="w-full h-full flex flex-col relative" 
      style={{ paddingBottom: isEditing ? '60px' : '0' }}
    >
      {/* Toolbar - Only show builder controls in edit mode */}
      {/* NOTE: "Add Row" button removed from top toolbar per Airtable-style refinement rules */}
      {/* Records are added via bottom-of-table button or inline creation */}
      {isEditing && onAddField && (
        <div className="flex-shrink-0 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
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
            {Array.isArray(filteredRows) ? filteredRows.length : 0} {Array.isArray(filteredRows) && filteredRows.length === 1 ? "row" : "rows"}
            {searchTerm && Array.isArray(filteredRows) && Array.isArray(safeRows) && filteredRows.length !== safeRows.length && (
              <span className="ml-1">(filtered from {safeRows.length})</span>
            )}
          </div>
        </div>
      )}

      {/* Non-fatal warning (e.g. view references columns that no longer exist) */}
      {tableWarning && (
        <div className="flex-shrink-0 mb-3">
          <div className="px-3 py-2 rounded-md border border-yellow-200 bg-yellow-50 text-yellow-800 text-xs flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="font-medium">Warning:</span>{" "}
              <span className="break-words">{tableWarning}</span>
            </div>
            <button
              type="button"
              onClick={() => setTableWarning(null)}
              className="flex-shrink-0 text-yellow-800/70 hover:text-yellow-900 underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Grid Table - Takes remaining space and scrolls */}
      <div className="flex-1 min-h-0 border border-gray-200 rounded-lg overflow-hidden bg-white flex flex-col relative">
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-auto relative"
          style={{ paddingBottom: isEditing ? '20px' : '0' }}
          onMouseMove={handleRowResizeHover}
          onMouseLeave={handleRowResizeMouseLeave}
        >
          {/* Row resize overlay (between rows) */}
          {hoverResizeRowId && resizeLineTop != null && !isMobile && (
            <div
              className="absolute left-0 right-0 z-30"
              style={{
                top: `${resizeLineTop - 3}px`,
                height: '6px',
                cursor: 'row-resize',
              }}
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const rowId = hoverResizeRowId
                const startHeight = getEffectiveRowHeight(rowId)
                startRowResize(rowId, startHeight, e.clientY)
              }}
              onDoubleClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                resetRowHeight(hoverResizeRowId)
              }}
              title="Drag to resize row (double-click to reset)"
            >
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-blue-500/70" />
            </div>
          )}
          {/* Allow the table to grow wider than the container so horizontal scroll appears */}
          <table className="min-w-full w-max border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {/* Checkbox column header (for row selection) - Airtable-style */}
                <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-8 sticky top-0 bg-gray-50 z-10">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-400/20 cursor-pointer"
                    title="Select all rows"
                    onChange={(e) => {
                      // TODO: Implement select all functionality
                      debugLog('LAYOUT', 'Select all:', { checked: e.target.checked })
                    }}
                  />
                </th>
                {/* Row action column header (for record opening) */}
                {enableRecordOpen && allowOpenRecord && (
                  <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-8 sticky top-0 bg-gray-50 z-10"></th>
                )}
                {/* Image column header if image field is configured */}
                {imageField && (
                  <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-12 sticky top-0 bg-gray-50 z-10"></th>
                )}
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext 
                    items={
                      safeVisibleFields.length > 0
                        ? safeVisibleFields
                            .filter((f): f is NonNullable<typeof f> => f !== null && f !== undefined && !!f.field_name)
                            .map(f => f.field_name)
                            .filter((name): name is string => typeof name === 'string' && name.length > 0)
                        : []
                    } 
                    strategy={horizontalListSortingStrategy}
                  >
                    {safeVisibleFields.length > 0
                      ? safeVisibleFields
                          .filter((field): field is NonNullable<typeof field> => {
                            // CRITICAL: Filter out null/undefined and ensure field_name exists
                            return field !== null && 
                                   field !== undefined && 
                                   typeof field === 'object' &&
                                   !!field.field_name && 
                                   typeof field.field_name === 'string'
                          })
                          .map((field, fieldIndex) => {
                            // CRITICAL: Defensive access to tableField and columnWidth
                            const tableField = Array.isArray(safeTableFields) 
                              ? safeTableFields.find(f => 
                                  f && 
                                  typeof f === 'object' && 
                                  (f.name === field.field_name || f.id === field.field_name)
                                )
                              : undefined
                            
                            const isVirtual = tableField?.type === 'formula' || tableField?.type === 'lookup'
                            const columnWidth = typeof columnWidths === 'object' && columnWidths !== null
                              ? (columnWidths[field.field_name] || COLUMN_DEFAULT_WIDTH)
                              : COLUMN_DEFAULT_WIDTH
                            
                            // Calculate left offset for frozen columns
                            // Account for checkbox column (32px), record open column (32px), and image column (48px if present)
                            const checkboxColumnWidth = 32
                            const recordOpenWidth = (enableRecordOpen && allowOpenRecord) ? 32 : 0
                            const imageColumnWidth = imageField ? 48 : 0
                            const leftOffset = checkboxColumnWidth + recordOpenWidth + imageColumnWidth + 
                              (fieldIndex < frozenColumns 
                                ? Array.from({ length: fieldIndex }, (_, i) => {
                                    const prevField = safeVisibleFields[i]
                                    if (!prevField) return 0
                                    const prevWidth = typeof columnWidths === 'object' && columnWidths !== null
                                      ? (columnWidths[prevField.field_name] || COLUMN_DEFAULT_WIDTH)
                                      : COLUMN_DEFAULT_WIDTH
                                    return prevWidth
                                  }).reduce((sum, w) => sum + w, 0)
                                : 0)
                            
                            const isFrozen = fieldIndex < frozenColumns
                            
                            // Check if this field is currently sorted, grouped, or filtered
                            const currentSort = safeViewSorts.find(s => s.field_name === field.field_name)
                            const currentSortDirection = currentSort ? (currentSort.direction === 'asc' ? 'asc' : 'desc') : null
                            const isGroupedBy = groupBy === field.field_name
                            const isFilteredBy = safeFilters.some(f => f.field === field.field_name) || safeViewFilters.some(f => f.field_name === field.field_name)
                            const isHidden = !field.visible
                            const isFirstColumn = fieldIndex === 0

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
                                isFrozen={isFrozen}
                                frozenLeft={isFrozen ? leftOffset : undefined}
                                isFirstColumn={isFirstColumn}
                                onSort={handleColumnSort}
                                onFilter={handleColumnFilter}
                                onGroup={handleColumnGroup}
                                onHide={handleColumnHide}
                                onDuplicate={handleColumnDuplicate}
                                onInsertLeft={handleColumnInsertLeft}
                                onInsertRight={handleColumnInsertRight}
                                onDelete={handleColumnDelete}
                                onCopyUrl={handleColumnCopyUrl}
                                onEditDescription={handleColumnEditDescription}
                                onEditPermissions={handleColumnEditPermissions}
                                onChangePrimary={handleChangePrimaryField}
                                currentSortDirection={currentSortDirection}
                                isGroupedBy={isGroupedBy}
                                isFilteredBy={isFilteredBy}
                                isHidden={isHidden}
                                onSelect={handleColumnSelect}
                                isSelected={selectedColumnName === field.field_name}
                              />
                            )
                          })
                      : null}
                  </SortableContext>
                </DndContext>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={
                      1 + // Checkbox column
                      safeVisibleFields.length +
                      (enableRecordOpen && allowOpenRecord ? 1 : 0) +
                      (imageField ? 1 : 0)
                    }
                    className="px-4 py-12"
                  >
                    {searchTerm ? (
                      <div className="text-center text-gray-500">
                        No rows match your search. Try adjusting your search terms.
                      </div>
                    ) : (
                      <div className="flex justify-center">
                        <EmptyTableState
                          onCreateRecord={allowInlineCreate && !isEditing ? handleAddRow : undefined}
                          onConfigureView={isEditing && onEditField ? () => {
                            // Open view settings or field configuration
                            // This could open a settings panel or navigate to view settings
                            if (onAddField) {
                              onAddField()
                            }
                          } : undefined}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              ) : flattenedGroups ? (
                flattenedGroups.map((it) => {
                  if (it.type === 'group') {
                    const node = it.node
                    const isCollapsed = collapsedGroups.has(node.pathKey)
                    const ruleLabel =
                      node.rule.type === 'date'
                        ? node.rule.granularity === 'year'
                          ? 'Year'
                          : 'Month'
                        : node.rule.field
                    return (
                      <tr key={`group-${node.pathKey}`} className="bg-gray-50 border-b border-gray-200">
                        <td
                          colSpan={
                            1 + // Checkbox column
                            safeVisibleFields.length +
                            (enableRecordOpen && allowOpenRecord ? 1 : 0) +
                            (imageField ? 1 : 0)
                          }
                          className="px-4 py-2"
                        >
                          <button
                            onClick={() => toggleGroup(node.pathKey)}
                            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 w-full text-left"
                            style={{ paddingLeft: 8 + (it.level || 0) * 16 }}
                          >
                            {isCollapsed ? (
                              <ChevronRight className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                            <span className="font-semibold">
                              {ruleLabel}: {node.label}
                            </span>
                            <span className="text-gray-500 ml-2">
                              ({node.size} {node.size === 1 ? "row" : "rows"})
                            </span>
                          </button>
                        </td>
                      </tr>
                    )
                  }

                  const row = it.item
                  const rowColor = getRowColor ? getRowColor(row) : null
                  const rowImage = getRowImage ? getRowImage(row) : null
                  const borderColor = rowColor ? { borderLeftColor: rowColor, borderLeftWidth: '4px' } : {}
                  const canOpenRecord = enableRecordOpen && allowOpenRecord
                  const thisRowId = row?.id ? String(row.id) : null
                  const thisRowHeight = getEffectiveRowHeight(thisRowId)

                  return (
                    <tr
                      key={thisRowId ? `${thisRowId}::${it.groupPathKey}` : `row-${Math.random()}`}
                      className={`border-b border-gray-100 transition-colors ${
                        thisRowId && selectedRowId === thisRowId ? 'bg-blue-50' : 'hover:bg-gray-50/50'
                      } cursor-default`}
                      style={{ ...borderColor, height: `${thisRowHeight}px`, minHeight: `${thisRowHeight}px`, maxHeight: `${thisRowHeight}px` }}
                      data-rowid="true"
                      data-row-key={thisRowId || ''}
                      onClick={thisRowId ? () => handleRowSelect(thisRowId) : undefined}
                      onDoubleClick={thisRowId ? () => handleRowDoubleClick(thisRowId) : undefined}
                    >
                      {/* Checkbox column (row selection) - Airtable-style */}
                      <td className="px-2 py-1 w-8">
                        <input
                          type="checkbox"
                          checked={thisRowId ? selectedRowId === thisRowId : false}
                          onChange={() => thisRowId && handleRowSelect(thisRowId)}
                          className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-400/20 cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                          title="Select row"
                        />
                      </td>
                      {/* Row open control */}
                      {canOpenRecord && (
                        <td className="px-2 py-1 w-8">
                          <button
                            type="button"
                            onClick={(e) => row?.id && handleOpenRecordClick(e, row.id)}
                            className="w-full h-full flex items-center justify-center text-gray-400 hover:text-blue-600 transition-colors rounded"
                            title="Open record"
                            aria-label="Open record"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                      {/* Image cell if image field is configured */}
                      {rowImage && (
                        <td
                          className="px-2 py-1 w-12"
                          onClick={(e) => e.stopPropagation()}
                          onDoubleClick={(e) => e.stopPropagation()}
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
                      {safeVisibleFields.length > 0
                        ? safeVisibleFields
                            .filter((field): field is NonNullable<typeof field> => {
                              return (
                                field !== null &&
                                field !== undefined &&
                                typeof field === 'object' &&
                                !!field.field_name &&
                                typeof field.field_name === 'string'
                              )
                            })
                            .map((field, fieldIndex) => {
                              const tableField = Array.isArray(safeTableFields)
                                ? safeTableFields.find(
                                    (f) =>
                                      f &&
                                      typeof f === 'object' &&
                                      (f.name === field.field_name || f.id === field.field_name)
                                  )
                                : undefined

                              const isVirtual = tableField?.type === 'formula' || tableField?.type === 'lookup'
                              const columnWidth =
                                typeof columnWidths === 'object' && columnWidths !== null
                                  ? (columnWidths[field.field_name] || COLUMN_DEFAULT_WIDTH)
                                  : COLUMN_DEFAULT_WIDTH

                              const rowId = row && typeof row === 'object' && row.id ? row.id : null
                              const canUseCellFactory = !!tableField && rowId !== null
                              
                              // Calculate left offset for frozen columns (same as header)
                              const recordOpenWidth = (enableRecordOpen && allowOpenRecord) ? 32 : 0
                              const imageColumnWidth = imageField ? 48 : 0
                              const leftOffset = recordOpenWidth + imageColumnWidth + 
                                (fieldIndex < frozenColumns 
                                  ? Array.from({ length: fieldIndex }, (_, i) => {
                                      const prevField = safeVisibleFields[i]
                                      if (!prevField) return 0
                                      const prevWidth = typeof columnWidths === 'object' && columnWidths !== null
                                        ? (columnWidths[prevField.field_name] || COLUMN_DEFAULT_WIDTH)
                                        : COLUMN_DEFAULT_WIDTH
                                      return prevWidth
                                    }).reduce((sum, w) => sum + w, 0)
                                  : 0)
                              
                              const isFrozen = fieldIndex < frozenColumns
                              
                              const cellStyle: React.CSSProperties = { 
                                width: `${columnWidth}px`, 
                                minWidth: `${columnWidth}px`, 
                                maxWidth: `${columnWidth}px`,
                                height: `${thisRowHeight}px`,
                                minHeight: `${thisRowHeight}px`,
                                maxHeight: `${thisRowHeight}px`,
                                overflow: 'hidden'
                              }
                              
                              if (isFrozen && frozenColumns > 0) {
                                cellStyle.position = 'sticky'
                                cellStyle.left = `${leftOffset}px`
                                cellStyle.zIndex = 10
                                cellStyle.backgroundColor = 'white'
                              }

                              return (
                                <td
                                  key={field.field_name}
                                  className="px-0 py-0"
                                  style={cellStyle}
                                  onClick={(e) => e.stopPropagation()}
                                  onDoubleClick={(e) => e.stopPropagation()}
                                >
                                  {canUseCellFactory ? (
                                    <CellFactory
                                      field={tableField!}
                                      value={row && typeof row === 'object' ? row[field.field_name] : undefined}
                                      rowId={String(rowId)}
                                      tableName={supabaseTableName}
                                      editable={canEdit && !isVirtual && rowId !== null}
                                      wrapText={wrapText}
                                      rowHeight={thisRowHeight}
                                      onSave={async (value) => {
                                        if (!isVirtual && rowId) {
                                          await handleCellSave(rowId, field.field_name, value)
                                        }
                                      }}
                                      onFieldOptionsUpdate={onTableFieldsRefresh}
                                    />
                                  ) : (
                                    <Cell
                                      value={row && typeof row === 'object' ? row[field.field_name] : undefined}
                                      fieldName={field.field_name}
                                      fieldType={tableField?.type}
                                      fieldOptions={tableField?.options}
                                      isVirtual={isVirtual}
                                      editable={canEdit && !isVirtual && rowId !== null}
                                      wrapText={wrapText}
                                      rowHeight={thisRowHeight}
                                      onSave={async (value) => {
                                        if (!isVirtual && rowId) {
                                          await handleCellSave(rowId, field.field_name, value)
                                        }
                                      }}
                                    />
                                  )}
                                </td>
                              )
                            })
                        : null}
                    </tr>
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
                  const thisRowId = row?.id ? String(row.id) : null
                  const thisRowHeight = getEffectiveRowHeight(thisRowId)
                  
                  return (
                  <tr
                    key={row?.id || `row-${Math.random()}`}
                    className={`border-b border-gray-100 transition-colors ${
                      thisRowId && selectedRowId === thisRowId ? 'bg-blue-50' : 'hover:bg-gray-50/50'
                    } cursor-default`}
                    style={{ ...borderColor, height: `${thisRowHeight}px`, minHeight: `${thisRowHeight}px`, maxHeight: `${thisRowHeight}px` }}
                    data-rowid="true"
                    data-row-key={thisRowId || ''}
                    onClick={thisRowId ? () => handleRowSelect(thisRowId) : undefined}
                    onDoubleClick={thisRowId ? () => handleRowDoubleClick(thisRowId) : undefined}
                  >
                    {/* Checkbox column (row selection) - Airtable-style */}
                    <td className="px-2 py-1 w-8">
                      <input
                        type="checkbox"
                        checked={thisRowId ? selectedRowId === thisRowId : false}
                        onChange={() => thisRowId && handleRowSelect(thisRowId)}
                        className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-400/20 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                        title="Select row"
                      />
                    </td>
                    {/* Row open control */}
                    {canOpenRecord && (
                      <td
                        className="px-2 py-1 w-8"
                      >
                        <button
                          type="button"
                          onClick={(e) => handleOpenRecordClick(e, row.id)}
                          className="w-full h-full flex items-center justify-center text-gray-400 hover:text-blue-600 transition-colors rounded"
                          title="Open record"
                          aria-label="Open record"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                    {/* Image cell if image field is configured */}
                    {rowImage && (
                      <td
                        className="px-2 py-1 w-12"
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
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
                    {safeVisibleFields.length > 0
                      ? safeVisibleFields
                          .filter((field): field is NonNullable<typeof field> => {
                            // CRITICAL: Filter out null/undefined and ensure field_name exists
                            return field !== null && 
                                   field !== undefined && 
                                   typeof field === 'object' &&
                                   !!field.field_name && 
                                   typeof field.field_name === 'string'
                          })
                          .map((field, fieldIndex) => {
                            // CRITICAL: Defensive access to tableField, columnWidth, and row.id
                            const tableField = Array.isArray(safeTableFields) 
                              ? safeTableFields.find(f => 
                                  f && 
                                  typeof f === 'object' && 
                                  (f.name === field.field_name || f.id === field.field_name)
                                )
                              : undefined
                            
                            const isVirtual = tableField?.type === 'formula' || tableField?.type === 'lookup'
                            const columnWidth = typeof columnWidths === 'object' && columnWidths !== null
                              ? (columnWidths[field.field_name] || COLUMN_DEFAULT_WIDTH)
                              : COLUMN_DEFAULT_WIDTH
                            
                            // CRITICAL: Ensure row.id exists before using it
                            const rowId = row && typeof row === 'object' && row.id ? row.id : null
                            
                            const canUseCellFactory = !!tableField && rowId !== null
                            
                            // Calculate left offset for frozen columns (same as header)
                            const checkboxColumnWidth = 32
                            const recordOpenWidth = (enableRecordOpen && allowOpenRecord) ? 32 : 0
                            const imageColumnWidth = imageField ? 48 : 0
                            const leftOffset = checkboxColumnWidth + recordOpenWidth + imageColumnWidth + 
                              (fieldIndex < frozenColumns 
                                ? Array.from({ length: fieldIndex }, (_, i) => {
                                    const prevField = safeVisibleFields[i]
                                    if (!prevField) return 0
                                    const prevWidth = typeof columnWidths === 'object' && columnWidths !== null
                                      ? (columnWidths[prevField.field_name] || COLUMN_DEFAULT_WIDTH)
                                      : COLUMN_DEFAULT_WIDTH
                                    return prevWidth
                                  }).reduce((sum, w) => sum + w, 0)
                                : 0)
                            
                            const isFrozen = fieldIndex < frozenColumns
                            
                            const cellStyle: React.CSSProperties = { 
                              width: `${columnWidth}px`, 
                              minWidth: `${columnWidth}px`, 
                              maxWidth: `${columnWidth}px`,
                              height: `${thisRowHeight}px`,
                              minHeight: `${thisRowHeight}px`,
                              maxHeight: `${thisRowHeight}px`,
                              overflow: 'hidden'
                            }
                            
                            if (isFrozen && frozenColumns > 0) {
                              cellStyle.position = 'sticky'
                              cellStyle.left = `${leftOffset}px`
                              cellStyle.zIndex = 10
                              cellStyle.backgroundColor = 'white'
                            }

                            return (
                              <td
                                key={field.field_name}
                                className="px-0 py-0"
                                style={cellStyle}
                                onClick={(e) => e.stopPropagation()}
                                onDoubleClick={(e) => e.stopPropagation()}
                              >
                                {canUseCellFactory ? (
                                  <CellFactory
                                    field={tableField!}
                                    value={row && typeof row === 'object' ? row[field.field_name] : undefined}
                                    rowId={String(rowId)}
                                    tableName={supabaseTableName}
                                    editable={canEdit && !isVirtual && rowId !== null}
                                    wrapText={wrapText}
                                    rowHeight={thisRowHeight}
                                    onSave={async (value) => {
                                      if (!isVirtual && rowId) {
                                        await handleCellSave(rowId, field.field_name, value)
                                      }
                                    }}
                                    onFieldOptionsUpdate={onTableFieldsRefresh}
                                  />
                                ) : (
                                  <Cell
                                    value={row && typeof row === 'object' ? row[field.field_name] : undefined}
                                    fieldName={field.field_name}
                                    fieldType={tableField?.type}
                                    fieldOptions={tableField?.options}
                                    isVirtual={isVirtual}
                                    editable={canEdit && !isVirtual && rowId !== null}
                                    wrapText={wrapText}
                                    rowHeight={thisRowHeight}
                                    onSave={async (value) => {
                                      if (!isVirtual && rowId) {
                                        await handleCellSave(rowId, field.field_name, value)
                                      }
                                    }}
                                  />
                                )}
                              </td>
                            )
                          })
                      : null}
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add record button at bottom of table (Airtable-style) */}
      {allowInlineCreate && (
        <div className="flex-shrink-0 border-t border-gray-200 bg-white px-4 py-2">
          <button
            onClick={handleAddRow}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add record
          </button>
        </div>
      )}

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        open={showRequiredFieldsConfirm}
        onOpenChange={setShowRequiredFieldsConfirm}
        onConfirm={async () => {
          if (pendingAction) {
            await pendingAction()
            setPendingAction(null)
          }
          setShowRequiredFieldsConfirm(false)
          setMissingRequiredFields([])
        }}
        title="Missing Required Fields"
        description={`Warning: The following required fields are empty:\n\n${missingRequiredFields.join('\n')}\n\nDo you want to create the record anyway? You can fill these fields after creation.\n\nNote: If the database enforces NOT NULL constraints, the creation will fail.`}
        confirmLabel="Create Anyway"
        cancelLabel="Cancel"
        variant="default"
      />
      <ConfirmDialog
        open={showDeleteFieldConfirm}
        onOpenChange={setShowDeleteFieldConfirm}
        onConfirm={confirmDeleteField}
        title="Delete Field"
        description={fieldToDelete ? `Are you sure you want to delete the field "${fieldToDelete}"? This action cannot be undone.` : ""}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
      />
    </div>
  )
}

