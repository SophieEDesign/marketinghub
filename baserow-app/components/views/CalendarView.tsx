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
import { CalendarIcon, X } from "lucide-react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import { filterRowsBySearch } from "@/lib/search/filterRows"
import { applyFiltersToQuery, type FilterConfig } from "@/lib/interface/filters"
import { format } from "date-fns"
import type { EventInput } from "@fullcalendar/core"
import type { TableRow } from "@/types/database"
import type { TableField } from "@/types/fields"
import RecordModal from "@/components/calendar/RecordModal"
import { isDebugEnabled, debugLog as debugCalendar, debugWarn as debugCalendarWarn } from '@/lib/interface/debug-flags'

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
}

export default function CalendarView({ 
  tableId, 
  viewId, 
  dateFieldId, 
  fieldIds,
  searchQuery = "",
  tableFields = [],
  filters = [],
  onRecordClick,
  blockConfig = {}
}: CalendarViewProps) {
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
  
  // Date range filter state
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)
  
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
      // Load table fields if not provided
      if (!tableFields || tableFields.length === 0) {
        loadTableFields()
      } else {
        // Only update if fields actually changed
        if (prevTableFieldsRef.current !== tableFieldsKey) {
          setLoadedTableFields(tableFields)
          prevTableFieldsRef.current = tableFieldsKey
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
    const dateRangeKey = dateFrom || dateTo ? `${dateFrom?.toISOString()}|${dateTo?.toISOString()}` : ''
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
        value: dateFrom ? dateFrom.toISOString().split('T')[0] : undefined,
        value2: dateTo ? dateTo.toISOString().split('T')[0] : undefined,
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
    
    // Early return if prerequisites aren't met
    if (!resolvedTableId || !supabaseTableName || loadedTableFields.length === 0) {
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
      console.error('Calendar: Exception loading rows:', error)
      setRows([])
    } finally {
      setLoading(false)
      isLoadingRef.current = false
    }
  }

  // Filter rows by search query
  const filteredRows = useMemo(() => {
    if (!searchQuery || !loadedTableFields.length) return rows
    
    // Convert TableRow format to flat format for search
    const flatRows = rows.map((row) => ({
      ...row.data,
      _rowId: row.id, // Preserve row ID
    }))
    
    // Filter using search helper
    const filtered = filterRowsBySearch(flatRows, loadedTableFields, searchQuery, fieldIds)
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

  // Get color field from view config
  const colorField = useMemo(() => {
    if (!viewConfig?.calendar_color_field || !loadedTableFields.length) return null
    return loadedTableFields.find(f => 
      f.name === viewConfig.calendar_color_field || 
      f.id === viewConfig.calendar_color_field
    )
  }, [viewConfig, loadedTableFields])

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
      
      // Resolve start field: block config > view config > null
      const blockStartField = blockConfig?.start_date_field || blockConfig?.from_date_field || blockConfig?.calendar_start_field
      const resolvedStartField = blockStartField 
        ? loadedTableFields.find(f => (f.name === blockStartField || f.id === blockStartField) && f.type === 'date')
        : null
      const actualStartFieldName = resolvedStartField?.name || startField?.name || viewConfig?.calendar_start_field || null
      
      // Resolve end field: block config > view config > null
      const blockEndField = blockConfig?.end_date_field || blockConfig?.to_date_field || blockConfig?.calendar_end_field
      const resolvedEndField = blockEndField
        ? loadedTableFields.find(f => (f.name === blockEndField || f.id === blockEndField) && f.type === 'date')
        : null
      const actualEndFieldName = resolvedEndField?.name || endField?.name || viewConfig?.calendar_end_field || null
      
      if (process.env.NODE_ENV === 'development' && filteredRows.length > 0) {
        console.log('Calendar: Date field resolution', {
          actualFieldName,
          actualStartFieldName,
          actualEndFieldName,
          blockConfig: { start_date_field: blockConfig?.start_date_field, end_date_field: blockConfig?.end_date_field },
          viewConfig: { calendar_start_field: viewConfig?.calendar_start_field, calendar_end_field: viewConfig?.calendar_end_field }
        })
      }
      
      // CRITICAL: Log sample row data to debug date field extraction
      if (process.env.NODE_ENV === 'development' && filteredRows.length > 0) {
        const sampleRow = filteredRows[0]
        console.log('Calendar: Sample row data for event mapping', {
          rowId: sampleRow.id,
          dateFieldName: actualStartFieldName || actualFieldName,
          dateValue: sampleRow.data ? sampleRow.data[actualStartFieldName || actualFieldName] : 'no data',
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
          
          // Check for date value - prefer start field if configured, otherwise use date field
          let dateValue: any = null
          const dateFieldToUse = actualStartFieldName || actualFieldName
          
          if (dateFieldToUse) {
            dateValue = row.data[dateFieldToUse]
            
            // Also try common variations (case-insensitive, with/without underscores)
            if (!dateValue) {
              const lowerFieldName = dateFieldToUse.toLowerCase()
              for (const key of Object.keys(row.data)) {
                if (key.toLowerCase() === lowerFieldName) {
                  dateValue = row.data[key]
                  break
                }
              }
            }
          }
          
          // Skip if no date value
          if (!dateValue || dateValue === null || dateValue === undefined || dateValue === '') {
            if (process.env.NODE_ENV === 'development' && filteredRows.length <= 5) {
              console.log('Calendar: Row filtered out - no date value', {
                rowId: row.id,
                dateField: dateFieldToUse,
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
        .map((row) => {
          // Get date values - support both single date field and start/end fields
          const dateFieldToUse = actualStartFieldName || actualFieldName
          let dateValue: any = null
          
          if (dateFieldToUse) {
            dateValue = row.data[dateFieldToUse]
            
            // Also try common variations (case-insensitive, with/without underscores)
            if (!dateValue) {
              const lowerFieldName = dateFieldToUse.toLowerCase()
              for (const key of Object.keys(row.data)) {
                if (key.toLowerCase() === lowerFieldName) {
                  dateValue = row.data[key]
                  break
                }
              }
            }
          }
          
          const endDateValue = actualEndFieldName ? row.data[actualEndFieldName] : null
          
          // Parse date values
          let parsedStartDate: Date
          let parsedEndDate: Date | null = null
          
          try {
            parsedStartDate = dateValue instanceof Date ? dateValue : new Date(dateValue)
            if (isNaN(parsedStartDate.getTime())) {
              parsedStartDate = new Date()
            }
            
            if (endDateValue) {
              parsedEndDate = endDateValue instanceof Date ? endDateValue : new Date(endDateValue)
              if (isNaN(parsedEndDate.getTime())) {
                parsedEndDate = parsedStartDate
              }
            }
          } catch {
            parsedStartDate = new Date()
            parsedEndDate = null
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
                field.name !== actualStartFieldName &&
                field.name !== actualEndFieldName &&
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
          if (titleFieldName && row.data[titleFieldName]) {
            title = String(row.data[titleFieldName])
          } else if (titleFieldId && row.data[titleFieldId]) {
            title = String(row.data[titleFieldId])
          } else {
            // Fallback: use first non-date, non-id field
            for (const [key, value] of Object.entries(row.data)) {
              if (key !== 'id' && key !== dateFieldToUse && key !== actualEndFieldName && value) {
                title = String(value)
                break
              }
            }
            if (title === "Untitled") {
              title = `Event ${row.id.substring(0, 8)}`
            }
          }

          // Get color from color field if configured
          let eventColor: string | undefined = undefined
          if (colorField && viewConfig?.calendar_color_field) {
            const colorFieldName = colorField.name || viewConfig.calendar_color_field
            const colorValue = row.data[colorFieldName]
            
            // If color field is a select field, use choiceColors from options
            if (colorValue && colorField.options?.choiceColors) {
              // Normalize the value for lookup (trim whitespace, handle case)
              const normalizedValue = String(colorValue).trim()
              const choiceColors = colorField.options.choiceColors
              
              // Try exact match first
              if (choiceColors[normalizedValue]) {
                eventColor = choiceColors[normalizedValue]
              } else {
                // Try case-insensitive match
                const matchingKey = Object.keys(choiceColors).find(
                  key => key.toLowerCase() === normalizedValue.toLowerCase()
                )
                if (matchingKey) {
                  eventColor = choiceColors[matchingKey]
                }
              }
              
              // Ensure hex color format
              if (eventColor && !eventColor.startsWith('#')) {
                eventColor = `#${eventColor}`
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

  // Render date range filters and other filters above calendar
  const renderFilters = () => {
    const hasOtherFilters = filters && filters.length > 0
    
    return (
      <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
        {/* Date Range Filters - Always show if resolvedDateFieldId is available */}
        {resolvedDateFieldId && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-600">Date Range</div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Label htmlFor="date-from" className="text-xs text-gray-600 whitespace-nowrap">
                  From:
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date-from"
                      variant="outline"
                      size="sm"
                      className="w-[140px] justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {dateFrom && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setDateFrom(undefined)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <Label htmlFor="date-to" className="text-xs text-gray-600 whitespace-nowrap">
                  To:
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date-to"
                      variant="outline"
                      size="sm"
                      className="w-[140px] justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      disabled={(date) => dateFrom ? date < dateFrom : false}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {dateTo && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setDateTo(undefined)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              {(dateFrom || dateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setDateFrom(undefined)
                    setDateTo(undefined)
                  }}
                >
                  Clear range
                </Button>
              )}
            </div>
          </div>
        )}
        
        {/* Other Filters */}
        {hasOtherFilters && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-600">Other Filters</div>
            <div className="flex flex-wrap gap-2">
              {filters.map((filter, idx) => (
                <div
                  key={idx}
                  className="px-2 py-1 bg-white border border-gray-300 rounded text-xs"
                >
                  <span className="font-medium">{filter.field}</span>
                  <span className="mx-1 text-gray-400">{filter.operator}</span>
                  <span className="text-gray-600">{String(filter.value || '')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="w-full h-full p-6 bg-gray-50">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {renderFilters()}
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          events={calendarEvents}
          key={`calendar-${resolvedTableId}-${resolvedDateFieldId}`} // CRITICAL: Stable key - don't include events.length to prevent remounts
          editable={true}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: viewMode === 'month' ? "dayGridWeek,dayGridMonth" : "dayGridMonth,dayGridWeek",
          }}
          initialView={viewMode === 'month' ? "dayGridMonth" : "dayGridWeek"}
          viewDidMount={(view) => {
            // Update view mode when user changes view
            if (view.view.type === 'dayGridMonth') {
              setViewMode('month')
            } else if (view.view.type === 'dayGridWeek') {
              setViewMode('week')
            }
          }}
          eventClick={(info) => {
            // CRITICAL: Handle event click - use onRecordClick callback if provided, otherwise use modal
            const recordId = info.event.id
            
            // DEBUG_CALENDAR: Always log event clicks in development (prove click wiring works)
            // Standardise on localStorage.getItem("DEBUG_CALENDAR") === "1"
            const debugEnabled = typeof window !== 'undefined' && localStorage.getItem("DEBUG_CALENDAR") === "1"
            if (debugEnabled || process.env.NODE_ENV === 'development') {
              console.log('[Calendar] Event clicked', {
                recordId,
                eventId: info.event.id,
                eventTitle: info.event.title,
                hasOnRecordClick: !!onRecordClick,
                willUseModal: !onRecordClick,
                willCallCallback: !!onRecordClick,
                debugEnabled,
              })
            }
            
            debugCalendar('CALENDAR', 'Event clicked', {
              recordId,
              event: info.event,
              hasOnRecordClick: !!onRecordClick,
              willUseModal: !onRecordClick
            })
            
            if (recordId) {
              // If onRecordClick callback provided (e.g., from RecordReview), use it
              if (onRecordClick) {
                if (debugEnabled || process.env.NODE_ENV === 'development') {
                  console.log('[Calendar] Calling onRecordClick callback', { recordId })
                }
                onRecordClick(recordId)
              } else {
                // Otherwise, open modal (default behavior)
                if (debugEnabled || process.env.NODE_ENV === 'development') {
                  console.log('[Calendar] Opening record modal', { recordId })
                }
                setSelectedRecordId(recordId)
              }
            } else {
              console.warn('[Calendar] Event clicked but no recordId found', { event: info.event })
            }
          }}
          dateClick={(info) => {
            // Date clicked - could create new record in future
            // Silently handle for now
          }}
        />
      </div>

      {/* Record Modal */}
      {resolvedTableId && (
        <RecordModal
          open={selectedRecordId !== null}
          onClose={() => setSelectedRecordId(null)}
          tableId={resolvedTableId}
          recordId={selectedRecordId}
          tableFields={loadedTableFields}
          onSave={() => {
            // Reload rows after save
            if (resolvedTableId && supabaseTableName) {
              loadRows()
            }
          }}
        />
      )}
    </div>
  )
}
