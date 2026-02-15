"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import type { EventDropArg, EventInput } from "@fullcalendar/core"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus } from "lucide-react"
import CalendarDateRangeControls from "@/components/views/calendar/CalendarDateRangeControls"
import QuickFilterBar from "@/components/filters/QuickFilterBar"
import type { TableRow } from "@/types/database"
import type { TableField } from "@/types/fields"
import { useRecordModal } from "@/contexts/RecordModalContext"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import type { FilterTree } from "@/lib/filters/canonical-model"
import {
  applyFiltersToQuery,
  deriveDefaultValuesFromFilters,
  normalizeFilter,
  type FilterConfig,
} from "@/lib/interface/filters"
import { resolveChoiceColor, normalizeHexColor } from "@/lib/field-colors"
import { asArray } from "@/lib/utils/asArray"
import { normalizeUuid } from "@/lib/utils/ids"
import { isAbortError } from "@/lib/api/error-handling"
import { useOperationFeedback } from "@/hooks/useOperationFeedback"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"

type MultiSource = {
  id: string
  enabled?: boolean
  label?: string
  table_id: string
  view_id?: string
  title_field: string
  start_date_field: string
  end_date_field?: string
  color_field?: string
  type_field?: string
}

interface MultiCalendarViewProps {
  blockId: string
  pageId?: string | null
  sources: MultiSource[]
  filters?: FilterConfig[]
  filterTree?: FilterTree | null
  blockConfig?: Record<string, unknown>
  isEditing?: boolean
  onRecordClick?: (recordId: string, tableId?: string) => void
  pageShowAddRecord?: boolean
  /** Interface mode: 'view' | 'edit'. When 'edit', record panel opens editable (Airtable-style). */
  interfaceMode?: 'view' | 'edit'
}

const SOURCE_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#84cc16",
  "#ec4899",
]

function pickSourceColor(index: number) {
  return SOURCE_COLORS[index % SOURCE_COLORS.length]
}

function safeDateOnly(d: Date) {
  return format(d, "yyyy-MM-dd")
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

function isSelectField(field: TableField): field is TableField & { type: "single_select" | "multi_select" } {
  return field.type === "single_select" || field.type === "multi_select"
}

function resolveFieldNameFromFields(fields: TableField[], raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== "string") return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const match = (Array.isArray(fields) ? fields : []).find((f) => f && (f.name === trimmed || f.id === trimmed))
  return match?.name || trimmed
}

function isFilterCompatible(filter: FilterConfig, tableFields: TableField[]) {
  const fieldName = (filter as any)?.field_name || (filter as any)?.field
  if (!fieldName) return false
  return tableFields.some((f) => f.name === fieldName || f.id === fieldName)
}

