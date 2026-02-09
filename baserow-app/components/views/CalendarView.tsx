"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CalendarIcon, X } from "lucide-react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import { filterRowsBySearch } from "@/lib/search/filterRows"
import { applyFiltersToQuery, deriveDefaultValuesFromFilters, stripFilterBlockFilters, type FilterConfig } from "@/lib/interface/filters"
import type { FilterTree } from "@/lib/filters/canonical-model"
import { flattenFilterTree } from "@/lib/filters/canonical-model"
import { addDays, differenceInCalendarDays, format, startOfDay } from "date-fns"
import type { EventDropArg, EventInput, EventClickArg, EventContentArg } from "@fullcalendar/core"
import type { TableRow } from "@/types/database"
import type { LinkedField, TableField } from "@/types/fields"
import RecordModal from "@/components/calendar/RecordModal"
import { isDebugEnabled, debugLog, debugWarn, debugError } from '@/lib/interface/debug-flags'
import { resolveChoiceColor, normalizeHexColor } from '@/lib/field-colors'
import CalendarDateRangeControls from "@/components/views/calendar/CalendarDateRangeControls"
import TimelineFieldValue, { type FieldValue } from "@/components/views/TimelineFieldValue"
import { isAbortError } from "@/lib/api/error-handling"
import { getLinkedFieldValueFromRow, linkedValueToIds, resolveLinkedFieldDisplayMap } from "@/lib/dataView/linkedFields"
import { normalizeUuid } from "@/lib/utils/ids"
import type { HighlightRule } from "@/lib/interface/types"
import { evaluateHighlightRules, getFormattingStyle } from "@/lib/conditional-formatting/evaluator"
interface CalendarViewProps {
  tableId: string
  viewId: string
  dateFieldId: string
  fieldIds: string[]
  searchQuery?: string
  tableFields?: TableField[]
  filters?: FilterConfig[] // Dynamic filters from config
  filterTree?: FilterTree // Canonical filter tree from filter blocks (supports groups/OR)
  onRecordClick?: (recordId: string) => void // Emit recordId on click
  blockConfig?: Record<string, any> // Block/page config for reading date_field from page settings
  colorField?: string // Field name to use for event colors (single-select field)
  imageField?: string // Field name to use for event images
  fitImageSize?: boolean // Whether to fit image to container size
  /** Bump to force a refetch (e.g. after external record creation). */
  reloadKey?: number
  /** Optional external control of date range filter UI/state (used by Calendar block unified header) */
  dateFrom?: Date
  dateTo?: Date
  onDateFromChange?: (date?: Date) => void
  onDateToChange?: (date?: Date) => void
  /** If false, CalendarView will not render the date range controls (caller can render them elsewhere). */
  showDateRangeControls?: boolean
  /** Conditional formatting rules */
  highlightRules?: HighlightRule[]
  /** When provided, RecordModal can save modal layout (in-modal edit). */
  onModalLayoutSave?: (fieldLayout: import("@/lib/interface/field-layout-utils").FieldLayoutItem[]) => void
  /** When true, show "Edit layout" in record modal. */
  canEditLayout?: boolean
  /** Interface mode: 'view' | 'edit'. When 'edit', all record modals open in edit mode (Airtable-style). */
  interfaceMode?: 'view' | 'edit'
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

function parseDateValueToLocalDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value
  const s = String(value).trim()
  if (!s) return null
  // IMPORTANT: treat YYYY-MM-DD as a local date (not UTC) to avoid day-shifts.
  const d = DATE_ONLY_RE.test(s) ? new Date(`${s}T00:00:00`) : new Date(s)
  return isNaN(d.getTime()) ? null : d
}

