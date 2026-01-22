"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { format } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react"
import { filterRowsBySearch } from "@/lib/search/filterRows"
import { applyFiltersToQuery, deriveDefaultValuesFromFilters, type FilterConfig } from "@/lib/interface/filters"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import type { TableRow } from "@/types/database"
import type { LinkedField, TableField } from "@/types/fields"
import { isAbortError } from "@/lib/api/error-handling"
import TimelineFieldValue from "./TimelineFieldValue"
import {
  resolveChoiceColor,
  normalizeHexColor,
} from "@/lib/field-colors"
import { resolveLinkedFieldDisplayMap } from "@/lib/dataView/linkedFields"
import { normalizeUuid } from "@/lib/utils/ids"
import { sanitizeFieldName } from "@/lib/fields/validation"
import { resolveSystemFieldAlias } from "@/lib/fields/systemFieldAliases"

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
  imageField?: string // Field name to use for event images
  fitImageSize?: boolean // Whether to fit image to container size
  onRecordClick?: (recordId: string) => void
  // Card field configuration
  titleField?: string // Field to use as card title
  cardField1?: string // Secondary field 1
  cardField2?: string // Secondary field 2
  cardField3?: string // Secondary field 3
  // Grouping
  groupByField?: string // Field to group by (select field)
  // Appearance settings
  wrapTitle?: boolean // Whether to wrap title text
  rowSize?: 'compact' | 'medium' | 'comfortable' // Row size setting
  /** Bump to force a refetch (e.g. after external record creation). */
  reloadKey?: number
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
  image?: string
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
  imageField,
  fitImageSize = false,
  onRecordClick,
  titleField: titleFieldProp,
  cardField1,
  cardField2,
  cardField3,
  groupByField: groupByFieldProp,
  wrapTitle: wrapTitleProp,
  rowSize = 'medium',
  reloadKey,
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
    loadTableInfo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId])

  useEffect(() => {
    if (supabaseTableName) {
      loadRows()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseTableName, tableId, filtersKey, tableFieldsKey, reloadKey])

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

  // Load view config for timeline settings (color field, etc.)
  const [viewConfig, setViewConfig] = useState<{
    timeline_color_field?: string | null
  } | null>(null)

  useEffect(() => {
    if (viewUuid) {
      loadViewConfig()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewUuid])

  async function loadViewConfig() {
    if (!viewUuid) return
    
    try {
      const { data: view } = await supabase
        .from('views')
        .select('config')
        .eq('id', viewUuid)
        .single()

      if (view?.config) {
        setViewConfig(view.config as any)
      }
    } catch (error) {
      console.error('Timeline: Error loading view config:', error)
    }
  }

  // Resolve color field from props (highest priority), block config, view config, or auto-detect
  const resolvedColorField = useMemo(() => {
    // 1. Props (highest priority - from appearance settings)
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
    
    // 3. Check view config
    if (viewConfig?.timeline_color_field) {
      const field = tableFields.find(f => 
        (f.name === viewConfig.timeline_color_field || f.id === viewConfig.timeline_color_field) && 
        (f.type === 'single_select' || f.type === 'multi_select')
      )
      if (field) return field
    }
    
    // 4. Auto-detect: find first single_select or multi_select field
    return tableFields.find(f => f.type === 'single_select' || f.type === 'multi_select') || null
  }, [colorField, blockConfig, viewConfig, tableFields])

  // Resolve date_from and date_to fields from block config, props, or auto-detect
  // This must be defined before resolvedCardFields since it's used there
  const resolvedDateFields = useMemo(() => {
    // Resolve date_from field (default/primary): block config > props > auto-detect
    const blockFromField = blockConfig?.date_from || blockConfig?.from_date_field || blockConfig?.start_date_field || blockConfig?.timeline_date_field
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

  // Resolve card field configuration
  const resolvedCardFields = useMemo(() => {
    // Get date field names to exclude from card fields
    const { fromFieldName, toFieldName } = resolvedDateFields
    const dateFieldNames = new Set([
      fromFieldName,
      toFieldName,
      startDateFieldId,
      endDateFieldId,
      dateFieldId,
    ].filter(Boolean))

    // Priority: Use fieldIds (derived from "Fields to Show on Cards/Table") if available (new system)
    // Otherwise fall back to timeline_field_1/2/3 (old system for backward compatibility)
    let allVisibleFields: TableField[] = []
    let cardFields: TableField[] = []
    let resolvedTitleField: TableField | null = null
    
    if (Array.isArray(fieldIds) && fieldIds.length > 0) {
      // Use the visible field order passed into this view (new system), but de-dupe by field id.
      // It's possible for configs to contain both id + name references (or duplicates after renames),
      // which would otherwise render duplicated chips/values on cards.
      const seenVisible = new Set<string>()
      allVisibleFields = []
      for (const fid of fieldIds) {
        const resolved =
          tableFields.find((f) => f.name === fid || f.id === fid) || undefined
        if (!resolved) continue
        if (resolved.id && seenVisible.has(String(resolved.id))) continue
        if (resolved.id) seenVisible.add(String(resolved.id))
        allVisibleFields.push(resolved)
      }
      
      // Resolve title field: explicit config > first non-date field from visible fields
      const titleFieldName = titleFieldProp || 
        blockConfig?.timeline_title_field || 
        blockConfig?.card_title_field ||
        null
      
      if (titleFieldName) {
        // IMPORTANT: title field may not be included in visible_fields.
        // Prefer resolving against the full tableFields list so user-selected title always works.
        resolvedTitleField =
          tableFields.find(f => f.name === titleFieldName || f.id === titleFieldName) || null

        // Don't allow a date field as the title (would be confusing, and is usually the timeline axis)
        if (resolvedTitleField && dateFieldNames.has(resolvedTitleField.name)) {
          resolvedTitleField = null
        }
      }
      
      // If no explicit title field, use first non-date field from visible_fields
      if (!resolvedTitleField) {
        // Prefer a text/long_text field for the title (e.g. "Content Name") so cards are readable.
        // If none exist in visible_fields, fall back to first non-date field.
        resolvedTitleField =
          allVisibleFields.find(
            (f) =>
              !dateFieldNames.has(f.name) &&
              (f.type === "text" || f.type === "long_text")
          ) ||
          allVisibleFields.find((f) => !dateFieldNames.has(f.name)) ||
          null
      }
      
      // Fallback to auto-detect if still no title field
      if (!resolvedTitleField) {
        const primaryField = tableFields.find(f => 
          (f.type === 'text' || f.type === 'long_text') && 
          (f.name.toLowerCase() === 'name' || f.name.toLowerCase() === 'title')
        ) || tableFields.find(f => f.type === 'text' || f.type === 'long_text') || null
        resolvedTitleField = primaryField
      }
      
      // Card fields are all visible fields except title and date fields
      const titleFieldNameToExclude = resolvedTitleField?.name
      const titleFieldIdToExclude = resolvedTitleField?.id
      cardFields = allVisibleFields.filter(f => 
        f.name !== titleFieldNameToExclude && 
        (titleFieldIdToExclude ? f.id !== titleFieldIdToExclude : true) &&
        !dateFieldNames.has(f.name) &&
        // Skip non-card-friendly types
        f.type !== 'attachment'
      )
    } else {
      // Fall back to old system (backward compatibility)
      const titleFieldName = titleFieldProp || 
        blockConfig?.timeline_title_field || 
        blockConfig?.card_title_field ||
        null
      
      // Find primary field (name/title field) as default
      const primaryField = tableFields.find(f => 
        (f.type === 'text' || f.type === 'long_text') && 
        (f.name.toLowerCase() === 'name' || f.name.toLowerCase() === 'title')
      ) || tableFields.find(f => f.type === 'text' || f.type === 'long_text') || null
      
      resolvedTitleField = titleFieldName
        ? tableFields.find(f => f.name === titleFieldName || f.id === titleFieldName) || primaryField
        : primaryField
      
      cardFields = [
        cardField1 || blockConfig?.timeline_field_1 || blockConfig?.card_field_1,
        cardField2 || blockConfig?.timeline_field_2 || blockConfig?.card_field_2,
        cardField3 || blockConfig?.timeline_field_3 || blockConfig?.card_field_3,
      ].filter(Boolean).map(fieldName => 
        tableFields.find(f => f.name === fieldName || f.id === fieldName)
      ).filter(Boolean) as TableField[]
    }

    return {
      titleField: resolvedTitleField,
      cardFields,
    }
  }, [titleFieldProp, cardField1, cardField2, cardField3, blockConfig, tableFields, resolvedDateFields, startDateFieldId, endDateFieldId, dateFieldId, fieldIds])

  // Resolve group by field
  const resolvedGroupByField = useMemo(() => {
    const groupFieldName = groupByFieldProp || 
      blockConfig?.timeline_group_by || 
      blockConfig?.group_by_field || 
      blockConfig?.group_by ||
      null
    
    if (!groupFieldName) return null
    
    // Timeline grouping is supported for many field types (not just select fields).
    // For select fields, we preserve choice-order sorting when choices are available.
    const field = tableFields.find(f => (f.name === groupFieldName || f.id === groupFieldName))
    
    return field || null
  }, [groupByFieldProp, blockConfig, tableFields])

  // Resolve display labels for any link_to_table fields used in cards/grouping.
  // NOTE: This must be defined after resolvedCardFields/resolvedGroupByField so TS doesn't
  // treat them as used-before-declaration.
  useEffect(() => {
    let cancelled = false

    const collectIds = (raw: any): string[] => {
      if (raw == null) return []
      if (Array.isArray(raw)) return raw.flatMap(collectIds)
      if (typeof raw === "object") {
        if (raw && "id" in raw) return [String((raw as any).id)]
        return []
      }
      const s = String(raw).trim()
      return s ? [s] : []
    }

    async function load() {
      const wanted = new Map<string, LinkedField>()
      const addIfLinked = (f: TableField | null | undefined) => {
        if (!f) return
        if (f.type !== "link_to_table") return
        wanted.set(f.name, f as LinkedField)
      }

      addIfLinked(resolvedCardFields?.titleField || null)
      for (const f of resolvedCardFields?.cardFields || []) addIfLinked(f)
      addIfLinked(resolvedGroupByField as any)

      if (wanted.size === 0) {
        setLinkedValueLabelMaps((prev) => (Object.keys(prev).length === 0 ? prev : {}))
        return
      }

      const next: Record<string, Record<string, string>> = {}
      for (const f of wanted.values()) {
        const ids = new Set<string>()
        for (const row of Array.isArray(filteredRows) ? filteredRows : []) {
          for (const id of collectIds((row as any)?.data?.[f.name])) ids.add(id)
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

  // Resolve wrap title setting
  const wrapTitle = useMemo(() => {
    return wrapTitleProp !== undefined 
      ? wrapTitleProp 
      : blockConfig?.timeline_wrap_title || 
        blockConfig?.card_wrap_title || 
        blockConfig?.appearance?.timeline_wrap_title ||
        blockConfig?.appearance?.card_wrap_title ||
        false
  }, [wrapTitleProp, blockConfig])

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
        let groupValue: string | null = null
        if (resolvedGroupByField) {
          const groupFieldName = resolvedGroupByField.name
          const groupFieldValue = row.data[groupFieldName]
          
          if (groupFieldValue) {
            // Normalize common value shapes to a stable string label.
            // - arrays: take first value (e.g. multi_select, link_to_table)
            // - Dates: stringify (ISO or existing string)
            // - objects: JSON stringify fallback (rare)
            if (Array.isArray(groupFieldValue)) {
              const first = groupFieldValue.length > 0 ? groupFieldValue[0] : null
              const id = first && typeof first === "object" && "id" in (first as any) ? String((first as any).id) : String(first ?? "")
              groupValue =
                resolvedGroupByField.type === "link_to_table" && id.trim()
                  ? linkedValueLabelMaps[groupFieldName]?.[id.trim()] ?? id
                  : id
            } else if (groupFieldValue instanceof Date) {
              groupValue = isNaN(groupFieldValue.getTime()) ? '' : groupFieldValue.toISOString()
            } else if (typeof groupFieldValue === 'object') {
              if (resolvedGroupByField.type === "link_to_table" && groupFieldValue && "id" in (groupFieldValue as any)) {
                const id = String((groupFieldValue as any).id ?? "").trim()
                groupValue = id ? (linkedValueLabelMaps[groupFieldName]?.[id] ?? id) : ""
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
                  ? linkedValueLabelMaps[groupFieldName]?.[id.trim()] ?? id
                  : id
            }
            if (groupValue !== null) groupValue = groupValue.trim()
          }
        }

        // Get image from image field
        let image: string | undefined = undefined
        if (imageField) {
          const imageValue = row.data[imageField]
          if (imageValue) {
            // Handle attachment field (array of URLs) or URL field (single URL)
            if (Array.isArray(imageValue) && imageValue.length > 0) {
              image = imageValue[0]
            } else if (typeof imageValue === 'string' && (imageValue.startsWith('http') || imageValue.startsWith('/'))) {
              image = imageValue
            }
          }
        }

        return {
          id: row.id,
          rowId: row.id,
          title,
          start,
          end,
          rowData: row.data,
          color,
          image,
          groupValue,
        }
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime())
  }, [filteredRows, startDateFieldId, endDateFieldId, dateFieldId, fieldIds, tableFields, optimisticUpdates, resolvedColorField, resolvedDateFields, imageField, resolvedCardFields, resolvedGroupByField])

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

  // Group events by group field if configured
  const groupedEvents = useMemo(() => {
    if (!resolvedGroupByField) {
      // No grouping - return single group
      return { '': visibleEvents }
    }

    const groups: Record<string, TimelineEvent[]> = {}
    
    visibleEvents.forEach(event => {
      const groupKey = event.groupValue || 'Unassigned'
      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(event)
    })

    // Sort groups by field options order if available (single/multi select)
    if (
      (resolvedGroupByField.type === 'single_select' || resolvedGroupByField.type === 'multi_select') &&
      resolvedGroupByField.options?.choices
    ) {
      const sortedGroups: Record<string, TimelineEvent[]> = {}
      const choices = resolvedGroupByField.options.choices
      
      // Add groups in choice order
      choices.forEach(choice => {
        if (groups[choice]) {
          sortedGroups[choice] = groups[choice]
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

  // Calculate row size spacing
  const rowSizeSpacing = useMemo(() => {
    const rowSizeValue = blockConfig?.appearance?.row_height || rowSize || 'medium'
    switch (rowSizeValue) {
      case 'compact':
        return { cardPadding: 'p-1.5', laneSpacing: 'mb-2', cardHeight: 'h-8' }
      case 'comfortable':
        return { cardPadding: 'p-3', laneSpacing: 'mb-6', cardHeight: 'h-16' }
      default: // medium
        return { cardPadding: 'p-2', laneSpacing: 'mb-4', cardHeight: 'h-10' }
    }
  }, [blockConfig, rowSize])

  // Absolute-positioned cards do NOT contribute to parent height.
  // Compute consistent pixel metrics so lanes reserve enough space and don't overlap.
  const laneLayout = useMemo(() => {
    const cardHeightPx =
      rowSizeSpacing.cardHeight === 'h-8' ? 32 : rowSizeSpacing.cardHeight === 'h-16' ? 64 : 40
    const stackGapPx =
      rowSizeSpacing.cardHeight === 'h-8' ? 50 : rowSizeSpacing.cardHeight === 'h-16' ? 90 : 70
    return { cardHeightPx, stackGapPx }
  }, [rowSizeSpacing.cardHeight])

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
    openRecord(tableId, rowId, supabaseTableName, (blockConfig as any)?.modal_fields)
  }, [blockConfig, onRecordClick, openRecord, supabaseTableName, tableId])

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
                let groupColor: string | undefined = undefined
                if (groupKey !== 'Unassigned' && resolvedGroupByField.options) {
                  // Type assertion: resolvedGroupByField is already filtered to be single_select or multi_select
                  const fieldType = (resolvedGroupByField.type === 'single_select' || resolvedGroupByField.type === 'multi_select')
                    ? resolvedGroupByField.type as 'single_select' | 'multi_select'
                    : 'single_select' as const // Fallback (shouldn't happen due to filtering)
                  const hexColor = resolveChoiceColor(
                    groupKey,
                    fieldType,
                    resolvedGroupByField.options,
                    resolvedGroupByField.type === 'single_select'
                  )
                  groupColor = normalizeHexColor(hexColor)
                }

                return (
                  <div key={groupKey} className={rowSizeSpacing.laneSpacing}>
                    {/* Group header */}
                    <div className="sticky top-12 bg-white z-5 border-b border-gray-200 pb-1 mb-2">
                      <div className="flex items-center gap-2">
                        {groupColor && (
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: groupColor }}
                          />
                        )}
                        <span className="text-xs font-medium text-gray-700">{groupLabel}</span>
                        <span className="text-xs text-gray-400">({groupEvents.length})</span>
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
                        const isDragging = draggingEvent === event.id
                        const isResizing = resizingEvent?.id === event.id
                        
                        return (
                          <div
                            key={event.id}
                            className="absolute group"
                            style={{
                              left: `${left}px`,
                              width: `${width}px`,
                              top: `${eventIndex * laneLayout.stackGapPx}px`,
                            }}
                          >
                            <Card
                              className={`${rowSizeSpacing.cardHeight} shadow-sm hover:shadow-md transition-shadow ${
                                event.color ? `border-l-4` : ""
                              } ${isDragging || isResizing ? 'opacity-75' : ''} ${
                                draggingEvent || resizingEvent ? 'cursor-grabbing' : 'cursor-pointer'
                              } ${selectedEventId === event.rowId ? 'ring-1 ring-blue-400/40' : ''}`}
                              style={{
                                borderLeftColor: event.color,
                                backgroundColor: event.color ? `${event.color}15` : "white",
                              }}
                              onMouseDown={(e) => handleDragStart(event, e)}
                              onClick={(e) => handleEventSelect(event, e)}
                            >
                              <CardContent className={`${rowSizeSpacing.cardPadding} h-full flex flex-col relative gap-1`}>
                                {/* Image if configured */}
                                {event.image && (
                                  <div className={`flex-shrink-0 w-6 h-6 rounded overflow-hidden bg-gray-100 ${fitImageSize ? 'object-contain' : 'object-cover'}`}>
                                    <img
                                      src={event.image}
                                      alt=""
                                      className={`w-full h-full ${fitImageSize ? 'object-contain' : 'object-cover'}`}
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none'
                                      }}
                                    />
                                  </div>
                                )}
                                
                                {/* Resize handle - left */}
                                <div
                                  className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-blue-300/50 opacity-0 group-hover:opacity-100 transition-opacity z-10 rounded-l"
                                  onMouseDown={(e) => handleResizeStart(event, 'start', e)}
                                  style={{ marginLeft: '-3px' }}
                                  title="Drag to resize start date"
                                  data-timeline-resize="true"
                                />
                                
                                {/* Title */}
                                {/* NOTE: Don't use flex-1 here; it can consume all height and hide field values below. */}
                                <div className={`text-xs font-medium leading-tight ${wrapTitle ? 'break-words' : 'truncate'}`}>
                                  {event.title}
                                </div>

                                {/* Card fields */}
                                {resolvedCardFields.cardFields.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {resolvedCardFields.cardFields.slice(0, 3).map((field) => {
                                      const value = event.rowData[field.name]
                                      return (
                                        <TimelineFieldValue
                                          key={field.id}
                                          field={field}
                                          value={value}
                                          valueLabelMap={linkedValueLabelMaps[field.name] || linkedValueLabelMaps[field.id]}
                                          compact={true}
                                        />
                                      )
                                    })}
                                  </div>
                                )}
                                
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
                  </div>
                )
              })
            ) : (
              // Render ungrouped events
              visibleEvents.map((event, index) => {
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
                      top: `${index * laneLayout.stackGapPx}px`,
                    }}
                  >
                    <Card
                      className={`${rowSizeSpacing.cardHeight} shadow-sm hover:shadow-md transition-shadow ${
                        event.color ? `border-l-4` : ""
                      } ${isDragging || isResizing ? 'opacity-75' : ''} ${
                        draggingEvent || resizingEvent ? 'cursor-grabbing' : 'cursor-pointer'
                      } ${selectedEventId === event.rowId ? 'ring-1 ring-blue-400/40' : ''}`}
                      style={{
                        borderLeftColor: event.color,
                        backgroundColor: event.color ? `${event.color}15` : "white",
                      }}
                      onMouseDown={(e) => handleDragStart(event, e)}
                      onClick={(e) => handleEventSelect(event, e)}
                    >
                      <CardContent className={`${rowSizeSpacing.cardPadding} h-full flex flex-col relative gap-1`}>
                        {/* Image if configured */}
                        {event.image && (
                          <div className={`flex-shrink-0 w-6 h-6 rounded overflow-hidden bg-gray-100 ${fitImageSize ? 'object-contain' : 'object-cover'}`}>
                            <img
                              src={event.image}
                              alt=""
                              className={`w-full h-full ${fitImageSize ? 'object-contain' : 'object-cover'}`}
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none'
                              }}
                            />
                          </div>
                        )}
                        
                        {/* Resize handle - left */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-blue-300/50 opacity-0 group-hover:opacity-100 transition-opacity z-10 rounded-l"
                          onMouseDown={(e) => handleResizeStart(event, 'start', e)}
                          style={{ marginLeft: '-3px' }}
                          title="Drag to resize start date"
                          data-timeline-resize="true"
                        />
                        
                        {/* Title */}
                        {/* NOTE: Don't use flex-1 here; it can consume all height and hide field values below. */}
                        <div className={`text-xs font-medium leading-tight ${wrapTitle ? 'break-words' : 'truncate'}`}>
                          {event.title}
                        </div>

                        {/* Card fields */}
                        {resolvedCardFields.cardFields.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {resolvedCardFields.cardFields.slice(0, 3).map((field) => {
                              const value = event.rowData[field.name]
                              return (
                                <TimelineFieldValue
                                  key={field.id}
                                  field={field}
                                  value={value}
                                  valueLabelMap={linkedValueLabelMaps[field.name] || linkedValueLabelMaps[field.id]}
                                  compact={true}
                                />
                              )
                            })}
                          </div>
                        )}
                        
                        {/* Resize handle - right */}
                        <div
                          className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-blue-300/50 opacity-0 group-hover:opacity-100 transition-opacity z-10 rounded-r"
                          onMouseDown={(e) => handleResizeStart(event, 'end', e)}
                          style={{ marginRight: '-3px' }}
                          title="Drag to resize end date"
                          data-timeline-resize="true"
                        />
                      </CardContent>
                    </Card>
                  </div>
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


