"use client"

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import { filterRowsBySearch } from "@/lib/search/filterRows"
import { resolveChoiceColor, normalizeHexColor, getTextColorForBackground, SEMANTIC_COLORS } from '@/lib/field-colors'
import { formatDateUK } from "@/lib/utils"
import type { TableField } from "@/types/fields"
import { renderPill, renderPills } from "@/lib/ui/pills"
import { sortLabelsByManualOrder } from "@/lib/fields/select-options"
import { applyFiltersToQuery, deriveDefaultValuesFromFilters, type FilterConfig, normalizeFilter } from "@/lib/interface/filters"
import { sortRowsByFieldType, shouldUseClientSideSorting, type ViewSort } from "@/lib/sorting/fieldTypeAwareSort"
import type { FilterType } from "@/types/database"
import { ChevronDown, ChevronRight, Filter, Group, MapPin, MoreHorizontal, Plus, Database } from "lucide-react"
import { useIsMobile } from "@/hooks/useResponsive"
import { Button } from "@/components/ui/button"
import EmptyState from "@/components/empty-states/EmptyState"
import RecordModal from "@/components/calendar/RecordModal"
import GroupDialog from "@/components/grid/GroupDialog"
import FilterDialog from "@/components/grid/FilterDialog"
import { toPostgrestColumn } from "@/lib/supabase/postgrest"
import { buildGroupTree, flattenGroupTree } from "@/lib/grouping/groupTree"
import type { GroupRule } from "@/lib/grouping/types"
import { isAbortError } from "@/lib/api/error-handling"
import type { LinkedField } from "@/types/fields"
import { getLinkedFieldValueFromRow, linkedValueToIds, resolveLinkedFieldDisplayMap } from "@/lib/dataView/linkedFields"
import { normalizeUuid } from "@/lib/utils/ids"
import { isUserField, getUserDisplayNames } from "@/lib/users/userDisplay"
import type { HighlightRule } from "@/lib/interface/types"
import { evaluateHighlightRules, getFormattingStyle } from "@/lib/conditional-formatting/evaluator"
import { getFieldDisplayName } from "@/lib/fields/display"

// PostgREST expects unquoted identifiers in order clauses; see `lib/supabase/postgrest`.

interface ListViewProps {
  tableId: string
  viewId?: string
  supabaseTableName: string
  tableFields: TableField[]
  filters?: FilterConfig[]
  sorts?: Array<{ field_name: string; direction: 'asc' | 'desc' }>
  groupBy?: string
  /** Nested grouping rules (preferred). If omitted, falls back to `groupBy`. */
  groupByRules?: GroupRule[]
  /** When grouping, should groups start collapsed? Default: true (closed). */
  defaultChoiceGroupsCollapsed?: boolean
  searchQuery?: string
  onRecordClick?: (recordId: string) => void
  // Creation controls (wired from block settings)
  showAddRecord?: boolean
  canCreateRecord?: boolean
  // List-specific field configuration
  titleField?: string // Required: field name for title
  subtitleFields?: string[] // Optional: up to 3 subtitle fields
  imageField?: string // Optional: field name for image/attachment
  pillFields?: string[] // Optional: select/multi-select fields to show as pills
  metaFields?: string[] // Optional: date, number, etc. for metadata
  modalFields?: string[] // Optional: fields to show in record modal (empty = show all)
  // Callbacks for block config updates (when not using views)
  onGroupByChange?: (fieldName: string | null) => void
  onFiltersChange?: (filters: FilterConfig[]) => void
  /** Optional external trigger to reload rows (e.g. after create in a parent block). */
  reloadKey?: any
  /** Callback when block content height changes (for grouped blocks) */
  onHeightChange?: (height: number) => void
  /** Row height in pixels (for height calculation) */
  rowHeight?: number
  /** Conditional formatting rules */
  highlightRules?: HighlightRule[]
  /** Optional: when provided, permission flags are applied in RecordModal. */
  cascadeContext?: { pageConfig?: any; blockConfig?: any } | null
  /** Interface mode: 'view' | 'edit'. When 'edit', record panel opens editable (Airtable-style). */
  interfaceMode?: 'view' | 'edit'
  /** Called when a record is deleted from RecordPanel; use to refresh core data. */
  onRecordDeleted?: () => void
}