export default function CalendarView({ 
  tableId, 
  viewId, 
  dateFieldId, 
  fieldIds: fieldIdsProp,
  searchQuery = "",
  tableFields = [],
  filters = [],
  filterTree = null,
  onRecordClick,
  blockConfig = {},
  colorField,
  imageField,
  fitImageSize = false,
  reloadKey,
  dateFrom: controlledDateFrom,
  dateTo: controlledDateTo,
  onDateFromChange,
  onDateToChange,
  showDateRangeControls = true,
  highlightRules = [],
  onModalLayoutSave,
  canEditLayout = false,
  interfaceMode = 'view',
}: CalendarViewProps) {
  const viewUuid = useMemo(() => normalizeUuid(viewId), [viewId])
  // Ensure fieldIds is always an array (defensive check for any edge cases)
  const fieldIds = useMemo(() => {
    if (!fieldIdsProp) return []
    if (Array.isArray(fieldIdsProp)) return fieldIdsProp
    // Fallback: if somehow not an array, return empty array
    debugWarn('CALENDAR', 'CalendarView: fieldIdsProp is not an array:', { type: typeof fieldIdsProp, value: fieldIdsProp })
    return []
  }, [fieldIdsProp])
  const router = useRouter()
  const [rows, setRows] = useState<TableRow[]>([])
  // CRITICAL: Use ref to access latest rows in callbacks without causing re-renders
  const rowsRef = useRef<TableRow[]>([])
  // Keep ref in sync with state
  useEffect(() => {
    rowsRef.current = rows
  }, [rows])
  
  const [loading, setLoading] = useState(true)
  // CRITICAL: Prevent hydration mismatch - FullCalendar generates dynamic IDs that differ between server/client
  const [mounted, setMounted] = useState(false)
  
  // DEBUG_CALENDAR: Enable via localStorage.DEBUG_CALENDAR=1
  // CRITICAL: Use useState to prevent hydration mismatch - localStorage access must happen after mount
  const [calendarDebugEnabled, setCalendarDebugEnabled] = useState(false)
  
  // Lifecycle logging
  useEffect(() => {
    // Set debug flag after mount to prevent hydration mismatch
    setCalendarDebugEnabled(isDebugEnabled('CALENDAR'))
    debugLog('CALENDAR', `CalendarView MOUNT: tableId=${tableId}, viewId=${viewId}`)
    // Mark as mounted to prevent hydration mismatch with FullCalendar
    setMounted(true)
    return () => {
      debugLog('CALENDAR', `CalendarView UNMOUNT: tableId=${tableId}, viewId=${viewId}`)
    }
  }, [])
  // CRITICAL: Initialize resolvedTableId from prop immediately (don't wait for useEffect)
  const [resolvedTableId, setResolvedTableId] = useState<string>(tableId || '')
  const [supabaseTableName, setSupabaseTableName] = useState<string | null>(null)
  const [loadedTableFields, setLoadedTableFields] = useState<TableField[]>(tableFields || [])
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [createRecordDate, setCreateRecordDate] = useState<Date | null>(null) // Date for creating new record
  const [linkedValueLabelMaps, setLinkedValueLabelMaps] = useState<Record<string, Record<string, string>>>({})
  const prevCalendarEventsSignatureRef = useRef<string>("")
  const prevCalendarEventsRef = useRef<EventInput[]>([])
  const prevDateFromTimeRef = useRef<number | null>(null)
  const prevDateToTimeRef = useRef<number | null>(null)
  const prevDateFromKeyRef = useRef<string>("")
  const prevDateToKeyRef = useRef<string>("")

  const areLinkedValueMapsEqual = useCallback(
    (a: Record<string, Record<string, string>>, b: Record<string, Record<string, string>>): boolean => {
      if (a === b) return true
      const aKeys = Object.keys(a)
      const bKeys = Object.keys(b)
      if (aKeys.length !== bKeys.length) return false
      for (const k of aKeys) {
        if (!(k in b)) return false
        const aInner = a[k] || {}
        const bInner = b[k] || {}
        const aInnerKeys = Object.keys(aInner)
        const bInnerKeys = Object.keys(bInner)
        if (aInnerKeys.length !== bInnerKeys.length) return false
        for (const ik of aInnerKeys) {
          if (aInner[ik] !== bInner[ik]) return false
        }
      }
      return true
    },
    []
  )

  // Respect block permissions + per-block add-record toggle.
  const showAddRecord = (blockConfig as any)?.appearance?.show_add_record === true
  const permissions = (blockConfig as any)?.permissions || {}
  const isViewOnly = permissions.mode === 'view'
  const allowInlineCreate = permissions.allowInlineCreate ?? true
  const allowOpenRecord = permissions.allowOpenRecord ?? true
  const canCreateRecord = showAddRecord && !isViewOnly && allowInlineCreate
  
  // View config state - calendar settings from view config
  const [viewConfig, setViewConfig] = useState<{
    calendar_date_field?: string | null
    calendar_start_field?: string | null
    calendar_end_field?: string | null
    calendar_color_field?: string | null
    calendar_display_fields?: string[]
    first_day_of_week?: number
    show_weekends?: boolean
    event_density?: 'compact' | 'expanded'
  } | null>(null)

  function formatCardValue(fieldName: string, rowData: Record<string, any> | null | undefined): string | null {
    if (!rowData) return null
    const raw = rowData[fieldName]
    if (raw === null || raw === undefined || raw === '') return null
    const field = loadedTableFields.find((f: TableField) => f.name === fieldName || f.id === fieldName)

    // Multi-select might be stored as array
    if (Array.isArray(raw)) {
      const joined = raw.filter(Boolean).map(String).join(', ')
      return joined.trim() ? joined : null
    }

    if (field?.type === 'checkbox') {
      return raw ? '?' : null
    }

    if (field?.type === 'date') {
      const d = parseDateValueToLocalDate(raw)
      if (d) {
        // DD/MM/YYYY
        return format(d, 'dd/MM/yyyy')
      }
    }

    const s = String(raw).trim()
    return s ? s : null
  }
  
  // Date range filter state
  const [internalDateFrom, setInternalDateFrom] = useState<Date | undefined>(undefined)
  const [internalDateTo, setInternalDateTo] = useState<Date | undefined>(undefined)
  const dateFrom = controlledDateFrom ?? internalDateFrom
  const dateTo = controlledDateTo ?? internalDateTo
  const setDateFrom = onDateFromChange ?? setInternalDateFrom
  const setDateTo = onDateToChange ?? setInternalDateTo
  
  // Use refs to track previous values and prevent infinite loops
  const prevTableFieldsRef = useRef<string>('')
  const prevFiltersRef = useRef<string>('')
  const prevLoadedFieldsKeyRef = useRef<string>('')
  const prevTableIdRef = useRef<string>('')
  const prevViewIdRef = useRef<string>('')
  const isLoadingRef = useRef(false)

  useEffect(() => {
    // Only update if tableId or viewId actually changed (not just reference)
    const tableIdChanged = prevTableIdRef.current !== tableId
    const viewIdChanged = prevViewIdRef.current !== viewId
    
    if (!tableIdChanged && !viewIdChanged) {
      return // No actual change, skip update
    }
    
    // Update refs
    prevTableIdRef.current = tableId || ''
    prevViewIdRef.current = viewId || ''
    
    // If tableId prop changes, update resolvedTableId immediately
    if (tableId && tableId.trim() !== '') {
      if (tableIdChanged) {
        setResolvedTableId(tableId)
      }
    } else {
      // Only try to resolve from viewId if tableId is not provided
      if (viewIdChanged) {
        resolveTableId()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, viewId])

  useEffect(() => {
    if (resolvedTableId) {
      loadTableInfo()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTableId])

  // Load view config when viewId changes
  useEffect(() => {
    if (viewUuid) {
      loadViewConfig()
    }
  }, [viewUuid])

  async function loadViewConfig() {
    if (!viewUuid) return
    
    try {
      const supabase = createClient()
      const { data: view } = await supabase
        .from('views')
        .select('config, table_id')
        .eq('id', viewUuid)
        .single()

      if (view?.config) {
        setViewConfig(view.config as any)
      }
      
      // If tableId wasn't provided but view has table_id, use it
      if (!tableId && view?.table_id) {
        setResolvedTableId(view.table_id)
      }
    } catch (error) {
      debugError('CALENDAR', 'Calendar: Error loading view config:', error)
    }
  }

  // Memoize tableFields to prevent unnecessary re-renders
  const tableFieldsKey = useMemo(() => {
    return JSON.stringify(tableFields?.map(f => ({ id: f.id, name: f.name, type: f.type })) || [])
  }, [tableFields])

  useEffect(() => {
    if (resolvedTableId) {
      // If tableFields prop is provided and not empty, use it
      if (tableFields && tableFields.length > 0) {
        // Ensure fields are in correct format (TableField[])
        const formattedFields: TableField[] = tableFields.map((f: any) => {
          // Handle both TableField and legacy format with field_id/field_name
          const fieldId = 'id' in f ? f.id : ('field_id' in f ? (f as any).field_id : '')
          const fieldName = 'name' in f ? f.name : ('field_name' in f ? (f as any).field_name : '')
          const fieldType = 'type' in f ? f.type : ('field_type' in f ? (f as any).field_type : 'text')
          const tableId = 'table_id' in f ? f.table_id : ''
          
          return {
            id: fieldId || '',
            table_id: tableId || resolvedTableId || '',
            name: fieldName || '',
            type: fieldType as any,
            position: 'position' in f ? f.position : 0,
            options: ('options' in f ? f.options : ('field_options' in f ? (f as any).field_options : {})) || {},
            created_at: 'created_at' in f ? f.created_at : new Date().toISOString()
          }
        })
        // Only update if fields actually changed
        if (prevTableFieldsRef.current !== tableFieldsKey) {
          setLoadedTableFields(formattedFields)
          prevTableFieldsRef.current = tableFieldsKey
        }
      } else {
        // Load table fields if not provided or empty
        if (loadedTableFields.length === 0) {
          loadTableFields()
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTableId, tableFieldsKey])

  // Resolve date field from page config, view config, or fallback to dateFieldId prop
  // Priority: block/page config > view config > dateFieldId prop
  // MUST be declared before combinedFilters which uses it
  const resolvedDateFieldId = useMemo(() => {
    // 1. Check block/page config first (from page settings)
    const pageDateField = blockConfig?.start_date_field || blockConfig?.from_date_field || blockConfig?.date_field || blockConfig?.calendar_date_field
    if (pageDateField) {
      // Validate it exists in table fields and is a date field
      const field = loadedTableFields.find((f: TableField) => 
        (f.name === pageDateField || f.id === pageDateField) && f.type === 'date'
      )
      if (field) {
        debugLog('CALENDAR', 'Using date field from page config:', field.name)
        return field.name
      }
    }
    
    // 2. Check view config
    if (viewConfig?.calendar_date_field) {
      const field = loadedTableFields.find((f: TableField) => 
        (f.name === viewConfig.calendar_date_field || f.id === viewConfig.calendar_date_field) && f.type === 'date'
      )
      if (field) {
        debugLog('CALENDAR', 'Using date field from view config:', field.name)
        return field.name
      }
    }
    if (viewConfig?.calendar_start_field) {
      const field = loadedTableFields.find((f: TableField) => 
        (f.name === viewConfig.calendar_start_field || f.id === viewConfig.calendar_start_field) && f.type === 'date'
      )
      if (field) {
        debugLog('CALENDAR', 'Using start date field from view config:', field.name)
        return field.name
      }
    }
    
    // 3. Fallback to dateFieldId prop
    if (dateFieldId) {
      const field = loadedTableFields.find((f: TableField) => 
        (f.name === dateFieldId || f.id === dateFieldId) && f.type === 'date'
      )
      if (field) {
        debugLog('CALENDAR', 'Using date field from prop:', field.name)
        return field.name
      }
    }
    
    debugWarn('CALENDAR', 'Calendar: No valid date field found.', { blockConfig, viewConfig, dateFieldId })
    return ''
  }, [blockConfig, viewConfig, dateFieldId, loadedTableFields])

  // Memoize filters to prevent unnecessary re-renders
  // Include date range filters in the key
  // CRITICAL: Compare dates by value (formatted string) not by reference to prevent infinite loops
  // Date objects are compared by reference in useMemo, so we need to extract the value first
  // CRITICAL: Use refs to cache previous values and only recalculate when timestamp actually changes
  const dateFromKey = useMemo(() => {
    const currentTime = dateFrom && !isNaN(dateFrom.getTime()) ? dateFrom.getTime() : null
    // Only recalculate if the timestamp actually changed
    if (currentTime === prevDateFromTimeRef.current && prevDateFromKeyRef.current !== '') {
      return prevDateFromKeyRef.current
    }
    prevDateFromTimeRef.current = currentTime
    const key = currentTime && dateFrom ? format(dateFrom, 'yyyy-MM-dd') : ''
    prevDateFromKeyRef.current = key
    return key
  }, [dateFrom ? dateFrom.getTime() : null])
  
  const dateToKey = useMemo(() => {
    const currentTime = dateTo && !isNaN(dateTo.getTime()) ? dateTo.getTime() : null
    // Only recalculate if the timestamp actually changed
    if (currentTime === prevDateToTimeRef.current && prevDateToKeyRef.current !== '') {
      return prevDateToKeyRef.current
    }
    prevDateToTimeRef.current = currentTime
    const key = currentTime && dateTo ? format(dateTo, 'yyyy-MM-dd') : ''
    prevDateToKeyRef.current = key
    return key
  }, [dateTo ? dateTo.getTime() : null])
  
  // CRITICAL: Cache previous filtersKey to prevent unnecessary recalculations
  const prevFiltersKeyRef = useRef<string>("")
  
  const filtersKey = useMemo(() => {
    // Date range is NOT included in filtersKey since it only affects calendar view display (via validRange),
    // not record filtering, so we don't need to reload data when date range changes
    const filtersStr = JSON.stringify(filters || [])
    const newKey = filtersStr
    
    // Only update if key actually changed
    if (newKey === prevFiltersKeyRef.current) {
      return prevFiltersKeyRef.current
    }
    
    prevFiltersKeyRef.current = newKey
    return newKey
  }, [filters])
  
  // CRITICAL: Cache previous combinedFilters to prevent unnecessary recalculations
  const prevCombinedFiltersRef = useRef<string>("")
  
  // Build combined filters (date range is NOT included - it only filters calendar view display, not records)
  // CRITICAL: Use dateFromKey and dateToKey (string values) instead of Date objects to prevent infinite loops
  const combinedFilters = useMemo(() => {
    const baseFilters = filterTree ? stripFilterBlockFilters(filters || []) : (filters || [])
    const allFilters: FilterConfig[] = [...baseFilters]
    
    // NOTE: Date range is NOT added to filters here - it only affects calendar view display via validRange prop
    // This ensures the date range filters the calendar view (which dates are visible) but does NOT filter the records
    
    // CRITICAL: Serialize and compare to prevent unnecessary object creation
    const serialized = JSON.stringify(allFilters)
    if (serialized === prevCombinedFiltersRef.current) {
      // Return cached version if unchanged (this prevents new array reference)
      // We need to reconstruct it, but at least we know it's the same
      return allFilters
    }
    
    prevCombinedFiltersRef.current = serialized
    return allFilters
  }, [filters, filterTree])

  // For "new record defaults" (Airtable-like), include flattened filter-tree conditions as best-effort.
  const combinedFiltersForDefaults = useMemo(() => {
    const out: FilterConfig[] = [...combinedFilters]
    if (!filterTree) return out

    for (const c of flattenFilterTree(filterTree)) {
      if (
        c.operator === "date_range" &&
        c.value &&
        typeof c.value === "object" &&
        "start" in (c.value as any) &&
        "end" in (c.value as any)
      ) {
        const v = c.value as any
        out.push({
          field: c.field_id,
          operator: c.operator as any,
          value: v.start ?? null,
          value2: v.end ?? null,
        })
      } else {
        out.push({
          field: c.field_id,
          operator: c.operator as any,
          value: c.value ?? null,
        })
      }
    }
    return out
  }, [combinedFilters, filterTree])

  // Memoize loadedTableFields key to prevent unnecessary re-renders
  const loadedTableFieldsKey = useMemo(() => {
    return JSON.stringify(loadedTableFields.map((f: TableField) => ({ id: f.id, name: f.name, type: f.type })))
  }, [loadedTableFields])

  // CRITICAL: Track previous combined key to prevent infinite loops
  // This ref is updated synchronously before any async operations
  const prevCombinedKeyRef = useRef<string>("")
  
  useEffect(() => {
    // Prevent concurrent loads
    if (isLoadingRef.current) {
      return
    }
    
    // Early return if critical prerequisites aren't met
    // Note: loadedTableFields are only needed for filtering, not for loading rows
    if (!resolvedTableId || !supabaseTableName) {
      debugLog('CALENDAR', 'Calendar: Skipping loadRows - prerequisites not met', {
        resolvedTableId: !!resolvedTableId,
        supabaseTableName: !!supabaseTableName,
        loadedTableFieldsCount: loadedTableFields.length
      })
      return
    }
    
    // Only reload if filters (including date range), searchQuery, or loadedTableFields actually changed
    const currentFiltersKey = filtersKey
    const currentFieldsKey = loadedTableFieldsKey
    const combinedKey = `${currentFiltersKey}|${searchQuery}|${currentFieldsKey}|${reloadKey ?? 0}`
    
    // CRITICAL: Only reload if the combined key actually changed.
    // DO NOT check rows.length === 0 as it causes infinite loops (React error #185).
    // If a table has 0 rows, that's a valid state and we should not keep reloading.
    // The first load is triggered when prevCombinedKeyRef.current === "" (initial state).
    const previousKey = prevCombinedKeyRef.current
    
    // CRITICAL: Double-check that the key actually changed (defensive check)
    if (previousKey === combinedKey) {
      // Key hasn't changed, skip load
      return
    }
    
    // CRITICAL: Set refs IMMEDIATELY and SYNCHRONOUSLY before calling loadRows to prevent infinite loops
    // This ensures that if the effect runs again before loadRows completes, it won't trigger another load
    prevCombinedKeyRef.current = combinedKey
    prevFiltersRef.current = combinedKey // Keep this for backward compatibility
    
    debugLog('CALENDAR', 'Calendar: Triggering loadRows', {
      previousKey: previousKey.substring(0, 50) + '...',
      newKey: combinedKey.substring(0, 50) + '...',
      keyChanged: true,
      dateFromKey,
      dateToKey,
      hasBothDates: !!(dateFromKey && dateToKey)
    })
    
    // Call loadRows - the isLoadingRef will prevent concurrent calls
    loadRows()
    // Use loadedTableFieldsKey to track actual content changes, not just length
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTableId, supabaseTableName, filtersKey, searchQuery, loadedTableFieldsKey, reloadKey])

  async function resolveTableId() {
    // CRITICAL: tableId prop MUST come from block config (not page fallback)
    // If tableId is provided, use it directly
    if (tableId && tableId.trim() !== '') {
      debugLog('CALENDAR', 'Using tableId from prop:', tableId)
      setResolvedTableId(tableId)
      return
    }

    // If no tableId but we have viewId, fetch the view's table_id (fallback for legacy pages)
    if (!tableId && viewUuid) {
      try {
        const supabase = createClient()
        const { data: view, error } = await supabase
          .from("views")
          .select("table_id")
          .eq("id", viewUuid)
          .single()

        if (error) {
          debugWarn('CALENDAR', 'Calendar: Could not resolve tableId from view:', error)
          setResolvedTableId("")
          setLoading(false)
          return
        }

        if (view?.table_id) {
          debugLog('CALENDAR', 'Resolved tableId from view:', view.table_id)
          setResolvedTableId(view.table_id)
        } else {
          debugWarn('CALENDAR', 'View has no table_id')
          setResolvedTableId("")
          setLoading(false)
        }
      } catch (error) {
        debugError('CALENDAR', 'Calendar: Error resolving tableId:', error)
        setResolvedTableId("")
        setLoading(false)
      }
    } else {
      debugWarn('CALENDAR', 'Calendar: No tableId provided and no viewId fallback')
      setResolvedTableId("")
      setLoading(false)
    }
  }

  async function loadTableInfo() {
    if (!resolvedTableId) return
    
    const sanitizedTableId = resolvedTableId.split(':')[0]
    if (!sanitizedTableId || sanitizedTableId.trim() === '') return

    try {
      const supabase = createClient()
      const { data: table } = await supabase
        .from("tables")
        .select("supabase_table")
        .eq("id", sanitizedTableId)
        .single()

      if (table?.supabase_table) {
        setSupabaseTableName(table.supabase_table)
      }
    } catch (error) {
      debugError('CALENDAR', 'Error loading table info:', error)
    }
  }

  async function loadTableFields() {
    if (!resolvedTableId) return
    
    const sanitizedTableId = resolvedTableId.split(':')[0]
    if (!sanitizedTableId || sanitizedTableId.trim() === '') return

    try {
      const supabase = createClient()
      const { data: fields } = await supabase
        .from("table_fields")
        .select("id, table_id, name, type, position, created_at, options")
        .eq("table_id", sanitizedTableId)
        .order("position", { ascending: true })

      if (fields) {
        setLoadedTableFields(fields.map((f: any) => ({ 
          id: f.id,
          table_id: f.table_id,
          name: f.name, 
          type: f.type,
          position: f.position,
          created_at: f.created_at,
          options: f.options 
        })))
      }
    } catch (error) {
      debugError('CALENDAR', 'Calendar: Error loading table fields:', error)
    }
  }

  async function loadRows() {
    // Gracefully handle missing tableId for SQL-view backed pages
    if (!resolvedTableId || !supabaseTableName) {
      debugLog('CALENDAR', 'Cannot load rows - missing tableId or supabaseTableName', { resolvedTableId, supabaseTableName })
      setRows([])
      setLoading(false)
      isLoadingRef.current = false
      return
    }
    
    // Prevent concurrent loads
    if (isLoadingRef.current) {
      return
    }
    
    isLoadingRef.current = true
    setLoading(true)
    try {
      const supabase = createClient()
      
      // DEBUG logging - always log if debug flag is set
      debugLog('CALENDAR', `[Calendar] Loading rows from table`, {
        tableId: resolvedTableId,
        supabaseTableName,
        filtersCount: filters.length,
        fieldIdsCount: fieldIds.length,
        resolvedDateFieldId,
        viewId
      })
      
      // Build query with filters
      let query = supabase
        .from(supabaseTableName)
        .select("*")

      // Apply filters using shared filter system (includes date range filters)
      const normalizedFields = loadedTableFields.map((f: TableField) => ({ name: f.name || f.id, type: f.type }))
      // Apply filter block tree first (supports groups/OR), then apply remaining flat filters (AND).
      if (filterTree) {
        query = applyFiltersToQuery(query, filterTree, normalizedFields)
      }
      query = applyFiltersToQuery(query, combinedFilters, normalizedFields)

      // Apply search query if provided
      if (searchQuery && fieldIds.length > 0) {
        // For search, we'll filter client-side after loading
        // This is simpler than building complex OR queries
      }

      const { data, error } = await query

      if (error) {
        if (isAbortError(error)) return
        debugError('CALENDAR', 'Calendar: Error loading rows:', {
          error,
          tableId: resolvedTableId,
          supabaseTableName,
          errorCode: (error as any).code,
          errorMessage: error.message
        })
        setRows([])
      } else {
        // Convert flat rows to TableRow format
        const tableRows: TableRow[] = (data || []).map((row: Record<string, unknown> & { id: string; created_at?: string; updated_at?: string }) => ({
          id: row.id,
          table_id: resolvedTableId,
          data: row,
          created_at: row.created_at || new Date().toISOString(),
          updated_at: row.updated_at || new Date().toISOString(),
        }))
        setRows(tableRows)
        
        // DEBUG_CALENDAR: Log loaded rows
        debugLog('CALENDAR', `Loaded ${data?.length || 0} rows from ${supabaseTableName}`, {
          rowCount: data?.length || 0,
          supabaseTableName,
          resolvedDateFieldId,
          sampleRowKeys: tableRows.length > 0 ? Object.keys(tableRows[0].data).slice(0, 10) : []
        })
      }
    } catch (error) {
      if (isAbortError(error)) return
      debugError('CALENDAR', 'Calendar: Exception loading rows:', error)
      setRows([])
    } finally {
      setLoading(false)
      isLoadingRef.current = false
    }
  }

  // Filter rows by search query
  const filteredRows = useMemo(() => {
    // Ensure rows is an array
    if (!Array.isArray(rows)) return []
    if (!searchQuery || !Array.isArray(loadedTableFields) || !loadedTableFields.length) return rows
    
    // Convert TableRow format to flat format for search
    const flatRows = rows.map((row) => ({
      ...row.data,
      _rowId: row.id, // Preserve row ID
    }))
    
    // Filter using search helper - ensure fieldIds is an array
    const safeFieldIds = Array.isArray(fieldIds) ? fieldIds : []
    const filtered = filterRowsBySearch(flatRows, loadedTableFields, searchQuery, safeFieldIds)
    // Ensure filtered is an array before calling map
    if (!Array.isArray(filtered)) return rows
    const filteredIds = new Set(filtered.map((r) => r._rowId))
    
    // Map back to TableRow format
    return rows.filter((row) => filteredIds.has(row.id))
  }, [rows, loadedTableFields, searchQuery, fieldIds])

  // Resolve display labels for any link_to_table fields shown on calendar cards.
  useEffect(() => {
    let cancelled = false

    async function load() {
      const idsToResolve = new Map<string, { field: LinkedField; ids: Set<string> }>()

      const resolveFieldObj = (raw: string) => {
        const trimmed = String(raw || "").trim()
        if (!trimmed) return null
        return loadedTableFields.find((f: TableField) => f.name === trimmed || f.id === trimmed) || null
      }

      for (const fid of Array.isArray(fieldIds) ? fieldIds : []) {
        const f = resolveFieldObj(fid)
        if (!f || f.type !== "link_to_table") continue
        if (!idsToResolve.has(f.name)) idsToResolve.set(f.name, { field: f as LinkedField, ids: new Set<string>() })
      }

      if (idsToResolve.size === 0) {
        setLinkedValueLabelMaps((prev: Record<string, Record<string, string>>) => (Object.keys(prev).length === 0 ? prev : {}))
        return
      }

      for (const row of Array.isArray(filteredRows) ? filteredRows : []) {
        for (const { field, ids } of idsToResolve.values()) {
          const fieldValue = getLinkedFieldValueFromRow(row as { data?: Record<string, unknown> }, field)
          for (const id of linkedValueToIds(fieldValue)) ids.add(id)
        }
      }

      const next: Record<string, Record<string, string>> = {}
      for (const { field, ids } of idsToResolve.values()) {
        if (ids.size === 0) continue
        const map = await resolveLinkedFieldDisplayMap(field, Array.from(ids))
        const obj = Object.fromEntries(map.entries())
        next[field.name] = obj
        next[(field as any).id] = obj
      }

      if (!cancelled) {
        setLinkedValueLabelMaps((prev: Record<string, Record<string, string>>) => (areLinkedValueMapsEqual(prev, next) ? prev : next))
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [filteredRows, loadedTableFields, fieldIds, areLinkedValueMapsEqual])


  // Find date field in loadedTableFields to validate it exists and is a date type
  const dateField = useMemo(() => {
    if (!resolvedDateFieldId || !loadedTableFields.length) return null
    // Try to find by name first, then by id
    return loadedTableFields.find((f: TableField) => 
      f.name === resolvedDateFieldId || 
      f.id === resolvedDateFieldId
    )
  }, [resolvedDateFieldId, loadedTableFields])

  const isValidDateField = useMemo(() => {
    if (!dateField) return false
    const fieldType = dateField.type
    return fieldType === 'date'
  }, [dateField])

  // Get start and end fields from view config
  const startField = useMemo(() => {
    if (!viewConfig?.calendar_start_field || !loadedTableFields.length) return null
    return loadedTableFields.find((f: TableField) => 
      f.name === viewConfig.calendar_start_field || 
      f.id === viewConfig.calendar_start_field
    )
  }, [viewConfig, loadedTableFields])

  const endField = useMemo(() => {
    if (!viewConfig?.calendar_end_field || !loadedTableFields.length) return null
    return loadedTableFields.find((f: TableField) => 
      f.name === viewConfig.calendar_end_field || 
      f.id === viewConfig.calendar_end_field
    )
  }, [viewConfig, loadedTableFields])

  function resolveCalendarDateFieldNames(): { fromFieldName: string; toFieldName: string | null } {
    // Primary ("from") field resolution: block config > view config (start) > resolvedDateFieldId
    const blockFromField =
      blockConfig?.date_from ||
      blockConfig?.from_date_field ||
      blockConfig?.start_date_field ||
      blockConfig?.calendar_start_field

    const resolvedFromField = blockFromField
      ? loadedTableFields.find(
          (f: TableField) => (f.name === blockFromField || f.id === blockFromField) && f.type === "date"
        )
      : null

    const viewStartField = viewConfig?.calendar_start_field
    const resolvedViewStartField = viewStartField
      ? loadedTableFields.find(
          (f: TableField) => (f.name === viewStartField || f.id === viewStartField) && f.type === "date"
        )
      : null

    const fromFieldName =
      resolvedFromField?.name ||
      startField?.name ||
      resolvedViewStartField?.name ||
      (typeof viewStartField === "string" ? viewStartField : "") ||
      resolvedDateFieldId ||
      ""

    // Secondary ("to") field resolution: block config > view config (end) > null
    const blockToField =
      blockConfig?.date_to ||
      blockConfig?.to_date_field ||
      blockConfig?.end_date_field ||
      blockConfig?.calendar_end_field

    const resolvedToField = blockToField
      ? loadedTableFields.find(
          (f: TableField) => (f.name === blockToField || f.id === blockToField) && f.type === "date"
        )
      : null

    const viewEndField = viewConfig?.calendar_end_field
    const resolvedViewEndField = viewEndField
      ? loadedTableFields.find(
          (f: TableField) => (f.name === viewEndField || f.id === viewEndField) && f.type === "date"
        )
      : null

    const toFieldName =
      resolvedToField?.name ||
      endField?.name ||
      resolvedViewEndField?.name ||
      (typeof viewEndField === "string" ? viewEndField : "") ||
      null

    return { fromFieldName, toFieldName }
  }

  // CRITICAL: Memoize handleEventDrop to prevent FullCalendar infinite update loops
  // This callback must be stable across renders to prevent React error #185
  // Use ref to access latest loadRows function without including it in dependencies
  const loadRowsRef = useRef<() => Promise<void>>()
  loadRowsRef.current = loadRows
  
  const handleEventDrop = useCallback(async (info: EventDropArg) => {
    const rowId = info.event?.id
    const newStart = info.event?.start

    if (!rowId || !newStart) {
      return
    }

    if (!supabaseTableName) {
      debugWarn('CALENDAR', "Calendar: Cannot persist drop - missing supabaseTableName")
      info.revert()
      return
    }

    const { fromFieldName, toFieldName } = resolveCalendarDateFieldNames()
    if (!fromFieldName) {
      debugWarn('CALENDAR', "Calendar: Cannot persist drop - missing fromFieldName", {
        rowId,
        resolvedDateFieldId,
        viewConfig,
        blockConfig,
      })
      info.revert()
      return
    }

    // Prefer original values from our row state, fallback to FullCalendar's oldEvent.
    // Use ref to get latest rows without causing callback recreation
    const currentRow = rowsRef.current.find((r: TableRow) => r.id === rowId)
    const currentRowData = currentRow?.data || (info.event.extendedProps as any)?.rowData

    const oldFromRaw = currentRowData?.[fromFieldName]
    const oldFromDate = parseDateValueToLocalDate(oldFromRaw) || info.oldEvent?.start || null

    const newFromDay = startOfDay(newStart)
    const newFromValue = format(newFromDay, "yyyy-MM-dd")

    // Update end field (if configured) by shifting it by the same delta as the start date.
    const updates: Record<string, any> = { [fromFieldName]: newFromValue }
    if (toFieldName && currentRowData?.[toFieldName] && oldFromDate && !isNaN(oldFromDate.getTime())) {
      const oldToRaw = currentRowData[toFieldName]
      const oldToDate = parseDateValueToLocalDate(oldToRaw)
      if (oldToDate) {
        const deltaDays = differenceInCalendarDays(newFromDay, startOfDay(oldFromDate))
        const newToDate = addDays(startOfDay(oldToDate), deltaDays)
        updates[toFieldName] = format(newToDate, "yyyy-MM-dd")
      }
    }

    // Optimistic UI update (so the event stays put even if we don't reload immediately).
    setRows((prev: TableRow[]) =>
      prev.map((r: TableRow) =>
        r.id === rowId
          ? {
              ...r,
              data: {
                ...(r.data || {}),
                ...updates,
              },
            }
          : r
      )
    )

    try {
      const supabase = createClient()
      const { error } = await supabase.from(supabaseTableName).update(updates).eq("id", rowId)
      if (error) {
        throw error
      }

      // Ensure the UI is in sync with any DB-side transforms.
      if (loadRowsRef.current) {
        await loadRowsRef.current()
      }
    } catch (error) {
      debugError('CALENDAR', "Calendar: Failed to persist event drop", {
        error,
        rowId,
        supabaseTableName,
        updates,
      })
      const e = error as any
      const message = e?.message || "Unknown error"
      const code = e?.code ? ` (code: ${e.code})` : ""
      alert(`Failed to save change${code}: ${message}`)
      info.revert()
      if (loadRowsRef.current) {
        await loadRowsRef.current()
      }
    }
  }, [supabaseTableName, resolvedDateFieldId, blockConfig, viewConfig, loadedTableFields, startField, endField])

  function getEvents(): EventInput[] {
    // Use resolved date field from config or fallback
    const effectiveDateField = dateField
    const effectiveDateFieldId = resolvedDateFieldId
    
    // Defensive check: ensure we have a valid date field
    if (!effectiveDateFieldId || !isValidDateField) {
      debugWarn('CALENDAR', 'Calendar: Cannot generate events - missing or invalid date field', {
        resolvedDateFieldId,
        isValidDateField,
        dateField,
        blockConfig,
        viewConfig
      })
      return []
    }
    
    // Defensive check: ensure we have rows
    if (!filteredRows || filteredRows.length === 0) {
      debugLog('CALENDAR', 'Calendar: No rows to generate events from', {
        totalRows: rows.length,
        filteredRows: filteredRows?.length || 0,
        searchQuery,
        filtersCount: filters.length
      })
      return []
    }
    
    // Defensive check: log if rows exist but events will be empty
    debugLog('CALENDAR', 'Calendar: Processing events', {
      enabled: filteredRows.length > 0,
      rowCount: filteredRows.length,
      dateField: effectiveDateFieldId,
      sampleRowKeys: filteredRows[0]?.data ? Object.keys(filteredRows[0].data).slice(0, 10) : []
    })
    
    try {
      // CRITICAL: Use field NAME (not ID) when reading row data
      // Supabase row keys are field names, not IDs
      // Priority: block config > view config > resolved field
      const actualFieldName = effectiveDateField?.name || effectiveDateFieldId
      
      // DEBUG_CALENDAR: Log date field resolution
      debugLog('CALENDAR', 'Date field resolution for events', {
        effectiveDateFieldId,
        effectiveDateFieldName: effectiveDateField?.name,
        actualFieldName,
        sampleRowKeys: filteredRows[0]?.data ? Object.keys(filteredRows[0].data).slice(0, 10) : []
      })
      
      // Resolve date_from field (default/primary): block config > view config > auto-detect > null
      // Check for date_from, from_date_field, start_date_field, calendar_start_field
      const blockFromField = blockConfig?.date_from || blockConfig?.from_date_field || blockConfig?.start_date_field || blockConfig?.calendar_start_field
      const resolvedFromField = blockFromField 
        ? loadedTableFields.find((f: TableField) => (f.name === blockFromField || f.id === blockFromField) && f.type === 'date')
        : null
      
      // #region agent log
      if (process.env.NODE_ENV === 'development') {
        console.log(`[CalendarView] Date field resolution - FROM: blockFromField=${blockFromField}, resolvedFromField=${resolvedFromField?.name || 'null'}, startField=${startField?.name || 'null'}`)
      }
      // #endregion
      
      // Auto-detect date_from field if not configured (look for fields named "date_from", "from_date", "start_date", etc.)
      let autoDetectedFromField: TableField | null = null
      if (!resolvedFromField && !startField && !viewConfig?.calendar_start_field) {
        autoDetectedFromField = loadedTableFields.find((f: TableField) => 
          f.type === 'date' && (
            f.name.toLowerCase() === 'date_from' || 
            f.name.toLowerCase() === 'from_date' ||
            f.name.toLowerCase() === 'start_date' ||
            f.name.toLowerCase().includes('date_from') ||
            f.name.toLowerCase().includes('from_date')
          )
        ) ?? null
      }
      
      const actualFromFieldName = resolvedFromField?.name || startField?.name || viewConfig?.calendar_start_field || autoDetectedFromField?.name || actualFieldName || null
      
      // Resolve date_to field (secondary/range): block config > view config > auto-detect > null
      // Check for date_to, to_date_field, end_date_field, calendar_end_field
      const blockToField = blockConfig?.date_to || blockConfig?.to_date_field || blockConfig?.end_date_field || blockConfig?.calendar_end_field
      const resolvedToField = blockToField
        ? loadedTableFields.find((f: TableField) => (f.name === blockToField || f.id === blockToField) && f.type === 'date')
        : null
      
      // #region agent log
      if (process.env.NODE_ENV === 'development') {
        console.log(`[CalendarView] Date field resolution - TO: blockToField=${blockToField}, resolvedToField=${resolvedToField?.name || 'null'}, endField=${endField?.name || 'null'}`)
      }
      // #endregion
      
      // Auto-detect date_to field if not configured (look for fields named "date_to", "to_date", "end_date", etc.)
      let autoDetectedToField: TableField | null = null
      if (!resolvedToField && !endField && !viewConfig?.calendar_end_field) {
        autoDetectedToField = loadedTableFields.find((f: TableField) => 
          f.type === 'date' && (
            f.name.toLowerCase() === 'date_to' || 
            f.name.toLowerCase() === 'to_date' ||
            f.name.toLowerCase() === 'end_date' ||
            f.name.toLowerCase().includes('date_to') ||
            f.name.toLowerCase().includes('to_date')
          )
        ) ?? null
      }
      
      const actualToFieldName = resolvedToField?.name || endField?.name || viewConfig?.calendar_end_field || autoDetectedToField?.name || null
      
      // #region agent log
      if (process.env.NODE_ENV === 'development') {
        console.log(`[CalendarView] Final date field names: actualFromFieldName=${actualFromFieldName}, actualToFieldName=${actualToFieldName}`)
        // Warn if date fields are configured but invalid
        if (blockFromField && !resolvedFromField && !startField && !viewConfig?.calendar_start_field && !autoDetectedFromField) {
          console.warn(`[CalendarView] Configured FROM date field "${blockFromField}" not found in table fields`)
        }
        if (blockToField && !resolvedToField && !endField && !viewConfig?.calendar_end_field && !autoDetectedToField) {
          console.warn(`[CalendarView] Configured TO date field "${blockToField}" not found in table fields`)
        }
      }
      // #endregion
      
      // CRITICAL: If both date fields are configured but invalid, return empty events to prevent infinite loop
      // This prevents React #185 when calendar tries to resolve invalid date fields repeatedly
      if (blockFromField && !actualFromFieldName && blockToField && !actualToFieldName) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[CalendarView] Both date fields are invalid - returning empty events to prevent loop`, {
            blockFromField,
            blockToField,
            loadedTableFieldsCount: loadedTableFields.length
          })
        }
        return []
      }
      
      if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development' && filteredRows.length > 0) {
        debugLog('CALENDAR', 'Calendar: Date field resolution', {
          actualFieldName,
          actualFromFieldName,
          actualToFieldName,
          blockConfig: { date_from: blockConfig?.date_from, date_to: blockConfig?.date_to, start_date_field: blockConfig?.start_date_field, end_date_field: blockConfig?.end_date_field },
          viewConfig: { calendar_start_field: viewConfig?.calendar_start_field, calendar_end_field: viewConfig?.calendar_end_field }
        })
      }
      
      // CRITICAL: Log sample row data to debug date field extraction
      if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development' && filteredRows.length > 0) {
        const sampleRow = filteredRows[0]
        debugLog('CALENDAR', 'Calendar: Sample row data for event mapping', {
          rowId: sampleRow.id,
          dateFromFieldName: actualFromFieldName,
          dateToFieldName: actualToFieldName,
          dateFromValue: sampleRow.data ? sampleRow.data[actualFromFieldName || ''] : 'no data',
          dateToValue: sampleRow.data ? sampleRow.data[actualToFieldName || ''] : 'no data',
          allDataKeys: sampleRow.data ? Object.keys(sampleRow.data) : [],
          rowDataSample: sampleRow.data ? Object.fromEntries(
            Object.entries(sampleRow.data).slice(0, 5)
          ) : null
        })
      }
      
      const events = filteredRows
        .filter((row: TableRow) => {
          if (!row || !row.data) {
            debugWarn('CALENDAR', 'Calendar: Row missing or has no data', { rowId: row?.id })
            return false
          }
          
          // Check for date values - prefer date_from (default), fallback to date_to if only that exists
          let fromDateValue: unknown = null
          let toDateValue: unknown = null
          
          // Try to get date_from value
          if (actualFromFieldName) {
            fromDateValue = row.data[actualFromFieldName]
            // Also try common variations (case-insensitive, with/without underscores)
            if (!fromDateValue) {
              const lowerFieldName = actualFromFieldName.toLowerCase()
              for (const key of Object.keys(row.data)) {
                if (key.toLowerCase() === lowerFieldName) {
                  fromDateValue = row.data[key]
                  break
                }
              }
            }
          }
          
          // Try to get date_to value
          if (actualToFieldName) {
            toDateValue = row.data[actualToFieldName]
            // Also try common variations (case-insensitive, with/without underscores)
            if (!toDateValue) {
              const lowerFieldName = actualToFieldName.toLowerCase()
              for (const key of Object.keys(row.data)) {
                if (key.toLowerCase() === lowerFieldName) {
                  toDateValue = row.data[key]
                  break
                }
              }
            }
          }
          
          // Use date_from as default, fallback to date_to if date_from is not available
          const dateValue = fromDateValue || toDateValue
          
          // Skip if no date value at all
          if (!dateValue || dateValue === null || dateValue === undefined || dateValue === '') {
            debugLog('CALENDAR', 'Calendar: Row filtered out - no date value', {
              enabled: filteredRows.length <= 5,
              rowId: row.id,
              dateFromField: actualFromFieldName,
              dateToField: actualToFieldName,
              availableKeys: Object.keys(row.data)
            })
            return false
          }
          
          // Try to parse the date value
          try {
            const parsedDate = dateValue instanceof Date ? dateValue : new Date(String(dateValue))
            // Check if date is valid
            const isValid = !isNaN(parsedDate.getTime())
            if (!isValid) {
              debugWarn('CALENDAR', 'Calendar: Row filtered out - invalid date', {
                rowId: row.id,
                dateValue,
                parsedDate
              })
            }
            return isValid
          } catch (error) {
            debugWarn('CALENDAR', 'Calendar: Row filtered out - date parse error', {
              rowId: row.id,
              dateValue,
              error
            })
            return false
          }
        })
        // Ensure we have an array before mapping
        .filter((row: TableRow): row is TableRow => row !== null && row !== undefined)
        .map((row: TableRow) => {
          // Get date values - use date_from (default) and date_to (if available for range)
          let fromDateValue: unknown = null
          let toDateValue: unknown = null
          
          // Try to get date_from value
          if (actualFromFieldName) {
            fromDateValue = row.data[actualFromFieldName]
            // Also try common variations (case-insensitive, with/without underscores)
            if (!fromDateValue) {
              const lowerFieldName = actualFromFieldName.toLowerCase()
              for (const key of Object.keys(row.data)) {
                if (key.toLowerCase() === lowerFieldName) {
                  fromDateValue = row.data[key]
                  break
                }
              }
            }
          }
          
          // Try to get date_to value
          if (actualToFieldName) {
            toDateValue = row.data[actualToFieldName]
            // Also try common variations (case-insensitive, with/without underscores)
            if (!toDateValue) {
              const lowerFieldName = actualToFieldName.toLowerCase()
              for (const key of Object.keys(row.data)) {
                if (key.toLowerCase() === lowerFieldName) {
                  toDateValue = row.data[key]
                  break
                }
              }
            }
          }
          
          // Parse date values
          // Use date_from as default start date, fallback to date_to if date_from is not available.
          // IMPORTANT: FullCalendar treats `end` as EXCLUSIVE for all-day events.
          // Our `date_to` is stored as an inclusive end date, so we must add +1 day.
          const parsedStart = parseDateValueToLocalDate(fromDateValue || toDateValue) || new Date()
          const parsedStartDay = startOfDay(parsedStart)

          let parsedEndExclusive: Date | undefined = undefined
          if (toDateValue) {
            const parsedEnd = parseDateValueToLocalDate(toDateValue) || parsedStartDay
            const parsedEndDay = startOfDay(parsedEnd)
            const inclusiveEndDay = parsedEndDay < parsedStartDay ? parsedStartDay : parsedEndDay
            parsedEndExclusive = addDays(inclusiveEndDay, 1)
          }
          
          // Use visible fields (fieldIds) to determine title - prefer first text field
          // Also check for primary field (name field) or first non-date field
          const visibleFieldsForTitle = (Array.isArray(fieldIds) ? fieldIds : [])
            .filter((fid: string) => {
              const field = loadedTableFields.find((f: TableField) => f.name === fid || f.id === fid)
              // Exclude date fields from title
              return field && 
                field.type !== 'date' && 
                field.name !== actualFieldName && 
                field.name !== actualFromFieldName &&
                field.name !== actualToFieldName &&
                field.id !== effectiveDateFieldId
            })
          
          // Find primary field (name field) or first text field for title
          const primaryField = loadedTableFields.find((f: TableField) => 
            f.type === 'text' && (f.name.toLowerCase() === 'name' || f.name.toLowerCase() === 'title')
          )
          
          const titleFieldId = primaryField 
            ? (primaryField.name || primaryField.id)
            : visibleFieldsForTitle.find((fid: string) => {
                const field = loadedTableFields.find((f: TableField) => f.name === fid || f.id === fid)
                return field && (field.type === 'text' || field.type === 'long_text')
              }) || visibleFieldsForTitle[0]
          
          // Find the actual field name for title
          const titleFieldObj = loadedTableFields.find((f: TableField) => 
            (f.name === titleFieldId || f.id === titleFieldId) || 
            (primaryField && (f.name === primaryField.name || f.id === primaryField.id))
          ) || (primaryField ? primaryField : null)
          
          const titleFieldName = titleFieldObj?.name || titleFieldId
          
          // Extract title from row data
          let title = "Untitled"
          let titleValue: unknown = null
          if (titleFieldName && row.data[titleFieldName]) {
            titleValue = row.data[titleFieldName]
            title = String(row.data[titleFieldName])
          } else if (titleFieldId && row.data[titleFieldId]) {
            titleValue = row.data[titleFieldId]
            title = String(row.data[titleFieldId])
          } else {
            // Fallback: use first non-date, non-id field
            for (const [key, value] of Object.entries(row.data)) {
              if (key !== 'id' && key !== actualFromFieldName && key !== actualToFieldName && key !== actualFieldName && value) {
                titleValue = value
                title = String(value)
                break
              }
            }
          }

          // Get color from color field if configured
          // Priority: props colorField > viewConfig calendar_color_field
          let eventColor: string | undefined = undefined
          const colorFieldToUse = colorField || viewConfig?.calendar_color_field
          
          if (colorFieldToUse) {
            // Find the color field object
            const colorFieldObj = loadedTableFields.find((f: TableField) => 
              (f.name === colorFieldToUse || f.id === colorFieldToUse) && 
              (f.type === 'single_select' || f.type === 'multi_select')
            )
            
            if (colorFieldObj) {
              const colorFieldName = colorFieldObj.name
              const colorValue = row.data[colorFieldName]
              
              // If color field is a select field, use centralized color system
              if (colorValue && (colorFieldObj.type === 'single_select' || colorFieldObj.type === 'multi_select')) {
                const normalizedValue = String(colorValue).trim()
                eventColor = normalizeHexColor(
                  resolveChoiceColor(
                    normalizedValue,
                    colorFieldObj.type,
                    colorFieldObj.options,
                    colorFieldObj.type === 'single_select'
                  )
                )
              }
            }
          }

          // Get image from image field if configured
          let eventImage: string | undefined = undefined
          if (imageField) {
            const imageValue = row.data[imageField]
            if (imageValue) {
              // Handle attachment field (array of URLs) or URL field (single URL)
              if (Array.isArray(imageValue) && imageValue.length > 0) {
                eventImage = imageValue[0]
              } else if (typeof imageValue === 'string' && (imageValue.startsWith('http') || imageValue.startsWith('/'))) {
                eventImage = imageValue
              }
            }
          }

          // Evaluate conditional formatting rules for calendar events
          const matchingRule = highlightRules && highlightRules.length > 0
            ? evaluateHighlightRules(highlightRules, row.data, loadedTableFields)
            : null
          
          // Get formatting style for row-level rules
          const rowFormattingStyle = matchingRule && matchingRule.scope !== 'cell'
            ? getFormattingStyle(matchingRule)
            : {}
          
          // Use conditional formatting colors if available, otherwise use colorField colors
          const finalBackgroundColor = rowFormattingStyle.backgroundColor || eventColor
          const finalTextColor = rowFormattingStyle.color || (eventColor ? (() => {
            // Calculate text color based on background luminance
            if (!eventColor.startsWith('#')) return '#000000'
            const r = parseInt(eventColor.slice(1, 3), 16)
            const g = parseInt(eventColor.slice(3, 5), 16)
            const b = parseInt(eventColor.slice(5, 7), 16)
            const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
            return luminance > 0.5 ? '#000000' : '#ffffff'
          })() : undefined)

          return {
            id: row.id,
            title: title || "Untitled",
            allDay: true,
            start: parsedStartDay,
            end: parsedEndExclusive,
            backgroundColor: finalBackgroundColor,
            borderColor: finalBackgroundColor,
            textColor: finalTextColor,
            extendedProps: {
              rowId: row.id,
              rowData: row.data,
              image: eventImage,
              fitImageSize,
              titleField: titleFieldObj,
              titleValue,
              // Calendar cards use the ordered "Fields to Show on Cards/Table" selection (fieldIds).
              // We display up to 3 fields (values) to avoid overly tall events.
              cardFields: (() => {
                // Important: the title is rendered separately in eventContent, so exclude the title field
                // from the cardFields list to avoid duplicate lines (e.g. "Content Name" appearing twice).
                const exclude = new Set<string>([
                  'id',
                  'created_at',
                  'updated_at',
                  actualFieldName || '',
                  actualFromFieldName || '',
                  actualToFieldName || '',
                  titleFieldName || '',
                ])

                const resolvedNamesRaw = (Array.isArray(fieldIds) ? fieldIds : [])
                  .map((fid: string) => {
                    const f = loadedTableFields.find((x: TableField) => x.name === fid || x.id === fid)
                    return f?.name || fid
                  })
                  .filter((name: string) => name && !exclude.has(name))

                // De-dupe while preserving order (fieldIds may include both id and name forms).
                const resolvedNames: string[] = []
                const seen = new Set<string>()
                for (const name of resolvedNamesRaw) {
                  if (seen.has(name)) continue
                  seen.add(name)
                  resolvedNames.push(name)
                }

                const items = resolvedNames
                  .map((name: string) => {
                    const field = loadedTableFields.find((f: TableField) => f.name === name)
                    if (!field) return null
                    // Skip non-card-friendly types
                    if (field.type === 'date' || field.type === 'attachment') return null

                    const raw = (row.data as any)?.[field.name]
                    const isEmpty =
                      raw === null ||
                      raw === undefined ||
                      raw === "" ||
                      (Array.isArray(raw) && raw.length === 0)
                    if (isEmpty) return null
                    return { field, value: raw }
                  })
                  .filter((x): x is { field: TableField; value: unknown } => Boolean(x))

                return items.slice(0, 3)
              })(),
            },
          }
        })
      
      // DEBUG_CALENDAR: Log event generation
      if (events.length === 0 && filteredRows.length > 0) {
        debugWarn('CALENDAR', `No events generated from ${filteredRows.length} rows`, {
          dateField: effectiveDateFieldId,
          resolvedDateFieldId,
          sampleRowData: filteredRows[0]?.data ? {
            id: filteredRows[0].id,
            dateFieldValue: filteredRows[0].data[effectiveDateFieldId],
            allKeys: Object.keys(filteredRows[0].data)
          } : null,
          check: 'Ensure date field is correctly configured and rows have valid date values'
        })
      } else if (events.length > 0) {
        debugLog('CALENDAR', `Generated ${events.length} events successfully`, {
          eventCount: events.length,
          rowCount: filteredRows.length,
          dateField: effectiveDateFieldId,
          sampleEvent: events[0] ? {
            id: events[0].id,
            title: events[0].title,
            start: events[0].start
          } : null
        })
      }
      return events
    } catch (error) {
      debugError('CALENDAR', 'Calendar: Error generating events:', error)
      return []
    }
  }

  // FullCalendar can get into internal update loops if `events` changes identity on
  // unrelated parent re-renders (especially when event objects contain new Date instances).
  // Memoize to only regenerate when the underlying data/config that affects events changes.
  // CRITICAL: Use JSON.stringify of blockConfig to create stable key even if object reference changes
  const blockConfigEventKey = useMemo(() => {
    const bc: Record<string, unknown> = blockConfig || {}
    return JSON.stringify({
      date_from: bc?.date_from ?? null,
      date_to: bc?.date_to ?? null,
      from_date_field: bc?.from_date_field ?? null,
      to_date_field: bc?.to_date_field ?? null,
      start_date_field: bc?.start_date_field ?? null,
      end_date_field: bc?.end_date_field ?? null,
      calendar_start_field: bc?.calendar_start_field ?? null,
      calendar_end_field: bc?.calendar_end_field ?? null,
      calendar_date_field: bc?.calendar_date_field ?? null,
      date_field: bc?.date_field ?? null,
    })
  }, [
    blockConfig?.date_from,
    blockConfig?.date_to,
    blockConfig?.from_date_field,
    blockConfig?.to_date_field,
    blockConfig?.start_date_field,
    blockConfig?.end_date_field,
    blockConfig?.calendar_start_field,
    blockConfig?.calendar_end_field,
    blockConfig?.calendar_date_field,
    blockConfig?.date_field,
  ])

  const viewConfigEventKey = useMemo(() => {
    return JSON.stringify({
      calendar_date_field: viewConfig?.calendar_date_field ?? null,
      calendar_start_field: viewConfig?.calendar_start_field ?? null,
      calendar_end_field: viewConfig?.calendar_end_field ?? null,
      calendar_color_field: viewConfig?.calendar_color_field ?? null,
    })
  }, [
    viewConfig?.calendar_date_field,
    viewConfig?.calendar_start_field,
    viewConfig?.calendar_end_field,
    viewConfig?.calendar_color_field,
  ])

  // CRITICAL: Ref to prevent infinite loops when getEvents() is called during render
  const isCalculatingEventsRef = useRef(false)
  const prevDepsRef = useRef<string>('')
  
  // Get events for rendering (hook; declared before early returns)
  const computedCalendarEvents = useMemo(() => {
    // Guard against concurrent calculations
    if (isCalculatingEventsRef.current) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[CalendarView] getEvents() called concurrently - returning empty to prevent loop`)
      }
      return []
    }
    
    // Track dependencies to detect what's changing
    const currentDeps = JSON.stringify({
      filteredRowsCount: filteredRows?.length || 0,
      filteredRowsId: filteredRows?.[0]?.id || 'none',
      searchQuery,
      filtersKey,
      resolvedDateFieldId,
      isValidDateField,
      loadedTableFieldsKey: loadedTableFieldsKey?.substring(0, 50),
      fieldIdsLength: fieldIds?.length || 0,
      colorFieldId: colorField || 'none',
      imageFieldId: imageField || 'none',
      fitImageSize,
      blockConfigEventKey: blockConfigEventKey?.substring(0, 50),
      viewConfigEventKey: viewConfigEventKey?.substring(0, 50),
    })
    
    if (process.env.NODE_ENV === 'development') {
      if (prevDepsRef.current && prevDepsRef.current !== currentDeps) {
        console.log(`[CalendarView] computedCalendarEvents dependencies changed:`, {
          prev: JSON.parse(prevDepsRef.current),
          current: JSON.parse(currentDeps),
        })
      }
      prevDepsRef.current = currentDeps
    }
    
    isCalculatingEventsRef.current = true
    try {
      // #region agent log
      if (process.env.NODE_ENV === 'development') {
        console.log(`[CalendarView] computedCalendarEvents useMemo recalculating`)
      }
      // #endregion
      const events = getEvents()
      // #region agent log
      if (process.env.NODE_ENV === 'development') {
        console.log(`[CalendarView] computedCalendarEvents useMemo completed`, { eventsCount: events?.length || 0 })
      }
      // #endregion
      return events
    } finally {
      isCalculatingEventsRef.current = false
    }
  }, [
    // Data that affects which rows become events
    filteredRows,
    searchQuery,
    filtersKey,
    // Field/config that affects mapping
    resolvedDateFieldId,
    isValidDateField,
    loadedTableFieldsKey,
    fieldIds,
    colorField,
    imageField,
    fitImageSize,
    blockConfigEventKey,
    viewConfigEventKey,
  ])

  // Make `events` prop stable across unrelated re-renders to avoid FullCalendar internal update loops.
  // We intentionally derive a lightweight signature from stable primitives.
  const calendarEvents = useMemo(() => {
    // CRITICAL: Guard against invalid events that could cause infinite loops
    if (!Array.isArray(computedCalendarEvents)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[CalendarView] computedCalendarEvents is not an array:`, typeof computedCalendarEvents)
      }
      return prevCalendarEventsRef.current || []
    }
    
    try {
      const signature = computedCalendarEvents
        .map((e: EventInput, index: number) => {
          try {
            // Guard against null/undefined events
            if (!e || typeof e !== 'object') {
              if (process.env.NODE_ENV === 'development') {
                console.warn(`[CalendarView] Invalid event at index ${index}:`, e)
              }
              return ''
            }
            
            const startMs =
              e?.start instanceof Date ? e.start.getTime() : typeof e?.start === "number" ? e.start : String(e?.start || "")
            const endMs =
              e?.end instanceof Date ? e.end.getTime() : typeof e?.end === "number" ? e.end : String(e?.end || "")
            const bg = String(e?.backgroundColor || "")
            const title = String(e?.title || "")
            const id = String(e?.id || "")
            const image = String(e?.extendedProps?.image || "")
            const cards = Array.isArray(e?.extendedProps?.cardFields)
              ? e.extendedProps.cardFields
                  .map((cf: { field?: { id?: string; name?: string }; value?: unknown }) => {
                    try {
                      return `${String(cf?.field?.id || cf?.field?.name || "")}=${String(cf?.value ?? "")}`
                    } catch (err) {
                      if (process.env.NODE_ENV === 'development') {
                        console.warn(`[CalendarView] Error processing card field:`, err, cf)
                      }
                      return ''
                    }
                  })
                  .filter(Boolean)
                  .join(",")
              : ""
            return `${id}|${title}|${startMs}|${endMs}|${bg}|${image}|${cards}`
          } catch (err) {
            if (process.env.NODE_ENV === 'development') {
              console.error(`[CalendarView] Error processing event at index ${index}:`, err, e)
            }
            return ''
          }
        })
        .filter(Boolean) // Remove empty strings from invalid events
        .join("~")

      if (prevCalendarEventsSignatureRef.current === signature) {
        return prevCalendarEventsRef.current
      }
      prevCalendarEventsSignatureRef.current = signature
      prevCalendarEventsRef.current = computedCalendarEvents
      return computedCalendarEvents
    } catch (err) {
      // CRITICAL: If signature calculation fails, return previous events to prevent infinite loop
      if (process.env.NODE_ENV === 'development') {
        console.error(`[CalendarView] Error calculating calendar events signature:`, err, {
          eventsCount: computedCalendarEvents.length,
          sampleEvent: computedCalendarEvents[0]
        })
      }
      return prevCalendarEventsRef.current || []
    }
  }, [computedCalendarEvents])

  // FullCalendar: keep option prop references stable to avoid internal update loops.
  // IMPORTANT: Hooks must be declared before any early returns.
  const calendarPlugins = useMemo(() => [dayGridPlugin, interactionPlugin], [])
  const calendarHeaderToolbar = useMemo(
    () => ({
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,dayGridWeek",
    }),
    []
  )
  const calendarDayHeaderFormat = useMemo(() => ({ weekday: "short" as const }), [])

  const calendarEventClassNames = useCallback(
    (arg: EventContentArg) => [
      "hover:opacity-80 transition-opacity rounded-md",
      allowOpenRecord ? "cursor-pointer" : "",
      selectedEventId === String(arg.event.id) ? "ring-1 ring-blue-400/40" : "",
    ],
    [allowOpenRecord, selectedEventId]
  )

  // CRITICAL: Stabilize linkedValueLabelMaps reference to prevent FullCalendar infinite loops
  // Use a ref to cache the previous value and only update when content actually changes
  const prevLinkedValueLabelMapsRef = useRef<Record<string, Record<string, string>>>({})
  const stableLinkedValueLabelMaps = useMemo(() => {
    // Only update if content actually changed (deep comparison)
    if (areLinkedValueMapsEqual(linkedValueLabelMaps, prevLinkedValueLabelMapsRef.current)) {
      return prevLinkedValueLabelMapsRef.current
    }
    prevLinkedValueLabelMapsRef.current = linkedValueLabelMaps
    return linkedValueLabelMaps
  }, [linkedValueLabelMaps, areLinkedValueMapsEqual])

  const calendarEventContent = useCallback((eventInfo: { event: EventInput; timeText?: string }) => {
    try {
      // CRITICAL: Guard against invalid event data that could cause infinite loops
      if (!eventInfo || !eventInfo.event) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[CalendarView] calendarEventContent called with invalid eventInfo:`, eventInfo)
        }
        return <div className="p-1 text-xs text-gray-500">Invalid event</div>
      }

      const image = eventInfo.event.extendedProps?.image
      const fitImageSize = eventInfo.event.extendedProps?.fitImageSize || false
      const cardFieldsRaw = eventInfo.event.extendedProps?.cardFields
      const cardFields = Array.isArray(cardFieldsRaw) ? cardFieldsRaw : []
      const titleField = eventInfo.event.extendedProps?.titleField as TableField | null | undefined
      const titleValue = (eventInfo.event.extendedProps as any)?.titleValue

      // Rich tooltip: full title + each card field label and value (so truncated text is readable on hover)
      const titleLine = String(eventInfo.event.title || "Untitled")
      const cardLines = cardFields.slice(0, 2).map((f: { field: TableField; value: unknown }, idx: number) => {
        try {
          // Guard against invalid field data
          if (!f || typeof f !== 'object') {
            if (process.env.NODE_ENV === 'development') {
              console.warn(`[CalendarView] Invalid card field at index ${idx}:`, f)
            }
            return ''
          }
          
          const label = f?.field?.name ?? "Field"
          const valueMap = f?.field ? (stableLinkedValueLabelMaps[f.field.name] || stableLinkedValueLabelMaps[f.field.id]) : undefined
          let valStr = ""
          if (f?.value !== null && f?.value !== undefined) {
            if (f?.field?.type === "link_to_table" && Array.isArray(f.value)) {
              const ids = f.value as string[]
              valStr = ids.map((id: string) => {
                try {
                  return valueMap?.[id] ?? id
                } catch (err) {
                  if (process.env.NODE_ENV === 'development') {
                    console.warn(`[CalendarView] Error mapping linked value:`, err, id)
                  }
                  return id
                }
              }).filter(Boolean).join(", ") || String(f.value)
            } else {
              valStr = Array.isArray(f.value) ? (f.value as unknown[]).map(String).join(", ") : String(f.value)
            }
          }
          return `${label}: ${valStr}`
        } catch (err) {
          if (process.env.NODE_ENV === 'development') {
            console.error(`[CalendarView] Error processing card field at index ${idx}:`, err, f)
          }
          return ''
        }
      }).filter(Boolean) // Remove empty strings from invalid fields
      const fullTooltip = [titleLine, ...cardLines].join("\n")

    return (
      <div className="flex items-center gap-1.5 h-full min-h-[2.5rem] min-w-0 px-1.5 py-1" title={fullTooltip}>
        {image && (
          <div
            className={`flex-shrink-0 w-4 h-4 rounded overflow-hidden bg-gray-100 ${
              fitImageSize ? "object-contain" : "object-cover"
            }`}
          >
            <img
              src={image}
              alt=""
              className={`w-full h-full ${fitImageSize ? "object-contain" : "object-cover"}`}
              onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                ;(e.target as HTMLImageElement).style.display = "none"
              }}
            />
          </div>
        )}
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex flex-col gap-0.5 min-w-0 leading-tight">
            <div className="line-clamp-2 text-xs font-medium">
              {titleField ? (
                <TimelineFieldValue
                  field={titleField}
                  value={titleValue ?? eventInfo.event.title}
                  valueLabelMap={stableLinkedValueLabelMaps[titleField.name] || stableLinkedValueLabelMaps[titleField.id]}
                  compact={true}
                />
              ) : (
                String(eventInfo.event.title || "Untitled")
              )}
            </div>
            {cardFields.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] opacity-90 min-w-0">
                {cardFields.slice(0, 2).map((f: { field: TableField; value: unknown }, idx: number) => {
                  try {
                    // Guard against invalid field data
                    if (!f || typeof f !== 'object') {
                      if (process.env.NODE_ENV === 'development') {
                        console.warn(`[CalendarView] Invalid card field in JSX at index ${idx}:`, f)
                      }
                      return null
                    }
                    
                    return (
                      <span key={`${eventInfo.event.id}-cf-${idx}`} className="truncate inline-flex items-center shrink-0 max-w-full">
                        {idx > 0 && <span className="text-gray-500 mr-1">·</span>}
                        {f?.field ? (
                          <TimelineFieldValue
                            field={f.field as TableField}
                            value={f.value as FieldValue}
                            valueLabelMap={stableLinkedValueLabelMaps[f.field.name] || stableLinkedValueLabelMaps[f.field.id]}
                            compact={true}
                          />
                        ) : (
                          String(f?.value || "")
                        )}
                      </span>
                    )
                  } catch (err) {
                    if (process.env.NODE_ENV === 'development') {
                      console.error(`[CalendarView] Error rendering card field at index ${idx}:`, err, f)
                    }
                    return null
                  }
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    )
    } catch (err) {
      // CRITICAL: If event content rendering fails, return a safe fallback to prevent infinite loop
      if (process.env.NODE_ENV === 'development') {
        console.error(`[CalendarView] Error rendering calendar event content:`, err, {
          eventId: eventInfo?.event?.id,
          eventTitle: eventInfo?.event?.title
        })
      }
      return <div className="p-1 text-xs text-gray-500">Error rendering event</div>
    }
  }, [stableLinkedValueLabelMaps])

  const onCalendarEventClick = useCallback(
    (info: EventClickArg) => {
      // Contract: single click opens the record (if permitted) and selects event.
      const recordId = info.event.id
      const recordIdString = recordId ? String(recordId) : ""
      setSelectedEventId(recordIdString || null)

      // DEBUG_CALENDAR: Always log event clicks in development (prove click wiring works)
      // Standardise on localStorage.getItem("DEBUG_CALENDAR") === "1"
      const debugEnabled = typeof window !== "undefined" && localStorage.getItem("DEBUG_CALENDAR") === "1"
      if (debugEnabled || (typeof process !== 'undefined' && process.env.NODE_ENV === "development")) {
        debugLog('CALENDAR', "[Calendar] Event clicked", {
          recordId,
          eventId: info.event.id,
          eventTitle: info.event.title,
          hasOnRecordClick: !!onRecordClick,
          allowOpenRecord,
          willUseModal: allowOpenRecord && !onRecordClick,
          willCallCallback: allowOpenRecord && !!onRecordClick,
          debugEnabled,
        })
      }

      debugLog("CALENDAR", "Event clicked", {
        recordId,
        event: info.event,
        hasOnRecordClick: !!onRecordClick,
        allowOpenRecord,
        willUseModal: allowOpenRecord && !onRecordClick,
      })

      if (!recordId) {
        debugWarn('CALENDAR', "[Calendar] Event clicked but no recordId found", { event: info.event })
        return
      }

      if (!allowOpenRecord) return

      if (onRecordClick) {
        onRecordClick(recordIdString)
        return
      }
      setSelectedRecordId(recordIdString)
    },
    [allowOpenRecord, onRecordClick]
  )

  const onCalendarDateClick = useCallback(
    (info: { dateStr: string }) => {
      if (!canCreateRecord) return
      // Date clicked - open modal to create new record with pre-filled date
      // info.dateStr is already in YYYY-MM-DD format
      const clickedDate = new Date(info.dateStr + "T00:00:00") // Ensure it's treated as local date
      setCreateRecordDate(clickedDate)
    },
    [canCreateRecord]
  )

  if (loading) {
    return <div className="p-4">Loading...</div>
  }

  // Handle missing tableId gracefully - show setup state
  if (!resolvedTableId || resolvedTableId.trim() === '') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
        <div className="text-sm mb-2 text-center font-medium">
          Calendar view requires a table connection.
        </div>
        <div className="text-xs text-gray-400 text-center">
          This page isn&apos;t connected to a table. Please configure it in Settings.
        </div>
      </div>
    )
  }

  // Handle missing or invalid date field - show setup state
  // Use resolvedDateFieldId instead of dateFieldId prop to check all sources
  if (!resolvedDateFieldId || !isValidDateField) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
        <div className="text-sm mb-2 text-center font-medium">
          Calendar view requires a date field.
        </div>
        <div className="text-xs text-gray-400 text-center">
          {!resolvedDateFieldId 
            ? "Please select a date field in Page Settings or block settings."
            : `The selected field "${resolvedDateFieldId}" is not a date field. Please select a date field in Page Settings.`
          }
        </div>
      </div>
    )
  }

  // Empty state for search
  if (searchQuery && filteredRows.length === 0 && rows.length > 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
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

  // Empty state for no data
  if (!loading && rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
        <div className="text-sm mb-2 text-center font-medium">
          No records found
        </div>
        <div className="text-xs text-gray-400 text-center">
          {filters.length > 0 
            ? "Try adjusting your filters to see more records."
            : "Add records to this table to see them in the calendar."
          }
        </div>
      </div>
    )
  }

  // Empty state: rows exist but no events generated (likely missing/invalid date values)
  // CRITICAL: This check must happen AFTER rows are loaded and events are generated
  if (!loading && rows.length > 0 && calendarEvents.length === 0) {
    // Log diagnostic info in development
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
      const sampleRow = rows[0]
      debugWarn('CALENDAR', 'Calendar: Rows exist but no events generated', {
        rowCount: rows.length,
        dateField: resolvedDateFieldId,
        sampleRowData: sampleRow?.data ? {
          id: sampleRow.id,
          dateFieldValue: sampleRow.data[resolvedDateFieldId],
          allKeys: Object.keys(sampleRow.data)
        } : null
      })
    }
    
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
        <div className="text-sm mb-2 text-center font-medium">
          No records with dates to display
        </div>
        <div className="text-xs text-gray-400 text-center max-w-md">
          {rows.length} {rows.length === 1 ? 'record' : 'records'} found, but none have valid date values in the selected date field &quot;{resolvedDateFieldId}&quot;.
          <br />
          <br />
          Please ensure:
          <ul className="list-disc list-inside mt-2 text-left">
            <li>The date field is correctly configured in Page Settings</li>
            <li>Records have valid date values in the selected field</li>
          </ul>
        </div>
      </div>
    )
  }

  // Render date range filters above calendar (other filters are shown via QuickFilterBar in blocks)
  const renderFilters = () => {
    if (!resolvedDateFieldId || !showDateRangeControls) return null
    return (
      <div className="mb-4">
        <CalendarDateRangeControls
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          defaultPreset={(blockConfig as any)?.default_date_range_preset && (blockConfig as any).default_date_range_preset !== 'none'
            ? ((blockConfig as any).default_date_range_preset as 'today' | 'thisWeek' | 'thisMonth' | 'nextWeek' | 'nextMonth' | 'custom')
            : null}
        />
      </div>
    )
  }

  return (
    <div className="w-full h-full bg-white">
      {/* Airtable-style Header - FullCalendar handles this with headerToolbar */}

      {renderFilters()}
      
      <div className="p-6 bg-white">
        {/* CRITICAL: Only render FullCalendar after mount to prevent hydration mismatch (React error #185) */}
        {/* FullCalendar generates dynamic DOM IDs that differ between server and client */}
        {mounted ? (
          <FullCalendar
            plugins={calendarPlugins}
            events={calendarEvents}
            editable={!isViewOnly}
            eventDrop={handleEventDrop}
            headerToolbar={calendarHeaderToolbar}
            // Uncontrolled: changing `initialView` after mount can trigger repeated remount/update cycles.
            initialView="dayGridMonth"
            height="auto"
            aspectRatio={1.35}
            dayMaxEvents={3}
            moreLinkClick="popover"
            eventDisplay="block"
            eventClassNames={calendarEventClassNames}
            dayCellClassNames="hover:bg-gray-50 transition-colors min-h-[10rem]"
            dayHeaderClassNames="text-sm font-medium text-gray-700 py-2"
            eventTextColor="#1f2937"
            eventBorderColor="transparent"
            eventBackgroundColor="#f3f4f6"
            dayHeaderFormat={calendarDayHeaderFormat}
            firstDay={1}
            eventContent={calendarEventContent}
            eventClick={onCalendarEventClick}
            dateClick={onCalendarDateClick}
            validRange={
              dateFrom || dateTo
                ? {
                    start: dateFrom ? format(dateFrom, 'yyyy-MM-dd') : undefined,
                    end: dateTo ? format(dateTo, 'yyyy-MM-dd') : undefined,
                  }
                : undefined
            }
          />
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-500">
            Loading calendar...
          </div>
        )}
      </div>

      {/* Record Modal for Editing */}
      {selectedRecordId && resolvedTableId && (
        <RecordModal
          key={`record-modal-${selectedRecordId}-${interfaceMode}`}
          open={selectedRecordId !== null}
          onClose={() => setSelectedRecordId(null)}
          tableId={resolvedTableId}
          modalFields={Array.isArray(blockConfig?.modal_fields) ? blockConfig.modal_fields : []}
          modalLayout={blockConfig?.modal_layout}
          recordId={selectedRecordId}
          tableFields={Array.isArray(loadedTableFields) ? loadedTableFields : []}
          supabaseTableName={supabaseTableName}
          cascadeContext={blockConfig ? { blockConfig } : undefined}
          canEditLayout={canEditLayout}
          onLayoutSave={onModalLayoutSave}
          interfaceMode={interfaceMode}
          onSave={() => {
            // Reload rows after save
            if (resolvedTableId && supabaseTableName) {
              loadRows()
            }
          }}
          onDeleted={() => {
            // Reload rows after delete
            if (resolvedTableId && supabaseTableName) {
              loadRows()
            }
          }}
        />
      )}

      {/* Record Modal for Creating New Record */}
      {canCreateRecord && createRecordDate && resolvedTableId && resolvedDateFieldId && (
        <RecordModal
          key={`record-modal-create-${interfaceMode}`}
          open={createRecordDate !== null}
          onClose={() => setCreateRecordDate(null)}
          tableId={resolvedTableId}
          modalFields={Array.isArray(blockConfig?.modal_fields) ? blockConfig.modal_fields : []}
          modalLayout={blockConfig?.modal_layout}
          recordId={null}
          tableFields={Array.isArray(loadedTableFields) ? loadedTableFields : []}
          supabaseTableName={supabaseTableName}
          cascadeContext={blockConfig ? { blockConfig } : undefined}
          canEditLayout={canEditLayout}
          onLayoutSave={onModalLayoutSave}
          interfaceMode={interfaceMode}
          initialData={(() => {
            // Pre-fill the date field(s) based on the clicked date
            const initial: Record<string, any> = {}
            // Also apply Airtable-style defaults from active filters (when they imply a single-value selection).
            // NOTE: combinedFilters includes date range UI filters, but deriveDefaultValuesFromFilters() intentionally ignores them.
            const defaultsFromFilters = deriveDefaultValuesFromFilters(combinedFiltersForDefaults, loadedTableFields)
            if (Object.keys(defaultsFromFilters).length > 0) {
              Object.assign(initial, defaultsFromFilters)
            }
            // IMPORTANT: Use local date formatting (not UTC via toISOString),
            // otherwise the day can shift for users outside UTC.
            const dateValue = format(createRecordDate, 'yyyy-MM-dd')
            
            // Use resolved date field or view config fields
            if (resolvedDateFieldId) {
              initial[resolvedDateFieldId] = dateValue
            }
            
            // Also set start field if configured
            if (viewConfig?.calendar_start_field) {
              initial[viewConfig.calendar_start_field] = dateValue
            }
            
            // Also set end field if configured (same as start for single-day events)
            if (viewConfig?.calendar_end_field) {
              initial[viewConfig.calendar_end_field] = dateValue
            }
            
            return initial
          })()}
          onSave={() => {
            // Reload rows after save
            if (resolvedTableId && supabaseTableName) {
              loadRows()
            }
            setCreateRecordDate(null)
          }}
        />
      )}
    </div>
  )
}
