"use client"

import { useState, useEffect, useMemo, useRef } from "react"
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
import { applyFiltersToQuery, type FilterConfig } from "@/lib/interface/filters"
import { format } from "date-fns"
import type { EventDropArg, EventInput } from "@fullcalendar/core"
import type { TableRow } from "@/types/database"
import type { TableField } from "@/types/fields"
import RecordModal from "@/components/calendar/RecordModal"
import { isDebugEnabled, debugLog as debugCalendar, debugWarn as debugCalendarWarn } from '@/lib/interface/debug-flags'
import { resolveChoiceColor, normalizeHexColor } from '@/lib/field-colors'
import CalendarDateRangeControls from "@/components/views/calendar/CalendarDateRangeControls"
import TimelineFieldValue from "@/components/views/TimelineFieldValue"
import { isAbortError } from "@/lib/api/error-handling"

interface CalendarViewProps {
  tableId: string
  viewId: string
  dateFieldId: string
  fieldIds: string[]
  searchQuery?: string
  tableFields?: any[]
  filters?: FilterConfig[] // Dynamic filters from config
  onRecordClick?: (recordId: string) => void // Emit recordId on click
  blockConfig?: Record<string, any> // Block/page config for reading date_field from page settings
  colorField?: string // Field name to use for event colors (single-select field)
  imageField?: string // Field name to use for event images
  fitImageSize?: boolean // Whether to fit image to container size
  /** Optional external control of date range filter UI/state (used by Calendar block unified header) */
  dateFrom?: Date
  dateTo?: Date
  onDateFromChange?: (date?: Date) => void
  onDateToChange?: (date?: Date) => void
  /** If false, CalendarView will not render the date range controls (caller can render them elsewhere). */
  showDateRangeControls?: boolean
}

