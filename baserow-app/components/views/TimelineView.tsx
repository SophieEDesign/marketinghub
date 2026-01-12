"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { format } from "date-fns"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react"
import { filterRowsBySearch } from "@/lib/search/filterRows"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import type { TableRow } from "@/types/database"
import type { TableField } from "@/types/fields"

interface TimelineViewProps {
  tableId: string
  viewId: string
  startDateFieldId?: string
  endDateFieldId?: string
  dateFieldId?: string // Single date field (if no start/end)
  fieldIds: string[]
  searchQuery?: string
  tableFields?: TableField[]
  blockConfig?: Record<string, any> // Block/page config for reading date_from/date_to from page settings
}

type ZoomLevel = "day" | "week" | "month" | "quarter" | "year"

interface TimelineEvent {
  id: string
  rowId: string
  title: string
  start: Date
  end: Date
  rowData: Record<string, any>
  color?: string
}

export default function TimelineView({
  tableId,
  viewId,
  startDateFieldId,
  endDateFieldId,
  dateFieldId,
  fieldIds: fieldIdsProp,
  searchQuery = "",
  tableFields = [],
  blockConfig = {},
}: TimelineViewProps) {
  // Ensure fieldIds is always an array
  const fieldIds = Array.isArray(fieldIdsProp) ? fieldIdsProp : []
  const { openRecord } = useRecordPanel()
  const [rows, setRows] = useState<TableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("month")
  const [scrollPosition, setScrollPosition] = useState(0)
  const timelineRef = useRef<HTMLDivElement>(null)

  // Drag and resize state
  const [draggingEvent, setDraggingEvent] = useState<string | null>(null)
  const [resizingEvent, setResizingEvent] = useState<{ id: string; edge: 'start' | 'end' } | null>(null)
  const [dragStartPos, setDragStartPos] = useState<{ x: number; startDate: Date; endDate: Date } | null>(null)
  const [optimisticUpdates, setOptimisticUpdates] = useState<Record<string, { start?: Date; end?: Date }>>({})

  // Get table name for opening records
  const [supabaseTableName, setSupabaseTableName] = useState<string>("")

  useEffect(() => {
    loadTableInfo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId])

  useEffect(() => {
    if (supabaseTableName) {
      loadRows()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseTableName, tableId])

  async function loadTableInfo() {
    const { data } = await supabase
      .from("tables")
      .select("supabase_table")
      .eq("id", tableId)
      .single()
    if (data) {
      setSupabaseTableName(data.supabase_table)
    }
  }

  async function loadRows() {
    if (!supabaseTableName) return
    
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from(supabaseTableName)
        .select("*")
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error loading rows:", error)
        setRows([])
      } else {
        // Convert to TableRow format
        const tableRows: TableRow[] = (data || []).map((row: any) => ({
          id: row.id,
          table_id: tableId,
          data: row,
          created_at: row.created_at || new Date().toISOString(),
          updated_at: row.updated_at || new Date().toISOString(),
        }))
        setRows(tableRows)
      }
    } catch (error) {
      console.error("Error loading rows:", error)
      setRows([])
    }
    setLoading(false)
  }

  // Filter rows by search query
  const filteredRows = useMemo(() => {
    if (!searchQuery || !tableFields.length) return rows

    const flatRows = rows.map((row) => ({
      ...row.data,
      _rowId: row.id,
    }))

    const filtered = filterRowsBySearch(flatRows, tableFields, searchQuery, fieldIds)
    const filteredIds = new Set(filtered.map((r) => r._rowId))

    return rows.filter((row) => filteredIds.has(row.id))
  }, [rows, tableFields, searchQuery, fieldIds])

  // Resolve date_from and date_to fields from block config, props, or auto-detect
  const resolvedDateFields = useMemo(() => {
    // Resolve date_from field (default/primary): block config > props > auto-detect
    const blockFromField = blockConfig?.date_from || blockConfig?.from_date_field || blockConfig?.start_date_field
    let resolvedFromField = blockFromField
      ? tableFields.find(f => (f.name === blockFromField || f.id === blockFromField) && f.type === 'date')
      : null
    
    // Auto-detect date_from field if not configured
    if (!resolvedFromField && !startDateFieldId) {
      resolvedFromField = tableFields.find(f => 
        f.type === 'date' && (
          f.name.toLowerCase() === 'date_from' || 
          f.name.toLowerCase() === 'from_date' ||
          f.name.toLowerCase() === 'start_date' ||
          f.name.toLowerCase().includes('date_from') ||
          f.name.toLowerCase().includes('from_date')
        )
      )
    }
    
    const actualFromFieldName = resolvedFromField?.name || startDateFieldId || dateFieldId || null
    
    // Resolve date_to field (secondary/range): block config > props > auto-detect
    const blockToField = blockConfig?.date_to || blockConfig?.to_date_field || blockConfig?.end_date_field
    let resolvedToField = blockToField
      ? tableFields.find(f => (f.name === blockToField || f.id === blockToField) && f.type === 'date')
      : null
    
    // Auto-detect date_to field if not configured
    if (!resolvedToField && !endDateFieldId) {
      resolvedToField = tableFields.find(f => 
        f.type === 'date' && (
          f.name.toLowerCase() === 'date_to' || 
          f.name.toLowerCase() === 'to_date' ||
          f.name.toLowerCase() === 'end_date' ||
          f.name.toLowerCase().includes('date_to') ||
          f.name.toLowerCase().includes('to_date')
        )
      )
    }
    
    const actualToFieldName = resolvedToField?.name || endDateFieldId || null
    
    return {
      fromFieldName: actualFromFieldName,
      toFieldName: actualToFieldName,
    }
  }, [blockConfig, startDateFieldId, endDateFieldId, dateFieldId, tableFields])

  // Convert rows to timeline events
  const events = useMemo<TimelineEvent[]>(() => {
    // Ensure filteredRows is an array
    if (!Array.isArray(filteredRows)) return []
    
    const { fromFieldName, toFieldName } = resolvedDateFields
    
    return filteredRows
      .filter((row) => {
        // Check if row has at least one date value (from date_from or date_to)
        if (fromFieldName && row.data[fromFieldName]) {
          return true
        }
        if (toFieldName && row.data[toFieldName]) {
          return true
        }
        // Fallback to old field names for backward compatibility
        if (startDateFieldId && row.data[startDateFieldId]) {
          return true
        }
        if (endDateFieldId && row.data[endDateFieldId]) {
          return true
        }
        if (dateFieldId && row.data[dateFieldId]) {
          return true
        }
        return false
      })
      .map((row) => {
        let start: Date
        let end: Date

        // Apply optimistic updates if available
        const optimistic = optimisticUpdates[row.id]

        const { fromFieldName, toFieldName } = resolvedDateFields
        
        // Get date values - prefer date_from (default), fallback to date_to if only that exists
        let fromDateValue: any = null
        let toDateValue: any = null
        
        // Try to get date_from value
        if (fromFieldName) {
          fromDateValue = optimistic?.start 
            ? optimistic.start.toISOString()
            : row.data[fromFieldName]
        }
        
        // Try to get date_to value
        if (toFieldName) {
          toDateValue = optimistic?.end
            ? optimistic.end.toISOString()
            : row.data[toFieldName]
        }
        
        // Fallback to old field names for backward compatibility
        if (!fromDateValue && startDateFieldId) {
          fromDateValue = optimistic?.start 
            ? optimistic.start.toISOString()
            : row.data[startDateFieldId]
        }
        if (!toDateValue && endDateFieldId) {
          toDateValue = optimistic?.end
            ? optimistic.end.toISOString()
            : row.data[endDateFieldId]
        }
        if (!fromDateValue && !toDateValue && dateFieldId) {
          fromDateValue = optimistic?.start
            ? optimistic.start.toISOString()
            : row.data[dateFieldId]
        }
        
        // Parse date values
        // Start date: prefer date_from, fallback to date_to if date_from is not available
        const startDateValue = fromDateValue || toDateValue
        if (startDateValue) {
          const parsedStart = startDateValue instanceof Date ? startDateValue : new Date(startDateValue)
          if (!isNaN(parsedStart.getTime())) {
            start = parsedStart
          } else {
            start = new Date()
          }
        } else {
          start = new Date()
        }
        
        // End date: use date_to if available (for range), otherwise use start date (single day event)
        if (toDateValue) {
          const parsedEnd = toDateValue instanceof Date ? toDateValue : new Date(toDateValue)
          if (!isNaN(parsedEnd.getTime())) {
            end = parsedEnd
          } else {
            end = start
          }
        } else if (fromDateValue && !toDateValue) {
          // Only date_from available, use it for both start and end (single day event)
          end = start
        } else {
          // No end date, use start date for both
          end = start
        }

        // Get title from first non-date field
        const titleField = (Array.isArray(fieldIds) ? fieldIds : []).find(
          (fid) => fid !== dateFieldId && fid !== startDateFieldId && fid !== endDateFieldId && 
                   fid !== fromFieldName && fid !== toFieldName
        )
        const title = titleField ? String(row.data[titleField] || "Untitled") : "Untitled"

        // Get color from select field if available
        const colorField = tableFields.find(
          (f) => f.type === "single_select" && Array.isArray(fieldIds) && fieldIds.includes(f.id || f.name)
        )
        const color = colorField
          ? getColorForValue(row.data[colorField.id || colorField.name])
          : undefined

        return {
          id: row.id,
          rowId: row.id,
          title,
          start,
          end,
          rowData: row.data,
          color,
        }
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime())
  }, [filteredRows, startDateFieldId, endDateFieldId, dateFieldId, fieldIds, tableFields, optimisticUpdates])

  // Calculate timeline range based on zoom level
  const timelineRange = useMemo(() => {
    const start = new Date(currentDate)
    const end = new Date(currentDate)

    switch (zoomLevel) {
      case "day":
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
        break
      case "week":
        const dayOfWeek = start.getDay()
        start.setDate(start.getDate() - dayOfWeek)
        start.setHours(0, 0, 0, 0)
        end.setDate(start.getDate() + 6)
        end.setHours(23, 59, 59, 999)
        break
      case "month":
        start.setDate(1)
        start.setHours(0, 0, 0, 0)
        end.setMonth(end.getMonth() + 1)
        end.setDate(0)
        end.setHours(23, 59, 59, 999)
        break
      case "quarter":
        const quarter = Math.floor(start.getMonth() / 3)
        start.setMonth(quarter * 3, 1)
        start.setHours(0, 0, 0, 0)
        end.setMonth((quarter + 1) * 3, 0)
        end.setHours(23, 59, 59, 999)
        break
      case "year":
        start.setMonth(0, 1)
        start.setHours(0, 0, 0, 0)
        end.setMonth(11, 31)
        end.setHours(23, 59, 59, 999)
        break
    }

    return { start, end }
  }, [currentDate, zoomLevel])

  // Filter events within timeline range
  const visibleEvents = useMemo(() => {
    return events.filter((event) => {
      return event.end >= timelineRange.start && event.start <= timelineRange.end
    })
  }, [events, timelineRange])

  // Calculate pixel positions for events
  const getEventPosition = useCallback(
    (event: TimelineEvent) => {
      const timelineWidth = timelineRef.current?.clientWidth || 1000
      const rangeMs = timelineRange.end.getTime() - timelineRange.start.getTime()
      const startMs = event.start.getTime() - timelineRange.start.getTime()
      const durationMs = event.end.getTime() - event.start.getTime()

      const left = (startMs / rangeMs) * timelineWidth
      const width = Math.max((durationMs / rangeMs) * timelineWidth, 100) // Min width 100px

      return { left, width }
    },
    [timelineRange]
  )

  // Generate time labels based on zoom level
  const timeLabels = useMemo(() => {
    const labels: Array<{ date: Date; label: string; position: number }> = []
    const timelineWidth = timelineRef.current?.clientWidth || 1000
    const rangeMs = timelineRange.end.getTime() - timelineRange.start.getTime()

    let current = new Date(timelineRange.start)
    const increment = getIncrementForZoom(zoomLevel)

    while (current <= timelineRange.end) {
      const position = ((current.getTime() - timelineRange.start.getTime()) / rangeMs) * timelineWidth
      labels.push({
        date: new Date(current),
        label: formatDateForZoom(current, zoomLevel),
        position,
      })
      current = addTime(current, increment, zoomLevel)
    }

    return labels
  }, [timelineRange, zoomLevel])

  const handleEventClick = useCallback(
    (event: TimelineEvent, e: React.MouseEvent) => {
      // Don't open record if we're resizing
      if (resizingEvent) {
        e.stopPropagation()
        return
      }
      if (supabaseTableName && tableId) {
        openRecord(tableId, event.rowId, supabaseTableName)
      }
    },
    [openRecord, supabaseTableName, tableId, resizingEvent]
  )

  // Handle event date updates
  const handleEventUpdate = useCallback(
    async (eventId: string, updates: { start?: Date; end?: Date }) => {
      if (!supabaseTableName) return

      try {
        const updateData: Record<string, any> = {}
        
        if (updates.start !== undefined) {
          if (startDateFieldId) {
            updateData[startDateFieldId] = updates.start.toISOString()
          } else if (dateFieldId) {
            updateData[dateFieldId] = updates.start.toISOString()
          }
        }
        
        if (updates.end !== undefined) {
          if (endDateFieldId) {
            updateData[endDateFieldId] = updates.end.toISOString()
          } else if (dateFieldId && !startDateFieldId) {
            // If only dateFieldId, update it with end date
            updateData[dateFieldId] = updates.end.toISOString()
          }
        }

        if (Object.keys(updateData).length > 0) {
          const { error } = await supabase
            .from(supabaseTableName)
            .update(updateData)
            .eq('id', eventId)

          if (error) throw error

          // Reload rows to reflect changes
          await loadRows()
        }
      } catch (error) {
        console.error('Error updating event dates:', error)
        alert('Failed to update event dates')
      }
    },
    [supabaseTableName, startDateFieldId, endDateFieldId, dateFieldId]
  )

  // Handle drag start
  const handleDragStart = useCallback(
    (event: TimelineEvent, e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDraggingEvent(event.id)
      setDragStartPos({
        x: e.clientX,
        startDate: new Date(event.start),
        endDate: new Date(event.end),
      })
    },
    []
  )

  // Handle resize start
  const handleResizeStart = useCallback(
    (event: TimelineEvent, edge: 'start' | 'end', e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setResizingEvent({ id: event.id, edge })
      // Store original dates for constraint calculations
      setDragStartPos({
        x: e.clientX,
        startDate: new Date(event.start),
        endDate: new Date(event.end),
      })
    },
    []
  )

  // Handle mouse move for dragging/resizing
  useEffect(() => {
    if (!draggingEvent && !resizingEvent) return
    if (!dragStartPos) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current) return

      const timelineRect = timelineRef.current.getBoundingClientRect()
      const relativeX = e.clientX - timelineRect.left
      const timelineWidth = timelineRef.current.clientWidth
      const rangeMs = timelineRange.end.getTime() - timelineRange.start.getTime()
      
      if (draggingEvent) {
        // Calculate the offset from the drag start
        const dragOffsetX = e.clientX - dragStartPos.x
        const offsetMs = (dragOffsetX / timelineWidth) * rangeMs
        const duration = dragStartPos.endDate.getTime() - dragStartPos.startDate.getTime()
        const newStart = new Date(dragStartPos.startDate.getTime() + offsetMs)
        const newEnd = new Date(newStart.getTime() + duration)
        
        // Don't clamp during dragging - allow moving outside visible range

        // Update optimistic state
        setOptimisticUpdates((prev) => ({
          ...prev,
          [draggingEvent]: { start: newStart, end: newEnd },
        }))
      } else if (resizingEvent && dragStartPos) {
        // Calculate the date at the mouse position for resizing
        const dateMs = timelineRange.start.getTime() + (relativeX / timelineWidth) * rangeMs
        const newDate = new Date(dateMs)
        
        // Use original dates from dragStartPos for constraints
        if (resizingEvent.edge === 'start') {
          // Start can't be after end
          const newStart = newDate < dragStartPos.endDate ? newDate : new Date(dragStartPos.endDate.getTime() - 1)
          setOptimisticUpdates((prev) => ({
            ...prev,
            [resizingEvent.id]: { ...prev[resizingEvent.id], start: newStart },
          }))
        } else {
          // End can't be before start
          const newEnd = newDate > dragStartPos.startDate ? newDate : new Date(dragStartPos.startDate.getTime() + 1)
          setOptimisticUpdates((prev) => ({
            ...prev,
            [resizingEvent.id]: { ...prev[resizingEvent.id], end: newEnd },
          }))
        }
      }
    }

    const handleMouseUp = async () => {
      if (draggingEvent && dragStartPos) {
        const event = events.find((e) => e.id === draggingEvent)
        if (event) {
          await handleEventUpdate(draggingEvent, {
            start: event.start,
            end: event.end,
          })
        }
        // Clear optimistic update after save
        setOptimisticUpdates((prev) => {
          const next = { ...prev }
          delete next[draggingEvent]
          return next
        })
        setDraggingEvent(null)
        setDragStartPos(null)
      } else if (resizingEvent && dragStartPos) {
        const event = events.find((e) => e.id === resizingEvent.id)
        if (event) {
          if (resizingEvent.edge === 'start') {
            await handleEventUpdate(resizingEvent.id, { start: event.start })
          } else {
            await handleEventUpdate(resizingEvent.id, { end: event.end })
          }
        }
        // Clear optimistic update after save
        setOptimisticUpdates((prev) => {
          const next = { ...prev }
          delete next[resizingEvent.id]
          return next
        })
        setResizingEvent(null)
        setDragStartPos(null)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingEvent, resizingEvent, dragStartPos, timelineRange, events, handleEventUpdate])

  const handlePrevious = () => {
    const newDate = new Date(currentDate)
    switch (zoomLevel) {
      case "day":
        newDate.setDate(newDate.getDate() - 1)
        break
      case "week":
        newDate.setDate(newDate.getDate() - 7)
        break
      case "month":
        newDate.setMonth(newDate.getMonth() - 1)
        break
      case "quarter":
        newDate.setMonth(newDate.getMonth() - 3)
        break
      case "year":
        newDate.setFullYear(newDate.getFullYear() - 1)
        break
    }
    setCurrentDate(newDate)
  }

  const handleNext = () => {
    const newDate = new Date(currentDate)
    switch (zoomLevel) {
      case "day":
        newDate.setDate(newDate.getDate() + 1)
        break
      case "week":
        newDate.setDate(newDate.getDate() + 7)
        break
      case "month":
        newDate.setMonth(newDate.getMonth() + 1)
        break
      case "quarter":
        newDate.setMonth(newDate.getMonth() + 3)
        break
      case "year":
        newDate.setFullYear(newDate.getFullYear() + 1)
        break
    }
    setCurrentDate(newDate)
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  const handleZoomIn = () => {
    const levels: ZoomLevel[] = ["year", "quarter", "month", "week", "day"]
    const currentIndex = levels.indexOf(zoomLevel)
    if (currentIndex < levels.length - 1) {
      setZoomLevel(levels[currentIndex + 1])
    }
  }

  const handleZoomOut = () => {
    const levels: ZoomLevel[] = ["year", "quarter", "month", "week", "day"]
    const currentIndex = levels.indexOf(zoomLevel)
    if (currentIndex > 0) {
      setZoomLevel(levels[currentIndex - 1])
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading timeline...</div>
      </div>
    )
  }

  if (!dateFieldId && !startDateFieldId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500">
          <p className="mb-2">No date field configured</p>
          <p className="text-sm">Please configure a date field for this timeline view</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="ml-4 text-sm font-medium">
            {formatDateRange(timelineRange.start, timelineRange.end, zoomLevel)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleZoomOut} disabled={zoomLevel === "year"}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <div className="text-xs text-gray-600 capitalize px-2">{zoomLevel}</div>
          <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={zoomLevel === "day"}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-auto relative" ref={timelineRef}>
        <div className="relative" style={{ minHeight: "100%", padding: "20px" }}>
          {/* Time labels */}
          <div className="sticky top-0 bg-white z-10 border-b border-gray-200 pb-2 mb-4">
            <div className="relative h-8">
              {timeLabels.map((label, index) => (
                <div
                  key={index}
                  className="absolute text-xs text-gray-600"
                  style={{ left: `${label.position}px`, transform: "translateX(-50%)" }}
                >
                  {label.label}
                </div>
              ))}
            </div>
          </div>

          {/* Events */}
          <div className="relative" style={{ minHeight: "400px" }}>
            {visibleEvents.map((event, index) => {
              const { left, width } = getEventPosition(event)
              const isDragging = draggingEvent === event.id
              const isResizing = resizingEvent?.id === event.id
              
              return (
                <div
                  key={event.id}
                  className="absolute group"
                  style={{
                    left: `${left}px`,
                    width: `${width}px`,
                    top: `${index * 50}px`,
                    height: "40px",
                  }}
                >
                  <Card
                    className={`h-full shadow-sm hover:shadow-md transition-shadow ${
                      event.color ? `border-l-4` : ""
                    } ${isDragging || isResizing ? 'opacity-75' : ''} ${
                      draggingEvent || resizingEvent ? 'cursor-grabbing' : 'cursor-move'
                    }`}
                    style={{
                      borderLeftColor: event.color,
                      backgroundColor: event.color ? `${event.color}15` : "white",
                    }}
                    onMouseDown={(e) => handleDragStart(event, e)}
                    onClick={(e) => handleEventClick(event, e)}
                  >
                    <CardContent className="p-2 h-full flex items-center relative">
                      {/* Resize handle - left */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-blue-300/50 opacity-0 group-hover:opacity-100 transition-opacity z-10 rounded-l"
                        onMouseDown={(e) => handleResizeStart(event, 'start', e)}
                        style={{ marginLeft: '-3px' }}
                        title="Drag to resize start date"
                      />
                      
                      {/* Event content */}
                      <div className="truncate text-sm font-medium flex-1 px-1">{event.title}</div>
                      
                      {/* Resize handle - right */}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-blue-300/50 opacity-0 group-hover:opacity-100 transition-opacity z-10 rounded-r"
                        onMouseDown={(e) => handleResizeStart(event, 'end', e)}
                        style={{ marginRight: '-3px' }}
                        title="Drag to resize end date"
                      />
                    </CardContent>
                  </Card>
                </div>
              )
            })}
          </div>

          {visibleEvents.length === 0 && (
            <div className="flex items-center justify-center h-64 text-gray-400">
              <div className="text-center">
                <p className="mb-2">No events in this time range</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    // Create new record
                    if (supabaseTableName) {
                      const newData: Record<string, any> = {}
                      if (dateFieldId) {
                        newData[dateFieldId] = new Date().toISOString()
                      }
                      if (startDateFieldId) {
                        newData[startDateFieldId] = new Date().toISOString()
                      }
                      const { error } = await supabase.from(supabaseTableName).insert([newData])
                      if (!error) {
                        loadRows()
                      }
                    }
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Event
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper functions
function getColorForValue(value: string): string {
  const colors = [
    "#3B82F6", // blue
    "#10B981", // green
    "#F59E0B", // amber
    "#EF4444", // red
    "#8B5CF6", // purple
    "#EC4899", // pink
    "#06B6D4", // cyan
    "#84CC16", // lime
  ]
  const hash = value.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colors[hash % colors.length]
}

function getIncrementForZoom(zoom: ZoomLevel): number {
  switch (zoom) {
    case "day":
      return 1 // hours
    case "week":
      return 1 // days
    case "month":
      return 1 // days
    case "quarter":
      return 1 // weeks
    case "year":
      return 1 // months
  }
}

function addTime(date: Date, increment: number, zoom: ZoomLevel): Date {
  const newDate = new Date(date)
  switch (zoom) {
    case "day":
      newDate.setHours(newDate.getHours() + increment)
      break
    case "week":
      newDate.setDate(newDate.getDate() + increment)
      break
    case "month":
      newDate.setDate(newDate.getDate() + increment)
      break
    case "quarter":
      newDate.setDate(newDate.getDate() + increment * 7)
      break
    case "year":
      newDate.setMonth(newDate.getMonth() + increment)
      break
  }
  return newDate
}

function formatDateForZoom(date: Date, zoom: ZoomLevel): string {
  // Validate date before formatting
  if (!date || isNaN(date.getTime())) {
    return "Invalid Date"
  }
  
  try {
    switch (zoom) {
      case "day":
        // Time format: HH:mm (24-hour clock, UK standard)
        return format(date, "HH:mm")
      case "week":
        // Day name and day number: "Mon 08"
        return format(date, "EEE d")
      case "month":
        // Day number only: "08"
        return format(date, "d")
      case "quarter":
        // Month abbreviation and day: "Jan 08"
        return format(date, "MMM d")
      case "year":
        // Month abbreviation only: "Jan"
        return format(date, "MMM")
      default:
        return format(date, "dd/MM/yyyy")
    }
  } catch (error) {
    console.error('Error formatting date:', error, date)
    return "Invalid Date"
  }
}

function formatDateRange(start: Date, end: Date, zoom: ZoomLevel): string {
  // Validate dates before formatting
  if (!start || isNaN(start.getTime()) || !end || isNaN(end.getTime())) {
    return "Invalid Date Range"
  }
  
  try {
    switch (zoom) {
      case "day":
        // Full date: "08 January 2026" (UK format)
        return format(start, "d MMMM yyyy")
      case "week":
        // Date range: "08 Jan - 14 Jan" (UK format)
        return `${format(start, "d MMM")} - ${format(end, "d MMM")}`
      case "month":
        // Month and year: "January 2026"
        return format(start, "MMMM yyyy")
      case "quarter":
        // Month range: "Jan - Mar 2026"
        return `${format(start, "MMM")} - ${format(end, "MMM yyyy")}`
      case "year":
      // Year only: "2026"
      return start.getFullYear().toString()
    default:
      return `${format(start, "dd/MM/yyyy")} - ${format(end, "dd/MM/yyyy")}`
    }
  } catch (error) {
    console.error('Error formatting date range:', error, { start, end })
    return "Invalid Date Range"
  }
}

