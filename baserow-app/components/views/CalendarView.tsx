"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import { filterRowsBySearch } from "@/lib/search/filterRows"
import { applyFiltersToQuery, type FilterConfig } from "@/lib/interface/filters"
import type { EventInput } from "@fullcalendar/core"
import type { TableRow } from "@/types/database"
import type { TableField } from "@/types/fields"

interface CalendarViewProps {
  tableId: string
  viewId: string
  dateFieldId: string
  fieldIds: string[]
  searchQuery?: string
  tableFields?: any[]
  filters?: FilterConfig[] // Dynamic filters from config
  onRecordClick?: (recordId: string) => void // Emit recordId on click
}

export default function CalendarView({ 
  tableId, 
  viewId, 
  dateFieldId, 
  fieldIds,
  searchQuery = "",
  tableFields = [],
  filters = [],
  onRecordClick
}: CalendarViewProps) {
  const router = useRouter()
  const [rows, setRows] = useState<TableRow[]>([])
  const [loading, setLoading] = useState(true)
  // CRITICAL: Initialize resolvedTableId from prop immediately (don't wait for useEffect)
  const [resolvedTableId, setResolvedTableId] = useState<string>(tableId || '')
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')
  const [supabaseTableName, setSupabaseTableName] = useState<string | null>(null)
  const [loadedTableFields, setLoadedTableFields] = useState<TableField[]>(tableFields || [])
  
  // Use refs to track previous values and prevent infinite loops
  const prevTableFieldsRef = useRef<string>('')
  const prevFiltersRef = useRef<string>('')
  const prevLoadedFieldsKeyRef = useRef<string>('')
  const isLoadingRef = useRef(false)

  useEffect(() => {
    // If tableId prop changes, update resolvedTableId immediately
    if (tableId && tableId.trim() !== '') {
      console.log('Calendar: tableId prop changed, updating resolvedTableId:', tableId)
      setResolvedTableId(tableId)
    } else {
      // Only try to resolve from viewId if tableId is not provided
      resolveTableId()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, viewId])

  useEffect(() => {
    if (resolvedTableId) {
      loadTableInfo()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTableId])

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

  // Memoize filters to prevent unnecessary re-renders
  const filtersKey = useMemo(() => {
    return JSON.stringify(filters || [])
  }, [filters])

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
      return
    }
    
    // Update the ref with current key before checking
    const currentFieldsKey = loadedTableFieldsKey
    if (prevLoadedFieldsKeyRef.current !== currentFieldsKey) {
      prevLoadedFieldsKeyRef.current = currentFieldsKey
    }
    
    // Only reload if filters, searchQuery, or loadedTableFields actually changed
    const currentFiltersKey = filtersKey
    const combinedKey = `${currentFiltersKey}|${searchQuery}|${currentFieldsKey}`
    
    // Only call loadRows if the combined key actually changed
    // This prevents infinite loops when props are recreated but content is the same
    if (prevFiltersRef.current !== combinedKey && combinedKey !== '') {
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
      
      // Only log when actually loading (not on every render check)
      if (process.env.NODE_ENV === 'development') {
        console.log('Calendar: Loading rows from table', {
          tableId: resolvedTableId,
          supabaseTableName,
          filtersCount: filters.length,
          fieldIdsCount: fieldIds.length
        })
      }
      
      // Build query with filters
      let query = supabase
        .from(supabaseTableName)
        .select("*")

      // Apply filters using shared filter system
      const normalizedFields = loadedTableFields.map(f => ({ name: f.name || f.id, type: f.type }))
      query = applyFiltersToQuery(query, filters, normalizedFields)

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
        
        // Only log in development and only once per actual load
        if (process.env.NODE_ENV === 'development') {
          console.log('Calendar: Loaded', data?.length || 0, 'rows from', supabaseTableName)
          if (tableRows.length > 0) {
            console.log('Calendar: Sample row data keys:', Object.keys(tableRows[0].data).slice(0, 10))
          }
        }
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
    if (!dateFieldId || !loadedTableFields.length) return null
    // Try to find by name first, then by id
    return loadedTableFields.find(f => 
      f.name === dateFieldId || 
      f.id === dateFieldId
    )
  }, [dateFieldId, loadedTableFields])

  const isValidDateField = useMemo(() => {
    if (!dateField) return false
    const fieldType = dateField.type
    return fieldType === 'date'
  }, [dateField])

  function getEvents(): EventInput[] {
    if (!dateFieldId || !isValidDateField) {
      console.log('Calendar: Cannot generate events - dateFieldId:', dateFieldId, 'isValidDateField:', isValidDateField, 'dateField:', dateField)
      return []
    }
    
    if (!filteredRows || filteredRows.length === 0) {
      console.log('Calendar: No rows to generate events from. Total rows:', rows.length, 'Filtered rows:', filteredRows?.length)
      return []
    }
    
    try {
      // Find the actual field name to use (could be name or id)
      const actualFieldName = dateField?.name || dateFieldId
      
      console.log('Calendar: Generating events with dateFieldId:', dateFieldId, 'actualFieldName:', actualFieldName, 'rows:', filteredRows.length)
      
      const events = filteredRows
        .filter((row) => {
          if (!row || !row.data) {
            console.log('Calendar: Skipping row - missing data', row)
            return false
          }
          
          // Try both the field name and the field ID
          const dateValue = row.data[actualFieldName] || row.data[dateFieldId]
          
          if (!dateValue) {
            // Log first few rows to debug
            if (filteredRows.indexOf(row) < 3) {
              console.log('Calendar: Row missing date value', {
                rowId: row.id,
                actualFieldName,
                dateFieldId,
                availableFields: Object.keys(row.data).slice(0, 5)
              })
            }
            return false
          }
          
          // Accept string dates, Date objects, or ISO strings
          return typeof dateValue === 'string' || dateValue instanceof Date
        })
        .map((row) => {
          const actualFieldName = dateField?.name || dateFieldId
          const dateValue = row.data[actualFieldName] || row.data[dateFieldId]
          
          // Use first non-date field as title, or fallback to row ID
          const titleField = (Array.isArray(fieldIds) ? fieldIds : [])
            .filter((fid) => {
              // Compare both by name and id
              const field = loadedTableFields.find(f => f.name === fid || f.id === fid)
              return field && (field.name !== actualFieldName && field.id !== dateFieldId)
            })
            .slice(0, 1)[0]
          
          // Find the actual field name for title
          const titleFieldObj = loadedTableFields.find(f => f.name === titleField || f.id === titleField)
          const titleFieldName = titleFieldObj?.name || titleField
          
          const title = titleFieldName 
            ? String(row.data[titleFieldName] || row.data[titleField] || "Untitled")
            : `Event ${row.id.substring(0, 8)}`

          return {
            id: row.id,
            title: title || "Untitled",
            start: dateValue,
            extendedProps: {
              rowId: row.id,
              rowData: row.data,
            },
          }
        })
      
      console.log('Calendar: Generated', events.length, 'events from', filteredRows.length, 'rows')
      if (events.length === 0 && filteredRows.length > 0) {
        console.warn('Calendar: No events generated despite having rows. Sample row data keys:', filteredRows[0]?.data ? Object.keys(filteredRows[0].data).slice(0, 10) : 'no data')
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
  if (!dateFieldId || !isValidDateField) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
        <div className="text-sm mb-2 text-center font-medium">
          Calendar view requires a date field.
        </div>
        <div className="text-xs text-gray-400 text-center">
          {!dateFieldId 
            ? "Please select a date field in block settings."
            : `The selected field "${dateFieldId}" is not a date field. Please select a date field in block settings.`
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

  // Render filters above calendar
  const renderFilters = () => {
    if (!filters || filters.length === 0) return null

    return (
      <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-xs font-semibold text-gray-600 mb-2">Filters</div>
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
    )
  }

  return (
    <div className="w-full h-full p-6 bg-gray-50">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {renderFilters()}
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          events={getEvents()}
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
            // Emit recordId and navigate to Record Review page
            const recordId = info.event.id
            if (recordId && onRecordClick) {
              onRecordClick(recordId)
            } else if (recordId && resolvedTableId) {
              // Navigate to record review page
              router.push(`/tables/${resolvedTableId}/records/${recordId}`)
            }
          }}
          dateClick={(info) => {
            // Date clicked - could create new record in future
            // Silently handle for now
          }}
        />
      </div>
    </div>
  )
}
