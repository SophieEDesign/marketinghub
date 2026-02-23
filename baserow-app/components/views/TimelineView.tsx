"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { format } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import TimelineEventCard from "./TimelineEventCard"
import { Plus, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react"
import { filterRowsBySearch } from "@/lib/search/filterRows"
import { applyFiltersToQuery, deriveDefaultValuesFromFilters, type FilterConfig } from "@/lib/interface/filters"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import type { TableRow } from "@/types/database"
import type { LinkedField, TableField } from "@/types/fields"
import { isAbortError } from "@/lib/api/error-handling"
import {
  resolveChoiceColor,
  normalizeHexColor,
  getTextColorForBackground,
  SEMANTIC_COLORS,
} from "@/lib/field-colors"
import { getLinkedFieldValueFromRow, linkedValueToIds, resolveLinkedFieldDisplayMap } from "@/lib/dataView/linkedFields"
import { normalizeUuid } from "@/lib/utils/ids"
import { sanitizeFieldName } from "@/lib/fields/validation"
import { resolveSystemFieldAlias } from "@/lib/fields/systemFieldAliases"
import { normalizeSelectOptionsForUi } from "@/lib/fields/select-options"
import { getPrimaryField } from "@/lib/fields/primary"
import { getFieldDisplayName } from "@/lib/fields/display"
import type { HighlightRule } from "@/lib/interface/types"
import { evaluateHighlightRules, getFormattingStyle } from "@/lib/conditional-formatting/evaluator"

interface TimelineViewProps {
  tableId: string
  viewId: string
  startDateFieldId?: string
  endDateFieldId?: string
  dateFieldId?: string // Single date field (if no start/end)
  fieldIds: string[]
  searchQuery?: string
  tableFields?: TableField[]
  filters?: FilterConfig[] // Dynamic filters from config
  blockConfig?: Record<string, any> // Block/page config for reading date_from/date_to from page settings
  colorField?: string // Field name to use for event colors (single-select field)
  onRecordClick?: (recordId: string) => void
  // Card field configuration (compact contract)
  titleField?: string // Field to use as card title
  tagField?: string // Optional single tag field (max 1 pill)
  // Grouping
  groupByField?: string // Field to group by (select field)
  // Appearance settings
  rowSize?: 'compact' | 'medium' | 'comfortable' // Row size setting
  compactMode?: boolean // When true: 28px cards; when false: 40px
  /** Bump to force a refetch (e.g. after external record creation). */
  reloadKey?: number
  /** Conditional formatting rules */
  highlightRules?: HighlightRule[]
  /** Interface mode: 'view' | 'edit'. When 'edit', record panel opens editable (Airtable-style). */
  interfaceMode?: 'view' | 'edit'
  /** Called when a record is deleted from RecordPanel; use to refresh core data. */
  onRecordDeleted?: () => void
  /** Callback to save field layout when user edits modal layout in right panel. */
  onModalLayoutSave?: (fieldLayout: import("@/lib/interface/field-layout-utils").FieldLayoutItem[]) => void
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
  groupValue?: string | null
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
  filters = [],
  blockConfig = {},
  colorField,
  onRecordClick,
  titleField: titleFieldProp,
  tagField: tagFieldProp,
  groupByField: groupByFieldProp,
  rowSize = 'medium',
  compactMode: compactModeProp,
  reloadKey,
  highlightRules = [],
  interfaceMode = 'view',
  onRecordDeleted,
  onModalLayoutSave,
}: TimelineViewProps) {
  const supabase = useMemo(() => createClient(), [])
  const viewUuid = useMemo(() => normalizeUuid(viewId), [viewId])
  // Ensure fieldIds is always an array
  const fieldIds = Array.isArray(fieldIdsProp) ? fieldIdsProp : []
  const { openRecord } = useRecordPanel()
  const [rows, setRows] = useState<TableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("month")
  const [scrollPosition, setScrollPosition] = useState(0)
  const timelineRef = useRef<HTMLDivElement>(null)
  const [linkedValueLabelMaps, setLinkedValueLabelMaps] = useState<Record<string, Record<string, string>>>({})

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

  // Drag and resize state
  const [draggingEvent, setDraggingEvent] = useState<string | null>(null)
  const [resizingEvent, setResizingEvent] = useState<{ id: string; edge: 'start' | 'end' } | null>(null)
  const [dragStartPos, setDragStartPos] = useState<{ x: number; startDate: Date; endDate: Date } | null>(null)
  // We only start a drag after the pointer moves a small threshold.
  // This fixes "can't click to open record" because mousedown no longer forces dragging state.
  const [pendingDrag, setPendingDrag] = useState<{ id: string; x: number; startDate: Date; endDate: Date } | null>(null)
  const [optimisticUpdates, setOptimisticUpdates] = useState<Record<string, { start?: Date; end?: Date }>>({})
  // Avoid opening a record due to the synthetic click fired after drag/resize.
  const justInteractedEventIdRef = useRef<string | null>(null)
  const justInteractedAtRef = useRef<number>(0)

  // Get table name for opening records
  const [supabaseTableName, setSupabaseTableName] = useState<string>("")
  // Cache physical columns to bridge drift between metadata names and actual columns.
  // This is critical when older tables were created with quoted identifiers (e.g. "Content Name")
  // but metadata uses snake_case internal names (e.g. content_name).
  const physicalColumnsRef = useRef<Set<string> | null>(null)
  const physicalColumnsTableRef = useRef<string | null>(null)

  const showAddRecord = (blockConfig as any)?.appearance?.show_add_record === true
  const permissions = (blockConfig as any)?.permissions || {}
  const isViewOnly = permissions.mode === 'view'
  const allowInlineCreate = permissions.allowInlineCreate ?? true
  const canCreateRecord = showAddRecord && !isViewOnly && allowInlineCreate

  // In live mode, parent props (especially `filters`) can be recreated each render.
  // If we depend on array/object identity in effects, we'll refetch repeatedly and
  // toggle `loading`, causing visible flashing.
  const filtersKey = JSON.stringify(Array.isArray(filters) ? filters : [])
  const tableFieldsKey = JSON.stringify(
    (Array.isArray(tableFields) ? tableFields : []).map((f) => ({
      id: (f as any)?.id,
      name: (f as any)?.name,
      type: (f as any)?.type,
    }))
  )

  // Prevent stale/overlapping loads from causing UI flicker.
  const loadSeqRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    async function loadTableInfo() {
      const { data } = await supabase
        .from("tables")
        .select("supabase_table")
        .eq("id", tableId)
        .single()
      if (!cancelled && data) {
        setSupabaseTableName(data.supabase_table)
      }
    }
    loadTableInfo()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId])

  async function ensurePhysicalColumns(force = false): Promise<Set<string> | null> {
    if (!supabaseTableName) return null
    if (!force && physicalColumnsTableRef.current === supabaseTableName && physicalColumnsRef.current) {
      return physicalColumnsRef.current
    }

    physicalColumnsTableRef.current = supabaseTableName
    physicalColumnsRef.current = null
    try {
      const { data: cols, error } = await supabase.rpc("get_table_columns", {
        table_name: supabaseTableName,
      })
      if (error) {
        // Non-fatal: we can still proceed using best-effort keys from returned rows.
        return null
      }
      if (Array.isArray(cols)) {
        const set = new Set<string>(
          cols
            .map((c: any) => String(c?.column_name ?? "").trim())
            .filter(Boolean)
        )
        // Include audit fields which are commonly referenced by filters/sorts.
        set.add("created_at")
        set.add("updated_at")
        set.add("created_by")
        set.add("updated_by")
        set.add("id")
        physicalColumnsRef.current = set
        return set
      }
    } catch {
      // ignore
    }
    return null
  }

  async function loadRows() {
    if (!supabaseTableName) return

    const seq = ++loadSeqRef.current
    setLoading(true)
    try {
      const physicalCols = await ensurePhysicalColumns()
      const sanitizedToPhysical = new Map<string, string>()
      if (physicalCols) {
        for (const col of physicalCols) {
          sanitizedToPhysical.set(sanitizeFieldName(col), col)
        }
      }

      const resolvePhysicalColumnForField = (field: TableField): string => {
        const candidates: Array<string | null | undefined> = [
          field.name,
          resolveSystemFieldAlias(field.name),
          typeof field.label === "string" ? field.label.trim() : null,
          typeof field.label === "string" ? sanitizeFieldName(field.label) : null,
          sanitizeFieldName(field.name),
        ]

        for (const c of candidates) {
          const key = typeof c === "string" ? c.trim() : ""
          if (!key) continue
          if (physicalCols?.has(key)) return key
        }

        // Last resort: if physical columns exist, match by sanitized form.
        if (physicalCols) {
          const viaSan = sanitizedToPhysical.get(sanitizeFieldName(field.name))
          if (viaSan) return viaSan
        }

        return field.name
      }

      // Build query with filters
      let query = supabase
        .from(supabaseTableName)
        .select("*")

      // Apply filters using shared filter system.
      // IMPORTANT: Keep `name` as the metadata field name to match how filters are stored.
      // (We separately normalize row data so rendering works even if physical columns drift.)
      const normalizedFields = (Array.isArray(tableFields) ? tableFields : []).map((f) => ({
        name: f.name || f.id,
        type: f.type,
        id: (f as any)?.id,
        options: (f as any)?.options,
      }))
      query = applyFiltersToQuery(query, Array.isArray(filters) ? filters : [], normalizedFields)

      // Apply ordering
      query = query.order("created_at", { ascending: false })

      const { data, error } = await query

      // If a newer load has started, ignore this result.
      if (seq !== loadSeqRef.current) return

      if (error) {
        if (!isAbortError(error)) {
          console.error("Error loading rows:", error)
          setRows([])
        }
      } else {
        // Convert to TableRow format
        const tableRows: TableRow[] = (data || []).map((row: any) => ({
          id: row.id,
          table_id: tableId,
          // Normalize row data so `row.data[field.name]` works even if the physical column
          // is not the same as the field metadata name (e.g. quoted identifiers / legacy drift).
          data: (() => {
            const out: Record<string, any> = { ...row }
            const fieldsArr = Array.isArray(tableFields) ? tableFields : []
            for (const f of fieldsArr) {
              const physical = resolvePhysicalColumnForField(f)
              // Only add alias if it doesn't already exist.
              if (physical && physical in row && !(f.name in out)) {
                out[f.name] = row[physical]
              }
              // Also alias by field id, if safe and missing.
              if (physical && physical in row && f.id && !(f.id in out)) {
                out[f.id] = row[physical]
              }
            }
            return out
          })(),
          created_at: row.created_at || new Date().toISOString(),
          updated_at: row.updated_at || new Date().toISOString(),
        }))
        setRows(tableRows)
      }
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Error loading rows:", error)
        // If a newer load has started, ignore this error.
        if (seq === loadSeqRef.current) {
          setRows([])
        }
      }
    } finally {
      // Only clear loading for the latest request.
      if (seq === loadSeqRef.current) {
        setLoading(false)
      }
    }
  }

  // Initial load and refetch when table/filters/reloadKey change
  useEffect(() => {
    if (!supabaseTableName) return
    loadRows()
  }, [supabaseTableName, filtersKey, reloadKey])

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

  // Load view config for timeline settings (from Customize timeline dialog)
  const [viewConfig, setViewConfig] = useState<{
    timeline_color_field?: string | null
    card_color_field?: string | null
    card_fields?: string[]
    card_image_field?: string | null
    card_wrap_text?: boolean
    timeline_date_field?: string | null
    timeline_end_date_field?: string | null
    timeline_group_by?: string | null
  } | null>(null)

  useEffect(() => {
    if (!viewUuid) return
    let cancelled = false

    async function loadViewConfig() {
      try {
        const { data: view } = await supabase
          .from('views')
          .select('config')
          .eq('id', viewUuid)
          .single()

        if (!cancelled && view?.config) {
          setViewConfig(view.config as any)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Timeline: Error loading view config:', error)
        }
      }
    }
    loadViewConfig()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewUuid])

  // Resolve color field from props (highest priority), block config, view config, or auto-detect
  const resolvedColorField = useMemo(() => {
    // 1. Props (highest priority - from appearance settings / Customize dialog)
    if (colorField) {
      const field = tableFields.find(f => 
        (f.name === colorField || f.id === colorField) && 
        (f.type === 'single_select' || f.type === 'multi_select')
      )
      if (field) return field
    }
    
    // 2. Check block/page config
    const blockColorField = blockConfig?.timeline_color_field || blockConfig?.color_field || blockConfig?.appearance?.color_field
    if (blockColorField) {
      const field = tableFields.find(f => 
        (f.name === blockColorField || f.id === blockColorField) && 
        (f.type === 'single_select' || f.type === 'multi_select')
      )
      if (field) return field
    }
    
    // 3. Check view config (Customize timeline saves to card_color_field)
    const viewColorField = viewConfig?.card_color_field || viewConfig?.timeline_color_field
    if (viewColorField) {
      const field = tableFields.find(f => 
        (f.name === viewColorField || f.id === viewColorField) && 
        (f.type === 'single_select' || f.type === 'multi_select')
      )
      if (field) return field
    }
    
    // 4. Auto-detect: find first single_select or multi_select field
    return tableFields.find(f => f.type === 'single_select' || f.type === 'multi_select') || null
  }, [colorField, blockConfig, viewConfig, tableFields])

  // Resolve date_from and date_to fields from block config, props, view config, or auto-detect
  // This must be defined before resolvedCardFields since it's used there
  const resolvedDateFields = useMemo(() => {
    // Resolve date_from field (default/primary): block config > props > view config > auto-detect
    const blockFromField = blockConfig?.date_from || blockConfig?.from_date_field || blockConfig?.start_date_field || blockConfig?.timeline_date_field
    let resolvedFromField = blockFromField
      ? tableFields.find(f => (f.name === blockFromField || f.id === blockFromField) && f.type === 'date')
      : null
    
    if (!resolvedFromField && startDateFieldId) {
      resolvedFromField = tableFields.find(f => (f.name === startDateFieldId || f.id === startDateFieldId) && f.type === 'date')
    }
    if (!resolvedFromField && viewConfig?.timeline_date_field) {
      resolvedFromField = tableFields.find(f => (f.name === viewConfig.timeline_date_field || f.id === viewConfig.timeline_date_field) && f.type === 'date')
    }
    // Auto-detect date_from field if not configured
    if (!resolvedFromField) {
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
    
    // Resolve date_to field (secondary/range): block config > props > view config > auto-detect
    const blockToField = blockConfig?.date_to || blockConfig?.to_date_field || blockConfig?.end_date_field
    let resolvedToField = blockToField
      ? tableFields.find(f => (f.name === blockToField || f.id === blockToField) && f.type === 'date')
      : null
    
    if (!resolvedToField && endDateFieldId) {
      resolvedToField = tableFields.find(f => (f.name === endDateFieldId || f.id === endDateFieldId) && f.type === 'date')
    }
    if (!resolvedToField && viewConfig?.timeline_end_date_field) {
      resolvedToField = tableFields.find(f => (f.name === viewConfig.timeline_end_date_field || f.id === viewConfig.timeline_end_date_field) && f.type === 'date')
    }
    // Auto-detect date_to field if not configured
    if (!resolvedToField) {
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
  }, [blockConfig, startDateFieldId, endDateFieldId, dateFieldId, viewConfig, tableFields])

  // Resolve compact card config: titleField + tagField (max 1)
  const resolvedCardFields = useMemo(() => {
    const { fromFieldName, toFieldName } = resolvedDateFields
    const dateFieldNames = new Set([
      fromFieldName,
      toFieldName,
      startDateFieldId,
      endDateFieldId,
      dateFieldId,
    ].filter(Boolean))

    const effectiveFieldIds = (Array.isArray(fieldIds) && fieldIds.length > 0)
      ? fieldIds
      : (Array.isArray(viewConfig?.card_fields) && viewConfig.card_fields.length > 0)
        ? viewConfig.card_fields
        : []

    let allVisibleFields: TableField[] = []
    if (effectiveFieldIds.length > 0) {
      const seenVisible = new Set<string>()
      for (const fid of effectiveFieldIds) {
        const resolved = tableFields.find((f) => f.name === fid || f.id === fid)
        if (!resolved) continue
        if (resolved.id && seenVisible.has(String(resolved.id))) continue
        if (resolved.id) seenVisible.add(String(resolved.id))
        allVisibleFields.push(resolved)
      }
    }

    // Title field: explicit config > first non-date from visible > primary
    const titleFieldName = titleFieldProp ||
      blockConfig?.timeline_title_field ||
      blockConfig?.card_title_field ||
      null

    let resolvedTitleField: TableField | null = null
    if (titleFieldName) {
      resolvedTitleField = tableFields.find(f => f.name === titleFieldName || f.id === titleFieldName) || null
      if (resolvedTitleField && dateFieldNames.has(resolvedTitleField.name)) resolvedTitleField = null
    }
    if (!resolvedTitleField) {
      resolvedTitleField =
        allVisibleFields.find(f => !dateFieldNames.has(f.name) && (f.type === "text" || f.type === "long_text")) ||
        allVisibleFields.find(f => !dateFieldNames.has(f.name)) ||
        null
    }
    if (!resolvedTitleField) {
      resolvedTitleField = tableFields.find(f =>
        (f.type === 'text' || f.type === 'long_text') &&
        (f.name.toLowerCase() === 'name' || f.name.toLowerCase() === 'title')
      ) || tableFields.find(f => f.type === 'text' || f.type === 'long_text') || null
    }

    // Tag field: explicit config > card_field_1/timeline_field_1 (backward compat). Max 1. Pill types only.
    const pillFieldTypes = ['single_select', 'multi_select', 'link_to_table']
    const tagFieldName = tagFieldProp ||
      blockConfig?.timeline_tag_field ||
      blockConfig?.timeline_field_1 ||
      blockConfig?.card_field_1 ||
      null
    const resolvedTagField = tagFieldName
      ? (() => {
          const f = tableFields.find(f => f.name === tagFieldName || f.id === tagFieldName)
          return f && pillFieldTypes.includes(f.type) ? f : null
        })()
      : null

    return { titleField: resolvedTitleField, tagField: resolvedTagField }
  }, [titleFieldProp, tagFieldProp, blockConfig, viewConfig, tableFields, resolvedDateFields, startDateFieldId, endDateFieldId, dateFieldId, fieldIds])

  // Resolve group by field - fall back to primary field if not configured
  const resolvedGroupByField = useMemo(() => {
    const groupFieldName = groupByFieldProp || 
      blockConfig?.timeline_group_by || 
      blockConfig?.group_by_field || 
      blockConfig?.group_by ||
      viewConfig?.timeline_group_by ||
      null
    
    if (groupFieldName) {
      // Timeline grouping is supported for many field types (not just select fields).
      // For select fields, we preserve choice-order sorting when choices are available.
      const field = tableFields.find(f => (f.name === groupFieldName || f.id === groupFieldName))
      if (field) return field
    }
    
    // Fall back to primary field if no group field is configured
    // This ensures we always group by a meaningful field instead of showing record IDs
    const primaryField = getPrimaryField(tableFields)
    return primaryField
  }, [groupByFieldProp, blockConfig, viewConfig, tableFields])

  // Resolve display labels for any link_to_table fields used in cards/grouping.
  // NOTE: This must be defined after resolvedCardFields/resolvedGroupByField so TS doesn't
  // treat them as used-before-declaration.
  useEffect(() => {
    let cancelled = false

    async function load() {
      const wanted = new Map<string, LinkedField>()
      const addIfLinked = (f: TableField | null | undefined) => {
        if (!f) return
        if (f.type !== "link_to_table") return
        wanted.set(f.name, f as LinkedField)
      }

      addIfLinked(resolvedCardFields?.titleField || null)
      addIfLinked(resolvedCardFields?.tagField || null)
      addIfLinked(resolvedGroupByField as any)

      if (wanted.size === 0) {
        setLinkedValueLabelMaps((prev) => (Object.keys(prev).length === 0 ? prev : {}))
        return
      }

      const next: Record<string, Record<string, string>> = {}
      for (const f of wanted.values()) {
        const ids = new Set<string>()
        for (const row of Array.isArray(filteredRows) ? filteredRows : []) {
          const fieldValue = getLinkedFieldValueFromRow(row as { data?: Record<string, unknown> }, f)
          for (const id of linkedValueToIds(fieldValue)) ids.add(id)
        }
        if (ids.size === 0) continue
        const map = await resolveLinkedFieldDisplayMap(f, Array.from(ids))
        const obj = Object.fromEntries(map.entries())
        next[f.name] = obj
        next[(f as any).id] = obj
      }

      if (!cancelled) {
        setLinkedValueLabelMaps((prev) => (areLinkedValueMapsEqual(prev, next) ? prev : next))
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [filteredRows, resolvedCardFields, resolvedGroupByField, tableFieldsKey, areLinkedValueMapsEqual])


  // Helper to get pill color for select fields
  const getPillColor = useCallback((field: TableField, value: any): string | null => {
    if (field.type !== 'single_select' && field.type !== 'multi_select') {
      return null
    }

    const normalizedValue = String(value).trim()
    return normalizeHexColor(
      resolveChoiceColor(
        normalizedValue,
        field.type,
        field.options,
        field.type === 'single_select'
      )
    )
  }, [])

  // Helper to generate a color for any group value (hash-based)
  const getGroupColor = useCallback((value: any): string => {
    const normalizedValue = String(value || '').trim()
    if (!normalizedValue) return '#9CA3AF' // Gray for empty values
    
    // Use hash-based color selection from SEMANTIC_COLORS
    let hash = 0
    for (let i = 0; i < normalizedValue.length; i++) {
      hash = normalizedValue.charCodeAt(i) + ((hash << 5) - hash)
    }
    return SEMANTIC_COLORS[Math.abs(hash) % SEMANTIC_COLORS.length]
  }, [])

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

        // Get title from configured title field or fallback
        let title = "Untitled"
        if (resolvedCardFields.titleField) {
          const titleValue = row.data[resolvedCardFields.titleField.name]
          if (titleValue !== null && titleValue !== undefined && titleValue !== "") {
            title = String(titleValue)
          }
        } else {
          // Fallback: use first non-date field
          const titleField = (Array.isArray(fieldIds) ? fieldIds : []).find(
            (fid) => fid !== dateFieldId && fid !== startDateFieldId && fid !== endDateFieldId && 
                     fid !== fromFieldName && fid !== toFieldName
          )
          if (titleField) {
            title = String(row.data[titleField] || "Untitled")
          }
        }

        // Get color from resolved color field (single_select or multi_select)
        let color: string | undefined = undefined
        if (resolvedColorField) {
          const fieldName = resolvedColorField.name
          const fieldValue = row.data[fieldName]
          
          if (fieldValue) {
            // For multi_select, use the first value; for single_select, use the value directly
            const valueToColor = resolvedColorField.type === 'multi_select' && Array.isArray(fieldValue)
              ? fieldValue[0]
              : fieldValue
            
            if (valueToColor) {
              // Use centralized color system
              const normalizedValue = String(valueToColor).trim()
              // Type assertion: resolvedColorField is already filtered to be single_select or multi_select
              const fieldType = (resolvedColorField.type === 'single_select' || resolvedColorField.type === 'multi_select')
                ? resolvedColorField.type as 'single_select' | 'multi_select'
                : 'single_select' as const // Fallback (shouldn't happen due to filtering)
              const hexColor = resolveChoiceColor(
                normalizedValue,
                fieldType,
                resolvedColorField.options,
                resolvedColorField.type === 'single_select'
              )
              color = normalizeHexColor(hexColor)
            }
          }
        }

        // Get group value for grouping
        // CRITICAL: Always use a field value, never fall back to record ID
        let groupValue: string | null = null
        if (resolvedGroupByField) {
          const groupFieldName = resolvedGroupByField.name
          const groupFieldId = (resolvedGroupByField as any).id
          // Try both field name and field id when reading the value
          // IMPORTANT: Never use row.id as a fallback - always use the field value or 'Unassigned'
          const groupFieldValue = row.data[groupFieldName] ?? (groupFieldId ? row.data[groupFieldId] : null)
          
          // Helper to resolve linked table field value to display label
          const resolveLinkedValue = (id: string): string => {
            if (!id || !id.trim()) return id
            const trimmedId = id.trim()
            // Try both field name and field id as keys
            const labelMap = linkedValueLabelMaps[groupFieldName] || linkedValueLabelMaps[groupFieldId] || {}
            return labelMap[trimmedId] || labelMap[id] || id
          }
          
          if (groupFieldValue !== null && groupFieldValue !== undefined && groupFieldValue !== '') {
            // Normalize common value shapes to a stable string label.
            // - arrays: take first value (e.g. multi_select, link_to_table)
            // - Dates: stringify (ISO or existing string)
            // - objects: JSON stringify fallback (rare)
            if (Array.isArray(groupFieldValue)) {
              const first = groupFieldValue.length > 0 ? groupFieldValue[0] : null
              if (first !== null && first !== undefined && first !== '') {
                const id = first && typeof first === "object" && "id" in (first as any) ? String((first as any).id) : String(first)
                groupValue =
                  resolvedGroupByField.type === "link_to_table" && id.trim()
                    ? resolveLinkedValue(id)
                    : id
              }
            } else if (groupFieldValue instanceof Date) {
              groupValue = isNaN(groupFieldValue.getTime()) ? 'Unassigned' : groupFieldValue.toISOString()
            } else if (typeof groupFieldValue === 'object') {
              if (resolvedGroupByField.type === "link_to_table" && groupFieldValue && "id" in (groupFieldValue as any)) {
                const id = String((groupFieldValue as any).id ?? "").trim()
                groupValue = id ? resolveLinkedValue(id) : "Unassigned"
              } else {
                try {
                  groupValue = JSON.stringify(groupFieldValue)
                } catch {
                  groupValue = String(groupFieldValue)
                }
              }
            } else {
              const id = String(groupFieldValue)
              groupValue =
                resolvedGroupByField.type === "link_to_table" && id.trim()
                  ? resolveLinkedValue(id)
                  : id
            }
            if (groupValue !== null && groupValue !== undefined) {
              groupValue = groupValue.trim()
              // Ensure we never use empty string or record ID as group value
              if (groupValue === '' || groupValue === row.id) {
                groupValue = 'Unassigned'
              }
            } else {
              groupValue = 'Unassigned'
            }
          } else {
            // Field value is null/undefined/empty - use 'Unassigned' instead of record ID
            groupValue = 'Unassigned'
          }
        } else {
          // No group field resolved (shouldn't happen with primary field fallback, but be safe)
          groupValue = 'Unassigned'
        }

        return {
          id: row.id,
          rowId: row.id,
          title,
          start,
          end,
          rowData: row.data,
          color,
          groupValue,
        }
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime())
  }, [filteredRows, startDateFieldId, endDateFieldId, dateFieldId, fieldIds, tableFields, optimisticUpdates, resolvedColorField, resolvedDateFields, resolvedCardFields, resolvedGroupByField])

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

  // Group events by group field (always use resolvedGroupByField which falls back to primary field)
  const groupedEvents = useMemo(() => {
    if (!resolvedGroupByField) {
      // Shouldn't happen with primary field fallback, but handle gracefully
      return { 'Unassigned': visibleEvents }
    }

    const groups: Record<string, TimelineEvent[]> = {}
    
    visibleEvents.forEach(event => {
      // groupValue should always be set (either a field value or 'Unassigned')
      // Never use record ID as group key
      const groupKey = event.groupValue || 'Unassigned'
      // Safety check: if groupKey looks like a UUID (record ID), use 'Unassigned' instead
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      const safeGroupKey = uuidPattern.test(groupKey) ? 'Unassigned' : groupKey
      
      if (!groups[safeGroupKey]) {
        groups[safeGroupKey] = []
      }
      groups[safeGroupKey].push(event)
    })

    // Sort groups by field options order if available (single/multi select)
    // Use selectOptions with sort_index as the source of truth
    if (
      resolvedGroupByField.type === 'single_select' || resolvedGroupByField.type === 'multi_select'
    ) {
      const { selectOptions } = normalizeSelectOptionsForUi(resolvedGroupByField.type, resolvedGroupByField.options)
      if (selectOptions.length > 0) {
        const sortedGroups: Record<string, TimelineEvent[]> = {}
        
        // Add groups in selectOptions order (by sort_index)
        const orderedOptions = [...selectOptions].sort((a, b) => a.sort_index - b.sort_index)
        orderedOptions.forEach(option => {
          if (groups[option.label]) {
            sortedGroups[option.label] = groups[option.label]
          }
        })
        
        // Add remaining groups (including Unassigned)
        Object.keys(groups).forEach(key => {
          if (!sortedGroups[key]) {
            sortedGroups[key] = groups[key]
          }
        })
        
        return sortedGroups
      }
    }

    // Default: alphabetical group order, with Unassigned last.
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      const aIsUnassigned = a === 'Unassigned'
      const bIsUnassigned = b === 'Unassigned'
      if (aIsUnassigned && !bIsUnassigned) return 1
      if (!aIsUnassigned && bIsUnassigned) return -1
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    })
    const sortedGroups: Record<string, TimelineEvent[]> = {}
    for (const k of sortedKeys) sortedGroups[k] = groups[k]
    return sortedGroups
  }, [visibleEvents, resolvedGroupByField])

  // Compact mode: 28px cards when true, 40px when false. Fixed heights regardless of content.
  const compactMode = compactModeProp ?? blockConfig?.timeline_compact_mode ?? (blockConfig?.appearance?.row_height === 'compact' || rowSize === 'compact') ?? false

  // Lane row spacing (for grouped layout)
  const rowSizeSpacing = useMemo(() => {
    return compactMode ? { laneSpacing: 'mb-2' } : { laneSpacing: 'mb-4' }
  }, [compactMode])

  // Absolute-positioned cards do NOT contribute to parent height.
  // Compute consistent pixel metrics so lanes reserve enough space and don't overlap.
  const laneLayout = useMemo(() => {
    const cardHeightPx = compactMode ? 28 : 40
    const stackGapPx = compactMode ? 40 : 52
    return { cardHeightPx, stackGapPx }
  }, [compactMode])

  const dateFieldNames = useMemo(() => {
    const { fromFieldName, toFieldName } = resolvedDateFields
    return new Set([
      fromFieldName,
      toFieldName,
      startDateFieldId,
      endDateFieldId,
      dateFieldId,
    ].filter(Boolean))
  }, [resolvedDateFields, startDateFieldId, endDateFieldId, dateFieldId])

  // Build tag string and tooltip content for compact card display
  const getCompactDisplay = useCallback((event: TimelineEvent) => {
    const { titleField, tagField } = resolvedCardFields
    const titleFieldName = titleField?.name
    const tagFieldName = tagField?.name

    let tag: string | undefined
    if (tagField) {
      const val = event.rowData[tagField.name] ?? event.rowData[tagField.id]
      if (val != null && val !== '') {
        if (tagField.type === 'link_to_table') {
          const arr = Array.isArray(val) ? val : [val]
          const first = arr[0]
          const id = first && typeof first === 'object' && 'id' in first ? String((first as any).id) : String(first)
          const map = linkedValueLabelMaps[tagField.name] || linkedValueLabelMaps[tagField.id] || {}
          tag = (id && map[id.trim()]) || id || String(val)
        } else if (tagField.type === 'multi_select' && Array.isArray(val)) {
          tag = val.length > 0 ? String(val[0]).trim() : undefined
        } else {
          tag = String(val).trim()
        }
      }
    }

    const tooltipLines: string[] = []
    for (const f of tableFields) {
      if (f.name === 'id') continue
      if (dateFieldNames.has(f.name)) continue
      if (f.name === titleFieldName || f.id === titleFieldName) continue
      if (f.name === tagFieldName || f.id === tagFieldName) continue
      if (f.type === 'attachment') continue

      const val = event.rowData[f.name] ?? event.rowData[f.id]
      if (val == null || val === '') continue

      let displayVal: string
      if (f.type === 'link_to_table') {
        const arr = Array.isArray(val) ? val : [val]
        const labels = arr.map((v: any) => {
          const id = v && typeof v === 'object' && 'id' in v ? String((v as any).id) : String(v)
          const map = linkedValueLabelMaps[f.name] || linkedValueLabelMaps[f.id] || {}
          return (id && map[id.trim()]) || id
        })
        displayVal = labels.join(', ')
      } else if (Array.isArray(val)) {
        displayVal = val.map(v => String(v)).join(', ')
      } else if (val instanceof Date) {
        displayVal = isNaN(val.getTime()) ? '—' : val.toLocaleDateString()
      } else {
        displayVal = String(val)
      }
      tooltipLines.push(`${getFieldDisplayName(f)}: ${displayVal}`)
    }
    const tooltipContent = tooltipLines.length > 0 ? tooltipLines.join('\n') : undefined

    return { tag, tooltipContent }
  }, [resolvedCardFields, tableFields, dateFieldNames, linkedValueLabelMaps])

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

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  const handleOpenEventRecord = useCallback((rowId: string) => {
    if (!supabaseTableName || !tableId) return
    if (onRecordClick) {
      onRecordClick(rowId)
      return
    }
    openRecord(tableId, rowId, supabaseTableName, (blockConfig as any)?.modal_fields, (blockConfig as any)?.modal_layout, blockConfig ? { blockConfig } : undefined, interfaceMode, onRecordDeleted, (blockConfig as any)?.field_layout, onModalLayoutSave ?? undefined, tableFields)
  }, [blockConfig, onRecordClick, openRecord, supabaseTableName, tableId, interfaceMode, onRecordDeleted, onModalLayoutSave, tableFields])

  const handleEventSelect = useCallback((event: TimelineEvent, e: React.MouseEvent) => {
    // Don't open/select if we're resizing/dragging.
    if (resizingEvent || draggingEvent) {
      e.stopPropagation()
      return
    }

    // If we just finished a drag/resize on this event, ignore the follow-up click.
    if (
      justInteractedEventIdRef.current === event.id &&
      Date.now() - justInteractedAtRef.current < 250
    ) {
      return
    }

    setSelectedEventId(event.rowId)
    handleOpenEventRecord(event.rowId)
  }, [draggingEvent, handleOpenEventRecord, resizingEvent])

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
      if (isViewOnly) return

      // Do NOT immediately enter dragging state. That breaks click-to-open.
      // Instead, mark this as a pending drag, and promote to a real drag only
      // after the pointer moves beyond a small threshold.
      setPendingDrag({
        id: event.id,
        x: e.clientX,
        startDate: new Date(event.start),
        endDate: new Date(event.end),
      })
    },
    [isViewOnly]
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
    if (!pendingDrag && !draggingEvent && !resizingEvent) return
    if ((draggingEvent || resizingEvent) && !dragStartPos) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current) return

      const timelineRect = timelineRef.current.getBoundingClientRect()
      const relativeX = e.clientX - timelineRect.left
      const timelineWidth = timelineRef.current.clientWidth
      const rangeMs = timelineRange.end.getTime() - timelineRange.start.getTime()

      // Promote pending drag to real drag only after moving a threshold.
      if (pendingDrag && !draggingEvent && !resizingEvent) {
        const dx = e.clientX - pendingDrag.x
        const DRAG_THRESHOLD_PX = 4
        if (Math.abs(dx) >= DRAG_THRESHOLD_PX) {
          setDraggingEvent(pendingDrag.id)
          setDragStartPos({
            x: pendingDrag.x,
            startDate: pendingDrag.startDate,
            endDate: pendingDrag.endDate,
          })
          setPendingDrag(null)
        } else {
          return
        }
      }
      
      if (draggingEvent) {
        const startPos = dragStartPos
        if (!startPos) return
        // Calculate the offset from the drag start
        const dragOffsetX = e.clientX - startPos.x
        const offsetMs = (dragOffsetX / timelineWidth) * rangeMs
        const duration = startPos.endDate.getTime() - startPos.startDate.getTime()
        const newStart = new Date(startPos.startDate.getTime() + offsetMs)
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
      // If we never crossed the threshold, treat as a normal click.
      if (pendingDrag && !draggingEvent && !resizingEvent) {
        setPendingDrag(null)
        return
      }

      if (draggingEvent && dragStartPos) {
        const event = events.find((e) => e.id === draggingEvent)
        if (event) {
          await handleEventUpdate(draggingEvent, {
            start: event.start,
            end: event.end,
          })
        }
        justInteractedEventIdRef.current = draggingEvent
        justInteractedAtRef.current = Date.now()
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
        justInteractedEventIdRef.current = resizingEvent.id
        justInteractedAtRef.current = Date.now()
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
  }, [pendingDrag, draggingEvent, resizingEvent, dragStartPos, timelineRange, events, handleEventUpdate])

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

  // Check if we have any date field configured (from props or blockConfig)
  const { fromFieldName, toFieldName } = resolvedDateFields
  if (!dateFieldId && !startDateFieldId && !fromFieldName && !toFieldName) {
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

          {/* Events - Grouped or Ungrouped */}
          <div
            className="relative"
            style={{
              height: `${Math.max(
                400,
                visibleEvents.length > 0
                  ? (visibleEvents.length - 1) * laneLayout.stackGapPx + laneLayout.cardHeightPx + 20
                  : 400
              )}px`,
            }}
          >
            {resolvedGroupByField ? (
              // Render grouped lanes
              Object.entries(groupedEvents).map(([groupKey, groupEvents], groupIndex) => {
                // Get group label and color
                const groupLabel = groupKey === 'Unassigned' ? 'Unassigned' : groupKey
                let groupColor: string | null = null
                if (groupKey !== 'Unassigned' && resolvedGroupByField) {
                  if (resolvedGroupByField.type === 'single_select' || resolvedGroupByField.type === 'multi_select') {
                    // Use field-specific color for select fields
                    groupColor = getPillColor(resolvedGroupByField, groupKey)
                  } else {
                    // Generate hash-based color for all other field types
                    groupColor = getGroupColor(groupKey)
                  }
                } else if (groupKey === 'Unassigned') {
                  // Gray for unassigned
                  groupColor = '#9CA3AF'
                }

                // Helper to convert hex to RGB
                const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
                  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
                  return result
                    ? {
                        r: parseInt(result[1], 16),
                        g: parseInt(result[2], 16),
                        b: parseInt(result[3], 16),
                      }
                    : null
                }

                // Evaluate conditional formatting rules for group headers
                // Create a mock row with the group value for evaluation
                const groupMockRow: Record<string, any> = {}
                if (resolvedGroupByField && groupKey !== 'Unassigned') {
                  groupMockRow[resolvedGroupByField.name] = groupKey
                }
                const groupMatchingRule = highlightRules && highlightRules.length > 0 && Object.keys(groupMockRow).length > 0
                  ? evaluateHighlightRules(
                      highlightRules.filter(r => r.scope === 'group'),
                      groupMockRow,
                      tableFields
                    )
                  : null
                
                // Get formatting style for group-level rules
                const groupFormattingStyle = groupMatchingRule
                  ? getFormattingStyle(groupMatchingRule)
                  : {}
                
                // Determine text color for contrast (conditional formatting takes precedence)
                const finalTextColor = groupFormattingStyle.color || undefined
                const textColorClass = finalTextColor ? '' : (groupColor ? getTextColorForBackground(groupColor) : 'text-gray-700')
                const textColorStyle = finalTextColor ? { color: finalTextColor } : (groupColor ? {} : { color: undefined })
                
                // Background color with opacity (use conditional formatting if available, otherwise use group color)
                const bgColorStyle = groupFormattingStyle.backgroundColor
                  ? {
                      backgroundColor: groupFormattingStyle.backgroundColor,
                      borderColor: groupFormattingStyle.backgroundColor,
                    }
                  : groupColor 
                    ? (() => {
                        const rgb = hexToRgb(groupColor)
                        if (rgb) {
                          return {
                            backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`, // 15% opacity
                            borderColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`, // 40% opacity for border
                          }
                        }
                        return {
                          backgroundColor: 'white',
                          borderColor: '#e5e7eb',
                        }
                      })()
                    : {
                        backgroundColor: 'white',
                        borderColor: '#e5e7eb',
                      }

                return (
                  <div key={groupKey} className={rowSizeSpacing.laneSpacing}>
                    {/* Group header */}
                    <div 
                      className="sticky top-12 z-5 border-b pb-1 mb-2 px-2 py-1 rounded"
                      style={bgColorStyle}
                    >
                      <div className="flex items-center gap-2">
                        {(groupFormattingStyle.backgroundColor || groupColor) && (
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: groupFormattingStyle.backgroundColor || groupColor || undefined }}
                          />
                        )}
                        <span className={`text-xs font-medium ${textColorClass}`} style={textColorStyle}>
                          {groupLabel}
                        </span>
                        <span className={`text-xs ${groupFormattingStyle.backgroundColor || groupColor ? 'opacity-80' : 'text-gray-400'}`} style={textColorStyle}>
                          ({groupEvents.length})
                        </span>
                      </div>
                    </div>

                    {/* Group events */}
                    <div
                      className="relative"
                      style={{
                        height: `${Math.max(
                          60,
                          groupEvents.length > 0
                            ? (groupEvents.length - 1) * laneLayout.stackGapPx + laneLayout.cardHeightPx + 12
                            : 60
                        )}px`,
                      }}
                    >
                      {groupEvents.map((event, eventIndex) => {
                        const { left, width } = getEventPosition(event)
                        const { tag, tooltipContent } = getCompactDisplay(event)
                        return (
                          <TimelineEventCard
                            key={event.id}
                            event={event}
                            left={left}
                            width={width}
                            top={eventIndex * laneLayout.stackGapPx}
                            title={event.title}
                            color={event.color}
                            tag={tag}
                            tooltipContent={tooltipContent}
                            compactMode={compactMode}
                            tableFields={tableFields}
                            highlightRules={highlightRules}
                            selectedEventId={selectedEventId}
                            isDragging={draggingEvent === event.id}
                            isResizing={resizingEvent?.id === event.id}
                            draggingOrResizingAny={!!(draggingEvent || resizingEvent)}
                            onDragStart={(e) => handleDragStart(event, e)}
                            onSelect={(e) => handleEventSelect(event, e)}
                            onResizeStart={(edge, e) => handleResizeStart(event, edge, e)}
                          />
                        )
                      })}
                    </div>
                  </div>
                )
              })
            ) : (
              // Render ungrouped events
              visibleEvents.map((event, index) => {
                const { left, width } = getEventPosition(event)
                const { tag, tooltipContent } = getCompactDisplay(event)
                return (
                  <TimelineEventCard
                    key={event.id}
                    event={event}
                    left={left}
                    width={width}
                    top={index * laneLayout.stackGapPx}
                    title={event.title}
                    color={event.color}
                    tag={tag}
                    tooltipContent={tooltipContent}
                    compactMode={compactMode}
                    tableFields={tableFields}
                    highlightRules={highlightRules}
                    selectedEventId={selectedEventId}
                    isDragging={draggingEvent === event.id}
                    isResizing={resizingEvent?.id === event.id}
                    draggingOrResizingAny={!!(draggingEvent || resizingEvent)}
                    onDragStart={(e) => handleDragStart(event, e)}
                    onSelect={(e) => handleEventSelect(event, e)}
                    onResizeStart={(edge, e) => handleResizeStart(event, edge, e)}
                  />
                )
              })
            )}
          </div>

          {visibleEvents.length === 0 && (
            <div className="flex items-center justify-center h-64 text-gray-400">
              <div className="text-center">
                <p className="mb-2">No events in this time range</p>
                {canCreateRecord && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      // Create new record
                      if (supabaseTableName && tableId) {
                        const { fromFieldName, toFieldName } = resolvedDateFields
                        const newData: Record<string, any> = {}

                        const defaultsFromFilters = deriveDefaultValuesFromFilters(filters, tableFields as any)
                        
                        // Use resolved date fields (from blockConfig, props, or auto-detected)
                        // Set date to current date in timeline view
                        const initialDate = currentDate.toISOString()
                        
                        if (fromFieldName) {
                          newData[fromFieldName] = initialDate
                        } else if (toFieldName) {
                          newData[toFieldName] = initialDate
                        } else if (startDateFieldId) {
                          newData[startDateFieldId] = initialDate
                        } else if (dateFieldId) {
                          newData[dateFieldId] = initialDate
                        }
                        
                        if (Object.keys(defaultsFromFilters).length > 0) {
                          Object.assign(newData, defaultsFromFilters)
                        }

                                                const { data, error } = await supabase
                          .from(supabaseTableName)
                          .insert([newData])
                          .select()
                          .single()
                        
                        if (error) {
                          console.error("Error creating event:", error)
                          alert("Failed to create event")
                        } else if (data?.id) {
                          // Reload rows to show the new event
                          await loadRows()
                          const createdId = String(data.id)
                          if (onRecordClick) {
                            onRecordClick(createdId)
                            return
                          }
                          // Contract: creating a record must NOT auto-open it.
                          // User can open via the dedicated chevron (or optional double-click).
                          setSelectedEventId(createdId)
                        }
                      }
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Event
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper functions (getColorForValue removed - using centralized color system)

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


