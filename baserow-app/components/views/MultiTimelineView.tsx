"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { addDays, addMonths, endOfMonth, format, startOfMonth, subMonths } from "date-fns"
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
import { Plus, ChevronLeft, ChevronRight } from "lucide-react"
import QuickFilterBar from "@/components/filters/QuickFilterBar"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import type { TableRow } from "@/types/database"
import type { TableField } from "@/types/fields"
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

type TimelineEvent = {
  id: string
  rowId: string
  tableId: string
  supabaseTableName: string
  sourceId: string
  sourceLabel: string
  title: string
  typeLabel?: string
  start: Date
  end: Date
  color: string
  mapping: MultiSource
  rowData: Record<string, any>
}

interface MultiTimelineViewProps {
  blockId: string
  pageId?: string | null
  sources: MultiSource[]
  filters?: FilterConfig[]
  filterTree?: FilterTree | null
  blockConfig?: Record<string, any>
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

export default function MultiTimelineView({
  blockId,
  pageId = null,
  sources,
  filters = [],
  blockConfig = {},
  isEditing = false,
  onRecordClick,
  pageShowAddRecord = false,
  interfaceMode = 'view',
}: MultiTimelineViewProps) {
  const supabase = useMemo(() => createClient(), [])
  const { openRecord } = useRecordPanel()
  const { handleError } = useOperationFeedback({
    errorTitle: "Timeline Error",
    showSuccess: false,
  })

  const appearance = (blockConfig as any)?.appearance || {}
  const permissions = (blockConfig as any)?.permissions || {}
  const isViewOnly = permissions.mode === "view"
  const allowInlineCreate = permissions.allowInlineCreate ?? true
  const blockShowAddRecord = appearance.show_add_record
  const showAddRecord = blockShowAddRecord === true || (blockShowAddRecord == null && pageShowAddRecord)
  const canCreateRecord = showAddRecord && !isViewOnly && allowInlineCreate && !isEditing

  const enabledSourceIdsDefault = useMemo(() => {
    return sources.filter((s) => s.enabled !== false).map((s) => s.id)
  }, [sources])
  const [enabledSourceIds, setEnabledSourceIds] = useState<string[]>(enabledSourceIdsDefault)
  useEffect(() => setEnabledSourceIds(enabledSourceIdsDefault), [enabledSourceIdsDefault])

  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [quickFiltersBySource, setQuickFiltersBySource] = useState<Record<string, FilterConfig[]>>({})
  const [quickFilterSourceId, setQuickFilterSourceId] = useState<string>(() => enabledSourceIdsDefault[0] || sources[0]?.id || "")

  // Creation flow
  const [createOpen, setCreateOpen] = useState(false)
  const [createSourceId, setCreateSourceId] = useState<string>("")
  const [createDate, setCreateDate] = useState<Date>(new Date())

  const [tablesBySource, setTablesBySource] = useState<Record<string, { tableId: string; supabaseTable: string; name: string }>>({})
  const [fieldsBySource, setFieldsBySource] = useState<Record<string, TableField[]>>({})
  const [viewDefaultFiltersBySource, setViewDefaultFiltersBySource] = useState<Record<string, FilterConfig[]>>({})
  const [rowsBySource, setRowsBySource] = useState<Record<string, TableRow[]>>({})
  const [errorsBySource, setErrorsBySource] = useState<Record<string, string>>({})

  const loadingRef = useRef(false)

  function isFilterCompatible(filter: FilterConfig, tableFields: TableField[]) {
    const fieldName = (filter as any)?.field_name || (filter as any)?.field
    if (!fieldName) return false
    return tableFields.some((f) => f.name === fieldName || f.id === fieldName)
  }

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

  async function loadAll() {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
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
              return // Component unmounted, exit early
            }
            const errorMsg = tableRes.error.message || "Failed to load table"
            nextErrors[s.id] = errorMsg
            handleError(tableRes.error, "Timeline Error", `Failed to load table for source "${s.label || s.id}": ${errorMsg}`)
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
              return
            }
            console.error(`MultiTimeline: Error loading fields for source ${s.id}:`, fieldsRes.error)
            nextErrors[s.id] = fieldsRes.error.message || "Failed to load fields"
            continue
          }

          nextFields[s.id] = asArray<TableField>(fieldsRes.data || [])

          const viewId = normalizeUuid((s as any)?.view_id)
          if (viewId) {
            const viewFiltersRes = await supabase
              .from("view_filters")
              .select("*")
              .eq("view_id", viewId)

            if (viewFiltersRes.error) {
              if (isAbortError(viewFiltersRes.error)) {
                return
              }
              // Non-critical error - log but continue
              console.warn(`MultiTimeline: Error loading view filters for source ${s.id}:`, viewFiltersRes.error)
            }

            nextViewDefaults[s.id] = asArray<any>(viewFiltersRes.data || []).map((f: any) =>
              // normalizeFilter expects BlockFilter/FilterConfig (no `id` field)
              normalizeFilter({
                field: f.field_name,
                operator: f.operator,
                value: f.value,
              } as any)
            )
          } else {
            nextViewDefaults[s.id] = []
          }
        } catch (err: any) {
          if (isAbortError(err)) {
            return
          }
          console.error(`MultiTimeline: Exception loading source ${s.id}:`, err)
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
          // Rule: quick filters apply on top; must not overwrite view defaults.
          const effectiveFilters = [...viewDefaults, ...compatibleFilterBlocks, ...compatibleQuick]

          let query = supabase.from(table.supabaseTable).select("*")
          const normalizedFields = tableFields.map((f) => ({ name: f.name || f.id, type: f.type }))
          query = applyFiltersToQuery(query, effectiveFilters, normalizedFields)
          query = query.order("created_at", { ascending: false })

          const rowsRes = await query

          if (rowsRes.error) {
            if (isAbortError(rowsRes.error)) {
              return
            }
            const errorMsg = rowsRes.error.message || "Failed to load rows"
            nextErrors[s.id] = errorMsg
            handleError(rowsRes.error, "Timeline Error", `Failed to load rows for source "${s.label || s.id}": ${errorMsg}`)
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
            return
          }
          console.error(`MultiTimeline: Exception loading rows for source ${s.id}:`, err)
          nextErrors[s.id] = err.message || "Unexpected error loading rows"
        }
      }

      setTablesBySource(nextTables)
      setFieldsBySource(nextFields)
      setViewDefaultFiltersBySource(nextViewDefaults)
      setRowsBySource(nextRows)
      setErrorsBySource(nextErrors)
    } catch (err: any) {
      if (isAbortError(err)) {
        return
      }
      const errorMsg = err.message || "Failed to load timeline data"
      setErrorsBySource({ __global__: errorMsg })
      handleError(err, "Timeline Error", `Failed to load timeline: ${errorMsg}`)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }

  useEffect(() => {
    loadAll().catch((err) => {
      if (!isAbortError(err)) {
        setLoading(false)
        loadingRef.current = false
        setErrorsBySource({ __global__: (err as Error)?.message || "Failed to load timeline" })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourcesKey, filtersKey, quickFiltersBySource])

  const range = useMemo(() => {
    const start = startOfMonth(currentDate)
    const end = endOfMonth(currentDate)
    return { start, end }
  }, [currentDate])

  const events = useMemo<TimelineEvent[]>(() => {
    const enabledSet = new Set(enabledSourceIds)
    const out: TimelineEvent[] = []

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
      const typeFieldName = resolveFieldNameFromFields(tableFields, s.type_field || null)
      const colorFieldName = resolveFieldNameFromFields(tableFields, s.color_field || null)

      rows.forEach((r) => {
        const row = r.data || {}
        const startRaw = startFieldName ? row[startFieldName] : null
        if (!startRaw) return
        const start = parseDateValueToLocalDate(startRaw)
        if (!start) return

        const endRaw = endFieldName ? (row[endFieldName] || null) : null
        const end = endRaw ? parseDateValueToLocalDate(endRaw) : start
        const finalEnd = end || start

        const title = titleFieldName && row[titleFieldName] ? String(row[titleFieldName]) : "Untitled"
        if (searchQuery && !title.toLowerCase().includes(searchQuery.toLowerCase())) return

        const typeLabel = typeFieldName && row[typeFieldName] ? String(row[typeFieldName]) : undefined

        let eventColor = sourceColor
        if (colorFieldName) {
          const colorFieldObj = tableFields.find(
            (f): f is TableField & { type: "single_select" | "multi_select" } =>
              Boolean(colorFieldName) &&
              (f.name === colorFieldName || f.id === colorFieldName) &&
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

        out.push({
          id: `${s.id}:${r.id}`,
          rowId: String(r.id),
          tableId: table.tableId,
          supabaseTableName: table.supabaseTable,
          sourceId: s.id,
          sourceLabel,
          title,
          typeLabel,
          start,
          end: finalEnd,
          color: eventColor,
          mapping: s,
          rowData: row,
        })
      })
    })

    return out
  }, [sources, enabledSourceIds, tablesBySource, fieldsBySource, rowsBySource, searchQuery])

  const eventsByLane = useMemo(() => {
    const lanes: Record<string, TimelineEvent[]> = {}
    events.forEach((e) => {
      const key = e.sourceLabel
      if (!lanes[key]) lanes[key] = []
      lanes[key].push(e)
    })
    Object.values(lanes).forEach((arr) => arr.sort((a, b) => a.start.getTime() - b.start.getTime()))
    return lanes
  }, [events])

  // Dragging (reschedule) – per-event only, persists to correct source table/field.
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<{
    eventId: string
    startX: number
    originalStart: Date
    originalEnd: Date
  } | null>(null)
  const [optimistic, setOptimistic] = useState<Record<string, { start?: Date; end?: Date }>>({})
  const [justDraggedEventId, setJustDraggedEventId] = useState<string | null>(null)
  const justDraggedAtRef = useRef<number>(0)

  const pxPerMs = useMemo(() => {
    const el = containerRef.current
    const width = el?.clientWidth || 1
    const durationMs = range.end.getTime() - range.start.getTime()
    return width / Math.max(1, durationMs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start.getTime(), range.end.getTime(), containerRef.current?.clientWidth])

  useEffect(() => {
    function onMove(ev: MouseEvent) {
      if (!dragging) return
      const deltaPx = ev.clientX - dragging.startX
      const deltaMs = deltaPx / pxPerMs
      const newStart = new Date(dragging.originalStart.getTime() + deltaMs)
      const newEnd = new Date(dragging.originalEnd.getTime() + deltaMs)
      setOptimistic((prev) => ({
        ...prev,
        [dragging.eventId]: { start: newStart, end: newEnd },
      }))
    }

    async function onUp() {
      if (!dragging) return
      const update = optimistic[dragging.eventId]
      const event = events.find((e) => e.id === dragging.eventId)
      setDragging(null)
      setJustDraggedEventId(dragging.eventId)
      justDraggedAtRef.current = Date.now()
      if (!event || !update?.start) return
      if (!event.mapping?.start_date_field) return

      // Resolve field names from field IDs/config
      const tableFields = fieldsBySource[event.sourceId] || []
      const startFieldName = resolveFieldNameFromFields(tableFields, event.mapping.start_date_field)
      const endFieldName = resolveFieldNameFromFields(tableFields, event.mapping.end_date_field || null)

      if (!startFieldName) {
        console.error("MultiTimeline: Cannot resolve start date field name", event.mapping.start_date_field)
        return
      }

      const updates: Record<string, any> = {
        [startFieldName]: safeDateOnly(update.start),
      }
      if (endFieldName && update.end) {
        updates[endFieldName] = safeDateOnly(update.end)
      }

      try {
        const { error } = await supabase.from(event.supabaseTableName).update(updates).eq("id", event.rowId)
        if (error) {
          if (isAbortError(error)) return
          throw error
        }
        await loadAll()
      } catch (e) {
        if (isAbortError(e)) return
        console.error("MultiTimeline: Failed to persist drag", e)
        await loadAll()
      } finally {
        setOptimistic((prev) => {
          const next = { ...prev }
          delete next[event.id]
          return next
        })
      }
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [dragging, optimistic, pxPerMs, events, supabase, fieldsBySource, loadAll])

  async function handleCreate() {
    const sid = createSourceId
    const mapping = sources.find((s) => s.id === sid)
    if (!mapping?.table_id) return
    const table = tablesBySource[sid]
    const tableFields = fieldsBySource[sid] || []
    if (!table?.supabaseTable) return

    const viewDefaults = viewDefaultFiltersBySource[sid] || []
    const compatibleFilterBlocks = (filters || []).filter((f) => isFilterCompatible(f, tableFields))
    const userQuick = quickFiltersBySource[sid] || []
    const compatibleQuick = userQuick.filter((f) => isFilterCompatible(f, tableFields))
    const effectiveFilters = [...viewDefaults, ...compatibleFilterBlocks, ...compatibleQuick]

    const defaultsFromFilters = deriveDefaultValuesFromFilters(effectiveFilters, tableFields)
    const newData: Record<string, any> = { ...defaultsFromFilters }
    
    // Resolve field names from field IDs/config
    const startFieldName = resolveFieldNameFromFields(tableFields, mapping.start_date_field)
    const endFieldName = resolveFieldNameFromFields(tableFields, mapping.end_date_field || null)
    
    if (startFieldName) newData[startFieldName] = safeDateOnly(createDate)
    if (endFieldName) newData[endFieldName] = newData[endFieldName] || safeDateOnly(createDate)

    try {
      const { error } = await supabase.from(table.supabaseTable).insert([newData])
      if (error) {
        if (isAbortError(error)) return
        throw error
      }
      setCreateOpen(false)
      await loadAll()
    } catch (e) {
      if (isAbortError(e)) return
      console.error("MultiTimeline: Failed to create record", e)
      alert("Failed to create record. Please try again.")
    }
  }

  const laneNames = useMemo(() => Object.keys(eventsByLane), [eventsByLane])

  const legendItems = useMemo(() => {
    return sources
      .filter((s) => s.table_id)
      .map((s, idx) => {
        const table = tablesBySource[s.id]
        const label = (s.label || "").trim() || table?.name || "Untitled"
        return { sourceId: s.id, label, color: pickSourceColor(idx) }
      })
  }, [sources, tablesBySource])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading timeline data..." />
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

  const rangeMs = range.end.getTime() - range.start.getTime()

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

      {!isEditing && (
        <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
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

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="bg-white" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium text-gray-800">{format(currentDate, "MMMM yyyy")}</div>
              <Button variant="outline" size="sm" className="bg-white" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
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
                    setCreateDate(new Date())
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
                  {sources
                    .filter((s) => s.table_id && enabledSourceIds.includes(s.id))
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
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto border border-gray-200 rounded-md bg-white" ref={containerRef}>
        {/* Axis header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-3 py-2 text-sm text-gray-700">
          {format(range.start, "dd MMM")} – {format(range.end, "dd MMM")}
        </div>

        <div className="divide-y">
          {laneNames.length === 0 && (
            <div className="p-6 text-sm text-gray-500">No events in this range.</div>
          )}

          {laneNames.map((lane) => {
            const laneEvents = eventsByLane[lane] || []
            return (
              <div key={lane} className="flex">
                <div className="w-56 flex-shrink-0 border-r border-gray-200 p-3 text-sm font-medium text-gray-800">
                  {lane}
                </div>
                <div className="relative flex-1 min-w-[600px] h-16">
                  {laneEvents.map((ev) => {
                    const o = optimistic[ev.id] || {}
                    const start = o.start || ev.start
                    const end = o.end || ev.end
                    const leftPct = ((start.getTime() - range.start.getTime()) / rangeMs) * 100
                    const widthPct = Math.max(0.5, ((end.getTime() - start.getTime()) / rangeMs) * 100)
                    const inRange = end >= range.start && start <= range.end
                    if (!inRange) return null

                    const tableFields = fieldsBySource[ev.sourceId] || []
                    const hasStartDate = tableFields.some(
                      (f) =>
                        (f.name === ev.mapping.start_date_field || f.id === ev.mapping.start_date_field) &&
                        f.type === "date"
                    )
                    const canDrag = hasStartDate && !isViewOnly && !isEditing
                    const label = ev.typeLabel ? `${ev.title} · ${ev.typeLabel}` : ev.title

                    return (
                      <div
                        key={ev.id}
                        className="absolute top-3 h-10 rounded-md px-2 flex items-center text-xs shadow cursor-pointer select-none border bg-white text-gray-900 hover:bg-gray-50 transition-colors"
                        style={{
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                          borderColor: "#e5e7eb",
                          // Merged multi-table view: keep the card styling identical across sources.
                          // (Legend/toggles still show per-source colour.)
                          borderLeftColor: "#e5e7eb",
                          borderLeftWidth: 1,
                        }}
                        onClick={() => {
                          // Avoid opening the record when the user just dragged.
                          if (justDraggedEventId === ev.id && Date.now() - justDraggedAtRef.current < 250) return
                          if (onRecordClick) {
                            onRecordClick(ev.rowId, ev.tableId)
                            return
                          }
                          openRecord(ev.tableId, ev.rowId, ev.supabaseTableName, (blockConfig as any)?.modal_fields, (blockConfig as any)?.modal_layout, blockConfig ? { blockConfig } : undefined, interfaceMode)
                        }}
                        onMouseDown={(e) => {
                          if (!canDrag) return
                          setDragging({
                            eventId: ev.id,
                            startX: e.clientX,
                            originalStart: ev.start,
                            originalEnd: ev.end,
                          })
                        }}
                        title={label}
                      >
                        <span className="truncate">{label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
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
              <Input value={safeDateOnly(createDate)} readOnly />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!createSourceId}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