export default function CalendarView({ 
  tableId, 
  viewId, 
  dateFieldId, 
  fieldIds: fieldIdsProp,
  searchQuery = "",
  tableFields = [],
  filters = [],
  onRecordClick,
  blockConfig = {},
  colorField,
  imageField,
  fitImageSize = false,
  dateFrom: controlledDateFrom,
  dateTo: controlledDateTo,
  onDateFromChange,
  onDateToChange,
  showDateRangeControls = true,
}: CalendarViewProps) {
  // Ensure fieldIds is always an array (defensive check for any edge cases)
  const fieldIds = useMemo(() => {
    if (!fieldIdsProp) return []
    if (Array.isArray(fieldIdsProp)) return fieldIdsProp
    // Fallback: if somehow not an array, return empty array
    console.warn('CalendarView: fieldIdsProp is not an array:', typeof fieldIdsProp, fieldIdsProp)
    return []
  }, [fieldIdsProp])
  const router = useRouter()
  const [rows, setRows] = useState<TableRow[]>([])
  const [loading, setLoading] = useState(true)
  
  // Lifecycle logging
  useEffect(() => {
    console.log(`[Lifecycle] CalendarView MOUNT: tableId=${tableId}, viewId=${viewId}`)
    return () => {
      console.log(`[Lifecycle] CalendarView UNMOUNT: tableId=${tableId}, viewId=${viewId}`)
    }
  }, [])
  
  // DEBUG_CALENDAR: Enable via localStorage.DEBUG_CALENDAR=1
  const calendarDebugEnabled = isDebugEnabled('CALENDAR')
  // CRITICAL: Initialize resolvedTableId from prop immediately (don't wait for useEffect)
  const [resolvedTableId, setResolvedTableId] = useState<string>(tableId || '')
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')
  const [supabaseTableName, setSupabaseTableName] = useState<string | null>(null)
  const [loadedTableFields, setLoadedTableFields] = useState<TableField[]>(tableFields || [])
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [createRecordDate, setCreateRecordDate] = useState<Date | null>(null) // Date for creating new record

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
    const field = loadedTableFields.find(f => f.name === fieldName || f.id === fieldName)

    // Multi-select might be stored as array
    if (Array.isArray(raw)) {
      const joined = raw.filter(Boolean).map(String).join(', ')
      return joined.trim() ? joined : null
    }

    if (field?.type === 'checkbox') {
      return raw ? '✓' : null
    }

    if (field?.type === 'date') {
      const d = raw instanceof Date ? raw : new Date(String(raw))
      if (!isNaN(d.getTime())) {
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
    if (viewId) {
      loadViewConfig()
    }
  }, [viewId])

  async function loadViewConfig() {
    if (!viewId) return
    
    try {
      const supabase = createClient()
      const { data: view } = await supabase
        .from('views')
        .select('config, table_id')
        .eq('id', viewId)
        .single()

      if (view?.config) {
        setViewConfig(view.config as any)
      }
      
      // If tableId wasn't provided but view has table_id, use it
      if (!tableId && view?.table_id) {
        setResolvedTableId(view.table_id)
      }
    } catch (error) {
      console.error('Calendar: Error loading view config:', error)
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
        const formattedFields = tableFields.map((f: any) => ({
          id: f.id || f.field_id,
          table_id: f.table_id,
          name: f.name || f.field_name,
          type: f.type || f.field_type,
          position: f.position || 0,
          created_at: f.created_at,
          options: f.options || f.field_options || {}
        }))
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
      const field = loadedTableFields.find(f => 
        (f.name === pageDateField || f.id === pageDateField) && f.type === 'date'
      )
      if (field) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Calendar: Using date field from page config:', field.name)
        }
        return field.name
      }
    }
    
    // 2. Check view config
    if (viewConfig?.calendar_date_field) {
      const field = loadedTableFields.find(f => 
        (f.name === viewConfig.calendar_date_field || f.id === viewConfig.calendar_date_field) && f.type === 'date'
      )
      if (field) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Calendar: Using date field from view config:', field.name)
        }
        return field.name
      }
    }
    if (viewConfig?.calendar_start_field) {
      const field = loadedTableFields.find(f => 
        (f.name === viewConfig.calendar_start_field || f.id === viewConfig.calendar_start_field) && f.type === 'date'
      )
      if (field) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Calendar: Using start date field from view config:', field.name)
        }
        return field.name
      }
    }
    
    // 3. Fallback to dateFieldId prop
    if (dateFieldId) {
      const field = loadedTableFields.find(f => 
        (f.name === dateFieldId || f.id === dateFieldId) && f.type === 'date'
      )
      if (field) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Calendar: Using date field from prop:', field.name)
        }
        return field.name
      }
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.warn('Calendar: No valid date field found. Block config:', blockConfig, 'View config:', viewConfig, 'Prop:', dateFieldId)
    }
    return ''
  }, [blockConfig, viewConfig, dateFieldId, loadedTableFields])

  // Memoize filters to prevent unnecessary re-renders
  // Include date range filters in the key
  const filtersKey = useMemo(() => {
    const dateRangeKey = (dateFrom && !isNaN(dateFrom.getTime())) || (dateTo && !isNaN(dateTo.getTime())) 
      ? `${dateFrom && !isNaN(dateFrom.getTime()) ? dateFrom.toISOString() : ''}|${dateTo && !isNaN(dateTo.getTime()) ? dateTo.toISOString() : ''}` 
      : ''
    return JSON.stringify(filters || []) + dateRangeKey
  }, [filters, dateFrom, dateTo])
  
  // Build combined filters including date range
  const combinedFilters = useMemo(() => {
    const allFilters: FilterConfig[] = [...(filters || [])]
    
    // Add date range filter if dates are set
    if (resolvedDateFieldId && (dateFrom || dateTo)) {
      allFilters.push({
        field: resolvedDateFieldId,
        operator: 'date_range',
        value: dateFrom && !isNaN(dateFrom.getTime()) ? dateFrom.toISOString().split('T')[0] : undefined,
        value2: dateTo && !isNaN(dateTo.getTime()) ? dateTo.toISOString().split('T')[0] : undefined,
      })
    }
    
    return allFilters
  }, [filters, resolvedDateFieldId, dateFrom, dateTo])

  // Memoize loadedTableFields key to prevent unnecessary re-renders
  const loadedTableFieldsKey = useMemo(() => {
    return JSON.stringify(loadedTableFields.map(f => ({ id: f.id, name: f.name, type: f.type })))
  }, [loadedTableFields])

  useEffect(() => {
    // Prevent concurrent loads
    if (isLoadingRef.current) {
      return
    }
    
    // Early return if critical prerequisites aren't met
    // Note: loadedTableFields are only needed for filtering, not for loading rows
    if (!resolvedTableId || !supabaseTableName) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Calendar: Skipping loadRows - prerequisites not met', {
          resolvedTableId: !!resolvedTableId,
          supabaseTableName: !!supabaseTableName,
          loadedTableFieldsCount: loadedTableFields.length
        })
      }
      return
    }
    
    // Update the ref with current key before checking
    const currentFieldsKey = loadedTableFieldsKey
    if (prevLoadedFieldsKeyRef.current !== currentFieldsKey) {
      prevLoadedFieldsKeyRef.current = currentFieldsKey
    }
    
    // Only reload if filters (including date range), searchQuery, or loadedTableFields actually changed
    const currentFiltersKey = filtersKey
    const combinedKey = `${currentFiltersKey}|${searchQuery}|${currentFieldsKey}`
    
    // CRITICAL: Load rows if key changed OR if we have no rows yet (initial load)
    // This ensures rows are always loaded when prerequisites are met
    const shouldLoad = prevFiltersRef.current !== combinedKey || rows.length === 0
    
    if (shouldLoad) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Calendar: Triggering loadRows', {
          keyChanged: prevFiltersRef.current !== combinedKey,
          noRowsYet: rows.length === 0,
          combinedKey: combinedKey.substring(0, 50) + '...'
        })
      }
      prevFiltersRef.current = combinedKey
      loadRows()
    }
    // Use loadedTableFieldsKey to track actual content changes, not just length
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTableId, supabaseTableName, filtersKey, searchQuery, loadedTableFieldsKey])

  async function resolveTableId() {
    // CRITICAL: tableId prop MUST come from block config (not page fallback)
    // If tableId is provided, use it directly
    if (tableId && tableId.trim() !== '') {
      console.log('Calendar: Using tableId from prop:', tableId)
      setResolvedTableId(tableId)
      return
    }

    // If no tableId but we have viewId, fetch the view's table_id (fallback for legacy pages)
    if (!tableId && viewId) {
      try {
        const supabase = createClient()
        const { data: view, error } = await supabase
          .from("views")
          .select("table_id")
          .eq("id", viewId)
          .single()

        if (error) {
          console.warn('Calendar: Could not resolve tableId from view:', error)
          setResolvedTableId("")
          setLoading(false)
          return
        }

        if (view?.table_id) {
          console.log('Calendar: Resolved tableId from view:', view.table_id)
          setResolvedTableId(view.table_id)
        } else {
          console.warn('Calendar: View has no table_id')
          setResolvedTableId("")
          setLoading(false)
        }
      } catch (error) {
        console.error('Calendar: Error resolving tableId:', error)
        setResolvedTableId("")
        setLoading(false)
      }
    } else {
      console.warn('Calendar: No tableId provided and no viewId fallback')
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
      console.error('Calendar: Error loading table info:', error)
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
      console.error('Calendar: Error loading table fields:', error)
    }
  }

  async function loadRows() {
    // Gracefully handle missing tableId for SQL-view backed pages
    if (!resolvedTableId || !supabaseTableName) {
      console.log('Calendar: Cannot load rows - missing tableId or supabaseTableName', { resolvedTableId, supabaseTableName })
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
      if (calendarDebugEnabled || process.env.NODE_ENV === 'development') {
        console.log(`[Calendar] Loading rows from table`, {
          tableId: resolvedTableId,
          supabaseTableName,
          filtersCount: filters.length,
          fieldIdsCount: fieldIds.length,
          resolvedDateFieldId,
          viewId
        })
      }
      
      // Build query with filters
      let query = supabase
        .from(supabaseTableName)
        .select("*")

      // Apply filters using shared filter system (includes date range filters)
      const normalizedFields = loadedTableFields.map(f => ({ name: f.name || f.id, type: f.type }))
      query = applyFiltersToQuery(query, combinedFilters, normalizedFields)

      // Apply search query if provided
      if (searchQuery && fieldIds.length > 0) {
        // For search, we'll filter client-side after loading
        // This is simpler than building complex OR queries
      }

      const { data, error } = await query

      if (error) {
        if (isAbortError(error)) return
        console.error('Calendar: Error loading rows:', error, {
          tableId: resolvedTableId,
          supabaseTableName,
          errorCode: (error as any).code,
          errorMessage: error.message
        })
        setRows([])
      } else {
        // Convert flat rows to TableRow format
        const tableRows: TableRow[] = (data || []).map((row: any) => ({
          id: row.id,
          table_id: resolvedTableId,
          data: row,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }))
        setRows(tableRows)
        
        // DEBUG_CALENDAR: Log loaded rows
        debugCalendar('CALENDAR', `Loaded ${data?.length || 0} rows from ${supabaseTableName}`, {
          rowCount: data?.length || 0,
          supabaseTableName,
          resolvedDateFieldId,
          sampleRowKeys: tableRows.length > 0 ? Object.keys(tableRows[0].data).slice(0, 10) : []
        })
      }
    } catch (error) {
      if (isAbortError(error)) return
      console.error('Calendar: Exception loading rows:', error)
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


  // Find date field in loadedTableFields to validate it exists and is a date type
  const dateField = useMemo(() => {
    if (!resolvedDateFieldId || !loadedTableFields.length) return null
    // Try to find by name first, then by id
    return loadedTableFields.find(f => 
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
    return loadedTableFields.find(f => 
      f.name === viewConfig.calendar_start_field || 
      f.id === viewConfig.calendar_start_field
    )
  }, [viewConfig, loadedTableFields])

  const endField = useMemo(() => {
    if (!viewConfig?.calendar_end_field || !loadedTableFields.length) return null
    return loadedTableFields.find(f => 
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
          (f) => (f.name === blockFromField || f.id === blockFromField) && f.type === "date"
        )
      : null

    const viewStartField = viewConfig?.calendar_start_field
    const resolvedViewStartField = viewStartField
      ? loadedTableFields.find(
          (f) => (f.name === viewStartField || f.id === viewStartField) && f.type === "date"
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
          (f) => (f.name === blockToField || f.id === blockToField) && f.type === "date"
        )
      : null

    const viewEndField = viewConfig?.calendar_end_field
    const resolvedViewEndField = viewEndField
      ? loadedTableFields.find(
          (f) => (f.name === viewEndField || f.id === viewEndField) && f.type === "date"
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

  async function handleEventDrop(info: EventDropArg) {
    const rowId = info.event?.id
    const newStart = info.event?.start

    if (!rowId || !newStart) {
      return
    }

    if (!supabaseTableName) {
      console.warn("Calendar: Cannot persist drop - missing supabaseTableName")
      info.revert()
      return
    }

    const { fromFieldName, toFieldName } = resolveCalendarDateFieldNames()
    if (!fromFieldName) {
      console.warn("Calendar: Cannot persist drop - missing fromFieldName", {
        rowId,
        resolvedDateFieldId,
        viewConfig,
        blockConfig,
      })
      info.revert()
      return
    }

    // Prefer original values from our row state, fallback to FullCalendar's oldEvent.
    const currentRow = rows.find((r) => r.id === rowId)
    const currentRowData = currentRow?.data || (info.event.extendedProps as any)?.rowData

    const oldFromRaw = currentRowData?.[fromFieldName]
    const oldFromDate =
      oldFromRaw && !isNaN(new Date(oldFromRaw).getTime())
        ? new Date(oldFromRaw)
        : info.oldEvent?.start || null

    const newFromValue = format(newStart, "yyyy-MM-dd")

    // Update end field (if configured) by shifting it by the same delta as the start date.
    const updates: Record<string, any> = { [fromFieldName]: newFromValue }
    if (toFieldName && currentRowData?.[toFieldName] && oldFromDate && !isNaN(oldFromDate.getTime())) {
      const oldToRaw = currentRowData[toFieldName]
      const oldToDate = new Date(oldToRaw)
      if (!isNaN(oldToDate.getTime())) {
        const deltaMs = newStart.getTime() - oldFromDate.getTime()
        const newToDate = new Date(oldToDate.getTime() + deltaMs)
        updates[toFieldName] = format(newToDate, "yyyy-MM-dd")
      }
    }

    // Optimistic UI update (so the event stays put even if we don't reload immediately).
    setRows((prev) =>
      prev.map((r) =>
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
      await loadRows()
    } catch (error) {
      console.error("Calendar: Failed to persist event drop", error, {
        rowId,
        supabaseTableName,
        updates,
      })
      const e = error as any
      const message = e?.message || "Unknown error"
      const code = e?.code ? ` (code: ${e.code})` : ""
      alert(`Failed to save change${code}: ${message}`)
      info.revert()
      await loadRows()
    }
  }

  function getEvents(): EventInput[] {
    // Use resolved date field from config or fallback
    const effectiveDateField = dateField
    const effectiveDateFieldId = resolvedDateFieldId
    
    // Defensive check: ensure we have a valid date field
    if (!effectiveDateFieldId || !isValidDateField) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Calendar: Cannot generate events - missing or invalid date field', {
          resolvedDateFieldId,
          isValidDateField,
          dateField,
          blockConfig,
          viewConfig
        })
      }
      return []
    }
    
    // Defensive check: ensure we have rows
    if (!filteredRows || filteredRows.length === 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Calendar: No rows to generate events from', {
          totalRows: rows.length,
          filteredRows: filteredRows?.length || 0,
          searchQuery,
          filtersCount: filters.length
        })
      }
      return []
    }
    
    // Defensive check: log if rows exist but events will be empty
    if (process.env.NODE_ENV === 'development' && filteredRows.length > 0) {
      console.log('Calendar: Processing events', {
        rowCount: filteredRows.length,
        dateField: effectiveDateFieldId,
        sampleRowKeys: filteredRows[0]?.data ? Object.keys(filteredRows[0].data).slice(0, 10) : []
      })
    }
    
    try {
      // CRITICAL: Use field NAME (not ID) when reading row data
      // Supabase row keys are field names, not IDs
      // Priority: block config > view config > resolved field
      const actualFieldName = effectiveDateField?.name || effectiveDateFieldId
      
      // DEBUG_CALENDAR: Log date field resolution
      debugCalendar('CALENDAR', 'Date field resolution for events', {
        effectiveDateFieldId,
        effectiveDateFieldName: effectiveDateField?.name,
        actualFieldName,
        sampleRowKeys: filteredRows[0]?.data ? Object.keys(filteredRows[0].data).slice(0, 10) : []
      })
      
      // Resolve date_from field (default/primary): block config > view config > auto-detect > null
      // Check for date_from, from_date_field, start_date_field, calendar_start_field
      const blockFromField = blockConfig?.date_from || blockConfig?.from_date_field || blockConfig?.start_date_field || blockConfig?.calendar_start_field
      const resolvedFromField = blockFromField 
        ? loadedTableFields.find(f => (f.name === blockFromField || f.id === blockFromField) && f.type === 'date')
        : null
      
      // Auto-detect date_from field if not configured (look for fields named "date_from", "from_date", "start_date", etc.)
      let autoDetectedFromField = null
      if (!resolvedFromField && !startField && !viewConfig?.calendar_start_field) {
        autoDetectedFromField = loadedTableFields.find(f => 
          f.type === 'date' && (
            f.name.toLowerCase() === 'date_from' || 
            f.name.toLowerCase() === 'from_date' ||
            f.name.toLowerCase() === 'start_date' ||
            f.name.toLowerCase().includes('date_from') ||
            f.name.toLowerCase().includes('from_date')
          )
        )
      }
      
      const actualFromFieldName = resolvedFromField?.name || startField?.name || viewConfig?.calendar_start_field || autoDetectedFromField?.name || actualFieldName || null
      
      // Resolve date_to field (secondary/range): block config > view config > auto-detect > null
      // Check for date_to, to_date_field, end_date_field, calendar_end_field
      const blockToField = blockConfig?.date_to || blockConfig?.to_date_field || blockConfig?.end_date_field || blockConfig?.calendar_end_field
      const resolvedToField = blockToField
        ? loadedTableFields.find(f => (f.name === blockToField || f.id === blockToField) && f.type === 'date')
        : null
      
      // Auto-detect date_to field if not configured (look for fields named "date_to", "to_date", "end_date", etc.)
      let autoDetectedToField = null
      if (!resolvedToField && !endField && !viewConfig?.calendar_end_field) {
        autoDetectedToField = loadedTableFields.find(f => 
          f.type === 'date' && (
            f.name.toLowerCase() === 'date_to' || 
            f.name.toLowerCase() === 'to_date' ||
            f.name.toLowerCase() === 'end_date' ||
            f.name.toLowerCase().includes('date_to') ||
            f.name.toLowerCase().includes('to_date')
          )
        )
      }
      
      const actualToFieldName = resolvedToField?.name || endField?.name || viewConfig?.calendar_end_field || autoDetectedToField?.name || null
      
      if (process.env.NODE_ENV === 'development' && filteredRows.length > 0) {
        console.log('Calendar: Date field resolution', {
          actualFieldName,
          actualFromFieldName,
          actualToFieldName,
          blockConfig: { date_from: blockConfig?.date_from, date_to: blockConfig?.date_to, start_date_field: blockConfig?.start_date_field, end_date_field: blockConfig?.end_date_field },
          viewConfig: { calendar_start_field: viewConfig?.calendar_start_field, calendar_end_field: viewConfig?.calendar_end_field }
        })
      }
      
      // CRITICAL: Log sample row data to debug date field extraction
      if (process.env.NODE_ENV === 'development' && filteredRows.length > 0) {
        const sampleRow = filteredRows[0]
        console.log('Calendar: Sample row data for event mapping', {
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
        .filter((row) => {
          if (!row || !row.data) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('Calendar: Row missing or has no data', { rowId: row?.id })
            }
            return false
          }
          
          // Check for date values - prefer date_from (default), fallback to date_to if only that exists
          let fromDateValue: any = null
          let toDateValue: any = null
          
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
            if (process.env.NODE_ENV === 'development' && filteredRows.length <= 5) {
              console.log('Calendar: Row filtered out - no date value', {
                rowId: row.id,
                dateFromField: actualFromFieldName,
                dateToField: actualToFieldName,
                availableKeys: Object.keys(row.data)
              })
            }
            return false
          }
          
          // Try to parse the date value
          try {
            const parsedDate = dateValue instanceof Date ? dateValue : new Date(dateValue)
            // Check if date is valid
            const isValid = !isNaN(parsedDate.getTime())
            if (!isValid && process.env.NODE_ENV === 'development' && filteredRows.length <= 5) {
              console.warn('Calendar: Row filtered out - invalid date', {
                rowId: row.id,
                dateValue,
                parsedDate
              })
            }
            return isValid
          } catch (error) {
            if (process.env.NODE_ENV === 'development' && filteredRows.length <= 5) {
              console.warn('Calendar: Row filtered out - date parse error', {
                rowId: row.id,
                dateValue,
                error
              })
            }
            return false
          }
        })
        // Ensure we have an array before mapping
        .filter((row): row is TableRow => row !== null && row !== undefined)
        .map((row) => {
          // Get date values - use date_from (default) and date_to (if available for range)
          let fromDateValue: any = null
          let toDateValue: any = null
          
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
          // Use date_from as default start date, fallback to date_to if date_from is not available
          let parsedStartDate: Date
          let parsedEndDate: Date | null = null
          
          try {
            // Start date: prefer date_from, fallback to date_to if date_from is not available
            const startDateValue = fromDateValue || toDateValue
            if (startDateValue) {
              parsedStartDate = startDateValue instanceof Date ? startDateValue : new Date(startDateValue)
              if (isNaN(parsedStartDate.getTime())) {
                parsedStartDate = new Date()
              }
            } else {
              parsedStartDate = new Date()
            }
            
            // End date: use date_to if available (for range), otherwise use start date (single day event)
            if (toDateValue) {
              parsedEndDate = toDateValue instanceof Date ? toDateValue : new Date(toDateValue)
              if (isNaN(parsedEndDate.getTime())) {
                parsedEndDate = parsedStartDate
              }
            } else if (fromDateValue && !toDateValue) {
              // Only date_from available, use it for both start and end (single day event)
              parsedEndDate = parsedStartDate
            } else {
              // No end date, use start date for both
              parsedEndDate = parsedStartDate
            }
          } catch {
            parsedStartDate = new Date()
            parsedEndDate = new Date()
          }
          
          // Use visible fields (fieldIds) to determine title - prefer first text field
          // Also check for primary field (name field) or first non-date field
          const visibleFieldsForTitle = (Array.isArray(fieldIds) ? fieldIds : [])
            .filter((fid) => {
              const field = loadedTableFields.find(f => f.name === fid || f.id === fid)
              // Exclude date fields from title
              return field && 
                field.type !== 'date' && 
                field.name !== actualFieldName && 
                field.name !== actualFromFieldName &&
                field.name !== actualToFieldName &&
                field.id !== effectiveDateFieldId
            })
          
          // Find primary field (name field) or first text field for title
          const primaryField = loadedTableFields.find(f => 
            f.type === 'text' && (f.name.toLowerCase() === 'name' || f.name.toLowerCase() === 'title')
          )
          
          const titleFieldId = primaryField 
            ? (primaryField.name || primaryField.id)
            : visibleFieldsForTitle.find((fid) => {
                const field = loadedTableFields.find(f => f.name === fid || f.id === fid)
                return field && (field.type === 'text' || field.type === 'long_text')
              }) || visibleFieldsForTitle[0]
          
          // Find the actual field name for title
          const titleFieldObj = loadedTableFields.find(f => 
            (f.name === titleFieldId || f.id === titleFieldId) || 
            (primaryField && (f.name === primaryField.name || f.id === primaryField.id))
          ) || (primaryField ? primaryField : null)
          
          const titleFieldName = titleFieldObj?.name || titleFieldId
          
          // Extract title from row data
          let title = "Untitled"
          let titleValue: any = null
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
            const colorFieldObj = loadedTableFields.find(f => 
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

          return {
            id: row.id,
            title: title || "Untitled",
            start: parsedStartDate,
            end: parsedEndDate || undefined,
            backgroundColor: eventColor,
            borderColor: eventColor,
            textColor: eventColor ? (() => {
              // Calculate text color based on background luminance
              if (!eventColor.startsWith('#')) return '#000000'
              const r = parseInt(eventColor.slice(1, 3), 16)
              const g = parseInt(eventColor.slice(3, 5), 16)
              const b = parseInt(eventColor.slice(5, 7), 16)
              const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
              return luminance > 0.5 ? '#000000' : '#ffffff'
            })() : undefined,
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
                  .map((fid) => {
                    const f = loadedTableFields.find((x) => x.name === fid || x.id === fid)
                    return f?.name || fid
                  })
                  .filter((name) => name && !exclude.has(name))

                // De-dupe while preserving order (fieldIds may include both id and name forms).
                const resolvedNames: string[] = []
                const seen = new Set<string>()
                for (const name of resolvedNamesRaw) {
                  if (seen.has(name)) continue
                  seen.add(name)
                  resolvedNames.push(name)
                }

                const items = resolvedNames
                  .map((name) => {
                    const field = loadedTableFields.find((f) => f.name === name)
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
                  .filter((x): x is { field: TableField; value: any } => Boolean(x))

                return items.slice(0, 3)
              })(),
            },
          }
        })
      
      // DEBUG_CALENDAR: Log event generation
      if (events.length === 0 && filteredRows.length > 0) {
        debugCalendarWarn('CALENDAR', `No events generated from ${filteredRows.length} rows`, {
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
        debugCalendar('CALENDAR', `Generated ${events.length} events successfully`, {
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
      console.error('Calendar: Error generating events:', error)
      return []
    }
  }

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

  // Get events for rendering
  const calendarEvents = getEvents()

  // Empty state: rows exist but no events generated (likely missing/invalid date values)
  // CRITICAL: This check must happen AFTER rows are loaded and events are generated
  if (!loading && rows.length > 0 && calendarEvents.length === 0) {
    // Log diagnostic info in development
    if (process.env.NODE_ENV === 'development') {
      const sampleRow = rows[0]
      console.warn('Calendar: Rows exist but no events generated', {
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
        />
      </div>
    )
  }

  return (
    <div className="w-full h-full bg-white">
      {/* Airtable-style Header - FullCalendar handles this with headerToolbar */}

      {renderFilters()}
      
      <div className="p-6 bg-white">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          events={calendarEvents}
          key={`calendar-${resolvedTableId}-${resolvedDateFieldId}`}
          editable={!isViewOnly}
          eventDrop={handleEventDrop}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: viewMode === 'month' ? "dayGridWeek,dayGridMonth" : "dayGridMonth,dayGridWeek",
          }}
          initialView={viewMode === 'month' ? "dayGridMonth" : "dayGridWeek"}
          height="auto"
          aspectRatio={1.35}
          dayMaxEvents={3}
          moreLinkClick="popover"
          eventDisplay="block"
          eventClassNames={(arg) => [
            "hover:opacity-80 transition-opacity rounded-md",
            allowOpenRecord ? "cursor-pointer" : "",
            selectedEventId === String(arg.event.id) ? "ring-1 ring-blue-400/40" : "",
          ]}
          dayCellClassNames="hover:bg-gray-50 transition-colors"
          dayHeaderClassNames="text-sm font-medium text-gray-700 py-2"
          eventTextColor="#1f2937"
          eventBorderColor="transparent"
          eventBackgroundColor="#f3f4f6"
          dayHeaderFormat={{ weekday: 'short' }}
          firstDay={1}
          eventContent={(eventInfo) => {
            const recordId = String(eventInfo.event.id || "")
            const image = eventInfo.event.extendedProps?.image
            const fitImageSize = eventInfo.event.extendedProps?.fitImageSize || false
            const cardFieldsRaw = eventInfo.event.extendedProps?.cardFields
            const cardFields = Array.isArray(cardFieldsRaw) ? cardFieldsRaw : []
            const titleField = eventInfo.event.extendedProps?.titleField as TableField | null | undefined
            const titleValue = (eventInfo.event.extendedProps as any)?.titleValue
            const tooltip = String(eventInfo.event.title || "")
            
            return (
              <div className="flex items-center gap-1.5 h-full min-w-0" title={tooltip}>
                {image && (
                  <div className={`flex-shrink-0 w-4 h-4 rounded overflow-hidden bg-gray-100 ${fitImageSize ? 'object-contain' : 'object-cover'}`}>
                    <img
                      src={image}
                      alt=""
                      className={`w-full h-full ${fitImageSize ? 'object-contain' : 'object-cover'}`}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-0.5 min-w-0 leading-tight">
                    <div className="truncate text-xs font-medium">
                      {titleField ? (
                        <TimelineFieldValue field={titleField} value={titleValue ?? eventInfo.event.title} compact={true} />
                      ) : (
                        String(eventInfo.event.title || "Untitled")
                      )}
                    </div>
                    {cardFields.slice(0, 2).map((f: any, idx: number) => (
                      <div key={`${eventInfo.event.id}-cf-${idx}`} className="truncate text-[10px] opacity-90">
                        {f?.field ? (
                          <TimelineFieldValue field={f.field as TableField} value={f.value} compact={true} />
                        ) : (
                          String(f?.value || "")
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          }}
          viewDidMount={(view) => {
            // Update view mode when user changes view
            if (view.view.type === 'dayGridMonth') {
              setViewMode('month')
            } else if (view.view.type === 'dayGridWeek') {
              setViewMode('week')
            }
          }}
          eventClick={(info) => {
            // Contract: single click opens the record (if permitted) and selects event.
            const recordId = info.event.id
            const recordIdString = recordId ? String(recordId) : ""
            setSelectedEventId(recordIdString || null)
            
            // DEBUG_CALENDAR: Always log event clicks in development (prove click wiring works)
            // Standardise on localStorage.getItem("DEBUG_CALENDAR") === "1"
            const debugEnabled = typeof window !== 'undefined' && localStorage.getItem("DEBUG_CALENDAR") === "1"
            if (debugEnabled || process.env.NODE_ENV === 'development') {
              console.log('[Calendar] Event clicked', {
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
            
            debugCalendar('CALENDAR', 'Event clicked', {
              recordId,
              event: info.event,
              hasOnRecordClick: !!onRecordClick,
              allowOpenRecord,
              willUseModal: allowOpenRecord && !onRecordClick
            })
            
            if (!recordId) {
              console.warn('[Calendar] Event clicked but no recordId found', { event: info.event })
              return
            }

            if (!allowOpenRecord) return

            if (onRecordClick) {
              onRecordClick(recordIdString)
              return
            }
            setSelectedRecordId(recordIdString)
          }}
          dateClick={(info) => {
            if (!canCreateRecord) return
            // Date clicked - open modal to create new record with pre-filled date
            // info.dateStr is already in YYYY-MM-DD format
            const clickedDate = new Date(info.dateStr + 'T00:00:00') // Ensure it's treated as local date
            setCreateRecordDate(clickedDate)
          }}
        />
      </div>

      {/* Record Modal for Editing */}
      {selectedRecordId && resolvedTableId && (
        <RecordModal
          open={selectedRecordId !== null}
          onClose={() => setSelectedRecordId(null)}
          tableId={resolvedTableId}
          modalFields={Array.isArray(blockConfig?.modal_fields) ? blockConfig.modal_fields : []}
          recordId={selectedRecordId}
          tableFields={Array.isArray(loadedTableFields) ? loadedTableFields : []}
          onSave={() => {
            // Reload rows after save
            if (resolvedTableId && supabaseTableName) {
              loadRows()
            }
          }}
        />
      )}

      {/* Record Modal for Creating New Record */}
      {canCreateRecord && createRecordDate && resolvedTableId && resolvedDateFieldId && (
        <RecordModal
          open={createRecordDate !== null}
          onClose={() => setCreateRecordDate(null)}
          tableId={resolvedTableId}
          modalFields={Array.isArray(blockConfig?.modal_fields) ? blockConfig.modal_fields : []}
          recordId={null}
          tableFields={Array.isArray(loadedTableFields) ? loadedTableFields : []}
          initialData={(() => {
            // Pre-fill the date field(s) based on the clicked date
            const initial: Record<string, any> = {}
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