function buildSourcesKey(list: MultiSource[]) {
  // Avoid JSON.stringify: configs can contain non-JSON values and throw at render-time.
  return (Array.isArray(list) ? list : [])
    .map((s) =>
      [
        s?.id ?? "",
        s?.enabled === false ? "0" : "1",
        s?.table_id ?? "",
        s?.view_id ?? "",
        s?.title_field ?? "",
        s?.start_date_field ?? "",
        s?.end_date_field ?? "",
        s?.color_field ?? "",
        s?.type_field ?? "",
      ]
        .map((x) => String(x ?? ""))
        .join("~")
    )
    .join("|")
}
function areStringArraysEqual(a: string[], b: string[]) {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

export default function MultiCalendarView({
  blockId,
  pageId = null,
  sources,
  filters = [],
  blockConfig = {},
  isEditing = false,
  onRecordClick,
  pageShowAddRecord = false,
  interfaceMode = 'view',
}: MultiCalendarViewProps) {
  const supabase = useMemo(() => createClient(), [])
  const { openRecord } = useRecordPanel()
  const { openRecordModal } = useRecordModal()
  const { handleError } = useOperationFeedback()

  // Respect block permissions + per-block add-record toggle (same contract as GridBlock).
  const appearance = (blockConfig as any)?.appearance || {}
  const permissions = (blockConfig as any)?.permissions || {}
  const isViewOnly = permissions.mode === "view"
  const allowInlineCreate = permissions.allowInlineCreate ?? true
  const blockShowAddRecord = appearance.show_add_record
  const showAddRecord = blockShowAddRecord === true || (blockShowAddRecord == null && pageShowAddRecord)
  const canCreateRecord = showAddRecord && !isViewOnly && allowInlineCreate && !isEditing

  // IMPORTANT: `sources` can be reconstructed each render upstream. If we unconditionally
  // sync derived defaults into state, we can trigger a render loop (React #185).
  const enabledSourceIdsDefaultKey = useMemo(() => {
    return (Array.isArray(sources) ? sources : [])
      .map((s) => `${s?.id}:${s?.enabled === false ? 0 : 1}`)
      .join("|")
  }, [sources])

  const enabledSourceIdsDefault = useMemo(() => {
    return (Array.isArray(sources) ? sources : []).filter((s) => s.enabled !== false).map((s) => s.id)
  }, [enabledSourceIdsDefaultKey])

  const [enabledSourceIds, setEnabledSourceIds] = useState<string[]>(enabledSourceIdsDefault)

  useEffect(() => {
    setEnabledSourceIds((prev) => (areStringArraysEqual(prev, enabledSourceIdsDefault) ? prev : enabledSourceIdsDefault))
  }, [enabledSourceIdsDefaultKey, enabledSourceIdsDefault])

  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)
  // CRITICAL: Prevent hydration mismatch - FullCalendar generates dynamic IDs that differ between server/client
  const [mounted, setMounted] = useState(false)

  const [tablesBySource, setTablesBySource] = useState<Record<string, { tableId: string; supabaseTable: string; name: string }>>({})
  const [fieldsBySource, setFieldsBySource] = useState<Record<string, TableField[]>>({})
  const [viewDefaultFiltersBySource, setViewDefaultFiltersBySource] = useState<Record<string, FilterConfig[]>>({})
  const [rowsBySource, setRowsBySource] = useState<Record<string, TableRow[]>>({})
  const [errorsBySource, setErrorsBySource] = useState<Record<string, string>>({})

  const [quickFiltersBySource, setQuickFiltersBySource] = useState<Record<string, FilterConfig[]>>({})
  const [quickFilterSourceId, setQuickFilterSourceId] = useState<string>(() => enabledSourceIdsDefault[0] || sources[0]?.id || "")

  // Creation flow
  const [createOpen, setCreateOpen] = useState(false)
  const [createSourceId, setCreateSourceId] = useState<string>("")
  // CRITICAL: Use undefined initially to prevent hydration mismatch, then set to Date after mount
  const [createDate, setCreateDate] = useState<Date | undefined>(undefined)

  const loadingRef = useRef(false)

  // Lifecycle: Mark as mounted to prevent hydration mismatch with FullCalendar
  useEffect(() => {
    setMounted(true)
    // Initialize createDate after mount to prevent hydration mismatch
    if (createDate === undefined) {
      setCreateDate(new Date())
    }
    return () => {
      setMounted(false)
    }
  }, [createDate])

  const effectiveEnabledSources = useMemo(() => {
    const enabledSet = new Set(enabledSourceIds)
    return sources.filter((s) => enabledSet.has(s.id) && s.table_id)
  }, [sources, enabledSourceIds])

  const sourcesKey = useMemo(() => buildSourcesKey(sources), [sources])
  const filtersKey = useMemo(() => {
    try {
      return JSON.stringify(filters || [])
    } catch {
      // Fall back to a lossy but safe signature.
      return (Array.isArray(filters) ? filters : [])
        .map((f: any) => [f?.field ?? "", f?.field_name ?? "", f?.operator ?? "", String(f?.value ?? ""), String(f?.value2 ?? "")]
          .join("~"))
        .join("|")
    }
  }, [filters])

  const loadAll = useCallback(async () => {
    if (loadingRef.current) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[MultiCalendar] loadAll: Already loading, skipping')
      }
      return
    }
    loadingRef.current = true
    setLoading(true)
    if (process.env.NODE_ENV === 'development') {
      console.log('[MultiCalendar] loadAll: Starting load', { sourcesCount: sources.length, sourcesKey })
    }
    const nextErrors: Record<string, string> = {}
    try {
      const nextTables: Record<string, { tableId: string; supabaseTable: string; name: string }> = {}
      const nextFields: Record<string, TableField[]> = {}
      const nextViewDefaults: Record<string, FilterConfig[]> = {}
      const nextRows: Record<string, TableRow[]> = {}

      // Serialize all requests (connection exhaustion guard).
      // Partial failure handling: continue loading other sources if one fails.
      for (const s of sources) {
        try {
          const tableId = normalizeUuid((s as any)?.table_id)
          if (!tableId) {
            nextErrors[s.id] = "Missing table ID"
            continue
          }

          const tableRes = await supabase
            .from("tables")
            .select("id, name, supabase_table")
            .eq("id", tableId)
            .single()

          if (tableRes.error) {
            if (isAbortError(tableRes.error)) {
              // Component unmounted, exit early but clear loading state
              setLoading(false)
              loadingRef.current = false
              return
            }
            const errorMsg = tableRes.error.message || "Failed to load table"
            nextErrors[s.id] = errorMsg
            handleError(tableRes.error, "Calendar Error", `Failed to load table for source "${s.label || s.id}": ${errorMsg}`)
            continue
          }

          if (!tableRes.data?.supabase_table) {
            nextErrors[s.id] = "Table not found"
            continue
          }

          nextTables[s.id] = {
            tableId,
            supabaseTable: tableRes.data.supabase_table,
            name: tableRes.data.name || "Untitled table",
          }

          const fieldsRes = await supabase
            .from("table_fields")
            .select("*")
            .eq("table_id", tableId)
            .order("position", { ascending: true })

          if (fieldsRes.error) {
            if (isAbortError(fieldsRes.error)) {
              // Component unmounted, exit early but clear loading state
              setLoading(false)
              loadingRef.current = false
              return
            }
            console.error(`MultiCalendar: Error loading fields for source ${s.id}:`, fieldsRes.error)
            nextErrors[s.id] = fieldsRes.error.message || "Failed to load fields"
            continue
          }

          nextFields[s.id] = asArray<TableField>(fieldsRes.data)

          // View default filters (optional per source)
          const viewId = normalizeUuid((s as any)?.view_id)
          if (viewId) {
            const viewFiltersRes = await supabase
              .from("view_filters")
              .select("*")
              .eq("view_id", viewId)

            if (viewFiltersRes.error) {
              if (isAbortError(viewFiltersRes.error)) {
                // Component unmounted, exit early but clear loading state
                setLoading(false)
                loadingRef.current = false
                return
              }
              // Non-critical error - log but continue
              console.warn(`MultiCalendar: Error loading view filters for source ${s.id}:`, viewFiltersRes.error)
            }

            const vf = asArray<any>(viewFiltersRes.data || []).map((f: any) =>
              // normalizeFilter expects BlockFilter/FilterConfig (no `id` field)
              normalizeFilter({
                field: f.field_name,
                operator: f.operator,
                value: f.value,
              } as any)
            )
            nextViewDefaults[s.id] = vf
          } else {
            nextViewDefaults[s.id] = []
          }
        } catch (err: any) {
          if (isAbortError(err)) {
            // Component unmounted, exit early but clear loading state
            setLoading(false)
            loadingRef.current = false
            return
          }
          console.error(`MultiCalendar: Exception loading source ${s.id}:`, err)
          nextErrors[s.id] = err.message || "Unexpected error"
        }
      }

      // Now load rows per source (serialized).
      for (const s of sources) {
        try {
          if (!s?.table_id) continue
          const table = nextTables[s.id]
          const tableFields = nextFields[s.id] || []
          if (!table?.supabaseTable) continue

          const viewDefaults = nextViewDefaults[s.id] || []
          const userQuick = quickFiltersBySource[s.id] || []

          const compatibleFilterBlocks = (filters || []).filter((f) => isFilterCompatible(f, tableFields))
          const compatibleQuick = userQuick.filter((f) => isFilterCompatible(f, tableFields))

          // Rule: quick filters apply on top; they must not overwrite view defaults.
          const effectiveFilters = [...viewDefaults, ...compatibleFilterBlocks, ...compatibleQuick]

          let query = supabase.from(table.supabaseTable).select("*")
          const normalizedFields = tableFields.map((f) => ({ name: f.name || f.id, type: f.type }))
          query = applyFiltersToQuery(query, effectiveFilters, normalizedFields)
          query = query.order("created_at", { ascending: false })

          const rowsRes = await query

          if (rowsRes.error) {
            if (isAbortError(rowsRes.error)) {
              // Component unmounted, exit early but clear loading state
              setLoading(false)
              loadingRef.current = false
              return
            }
            const errorMsg = rowsRes.error.message || "Failed to load rows"
            nextErrors[s.id] = errorMsg
            handleError(rowsRes.error, "Calendar Error", `Failed to load rows for source "${s.label || s.id}": ${errorMsg}`)
            continue
          }

          const data = asArray<any>(rowsRes.data || [])
          nextRows[s.id] = data.map((row) => ({
            id: row.id,
            table_id: table.tableId,
            data: row,
            created_at: row.created_at || new Date().toISOString(),
            updated_at: row.updated_at || new Date().toISOString(),
          })) as TableRow[]
        } catch (err: any) {
          if (isAbortError(err)) {
            // Component unmounted, exit early but clear loading state
            setLoading(false)
            loadingRef.current = false
            return
          }
          const errorMsg = err.message || "Unexpected error loading rows"
          nextErrors[s.id] = errorMsg
          handleError(err, "Calendar Error", `Unexpected error loading source "${s.label || s.id}": ${errorMsg}`)
        }
      }

      setTablesBySource(nextTables)
      setFieldsBySource(nextFields)
      setViewDefaultFiltersBySource(nextViewDefaults)
      setRowsBySource(nextRows)
      setErrorsBySource(nextErrors)
      if (process.env.NODE_ENV === 'development') {
        console.log('[MultiCalendar] loadAll: Completed successfully', {
          tablesCount: Object.keys(nextTables).length,
          rowsCount: Object.values(nextRows).reduce((sum, rows) => sum + rows.length, 0),
          errorsCount: Object.keys(nextErrors).length
        })
      }
    } catch (err: any) {
      if (isAbortError(err)) {
        // Component unmounted, exit early but clear loading state
        setLoading(false)
        loadingRef.current = false
        return
      }
      const errorMsg = err.message || "Failed to load calendar data"
      setErrorsBySource({ __global__: errorMsg })
      handleError(err, "Calendar Error", `Failed to load calendar: ${errorMsg}`)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [filtersKey, quickFiltersBySource, sourcesKey, supabase, handleError, sources])

  // Reload whenever sources change (and on first mount). Quick filters are applied via dedicated reload button (keeps it predictable).
  useEffect(() => {
    // Only load if we have valid sources
    if (!sources || sources.length === 0) {
      // No sources configured - clear loading state immediately
      if (process.env.NODE_ENV === 'development') {
        console.log('[MultiCalendar] useEffect: No sources, clearing loading state')
      }
      setLoading(false)
      loadingRef.current = false
      setTablesBySource({})
      setFieldsBySource({})
      setRowsBySource({})
      setErrorsBySource({})
      return
    }
    if (process.env.NODE_ENV === 'development') {
      console.log('[MultiCalendar] useEffect: Triggering loadAll', { sourcesKey, filtersKey, sourcesCount: sources.length })
    }
    // Call loadAll - it's stable based on sourcesKey and filtersKey
    loadAll().catch((err) => {
      // Handle any unhandled promise rejections
      if (!isAbortError(err)) {
        console.error('[MultiCalendar] loadAll promise rejection:', err)
        setLoading(false)
        loadingRef.current = false
        setErrorsBySource({ __global__: err.message || 'Failed to load calendar' })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourcesKey, filtersKey]) // Only depend on stable keys, not the callback or sources array

  const events = useMemo<EventInput[]>(() => {
    // CRITICAL: Don't compute events during SSR - return empty array until mounted
    // This prevents hydration mismatches from date parsing or FullCalendar event generation
    if (!mounted) {
      return []
    }
    
    const enabledSet = new Set(enabledSourceIds)

    const out: EventInput[] = []
    sources.forEach((s, idx) => {
      if (!enabledSet.has(s.id)) return
      if (!s.table_id || !s.title_field || !s.start_date_field) return

      const table = tablesBySource[s.id]
      const tableFields = fieldsBySource[s.id] || []
      const rows = rowsBySource[s.id] || []
      if (!table) return

      const sourceLabel = (s.label || "").trim() || table.name
      const sourceColor = pickSourceColor(idx)

      // IMPORTANT: Supabase row keys are field NAMES (columns), but config can store IDs.
      const startFieldName = resolveFieldNameFromFields(tableFields, s.start_date_field)
      const endFieldName = resolveFieldNameFromFields(tableFields, s.end_date_field || null)
      const titleFieldName = resolveFieldNameFromFields(tableFields, s.title_field)

      const isStartEditable =
        !!startFieldName && tableFields.some((f) => f && f.name === startFieldName && f.type === "date")

      rows.forEach((r) => {
        const row = r.data || {}
        const startRaw = startFieldName ? row[startFieldName] : null
        const endRaw = endFieldName ? row[endFieldName] : null
        if (!startRaw) return

        const start = parseDateValueToLocalDate(startRaw)
        if (!start) return

        const end = endRaw ? parseDateValueToLocalDate(endRaw) : start
        const finalEnd = end || start

        const title = titleFieldName && row[titleFieldName] ? String(row[titleFieldName]) : "Untitled"
        if (searchQuery && !title.toLowerCase().includes(searchQuery.toLowerCase())) return

        // Date range filter (UI-level)
        if (dateFrom && start < dateFrom) return
        if (dateTo && start > dateTo) return

        let eventColor = sourceColor
        if (s.color_field) {
          const resolvedColorFieldName = resolveFieldNameFromFields(tableFields, s.color_field)
          const colorFieldObj = tableFields.find(
            (f): f is TableField & { type: "single_select" | "multi_select" } =>
              Boolean(resolvedColorFieldName) &&
              (f.name === resolvedColorFieldName || f.id === resolvedColorFieldName) &&
              isSelectField(f)
          )
          if (colorFieldObj) {
            const rawValue = row[colorFieldObj.name]
            if (rawValue) {
              eventColor = normalizeHexColor(
                resolveChoiceColor(
                  String(rawValue).trim(),
                  colorFieldObj.type,
                  colorFieldObj.options,
                  colorFieldObj.type === "single_select"
                )
              )
            }
          }
        }

        const eventId = `${s.id}:${r.id}`

        out.push({
          id: eventId,
          title,
          start,
          end: finalEnd || undefined,
          // Unified "card" styling: neutral background + subtle neutral border.
          // This is a merged multi-table view, so cards should look the same regardless of source.
          backgroundColor: "#ffffff",
          borderColor: "#e5e7eb",
          textColor: "#111827",
          editable: isStartEditable && !isViewOnly && !isEditing,
          startEditable: isStartEditable && !isViewOnly && !isEditing,
          extendedProps: {
            sourceId: s.id,
            sourceLabel,
            tableId: table.tableId,
            supabaseTableName: table.supabaseTable,
            rowId: r.id,
            mapping: s,
            rowData: row,
            sourceColor,
          },
        })
      })
    })

    return out
  }, [
    mounted, // CRITICAL: Only compute events after mount
    sources,
    enabledSourceIds,
    tablesBySource,
    fieldsBySource,
    rowsBySource,
    searchQuery,
    dateFrom,
    dateTo,
    isViewOnly,
    isEditing,
  ])

  const handleEventDrop = useCallback(async (info: EventDropArg) => {
    const ext = info.event.extendedProps as any
    const mapping = ext?.mapping as MultiSource | undefined
    const tableId = ext?.tableId as string | undefined
    const supabaseTableName = ext?.supabaseTableName as string | undefined
    const rowId = ext?.rowId as string | undefined
    const newStart = info.event?.start

    if (!mapping || !tableId || !supabaseTableName || !rowId || !newStart) {
      info.revert()
      return
    }

    const tableFields = fieldsBySource[mapping.id] || []
    const startFieldName = resolveFieldNameFromFields(tableFields, mapping.start_date_field)
    const endFieldName = resolveFieldNameFromFields(tableFields, mapping.end_date_field || null)
    const hasStart = !!startFieldName && tableFields.some((f) => f && f.name === startFieldName && f.type === "date")
    if (!hasStart) {
      info.revert()
      return
    }

    // Shift end date by the same delta, if an end field exists.
    const currentRow = (rowsBySource[mapping.id] || []).find((r) => r.id === rowId)
    const currentRowData = currentRow?.data || ext?.rowData || {}
    const oldFromRaw = startFieldName ? currentRowData?.[startFieldName] : null
    const oldFromDate = oldFromRaw && !isNaN(new Date(oldFromRaw).getTime()) ? new Date(oldFromRaw) : info.oldEvent?.start || null

    const updates: Record<string, any> = startFieldName ? { [startFieldName]: safeDateOnly(newStart) } : {}

    if (endFieldName && currentRowData?.[endFieldName] && oldFromDate && !isNaN(oldFromDate.getTime())) {
      const oldToRaw = currentRowData[endFieldName]
      const oldToDate = new Date(oldToRaw)
      if (!isNaN(oldToDate.getTime())) {
        const deltaMs = newStart.getTime() - oldFromDate.getTime()
        const newToDate = new Date(oldToDate.getTime() + deltaMs)
        updates[endFieldName] = safeDateOnly(newToDate)
      }
    }

    // Optimistic update
    setRowsBySource((prev) => ({
      ...prev,
      [mapping.id]: (prev[mapping.id] || []).map((r) =>
        r.id === rowId
          ? { ...r, data: { ...(r.data || {}), ...updates } }
          : r
      ),
    }))

    try {
      const { error } = await supabase.from(supabaseTableName).update(updates).eq("id", rowId)
      if (error) throw error
    } catch (e) {
      info.revert()
      await loadAll()
    }
  }, [fieldsBySource, rowsBySource, supabase, loadAll])

  // FullCalendar: keep option prop references stable to avoid internal update loops.
  const calendarPlugins = useMemo(() => [dayGridPlugin, interactionPlugin], [])

  const onCalendarEventClick = useCallback(
    (info: any) => {
      const ext = info.event.extendedProps as any
      const recordId = String(ext?.rowId || "")
      const tableId = String(ext?.tableId || "")
      const tableName = String(ext?.supabaseTableName || "")
      if (!recordId || !tableId || !tableName) return
      if (onRecordClick) {
        onRecordClick(recordId, tableId)
        return
      }
      openRecord(tableId, recordId, tableName, (blockConfig as any)?.modal_fields, (blockConfig as any)?.modal_layout, blockConfig ? { blockConfig } : undefined, interfaceMode)
    },
    [blockConfig, onRecordClick, openRecord, interfaceMode]
  )

  const onCalendarDateClick = useCallback(
    (arg: any) => {
      if (!canCreateRecord) return
      // Force explicit table selection (no implicit default).
      setCreateSourceId("")
      setCreateDate(arg.date || new Date())
      setCreateOpen(true)
    },
    [canCreateRecord]
  )

  async function handleCreate() {
    const sid = createSourceId
    const mapping = sources.find((s) => s.id === sid)
    if (!mapping?.table_id) return
    const table = tablesBySource[sid]
    const tableFields = fieldsBySource[sid] || []
    if (!table?.supabaseTable) return

    const startFieldName = resolveFieldNameFromFields(tableFields, mapping.start_date_field)
    const endFieldName = resolveFieldNameFromFields(tableFields, mapping.end_date_field || null)

    const viewDefaults = viewDefaultFiltersBySource[sid] || []
    const userQuick = quickFiltersBySource[sid] || []
    const compatibleFilterBlocks = (filters || []).filter((f) => isFilterCompatible(f, tableFields))
    const compatibleQuick = userQuick.filter((f) => isFilterCompatible(f, tableFields))
    const effectiveFilters = [...viewDefaults, ...compatibleFilterBlocks, ...compatibleQuick]

    const defaultsFromFilters = deriveDefaultValuesFromFilters(effectiveFilters, tableFields)

    const newData: Record<string, any> = {
      ...defaultsFromFilters,
    }
    // Ensure date fields are set so record appears in view
    const dateToUse = createDate || new Date()
    if (startFieldName) newData[startFieldName] = safeDateOnly(dateToUse)
    if (endFieldName) newData[endFieldName] = newData[endFieldName] || safeDateOnly(dateToUse)

    setCreateOpen(false)
    openRecordModal({
      tableId: mapping.table_id,
      recordId: null,
      tableFields,
      modalFields: Array.isArray((blockConfig as any)?.modal_fields) ? (blockConfig as any).modal_fields : undefined,
      initialData: newData,
      supabaseTableName: table.supabaseTable,
      cascadeContext: blockConfig ? { blockConfig } : undefined,
      interfaceMode: interfaceMode ?? "view",
      onSave: () => loadAll(),
      onDeleted: () => loadAll(),
    })
  }

  const legendItems = useMemo(() => {
    return sources
      .filter((s) => s.table_id)
      .map((s, idx) => {
        const table = tablesBySource[s.id]
        const label = (s.label || "").trim() || table?.name || "Untitled"
        return { sourceId: s.id, label, color: pickSourceColor(idx) }
      })
  }, [sources, tablesBySource])

  // CRITICAL: Don't render content during SSR - wait for mount to prevent hydration mismatches
  // This prevents issues with legendItems, errorMessages, and other mapped content that depends on client-side data
  if (!mounted || loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading calendar data..." />
      </div>
    )
  }

  // Show errors if any sources failed to load
  const hasErrors = Object.keys(errorsBySource).length > 0
  const errorMessages = Object.entries(errorsBySource).map(([sourceId, error]) => {
    const source = sources.find((s) => s.id === sourceId)
    const table = tablesBySource[sourceId]
    const label = source?.label || table?.name || sourceId
    return { label, error }
  })

  return (
    <div className="h-full w-full flex flex-col">
      {/* Error messages */}
      {hasErrors && !isEditing && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
          <div className="text-sm font-medium text-red-800">Some sources failed to load:</div>
          {errorMessages.map(({ label, error }, idx) => (
            <div key={idx} className="text-xs text-red-700">
              <span className="font-medium">{label}:</span> {error}
            </div>
          ))}
        </div>
      )}

      {/* Unified header: toggles + quick filters + add */}
      {!isEditing && (
        <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                {legendItems.map((item) => {
                  const checked = enabledSourceIds.includes(item.sourceId)
                  return (
                    <label key={item.sourceId} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          const on = Boolean(v)
                          setEnabledSourceIds((prev) => {
                            const set = new Set(prev)
                            if (on) set.add(item.sourceId)
                            else set.delete(item.sourceId)
                            return Array.from(set)
                          })
                        }}
                      />
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-gray-700">{item.label}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search titles…"
                className="h-8 w-48 bg-white"
              />
              {canCreateRecord && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="bg-white"
                  onClick={() => {
                    // Force the user to choose a source/table when multiple tables are present.
                    // (Do not preselect the first enabled source.)
                    setCreateSourceId("")
                    // Only set date if mounted (prevents hydration issues)
                    if (mounted) {
                      setCreateDate(new Date())
                    }
                    setCreateOpen(true)
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              )}
            </div>
          </div>

          {/* Quick filters per source (session-only) */}
          {effectiveEnabledSources.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="min-w-[220px]">
                <Label className="text-xs text-gray-600">Quick filters for</Label>
                <Select
                  value={quickFilterSourceId || "__none__"}
                  onValueChange={(v) => setQuickFilterSourceId(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger className="h-8 bg-white">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {effectiveEnabledSources.map((s) => {
                      const table = tablesBySource[s.id]
                      const label = (s.label || "").trim() || table?.name || "Untitled"
                      return (
                        <SelectItem key={s.id} value={s.id}>
                          {label}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              {quickFilterSourceId && (
                <QuickFilterBar
                  storageKey={`mh:multiQuickFilters:${pageId || "page"}:${blockId}:${quickFilterSourceId}`}
                  tableFields={fieldsBySource[quickFilterSourceId] || []}
                  viewDefaultFilters={viewDefaultFiltersBySource[quickFilterSourceId] || []}
                  onChange={(next) =>
                    setQuickFiltersBySource((prev) => ({ ...prev, [quickFilterSourceId]: next }))
                  }
                />
              )}

              <Button
                type="button"
                size="sm"
                variant="outline"
                className="bg-white"
                onClick={() => loadAll()}
                disabled={loadingRef.current}
                title="Apply quick filters"
              >
                Apply
              </Button>
            </div>
          )}

          <CalendarDateRangeControls
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            disabled={false}
            defaultPreset={(blockConfig as any)?.default_date_range_preset && (blockConfig as any).default_date_range_preset !== 'none'
              ? ((blockConfig as any).default_date_range_preset as 'today' | 'thisWeek' | 'thisMonth' | 'nextWeek' | 'nextMonth' | 'custom')
              : null}
          />
        </div>
      )}

      <div className="flex-1 min-h-0">
        {/* CRITICAL: FullCalendar only renders after mount (guarded by outer mounted check) */}
        {/* FullCalendar generates dynamic DOM IDs that differ between server and client */}
        <FullCalendar
          plugins={calendarPlugins}
          initialView="dayGridMonth"
          height="100%"
          events={events}
          editable={!isViewOnly && !isEditing}
          eventDrop={handleEventDrop}
          eventClick={onCalendarEventClick}
          dateClick={onCalendarDateClick}
          // Enforce unified styling even if FullCalendar/theme CSS overrides event colors.
          eventDidMount={(arg: any) => {
            const el = arg?.el as HTMLElement | undefined
            if (!el) return
            el.style.setProperty("background-color", "#ffffff", "important")
            el.style.setProperty("border-color", "#e5e7eb", "important")
            el.style.setProperty("color", "#111827", "important")
            el.style.setProperty("border-width", "1px", "important")
            el.style.setProperty("border-style", "solid", "important")
            el.style.setProperty("box-shadow", "0 1px 2px rgba(0,0,0,0.05)", "important")
            el.style.setProperty("border-radius", "6px", "important")

            // FullCalendar often renders the title inside an <a>; force link text color too.
            try {
              el.querySelectorAll("a").forEach((a) => {
                ;(a as HTMLElement).style.setProperty("color", "#111827", "important")
              })
            } catch {
              // ignore
            }
          }}
        />
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add record</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Table</Label>
              <Select value={createSourceId || "__none__"} onValueChange={(v) => setCreateSourceId(v === "__none__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select table" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select…</SelectItem>
                  {sources
                    .filter((s) => s.table_id && s.enabled !== false)
                    .map((s) => {
                      const table = tablesBySource[s.id]
                      const label = (s.label || "").trim() || table?.name || "Untitled"
                      return (
                        <SelectItem key={s.id} value={s.id}>
                          {label}
                        </SelectItem>
                      )
                    })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <Input value={createDate ? safeDateOnly(createDate) : ""} readOnly />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!createSourceId || !createDate}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}