export default function ListView({
  tableId,
  viewId,
  supabaseTableName,
  tableFields,
  filters = [],
  sorts = [],
  groupBy,
  groupByRules,
  defaultChoiceGroupsCollapsed = true,
  searchQuery = "",
  onRecordClick,
  showAddRecord = false,
  canCreateRecord = false,
  titleField,
  subtitleFields = [],
  imageField,
  pillFields = [],
  metaFields = [],
  modalFields,
  onGroupByChange,
  onFiltersChange,
  reloadKey,
  onHeightChange,
  rowHeight = 30,
  highlightRules = [],
  cascadeContext,
  interfaceMode = 'view',
  onRecordDeleted,
}: ListViewProps) {
  const { openRecord } = useRecordPanel()
  const isMobile = useIsMobile()
  const viewUuid = useMemo(() => normalizeUuid(viewId), [viewId])
  const [rows, setRows] = useState<Record<string, any>[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const prevGroupByRef = useRef<string | undefined>(undefined)
  const didInitChoiceGroupCollapseRef = useRef(false)
  // Ref for measuring content height
  const contentRef = useRef<HTMLDivElement>(null)
  const [tableName, setTableName] = useState<string | null>(null)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [filterDialogOpen, setFilterDialogOpen] = useState(false)
  const [currentGroupBy, setCurrentGroupBy] = useState<string | undefined>(groupBy)
  const [currentFilters, setCurrentFilters] = useState<FilterConfig[]>(() =>
    Array.isArray(filters) ? filters.map((f) => normalizeFilter(f as Parameters<typeof normalizeFilter>[0])) : []
  )
  const [groupValueLabelMaps, setGroupValueLabelMaps] = useState<Record<string, Record<string, string>>>({})
  const [userDisplayNames, setUserDisplayNames] = useState<Map<string, string>>(new Map())

  // Create flow: open modal first; only insert on Save inside modal.
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createInitialData, setCreateInitialData] = useState<Record<string, any> | null>(null)

  // CRITICAL: Prevent infinite retry loops
  const loadingRowsRef = useRef(false)
  const consecutiveFailuresRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const MAX_CONSECUTIVE_FAILURES = 3
  const RETRY_DELAY_MS = 2000 // 2 seconds

  // Load table name for record panel
  useEffect(() => {
    if (tableId && !tableName) {
      const loadTableName = async () => {
        const supabase = createClient()
        const { data } = await supabase
          .from("tables")
          .select("name, supabase_table")
          .eq("id", tableId)
          .single()
        if (data) {
          setTableName(data.supabase_table)
        }
      }
      loadTableName()
    }
  }, [tableId, tableName])

  const handleOpenRecord = useCallback((recordId: string) => {
    if (onRecordClick) {
      onRecordClick(recordId)
      return
    }
    const effectiveTableName = tableName || supabaseTableName
    if (tableId && effectiveTableName) {
      openRecord(tableId, recordId, effectiveTableName, undefined, undefined, cascadeContext ?? undefined, interfaceMode, onRecordDeleted)
    }
  }, [onRecordClick, openRecord, supabaseTableName, tableId, tableName, cascadeContext, interfaceMode, onRecordDeleted])

  // Update currentGroupBy when groupBy prop changes
  useEffect(() => {
    setCurrentGroupBy(groupBy)
  }, [groupBy])

  // Update currentFilters when filters prop changes
  // CRITICAL: Memoize filters to prevent unnecessary re-renders
  const filtersKey = useMemo(() => {
    return JSON.stringify(filters.map(f => ({
      field: f.field,
      operator: f.operator,
      value: f.value,
      value2: f.value2,
    })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))
  }, [filters])

  // CRITICAL: Memoize sorts to prevent unnecessary re-renders
  const sortsKey = useMemo(() => {
    return JSON.stringify(sorts.map(s => ({
      field_name: s.field_name,
      direction: s.direction,
    })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))
  }, [sorts])

  // Key from currentFilters so load-rows effect runs when user saves in filter dialog (local state update)
  const currentFiltersKey = useMemo(() => {
    return JSON.stringify(currentFilters.map(f => ({
      field: f.field,
      operator: f.operator,
      value: f.value,
      value2: f.value2,
    })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))
  }, [currentFilters])

  useEffect(() => {
    setCurrentFilters(filters)
  }, [filtersKey, filters])

  // Load rows
  useEffect(() => {
    // CRITICAL: Prevent concurrent loads and infinite retry loops
    if (loadingRowsRef.current) {
      return
    }

    // Reset failure count when dependencies change (new query)
    consecutiveFailuresRef.current = 0

    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    loadRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, supabaseTableName, filtersKey, currentFiltersKey, sortsKey, reloadKey])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  async function loadRows() {
    // CRITICAL: Prevent concurrent loads
    if (loadingRowsRef.current) {
      return
    }

    // CRITICAL: Stop retrying after too many failures
    if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
      console.warn(`[ListView] Stopping retries after ${MAX_CONSECUTIVE_FAILURES} consecutive failures`)
      return
    }

    if (!supabaseTableName) {
      setRows([])
      setLoading(false)
      return
    }

    loadingRowsRef.current = true
    setLoading(true)

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController()

    try {
      const supabase = createClient()
      let query = supabase.from(supabaseTableName).select("*")

      // Apply filters using shared unified filter engine (includes date operators)
      if (currentFilters.length > 0) {
        const normalizedFields = tableFields.map((f) => ({
          name: f.name,
          type: f.type,
          id: f.id,
          options: (f as any).options,
        }))
        query = applyFiltersToQuery(query, currentFilters, normalizedFields)
      }

      // Check if we need client-side sorting (for select fields that sort by sort_index)
      const needsClientSideSort = shouldUseClientSideSorting(
        sorts.map(s => ({ field_name: s.field_name, direction: s.direction as 'asc' | 'desc' })),
        tableFields
      )

      // Apply sorting
      if (sorts.length > 0 && !needsClientSideSort) {
        // Chain multiple .order() calls for multi-column sort (Supabase/PostgREST supports this)
        sorts.forEach((sort) => {
          const col = toPostgrestColumn(sort.field_name)
          if (!col) {
            console.warn('[ListView] Skipping sort on invalid column:', sort.field_name)
            return
          }
          query = query.order(col, { ascending: sort.direction === 'asc' })
        })
      } else if (sorts.length === 0) {
        query = query.order('created_at', { ascending: false })
      }

      // Explicit limit so we don't rely on Supabase default (often 20–30); show all rows up to a safe cap
      const ROWS_LIMIT = 2000
      query = query.limit(ROWS_LIMIT)

      const { data, error } = await query

      if (error) {
        if (isAbortError(error)) {
          loadingRowsRef.current = false
          return
        }
        console.error("Error loading rows:", error)
        consecutiveFailuresRef.current += 1
        
        // Only clear rows if we haven't loaded any yet (preserve existing data on error)
        // Don't clear rows - preserve existing data to prevent flashing

        // Don't retry automatically - let the user refresh or fix the issue
        // The effect will retry when dependencies change
      } else {
        // Success - reset failure count
        consecutiveFailuresRef.current = 0
        
        // Apply client-side sorting if needed (for select fields that sort by sort_index)
        let rowsData = data || []
        if (needsClientSideSort && sorts.length > 0) {
          rowsData = await sortRowsByFieldType(
            rowsData,
            sorts.map(s => ({ field_name: s.field_name, direction: s.direction as 'asc' | 'desc' })),
            tableFields
          )
        }
        
        setRows(rowsData)
        
        // Fetch user display names for user fields in loaded rows
        if (data && data.length > 0) {
          const userIds = new Set<string>()
          tableFields.forEach((field) => {
            if (isUserField(field.name)) {
              data.forEach((row) => {
                const userId = row[field.name]
                if (userId && typeof userId === "string") {
                  userIds.add(userId)
                }
              })
            }
          })
          
          if (userIds.size > 0) {
            getUserDisplayNames(Array.from(userIds)).then(setUserDisplayNames).catch(() => {
              // Fail gracefully
            })
          }
        }
      }
    } catch (error) {
      if (isAbortError(error)) {
        loadingRowsRef.current = false
        return
      }
      console.error("Error loading rows:", error)
      consecutiveFailuresRef.current += 1
      
      // Don't clear rows - preserve existing data to prevent flashing
    } finally {
      setLoading(false)
      loadingRowsRef.current = false
      abortControllerRef.current = null
    }
  }

  // Filter rows by search query
  const filteredRows = useMemo(() => {
    if (!searchQuery || !tableFields.length) return rows

    const fieldIds = tableFields.map(f => f.name)
    return filterRowsBySearch(rows, tableFields, searchQuery, fieldIds)
  }, [rows, tableFields, searchQuery])

  const effectiveGroupRules = useMemo<GroupRule[]>(() => {
    const safe = Array.isArray(groupByRules) ? groupByRules.filter(Boolean) : []
    if (safe.length > 0) return safe
    if (currentGroupBy && typeof currentGroupBy === 'string' && currentGroupBy.trim()) {
      return [{ type: 'field', field: currentGroupBy.trim() }]
    }
    return []
  }, [currentGroupBy, groupByRules])

  const groupModel = useMemo(() => {
    if (effectiveGroupRules.length === 0) return null
    return buildGroupTree(filteredRows, tableFields, effectiveGroupRules, {
      emptyLabel: '(Empty)',
      emptyLast: true,
      valueLabelMaps: groupValueLabelMaps,
    })
  }, [effectiveGroupRules, filteredRows, tableFields, groupValueLabelMaps])

  // Resolve grouping labels for linked record fields (link_to_table).
  useEffect(() => {
    let cancelled = false

    async function load() {
      const rules = Array.isArray(effectiveGroupRules) ? effectiveGroupRules : []
      if (rules.length === 0) {
        setGroupValueLabelMaps({})
        return
      }

      const safeFields = Array.isArray(tableFields) ? tableFields : []
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
        for (const row of Array.isArray(filteredRows) ? filteredRows : []) {
          const fieldValue = getLinkedFieldValueFromRow(row as Record<string, unknown>, f)
          for (const id of linkedValueToIds(fieldValue)) ids.add(id)
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
  }, [effectiveGroupRules, filteredRows, tableFields])

  const flattenedGroups = useMemo(() => {
    if (!groupModel || groupModel.rootGroups.length === 0) return null
    return flattenGroupTree(groupModel.rootGroups, collapsedGroups)
  }, [collapsedGroups, groupModel])

  const groupPathMap = useMemo(() => {
    const map = new Map<string, any[]>()
    if (!groupModel) return map
    const walk = (node: any, ancestors: any[]) => {
      const next = [...ancestors, node]
      map.set(String(node.pathKey), next)
      const children = Array.isArray(node.children) ? node.children : []
      children.forEach((c: any) => walk(c, next))
    }
    const roots = Array.isArray(groupModel.rootGroups) ? groupModel.rootGroups : []
    roots.forEach((g) => walk(g, []))
    return map
  }, [groupModel])

  // When grouping, allow "start collapsed" behavior (default: collapsed).
  // This is intentionally applied only on initial load / when the groupBy field changes / when the setting flips,
  // so we don't override the user's manual expand/collapse interactions mid-session.
  useEffect(() => {
    const groupByChanged = prevGroupByRef.current !== currentGroupBy
    prevGroupByRef.current = currentGroupBy

    if (groupByChanged) {
      didInitChoiceGroupCollapseRef.current = false
      setCollapsedGroups(new Set())
    }

    // No grouping: always open (nothing to collapse)
    if (effectiveGroupRules.length === 0) {
      didInitChoiceGroupCollapseRef.current = false
      return
    }

    // If the setting is "open", force-expand (clear collapsed set).
    if (!defaultChoiceGroupsCollapsed) {
      didInitChoiceGroupCollapseRef.current = false
      setCollapsedGroups(new Set())
      return
    }

    // Setting is "closed": collapse all groups once, when we have keys.
    if (didInitChoiceGroupCollapseRef.current) return
    const top = groupModel?.rootGroups || []
    if (top.length === 0) return
    setCollapsedGroups(new Set(top.map((n) => n.pathKey)))
    didInitChoiceGroupCollapseRef.current = true
  }, [currentGroupBy, defaultChoiceGroupsCollapsed, effectiveGroupRules.length, groupModel?.rootGroups])

  // Measure content height when grouping changes (expand/collapse or enable/disable)
  // Only trigger on group state changes, not on data refresh, inline editing, etc.
  // Enhanced with better measurement accuracy and max height cap
  useEffect(() => {
    if (!onHeightChange || !contentRef.current) return
    
    const isGrouped = effectiveGroupRules.length > 0
    if (!isGrouped) return // No grouping, skip measurement

    // Debounce measurement to avoid excessive updates
    const timeoutId = setTimeout(() => {
      if (!contentRef.current) return
      
      // Get computed styles to account for padding and margins
      const computedStyle = window.getComputedStyle(contentRef.current)
      const paddingTop = parseFloat(computedStyle.paddingTop) || 0
      const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0
      const marginTop = parseFloat(computedStyle.marginTop) || 0
      const marginBottom = parseFloat(computedStyle.marginBottom) || 0
      
      // Measure the actual scroll height of the content
      const pixelHeight = contentRef.current.scrollHeight || contentRef.current.clientHeight || 0
      
      // Add padding and margins to total height
      const totalPixelHeight = pixelHeight + paddingTop + paddingBottom + marginTop + marginBottom
      
      // Convert to grid units (round up to ensure content fits)
      const heightInGridUnits = Math.ceil(totalPixelHeight / rowHeight)
      
      // Apply min and max constraints (max: 50 grid units)
      const finalHeight = Math.max(2, Math.min(heightInGridUnits, 50))
      
      onHeightChange(finalHeight)
    }, 100) // Small debounce to allow DOM to update

    return () => clearTimeout(timeoutId)
  }, [collapsedGroups, effectiveGroupRules.length, currentGroupBy, onHeightChange, rowHeight])

  // Handle group change
  const handleGroupChange = useCallback(async (fieldName: string | null) => {
    setCurrentGroupBy(fieldName || undefined)
    
    // If callback provided (block config), use it
    if (onGroupByChange) {
      onGroupByChange(fieldName)
      return
    }
    
    // Otherwise, try to save to view config if viewId exists
    if (!viewUuid) {
      return
    }

    try {
      const supabase = createClient()
      const groupByValue = fieldName || null

      // Update view config
      const { data: viewData } = await supabase
        .from("views")
        .select("config")
        .eq("id", viewUuid)
        .single()

      if (viewData) {
        const config = (viewData.config as Record<string, any>) || {}
        config.groupBy = groupByValue

        await supabase
          .from("views")
          .update({ config })
          .eq("id", viewUuid)
      }
    } catch (error) {
      console.error("Error saving group setting:", error)
    }
  }, [viewUuid, onGroupByChange])

  // Handle filters change
  const handleFiltersChange = useCallback((newFilters: Array<{ id?: string; field_name: string; operator: any; value?: string }>) => {
    const filterConfigs: FilterConfig[] = newFilters.map(f => ({
      field: f.field_name,
      operator: f.operator,
      value: f.value || '',
    }))
    setCurrentFilters(filterConfigs)
    
    // If callback provided (block config), use it
    if (onFiltersChange) {
      onFiltersChange(filterConfigs)
    }
  }, [onFiltersChange])

  // Helper to get image from image field
  const getRowValue = useCallback(
    (row: Record<string, any>, fieldNameOrId?: string | null) => {
      if (!fieldNameOrId) return null
      const f = tableFields.find((tf) => tf.name === fieldNameOrId || tf.id === fieldNameOrId)
      const key = f?.name || fieldNameOrId
      return row?.[key] ?? null
    },
    [tableFields]
  )

  const getImageUrlFromValue = useCallback((imageValue: any): string | null => {
    if (!imageValue) return null

    // Handle attachment field (array of URLs/objects) or URL field (single URL)
    if (Array.isArray(imageValue) && imageValue.length > 0) {
      const firstItem = imageValue[0]
      if (typeof firstItem === 'string') {
        return firstItem
      }
      if (typeof firstItem === 'object' && firstItem?.url) {
        return firstItem.url
      }
    }
    if (typeof imageValue === 'string' && (imageValue.startsWith('http') || imageValue.startsWith('/'))) {
      return imageValue
    }

    return null
  }, [])

  // Helper to format field value for display
  const formatFieldValue = useCallback((field: TableField, value: any): string => {
    if (value === null || value === undefined || value === '') {
      return '—'
    }

    // Check if this is a user field and we have a display name cached
    if (isUserField(field.name) && typeof value === "string") {
      const displayName = userDisplayNames.get(value)
      if (displayName) {
        return displayName
      }
      // Fall through to default if name not loaded yet
    }

    switch (field.type) {
      case 'date':
        return formatDateUK(value)
      case 'number':
      case 'percent':
      case 'currency':
        return String(value)
      case 'checkbox':
        return value ? 'Yes' : 'No'
      case 'single_select':
      case 'multi_select':
        if (Array.isArray(value)) {
          return value.join(', ')
        }
        return String(value)
      case 'attachment':
        if (Array.isArray(value)) {
          return `${value.length} file${value.length !== 1 ? 's' : ''}`
        }
        return '—'
      default:
        return String(value)
    }
  }, [userDisplayNames])

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

  const handleAddRecordToGroup = useCallback(async (groupKey: string) => {
    if (!showAddRecord || !canCreateRecord) return
    if (!supabaseTableName || !tableId) return
    if (effectiveGroupRules.length === 0) return

    try {
      const newData: Record<string, any> = {}

      const defaultsFromFilters = deriveDefaultValuesFromFilters(filters, tableFields)
      if (Object.keys(defaultsFromFilters).length > 0) {
        Object.assign(newData, defaultsFromFilters)
      }

      const chain = groupPathMap.get(groupKey as any) || []
      for (const node of chain as any[]) {
        const rule = (node as any).rule as GroupRule
        if (rule.type === 'field') {
          // For "(Empty)" groups, store null so the record lands in the empty bucket.
          if ((node as any).key === '(Empty)') {
            newData[rule.field] = null
          } else {
            // Checkbox buckets use keys "true"/"false"
            const field = tableFields.find((f) => f.name === rule.field || f.id === rule.field)
            if (field?.type === 'checkbox') {
              newData[rule.field] = String((node as any).key) === 'true'
            } else {
              newData[rule.field] = (node as any).key
            }
          }
        } else if (rule.type === 'date') {
          if ((node as any).key === '(Empty)') {
            newData[rule.field] = null
          } else if (rule.granularity === 'year') {
            const y = String((node as any).key)
            newData[rule.field] = /^\d{4}$/.test(y) ? `${y}-01-01` : null
          } else {
            const ym = String((node as any).key)
            newData[rule.field] = /^\d{4}-\d{2}$/.test(ym) ? `${ym}-01` : null
          }
        }
      }
      // Do NOT insert yet — open the modal with pre-filled data.
      setCreateInitialData(newData)
      setCreateModalOpen(true)
    } catch (error) {
      console.error('Failed to create record:', error)
      alert('Failed to create record. Please try again.')
    }
  }, [showAddRecord, canCreateRecord, supabaseTableName, tableId, effectiveGroupRules.length, groupPathMap, tableFields, filters])

  const handleOpenCreateModal = useCallback(() => {
    if (!showAddRecord || !canCreateRecord || !tableId || !supabaseTableName) return
    const defaultsFromFilters = deriveDefaultValuesFromFilters(filters, tableFields)
    const initial = Object.keys(defaultsFromFilters).length > 0 ? defaultsFromFilters : {}
    setCreateInitialData(initial)
    setCreateModalOpen(true)
  }, [showAddRecord, canCreateRecord, tableId, supabaseTableName, filters, tableFields])

  const createRecordModal = (
    <RecordModal
      open={createModalOpen}
      onClose={() => {
        setCreateModalOpen(false)
        setCreateInitialData(null)
      }}
      tableId={tableId}
      recordId={null}
      tableFields={Array.isArray(tableFields) ? tableFields : []}
      modalFields={modalFields}
      initialData={createInitialData || undefined}
      onSave={async () => {
        await loadRows()
        setCreateModalOpen(false)
        setCreateInitialData(null)
      }}
      supabaseTableName={supabaseTableName}
      cascadeContext={cascadeContext}
    />
  )

  // Render a list item
  const renderListItem = useCallback((row: Record<string, any>) => {
    const recordId = row.id

    // Get title field
    const titleFieldObj = tableFields.find(f => f.name === titleField || f.id === titleField)
    const titleRaw = titleFieldObj ? row?.[titleFieldObj.name] : null
    const titleText = titleFieldObj ? formatFieldValue(titleFieldObj, titleRaw) : 'Untitled'

    // Get image
    const imageRaw = imageField ? getRowValue(row, imageField) : null
    const imageUrl = imageField ? getImageUrlFromValue(imageRaw) : null

    // Subtitle mapping (to match card style)
    const descriptionKey = subtitleFields?.[0]
    const locationKey = subtitleFields?.[1]
    const extraSubtitleKeys = (subtitleFields || []).slice(2, 3)

    const descriptionField = descriptionKey ? tableFields.find((f) => f.name === descriptionKey || f.id === descriptionKey) : null
    const locationField = locationKey ? tableFields.find((f) => f.name === locationKey || f.id === locationKey) : null
    const descriptionText = descriptionField ? formatFieldValue(descriptionField, row?.[descriptionField.name]) : ''
    const locationText = locationField ? formatFieldValue(locationField, row?.[locationField.name]) : ''

    const extraSubtitle = extraSubtitleKeys
      .map((k) => {
        const f = tableFields.find((tf) => tf.name === k || tf.id === k)
        if (!f) return null
        const t = formatFieldValue(f, row?.[f.name])
        if (!t || t === '—') return null
        return { key: k, label: f.name, text: t }
      })
      .filter(Boolean) as Array<{ key: string; label: string; text: string }>

    // Evaluate conditional formatting rules
    const matchingRule = highlightRules && highlightRules.length > 0
      ? evaluateHighlightRules(highlightRules, row, tableFields)
      : null
    
    // Get formatting style for row-level rules
    const rowFormattingStyle = matchingRule && matchingRule.scope !== 'cell'
      ? getFormattingStyle(matchingRule)
      : {}

    return (
      <div
        key={recordId}
        onClick={() => setSelectedRecordId(String(recordId))}
        onDoubleClick={() => handleOpenRecord(String(recordId))}
        className={`group touch-manipulation cursor-default rounded-xl border bg-white shadow-sm transition-all ${
          selectedRecordId === String(recordId)
            ? "border-blue-200 ring-2 ring-blue-100"
            : "border-gray-200 hover:border-gray-300 hover:shadow-md active:shadow-sm"
        }`}
        style={rowFormattingStyle}
      >
        <div className={`flex items-start gap-4 ${isMobile ? 'p-3' : 'p-4'}`}>
          {/* Thumbnail (always reserved, matches card style) */}
          <div className={`flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 ${isMobile ? 'w-14 h-14' : 'w-20 h-20'}`}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className={`font-semibold text-gray-900 ${isMobile ? 'text-sm' : 'text-base'} leading-snug line-clamp-2`}>
                  {titleText && titleText !== '—' ? titleText : 'Untitled'}
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleOpenRecord(String(recordId))
                }}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                title="Open"
                aria-label="Open"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>

            {/* Description */}
            {descriptionText && descriptionText !== '—' && (
              <div className={`mt-1 text-gray-600 ${isMobile ? 'text-xs' : 'text-sm'} leading-snug line-clamp-2`}>
                {descriptionText}
              </div>
            )}

            {/* Location */}
            {locationText && locationText !== '—' && (
              <div className={`mt-2 flex items-center gap-1.5 text-gray-500 ${isMobile ? 'text-xs' : 'text-sm'} min-w-0`}>
                <MapPin className="h-4 w-4 flex-shrink-0 text-gray-400" />
                <span className="truncate">{locationText}</span>
              </div>
            )}

            {/* Extra subtitle (optional) */}
            {extraSubtitle.length > 0 && (
              <div className="mt-1 space-y-1">
                {extraSubtitle.map((s) => (
                  <div key={s.key} className={`text-gray-500 ${isMobile ? 'text-xs' : 'text-sm'} truncate`}>
                    {s.text}
                  </div>
                ))}
              </div>
            )}

            {/* Tags (pills) - Use standardized pill rendering with proper sort order */}
            {pillFields.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {pillFields.map((fieldNameOrId) => {
                  const field = tableFields.find((f) => f.name === fieldNameOrId || f.id === fieldNameOrId)
                  if (!field) return null
                  
                  const raw = row?.[field.name]
                  if (raw == null || raw === '' || (Array.isArray(raw) && raw.length === 0)) return null

                  // Use standardized pill rendering which respects sort_index order
                  if (field.type === 'multi_select') {
                    const values = Array.isArray(raw) ? raw : []
                    const validValues = values.filter((v) => v != null && String(v).trim() !== '')
                    if (validValues.length === 0) return null
                    
                    // Sort by manual order (sort_index) before rendering
                    const sortedValues = sortLabelsByManualOrder(
                      validValues.map(v => String(v).trim()),
                      'multi_select',
                      field.options
                    )
                    
                    return (
                      <React.Fragment key={field.name}>
                        {renderPills(field, sortedValues, { density: 'default' })}
                      </React.Fragment>
                    )
                  } else if (field.type === 'single_select') {
                    const value = String(raw).trim()
                    if (!value) return null
                    return (
                      <React.Fragment key={field.name}>
                        {renderPill({ field, value, density: 'default' })}
                      </React.Fragment>
                    )
                  } else if (field.type === 'link_to_table' || field.type === 'lookup') {
                    // For linked fields, render as pills if they support it
                    const value = String(raw).trim()
                    if (!value) return null
                    return (
                      <React.Fragment key={field.name}>
                        {renderPill({ field, value, density: 'default' })}
                      </React.Fragment>
                    )
                  }
                  
                  return null
                })}
              </div>
            )}

            {/* Metadata (optional) */}
            {metaFields.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                {metaFields.map((fieldNameOrId) => {
                  const field = tableFields.find((f) => f.name === fieldNameOrId || f.id === fieldNameOrId)
                  if (!field) return null
                  const text = formatFieldValue(field, row?.[field.name])
                  if (!text || text === '—') return null
                  return (
                    <span key={`meta:${field.name}`} className="truncate">
                      <span className="text-gray-400">{getFieldDisplayName(field)}:</span> {text}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }, [
    tableFields,
    titleField,
    subtitleFields,
    imageField,
    pillFields,
    metaFields,
    getRowValue,
    getImageUrlFromValue,
    handleOpenRecord,
    isMobile,
    selectedRecordId,
    formatFieldValue,
    getPillColor,
    highlightRules,
  ])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        Loading...
      </div>
    )
  }

  // Render grouped (nested) or ungrouped
  if (flattenedGroups && flattenedGroups.length > 0) {
    return (
      <div ref={contentRef} className="h-full flex flex-col">
        {/* Toolbar */}
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b bg-white">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGroupDialogOpen(true)}
            className="h-8"
          >
            <Group className="h-4 w-4 mr-2" />
            Group
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilterDialogOpen(true)}
            className="h-8"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filter
            {currentFilters.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                {currentFilters.length}
              </span>
            )}
          </Button>
          {showAddRecord && canCreateRecord && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenCreateModal}
              className="h-8 ml-auto"
              title="Add a new record"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add record
            </Button>
          )}
        </div>

        {/* Grouped Content */}
        <div className="flex-1 overflow-y-auto">
          {flattenedGroups.map((it) => {
            if (it.type === 'group') {
              const node = it.node
              const isCollapsed = collapsedGroups.has(node.pathKey)
              const groupFieldForLabel = node.rule.type === 'field'
                ? tableFields.find((f) => f.name === node.rule.field || f.id === node.rule.field)
                : null
              const ruleLabel =
                node.rule.type === 'date'
                  ? node.rule.granularity === 'year'
                    ? 'Year'
                    : 'Month'
                  : (groupFieldForLabel ? getFieldDisplayName(groupFieldForLabel) : node.rule.field)

              // Group color - generate for ALL groups
              let groupColor: string | null = null
              if (node.rule.type === 'field') {
                const groupField = groupFieldForLabel ?? tableFields.find((f) => f.name === node.rule.field || f.id === node.rule.field)
                if (groupField && (groupField.type === 'single_select' || groupField.type === 'multi_select')) {
                  // Use field-specific color for select fields
                  groupColor = getPillColor(groupField, node.key)
                } else {
                  // Generate hash-based color for all other field types
                  groupColor = getGroupColor(node.key)
                }
              } else {
                // For date-based grouping, generate color from the date value
                groupColor = getGroupColor(node.key)
              }

              // Evaluate conditional formatting rules for group headers
              // Create a mock row with the group value for evaluation
              const groupMockRow: Record<string, any> = {}
              if (node.rule.type === 'field') {
                const groupField = tableFields.find((f) => f.name === node.rule.field || f.id === node.rule.field)
                if (groupField && node.label) {
                  groupMockRow[groupField.name] = node.key
                }
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
              
              // Combine group color with conditional formatting (conditional formatting takes precedence)
              const finalHeaderBgColor = groupFormattingStyle.backgroundColor || (groupColor ? `${groupColor}80` : 'rgb(249, 250, 251)')
              const finalHeaderTextColor = groupFormattingStyle.color || (groupColor ? undefined : undefined)
              
              // Determine text color for contrast (only if no conditional formatting text color)
              const textColorClass = finalHeaderTextColor ? '' : (groupColor ? getTextColorForBackground(groupColor) : 'text-gray-900')
              const textColorStyle = finalHeaderTextColor ? { color: finalHeaderTextColor } : (groupColor ? {} : { color: undefined })
              
              return (
                <div key={node.pathKey} className="border-b border-gray-200 last:border-b-0">
                  <div 
                    className="flex items-center justify-between px-4 py-2 transition-colors"
                    style={{
                      backgroundColor: finalHeaderBgColor,
                      ...textColorStyle,
                    }}
                    onMouseEnter={(e) => {
                      if (groupColor) {
                        e.currentTarget.style.backgroundColor = `${groupColor}90`
                      } else {
                        e.currentTarget.style.backgroundColor = 'rgb(243, 244, 246)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (groupColor) {
                        e.currentTarget.style.backgroundColor = `${groupColor}80`
                      } else {
                        e.currentTarget.style.backgroundColor = 'rgb(249, 250, 251)'
                      }
                    }}
                  >
                    <button
                      onClick={() => {
                        setCollapsedGroups((prev) => {
                          const next = new Set(prev)
                          if (next.has(node.pathKey)) next.delete(node.pathKey)
                          else next.add(node.pathKey)
                          return next
                        })
                      }}
                      className="flex items-center gap-2 text-left flex-1"
                      style={{ paddingLeft: 8 + (it.level || 0) * 16 }}
                    >
                      {isCollapsed ? (
                        <ChevronRight className={`h-4 w-4 ${textColorClass}`} style={{ opacity: 0.7 }} />
                      ) : (
                        <ChevronDown className={`h-4 w-4 ${textColorClass}`} style={{ opacity: 0.7 }} />
                      )}
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-sm font-medium ${textColorClass}`}
                        style={{
                          backgroundColor: groupColor ? `${groupColor}CC` : undefined,
                          border: groupColor ? `1px solid ${groupColor}FF` : undefined,
                          ...textColorStyle,
                        }}
                      >
                        {ruleLabel}: {node.label}
                      </span>
                      <span className={`text-sm ml-2 ${textColorClass}`} style={{ opacity: 0.8 }}>{node.size}</span>
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        handleAddRecordToGroup(node.pathKey)
                      }}
                      className="h-7 text-xs"
                      disabled={!showAddRecord || !canCreateRecord}
                      title={
                        !showAddRecord
                          ? 'Enable "Show Add record button" in block settings to add records'
                          : !canCreateRecord
                            ? 'Adding records is disabled for this block'
                            : 'Add a new record to this group'
                      }
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add content
                    </Button>
                  </div>
                </div>
              )
            }

            // Item row (card)
            const row = it.item as any
            const key = `${String(row?.id ?? Math.random())}::${it.groupPathKey}`
            return (
              <div key={key} className="px-4 py-3">
                {renderListItem(row)}
              </div>
            )
          })}
        </div>

        {/* Dialogs */}
        {viewId ? (
          <>
            <GroupDialog
              isOpen={groupDialogOpen}
              onClose={() => setGroupDialogOpen(false)}
              viewId={viewId}
              tableFields={tableFields}
              groupBy={currentGroupBy}
              onGroupChange={handleGroupChange}
            />
            <FilterDialog
              isOpen={filterDialogOpen}
              onClose={() => setFilterDialogOpen(false)}
              viewId={viewId}
              tableFields={tableFields}
              filters={currentFilters.map((f, idx) => ({
                id: `filter-${idx}`,
                field_name: f.field,
                operator: f.operator as FilterType,
                value: f.value,
              }))}
              onFiltersChange={handleFiltersChange}
            />
          </>
        ) : (groupDialogOpen || filterDialogOpen) && (
          // Simple dialog for when there's no viewId
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md">
              <h3 className="text-lg font-semibold mb-2">
                {groupDialogOpen ? 'Grouping Settings' : 'Filter Settings'}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Configure {groupDialogOpen ? 'grouping' : 'filter'} settings in the block settings panel (Data tab).
              </p>
              <Button onClick={() => {
                setGroupDialogOpen(false)
                setFilterDialogOpen(false)
              }}>Close</Button>
            </div>
          </div>
        )}

        {createRecordModal}
      </div>
    )
  }

  // Render ungrouped list
  const rowsToRender = filteredRows

  if (rowsToRender.length === 0) {
    return (
      <div ref={contentRef} className="h-full flex flex-col">
        {/* Toolbar */}
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b bg-white">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGroupDialogOpen(true)}
            className="h-8"
          >
            <Group className="h-4 w-4 mr-2" />
            Group
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilterDialogOpen(true)}
            className="h-8"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filter
            {currentFilters.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                {currentFilters.length}
              </span>
            )}
          </Button>
          {showAddRecord && canCreateRecord && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenCreateModal}
              className="h-8 ml-auto"
              title="Add a new record"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add record
            </Button>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <EmptyState
            icon={<Database className="h-12 w-12" />}
            title="No records found"
            description={searchQuery 
              ? "No records match your search query. Try adjusting your search or clear it to see all records."
              : filters.length > 0
              ? "No records match your current filters. Try adjusting your filters or create a new record."
              : "This table doesn't have any records yet. Create your first record to get started."}
            action={searchQuery ? {
              label: "Clear Search",
              onClick: () => {
                const params = new URLSearchParams(window.location.search)
                params.delete("q")
                window.history.replaceState({}, "", `?${params.toString()}`)
                window.location.reload()
              },
            } : undefined}
          />
        </div>
        {/* Dialogs */}
        {viewId ? (
          <>
            <GroupDialog
              isOpen={groupDialogOpen}
              onClose={() => setGroupDialogOpen(false)}
              viewId={viewId}
              tableFields={tableFields}
              groupBy={currentGroupBy}
              onGroupChange={handleGroupChange}
            />
            <FilterDialog
              isOpen={filterDialogOpen}
              onClose={() => setFilterDialogOpen(false)}
              viewId={viewId}
              tableFields={tableFields}
              filters={currentFilters.map((f, idx) => ({
                id: `filter-${idx}`,
                field_name: f.field,
                operator: f.operator as FilterType,
                value: f.value,
              }))}
              onFiltersChange={handleFiltersChange}
            />
          </>
        ) : (groupDialogOpen || filterDialogOpen) && (
          // Simple dialog for when there's no viewId
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md">
              <h3 className="text-lg font-semibold mb-2">
                {groupDialogOpen ? 'Grouping Settings' : 'Filter Settings'}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Configure {groupDialogOpen ? 'grouping' : 'filter'} settings in the block settings panel (Data tab).
              </p>
              <Button onClick={() => {
                setGroupDialogOpen(false)
                setFilterDialogOpen(false)
              }}>Close</Button>
            </div>
          </div>
        )}

        {createRecordModal}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b bg-white">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setGroupDialogOpen(true)}
          className="h-8"
        >
          <Group className="h-4 w-4 mr-2" />
          Group
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFilterDialogOpen(true)}
          className="h-8"
        >
          <Filter className="h-4 w-4 mr-2" />
          Filter
          {currentFilters.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
              {currentFilters.length}
            </span>
          )}
        </Button>
        {showAddRecord && canCreateRecord && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenCreateModal}
            className="h-8 ml-auto"
            title="Add a new record"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add record
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-3">
          {rowsToRender.map((row) => renderListItem(row))}
        </div>
      </div>
      {/* Dialogs */}
      {viewId ? (
        <>
          <GroupDialog
            isOpen={groupDialogOpen}
            onClose={() => setGroupDialogOpen(false)}
            viewId={viewId}
            tableFields={tableFields}
            groupBy={currentGroupBy}
            onGroupChange={handleGroupChange}
          />
          <FilterDialog
            isOpen={filterDialogOpen}
            onClose={() => setFilterDialogOpen(false)}
            viewId={viewId}
            tableFields={tableFields}
            filters={currentFilters.map((f, idx) => ({
              id: `filter-${idx}`,
              field_name: f.field,
              operator: f.operator,
              value: f.value,
            }))}
            onFiltersChange={handleFiltersChange}
          />
        </>
      ) : (groupDialogOpen || filterDialogOpen) && (
        // Simple dialog for when there's no viewId
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-semibold mb-2">
              {groupDialogOpen ? 'Grouping Settings' : 'Filter Settings'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {groupDialogOpen ? 'Grouping' : 'Filter'} settings require a view to be configured. Please configure a view in the block settings.
            </p>
            <Button onClick={() => {
              setGroupDialogOpen(false)
              setFilterDialogOpen(false)
            }}>Close</Button>
          </div>
        </div>
      )}

      {createRecordModal}
    </div>
  )
}

