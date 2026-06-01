"use client"

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { PageBlock, ViewType } from "@/lib/interface/types"
import GridViewWrapper from "@/components/grid/GridViewWrapper"
import CalendarView from "@/components/views/CalendarView"
import { ErrorBoundary } from "@/components/interface/ErrorBoundary"
import KanbanView from "@/components/views/KanbanView"
import TimelineView from "@/components/views/TimelineView"
import GalleryView from "@/components/views/GalleryView"
import ListView from "@/components/views/ListView"
import {
  mergeFilters,
  mergeViewDefaultFiltersWithUserQuickFilters,
  deriveDefaultValuesFromFilters,
  normalizeFilter,
  type FilterConfig,
} from "@/lib/interface/filters"
import type { FilterTree } from "@/lib/filters/canonical-model"
import { useViewMeta } from "@/hooks/useViewMeta"
import { debugLog, debugWarn, isDebugEnabled } from "@/lib/interface/debug-flags"
import { asArray } from "@/lib/utils/asArray"
import type { TableField } from "@/types/fields"
import { getFieldDisplayName } from "@/lib/fields/display"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import QuickFilterBar from "@/components/filters/QuickFilterBar"
import CalendarAnchorControls from "@/components/views/calendar/CalendarAnchorControls"
import type { CalendarViewScrollHandle } from "@/components/views/CalendarView"
import { VIEWS_ENABLED } from "@/lib/featureFlags"
import { normalizeUuid } from "@/lib/utils/ids"
import { isAbortError } from "@/lib/api/error-handling"
import { useRecordModal } from "@/contexts/RecordModalContext"
import { useMarketingDashboard } from "@/contexts/MarketingDashboardContext"
import { startOfWeek, endOfWeek, startOfDay, addWeeks, startOfMonth, endOfMonth, addMonths } from "date-fns"
import type { GroupRule } from "@/lib/grouping/types"
import { getVisibleFieldsFromLayout } from "@/lib/interface/field-layout-helpers"
import type { FieldLayoutItem } from "@/lib/interface/field-layout-utils"
import { buildRecordContextFilters } from "@/lib/interface/record-context-filters"
import { cn } from "@/lib/utils"
import { effectiveAllowInternalScroll, resolveBlockDisplaySettings } from "@/lib/interface/block-display-settings"
import BlockHeader from "@/components/interface/blocks/shared/BlockHeader"

interface GridBlockProps {
  block: PageBlock
  isEditing?: boolean
  /** Interface mode: 'view' | 'edit'. When 'edit', all record modals open in edit mode (Airtable-style). */
  interfaceMode?: 'view' | 'edit'
  pageTableId?: string | null // Table ID from the page
  pageId?: string | null // Page ID
  recordId?: string | null // Record ID for record review pages (used to detect record context)
  /** Table ID of the selected record_context row (with recordId); enables record_context_link filters */
  recordTableId?: string | null
  filters?: FilterConfig[] // Page-level or filter block filters
  filterTree?: FilterTree // Canonical filter tree from filter blocks (supports groups/OR)
  onRecordClick?: (recordId: string, tableId?: string) => void // Callback for record clicks (for RecordReview integration)
  pageShowAddRecord?: boolean // Page-level default for showing Add record
  onEphemeralHeightDelta?: (blockId: string, deltaPx: number) => void // Callback for ephemeral height changes (collapsible expansion)
  rowHeight?: number // Row height in pixels (for height calculation)
  /** When provided, RecordModal can save field layout changes (in-modal edit). */
  onModalLayoutSave?: (fieldLayout: import("@/lib/interface/field-layout-utils").FieldLayoutItem[]) => void
  /** When true, show "Edit layout" in record modal. */
  canEditLayout?: boolean
  /** When true (full-page calendar), use compact Airtable-style top bar and date range from block settings. */
  isFullPage?: boolean
  /** When set and matches this block, opens the record in edit mode */
  openRecordInEditModeForBlock?: { blockId: string; recordId: string; tableId: string } | null
}

export default function GridBlock({
  block,
  isEditing = false,
  interfaceMode = 'view',
  pageTableId = null,
  pageId = null,
  recordId = null,
  recordTableId = null,
  filters = [],
  filterTree = null,
  onRecordClick,
  pageShowAddRecord = false,
  onEphemeralHeightDelta,
  rowHeight = 30,
  onModalLayoutSave,
  canEditLayout = false,
  isFullPage = false,
  openRecordInEditModeForBlock,
}: GridBlockProps) {
  const marketingDashboardStyle = useMarketingDashboard()
const { config } = block
  const displaySettings = resolveBlockDisplaySettings(block.type, config)
  const isFitMode = displaySettings.displayMode === "fit" && !isFullPage
  const allowInternalScroll = effectiveAllowInternalScroll(
    isFullPage,
    displaySettings.displayMode,
    displaySettings.overflowBehaviour
  )

  // CRITICAL: block.config is often a new object each render (from CalendarBlock/BlockRenderer).
  // Passing unstable blockConfig to CalendarView → blockConfigRef changes → handleEventClick deps
  // → FullCalendar reinit → React #185. Memoize by content so CalendarView receives stable reference.
  const configContentKey = config ? JSON.stringify(config) : ''
  const stableBlockConfig = useMemo(() => config ?? {}, [configContentKey])
  const cascadeContext = useMemo(
    () => (stableBlockConfig ? { blockConfig: stableBlockConfig } : undefined),
    [stableBlockConfig]
  )
  // CRITICAL: For calendar blocks, always use 'calendar' so sibling structure stays stable and CalendarView does not remount.
  // If we fall back to 'grid' when config is briefly undefined, React sees a different tree and unmounts CalendarView.
  const viewType: ViewType = block.type === 'calendar' ? 'calendar' : (config?.view_type || 'grid')
const { openRecordModal } = useRecordModal()

const [openRecordInEditMode, setOpenRecordInEditMode] = useState<string | null>(null)

// Open record in edit mode when openRecordInEditModeForBlock matches this block
  useEffect(() => {
    if (openRecordInEditModeForBlock && openRecordInEditModeForBlock.blockId === block.id) {
      setOpenRecordInEditMode(openRecordInEditModeForBlock.recordId)
      // Clear after a short delay to allow GridView to process it
      const timer = setTimeout(() => {
        setOpenRecordInEditMode(null)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [openRecordInEditModeForBlock, block.id])

// Track base height (collapsed state) to calculate deltas
  const lastReportedDeltaPxRef = useRef<number | null>(null)

const previousMeasuredHeightPxRef = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

// Convert total height from GridView to ephemeral delta
  const handleHeightChange = useCallback((totalHeightGridUnits: number) => {
    if (!onEphemeralHeightDelta) return

    // Canvas expects an absolute overflow delta in px (>= 0), not a per-event delta change.
    const totalHeightPx = totalHeightGridUnits * rowHeight
    const baseHeightPx = Math.max(2, block.h || 4) * rowHeight
    const deltaPx = Math.max(0, totalHeightPx - baseHeightPx)

    const lastMeasured = previousMeasuredHeightPxRef.current
    const lastDelta = lastReportedDeltaPxRef.current
    const heightChanged = lastMeasured === null || Math.abs(totalHeightPx - lastMeasured) > 1
    const deltaChanged = lastDelta === null || Math.abs(deltaPx - lastDelta) > 1
    if (heightChanged && deltaChanged) {
      onEphemeralHeightDelta(block.id, deltaPx)
      lastReportedDeltaPxRef.current = deltaPx
    }

    previousMeasuredHeightPxRef.current = totalHeightPx
  }, [onEphemeralHeightDelta, block.id, rowHeight])

  useEffect(() => {
    if (!onEphemeralHeightDelta || isFullPage) return

    if (!isFitMode) {
      lastReportedDeltaPxRef.current = 0
      onEphemeralHeightDelta(block.id, 0)
      return
    }

    if (!containerRef.current) return
    const element = containerRef.current

    const measureAndReport = () => {
      const measuredPx = Math.max(element.scrollHeight || 0, element.clientHeight || 0)
      const baseHeightPx = Math.max(2, block.h || 4) * rowHeight
      const deltaPx = Math.max(0, measuredPx - baseHeightPx)
      const previousDelta = lastReportedDeltaPxRef.current
      if (previousDelta === null || Math.abs(previousDelta - deltaPx) > 1) {
        onEphemeralHeightDelta(block.id, deltaPx)
        lastReportedDeltaPxRef.current = deltaPx
      }
    }

    measureAndReport()

    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => {
      measureAndReport()
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [onEphemeralHeightDelta, isFitMode, isFullPage, block.id, block.h, rowHeight, configContentKey, viewType])
// Grid block table_id resolution: use config.table_id first, fallback to pageTableId
  // This ensures calendar/list/kanban pages work even if table_id isn't explicitly set in block config
  // Backward compatibility: some legacy data used camelCase `tableId`
  const legacyTableId = (config as any)?.tableId
  const tableId = config?.table_id || legacyTableId || pageTableId || config?.base_table || null
  // RULE: Views are currently not used; ignore view_id unless explicitly enabled.
  const viewId = VIEWS_ENABLED ? config?.view_id : null
const viewUuid = useMemo(() => normalizeUuid(viewId), [viewId])
// DEBUG_LIST: Log tableId resolution
  // CRITICAL: Use useState to prevent hydration mismatch - localStorage access must happen after mount
const [listDebugEnabled, setListDebugEnabled] = useState(false)

useEffect(() => {
    setListDebugEnabled(isDebugEnabled('LIST'))
    if (isDebugEnabled('LIST')) {
      debugLog('LIST', 'GridBlock tableId resolution', {
        blockId: block.id,
        configTableId: config?.table_id,
        pageTableId,
        configBaseTable: config?.base_table,
        resolvedTableId: tableId,
        viewId,
        viewType,
      })
    }
  }, [])
// Visible fields from config (required) - ensure it's always an array
  // NOTE: Prefer block.field_layout when available (unified layout source)
  const visibleFieldsConfig = Array.isArray(config?.visible_fields) 
    ? config.visible_fields 
    : (config?.visible_fields ? [config.visible_fields] : [])
  const blockBaseFilters = Array.isArray(config?.filters) ? config.filters : []
  const sortsConfig = Array.isArray(config?.sorts) ? config.sorts : []

  const viewDefaultFilters = useMemo<FilterConfig[]>(() => {
    return (blockBaseFilters || []).map((f: any) => normalizeFilter(f))
  }, [blockBaseFilters])

  const [userQuickFilters, setUserQuickFilters] = useState<FilterConfig[]>([])
  // Calendar-only: initial scroll target (anchor-based, no filtering)
  const [calendarDateFrom, setCalendarDateFrom] = useState<Date | undefined>(undefined)
  const [calendarDateTo, setCalendarDateTo] = useState<Date | undefined>(undefined)
  const calendarScrollRef = useRef<CalendarViewScrollHandle | null>(null)

  // Track if date range has been initialized to prevent re-initialization when user clears it
  const dateRangeInitializedRef = useRef(false)
  
  // Initialize calendar date range based on config (only if preset is explicitly set)
  // Only initialize once - don't re-initialize when user clears the range
  useEffect(() => {
    if (viewType === 'calendar' && !dateRangeInitializedRef.current && calendarDateFrom === undefined && calendarDateTo === undefined) {
      const preset = config?.default_date_range_preset
      
      // Only initialize if a preset is explicitly configured (not 'none' and not undefined)
      if (!preset || preset === 'none') {
        // No preset configured - mark as initialized but don't set dates
        dateRangeInitializedRef.current = true
        return
      }
      
      const today = startOfDay(new Date())
      let from: Date | undefined
      let to: Date | undefined
      
      switch (preset) {
        case 'today':
          from = today
          to = today
          break
        case 'thisWeek':
          from = startOfWeek(today, { weekStartsOn: 1 }) // Monday
          to = endOfWeek(today, { weekStartsOn: 1 }) // Sunday
          break
        case 'thisMonth':
          from = startOfMonth(today)
          to = endOfMonth(today)
          break
        case 'nextWeek':
          const nextWeekStart = addWeeks(startOfWeek(today, { weekStartsOn: 1 }), 1)
          from = nextWeekStart
          to = endOfWeek(nextWeekStart, { weekStartsOn: 1 })
          break
        case 'nextMonth':
          const nextMonthStart = addMonths(startOfMonth(today), 1)
          from = nextMonthStart
          to = endOfMonth(nextMonthStart)
          break
        default:
          // Unknown preset - mark as initialized but don't set dates
          dateRangeInitializedRef.current = true
          return
      }
      
      if (from && to) {
        setCalendarDateFrom(from)
        setCalendarDateTo(to)
        dateRangeInitializedRef.current = true
      }
    }
  }, [viewType, calendarDateFrom, calendarDateTo, config?.default_date_range_preset])
  
  // Reset initialization flag when view type changes
  useEffect(() => {
    dateRangeInitializedRef.current = false
  }, [viewType])
  // Bump to force views to refetch after record creation.
  const [refreshKey, setRefreshKey] = useState(0)

  const viewFiltersWithUserOverrides = useMemo(() => {
    return mergeViewDefaultFiltersWithUserQuickFilters(viewDefaultFilters, userQuickFilters)
  }, [viewDefaultFilters, userQuickFilters])

  const recordContextLinkKey = JSON.stringify(config?.record_context_link ?? null)
  const recordContextFilters = useMemo(
    () => buildRecordContextFilters(config?.record_context_link, recordId, recordTableId),
    [recordId, recordTableId, recordContextLinkKey]
  )

  // Merge filters with proper precedence:
  // - builder-owned view defaults (with session-only user overrides)
  // - filter block filters (additive, cannot override)
  // - record_context_link (when page has a record_context selection)
  const allFilters = useMemo(() => {
    return mergeFilters(viewFiltersWithUserOverrides, filters, recordContextFilters)
  }, [viewFiltersWithUserOverrides, filters, recordContextFilters])
  const [loading, setLoading] = useState(true)
  const [table, setTable] = useState<{ supabase_table: string; name?: string | null } | null>(null)
  const [tableFields, setTableFields] = useState<any[]>([])
  const [groupBy, setGroupBy] = useState<string | undefined>(undefined)
  
  // Use cached metadata hook (serialized, no parallel requests)
  const { metadata: viewMeta, loading: metaLoading } = useViewMeta(viewUuid, tableId)

  // CRITICAL: Normalize all inputs at grid entry point
  // Never trust upstream to pass correct types - always normalize
  const safeTableFields = asArray<TableField>(tableFields)
  
  // Convert cached metadata to component state format
  const viewFields = useMemo(() => {
    if (!viewMeta?.fields) return []
    return viewMeta.fields.map(f => ({
      field_name: f.field_name,
      visible: f.visible,
      position: f.position,
    }))
  }, [viewMeta?.fields])
  
  const viewFilters = useMemo(() => {
    if (!viewMeta?.filters) return []
    return viewMeta.filters.map(f => ({
      id: f.id || '',
      field_name: f.field_name,
      operator: f.operator,
      value: f.value,
    }))
  }, [viewMeta?.filters])
  
  const viewSorts = useMemo(() => {
    if (!viewMeta?.sorts) return []
    return viewMeta.sorts.map(s => ({
      id: s.id || '',
      field_name: s.field_name,
      direction: s.direction,
      order_index: (s as any).order_index ?? 0,
    }))
  }, [viewMeta?.sorts])

  // Track loading state to prevent concurrent loads
  const loadingRef = useRef(false)
  const tableIdRef = useRef<string | null>(null)
  const viewIdRef = useRef<string | null | undefined>(null)
  
  // Track previous tableId/viewId to prevent unnecessary reloads when config reference changes
  // but actual values remain the same
  const prevTableIdRef = useRef<string | null>(null)
  const prevViewIdRef = useRef<string | null | undefined>(null)

  useEffect(() => {
    if (!tableId) {
      setLoading(false)
      prevTableIdRef.current = null
      prevViewIdRef.current = null
      return
    }

    // CRITICAL: Skip reload if tableId and viewId haven't actually changed
    // This prevents unnecessary reloads when config reference changes but values are the same
    const tableIdChanged = prevTableIdRef.current !== tableId
    const viewIdChanged = prevViewIdRef.current !== viewId
    
    if (!tableIdChanged && !viewIdChanged) {
      // Values haven't changed, skip reload
      return
    }

    // Skip if already loading the same table
    if (loadingRef.current && tableIdRef.current === tableId && viewIdRef.current === viewId) {
      return
    }

    // Update refs
    prevTableIdRef.current = tableId
    prevViewIdRef.current = viewId
    loadingRef.current = true
    tableIdRef.current = tableId
    viewIdRef.current = viewId
    setLoading(true)

    async function loadTableData() {
      try {
        const supabase = createClient()

        // CRITICAL: Serialize table and table_fields requests (no parallel Promise.all)
        // Load table first
        const tableRes = await supabase
          .from("tables")
          .select("supabase_table, name")
          .eq("id", tableId)
          .maybeSingle()

        if (tableRes.data) {
          setTable(tableRes.data)
        }

        // Then load table_fields
        const tableFieldsRes = await supabase
          .from("table_fields")
          .select("*")
          .eq("table_id", tableId)
          .order("position", { ascending: true })

        // CRITICAL: Normalize tableFields to array before setting state
        const normalizedFields = asArray(tableFieldsRes.data)
        setTableFields(normalizedFields)

        // Load view config if viewId provided (separate from metadata)
        // RULE: Views are disabled by default; only load when explicitly enabled.
        if (VIEWS_ENABLED && viewUuid) {
          const viewRes = await supabase
            .from("views")
            .select("config")
            .eq("id", viewUuid)
            .maybeSingle()

          if (viewRes.data?.config) {
            const viewConfig = viewRes.data.config as { groupBy?: string }
            setGroupBy(viewConfig.groupBy)
          }
        }
      } catch (error) {
        console.error("Error loading table data:", error)
        // CRITICAL: Do NOT retry automatically on network failure
        // Keep existing data if available
      } finally {
        setLoading(false)
        loadingRef.current = false
      }
    }

    loadTableData()
  }, [tableId, viewUuid]) // Dependencies are tableId/viewId values, not config reference

  // Combine loading states
  const isLoading = loading || metaLoading

  // Determine visible fields: block.field_layout is single source of truth; legacy visible_fields deprecated
  // CRITICAL: Must run before any early return so useMemo (fieldIds) is always called (Rules of Hooks)
  type ViewFieldType = {
    field_name: string
    visible: boolean
    position: number
  }
  const safeViewFields = asArray<ViewFieldType>(viewFields)
  const fieldLayout = (config as any)?.field_layout as FieldLayoutItem[] | undefined
  const hasFieldLayout = Array.isArray(fieldLayout) && fieldLayout.length > 0
  const visibleFieldsFromLayout = useMemo(() => {
    if (!hasFieldLayout || !safeTableFields.length) return []
    return getVisibleFieldsFromLayout(fieldLayout!, safeTableFields, 'modal')
  }, [hasFieldLayout, fieldLayout, safeTableFields])
  const visibleFields = hasFieldLayout
    ? visibleFieldsFromLayout.map((f, i) => ({ field_name: f.name, visible: true, position: i }))
    : (visibleFieldsConfig.length > 0
      ? visibleFieldsConfig.map((fieldName: string) => {
          const field = safeTableFields.find(
            f => f && (f.name === fieldName || f.id === fieldName || getFieldDisplayName(f) === fieldName)
          )
          return field ? { field_name: field.name, visible: true, position: 0 } : null
        }).filter(Boolean) as Array<{ field_name: string; visible: boolean; position: number }>
      : safeViewFields.filter(f => f && f.visible))

  // CRITICAL: Memoize fieldIds so CalendarView (and other views) receive a stable array reference.
  // Without this, visibleFields.map(...) creates a new array every render → CalendarView's
  // linkedValueLabelMaps effect re-runs → setState → re-render → React #185 loop.
  const fieldIds = useMemo(
    () => visibleFields.map(f => f.field_name),
    [visibleFields.map(f => f.field_name).join(',')]
  )

  // Kanban uses kanban_card_fields when set; otherwise falls back to fieldIds
  const kanbanFieldIds = useMemo(() => {
    const kanbanFields = (config as any)?.kanban_card_fields
    if (Array.isArray(kanbanFields) && kanbanFields.length > 0) {
      return kanbanFields
    }
    return fieldIds
  }, [configContentKey, fieldIds])

  if (!tableId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <p className="mb-2">{isEditing ? "This block requires a table connection." : "No table connection"}</p>
          {isEditing && (
            <p className="text-xs text-gray-400">Configure the table in block settings.</p>
          )}
        </div>
      </div>
    )
  }

  // DEBUG_LIST: Log visible fields resolution
  if (listDebugEnabled) {
    debugLog('LIST', 'GridBlock visible fields resolution', {
      blockId: block.id,
      visibleFieldsConfigCount: visibleFieldsConfig.length,
      viewFieldsCount: safeViewFields.length,
      visibleViewFieldsCount: safeViewFields.filter(f => f && f.visible).length,
      tableFieldsCount: tableFields.length,
      resolvedVisibleFieldsCount: visibleFields.length,
      resolvedVisibleFields: visibleFields.map(f => f.field_name),
    })
  }

  // Modal uses same field set as Data: field_layout when available, else legacy modal_fields
  const modalFieldsForRecord = hasFieldLayout
    ? visibleFieldsFromLayout.map((f) => f.name)
    : (visibleFieldsConfig.length > 0 ? visibleFieldsConfig : (config as any).modal_fields) as string[] | undefined

  // Convert merged filters to legacy format for GridViewWrapper (backward compatibility)
  const activeFilters = allFilters.map((f, idx) => ({
    id: f.field || `filter-${idx}`,
    field_name: f.field,
    operator: f.operator,
    value: f.value,
  }))

  const activeSorts = sortsConfig.length > 0
    ? sortsConfig.map((s: any) => ({
        id: s.field || '',
        field_name: s.field || '',
        direction: s.direction || 'asc',
      }))
    : viewSorts

  if (isLoading || !table) {
    if (marketingDashboardStyle) {
      return (
        <div className="h-full w-full rounded-card-lg border border-border/50 bg-card p-4 shadow-sm">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-1/3 rounded bg-muted" />
            <div className="h-10 rounded bg-muted/70" />
            <div className="h-10 rounded bg-muted/70" />
            <div className="h-10 rounded bg-muted/70" />
          </div>
        </div>
      )
    }
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        Loading...
      </div>
    )
  }

  // Apply appearance settings (legacy inline styles only; new appearance is handled by BlockAppearanceWrapper)
  const appearance = config.appearance || {}
  const blockStyle: React.CSSProperties = {
    backgroundColor: appearance.background_color,
    borderColor: appearance.border_color,
    borderWidth: appearance.border_width !== undefined ? `${appearance.border_width}px` : undefined,
    borderRadius: appearance.border_radius !== undefined ? `${appearance.border_radius}px` : undefined,
    // Only apply legacy numeric padding here; string padding ('compact'|'normal'|'spacious') is handled in wrapper
    padding: typeof (appearance as any).padding === 'number' ? `${(appearance as any).padding}px` : undefined,
  }

  // In view mode, do NOT auto-title a grid block from the underlying table name.
  // This commonly duplicates the page title (e.g. page name == table name) and creates "two titles" UX.
  // Titles should be explicit: appearance.title (preferred) or config.title (legacy).
  const blockTitle = appearance.title || config.title

  // Add record button: when Appearance toggle was removed, default to Data > Permissions (allowInlineCreate)
  const blockShowAddRecord = (appearance as any).show_add_record
  const allowInlineCreateFromPerms = (config.permissions?.allowInlineCreate ?? true)
  const showAddRecord =
    blockShowAddRecord === true ||
    (blockShowAddRecord == null && (pageShowAddRecord || allowInlineCreateFromPerms))

  // Toolbar visibility: keep edit mode WYSIWYG (match live view).
  const showToolbar = appearance.show_toolbar !== false
  // For non-grid views, the only "toolbar" we currently render is QuickFilterBar (filters).
  const showQuickFilters = showToolbar && appearance.show_filter !== false

  // When grid uses grouping, it uses push-down (overflow-visible); container must allow overflow for content to flow.
  const groupByRulesFromConfig = (config as any).group_by_rules as GroupRule[] | undefined
  const groupByFromConfigRaw = (config as any).group_by_field || (config as any).group_by
  const effectiveGroupByForPushDown = (() => {
    if (groupByRulesFromConfig && groupByRulesFromConfig.length > 0 && groupByRulesFromConfig[0].type === 'field')
      return groupByRulesFromConfig[0].field
    if (groupByFromConfigRaw && typeof groupByFromConfigRaw === 'string') {
      const match = safeTableFields.find((f) => f && (f.name === groupByFromConfigRaw || f.id === groupByFromConfigRaw))
      return match?.name || groupByFromConfigRaw
    }
    return groupBy
  })()
  const isGridWithPushDown = viewType === 'grid' && !!effectiveGroupByForPushDown && !isFullPage

  const { canCreateRecord, isAddRecordDisabled, handleAddRecord } = (() => {
    const permissions = config.permissions || {}
    const isViewOnly = permissions.mode === 'view'
    const allowInlineCreate = permissions.allowInlineCreate ?? true
    const canCreate = !isViewOnly && allowInlineCreate
    const disabled = !showAddRecord || !canCreate || isLoading || !table || !tableId

    const resolveFieldName = (fieldIdOrName: unknown): string | null => {
      if (!fieldIdOrName || typeof fieldIdOrName !== "string") return null
      const raw = fieldIdOrName.trim()
      if (!raw) return null
      const match = safeTableFields.find((f) => f && (f.id === raw || f.name === raw))
      return match?.name || raw
    }

    const handler = async () => {
      if (disabled || !table || !tableId) {
        console.warn('GridBlock: Add record handler called but disabled or missing table/tableId', {
          disabled,
          hasTable: !!table,
          tableId,
        })
        return
      }
      try {
        const supabase = createClient()
        const today = new Date()
        const todayDate = today.toISOString().split('T')[0]

        const newData: Record<string, any> = {}

        const defaultsFromFilters = deriveDefaultValuesFromFilters(allFilters, safeTableFields)

        // Ensure newly created records show up for date-based views by pre-filling the date field if we can.
        if (viewType === 'calendar') {
          const rawDateField =
            (config as any).start_date_field ||
            (config as any).from_date_field ||
            (config as any).calendar_date_field ||
            (config as any).calendar_start_field ||
            (config as any).date_field
          const dateFieldName = resolveFieldName(rawDateField)
          if (dateFieldName) {
            // IMPORTANT: Supabase table columns are field *names*, not field IDs.
            newData[dateFieldName] = todayDate
          }
        }

        if (viewType === 'timeline') {
          const rawFromField =
            (config as any).date_from ||
            (config as any).from_date_field ||
            (config as any).start_date_field ||
            (config as any).timeline_date_field ||
            (config as any).date_field
          const rawToField =
            (config as any).date_to ||
            (config as any).to_date_field ||
            (config as any).end_date_field

          const fromFieldName = resolveFieldName(rawFromField)
          const toFieldName = resolveFieldName(rawToField)

          if (fromFieldName) {
            newData[fromFieldName] = todayDate
          } else if (toFieldName) {
            newData[toFieldName] = todayDate
          }
          if (toFieldName) {
            // Default end date to same as start for single-day events.
            newData[toFieldName] = newData[toFieldName] || todayDate
          }
        }

        if (Object.keys(defaultsFromFilters).length > 0) {
          Object.assign(newData, defaultsFromFilters)
        }

        const { data, error } = await supabase
          .from(table.supabase_table)
          .insert([newData])
          .select()
          .single()

        if (error) {
          // Check if it's an abort error before throwing
          if (isAbortError(error)) {
            return
          }
          // Check nested error structure
          const errorObj = error as any
          if (errorObj?.error && isAbortError(errorObj.error)) {
            return
          }
          if (errorObj?.details && isAbortError({ message: errorObj.details })) {
            return
          }
          throw error
        }

        const createdId = (data as any)?.id || (data as any)?.record_id
        if (!createdId) {
          console.warn('GridBlock: Record created but no ID returned', { data })
          return
        }

        // Force the currently rendered view to refetch so the new record appears immediately.
        setRefreshKey((k) => k + 1)

        // Contract: creating a record must NOT auto-open it.
        // User can open via the dedicated chevron (or optional double-click) in the grid.
      } catch (error) {
        // Ignore abort errors (expected during navigation/unmount)
        if (isAbortError(error)) {
          return
        }
        
        // Also check if error has a nested error object (e.g., from Supabase)
        const errorObj = error as any
        if (errorObj?.error && isAbortError(errorObj.error)) {
          return
        }
        if (errorObj?.details && isAbortError({ message: errorObj.details })) {
          return
        }
        
        // Only log and show errors for real failures
        console.error('Failed to create record:', error)
        const errorMessage = (error as any)?.message || (error as any)?.error?.message || 'Failed to create record. Please try again.'
        alert(errorMessage)
      }
    }

    return {
      canCreateRecord: canCreate,
      isAddRecordDisabled: disabled,
      handleAddRecord: handler,
    }
  })()

  // Detect whether the BlockAppearanceWrapper will render the title/header.
  // If it will, GridBlock must NOT render its own title/header (otherwise we get duplicate titles).
  const wrapperHasAppearanceSettings = !!(appearance && (
    (appearance as any).background ||
    (appearance as any).border ||
    (appearance as any).radius ||
    (appearance as any).shadow ||
    (appearance as any).padding ||
    (appearance as any).margin ||
    (appearance as any).accent ||
    (appearance as any).showTitle !== undefined ||
    (appearance as any).titleSize ||
    (appearance as any).titleAlign ||
    (appearance as any).showDivider !== undefined
  ))

  // Render based on view type
  const renderView = () => {
    switch (viewType) {
      case 'calendar': {
        // CRITICAL: Always render CalendarView so the block mounts. Validation and empty states are handled inside CalendarView.
        // Calendar will load its own config from the view, but we can provide a fallback dateFieldId
        // Find ALL date fields in the table (not just visibleFields) to ensure we can find the configured field
        const allDateFieldsInTable = safeTableFields
          .filter(field => field.type === 'date')
          .map(field => ({ field }))
        
        // Prioritize fields with names like 'date', 'date_to', 'date_due' over 'created', 'created_at', 'updated_at'
        const preferredDateField = allDateFieldsInTable.find(({ field }) => {
          const name = field.name.toLowerCase()
          return name.includes('date') && !name.includes('created') && !name.includes('updated')
        })
        
        const defaultDateField = preferredDateField || allDateFieldsInTable[0]
        
        // Resolve dateFieldId as fallback - prefer field name over ID since data uses field names as keys
        // The CalendarView component will load the view config and use that instead
        let dateFieldId = ''
        
        // Check block config first (include calendar_start_field for two-date config)
        const dateFieldFromConfig = config.calendar_date_field || config.start_date_field || (config as any).calendar_start_field
        
        if (dateFieldFromConfig) {
          // If config has a field ID/name, find the actual field to validate it exists and is a date field
          const resolvedField = safeTableFields.find(tf => 
            (tf.name === dateFieldFromConfig || tf.id === dateFieldFromConfig) && tf.type === 'date'
          )
          if (resolvedField) {
            dateFieldId = resolvedField.name
          }
        }
        
        // If config field not found or invalid, try to use a default date field
        if (!dateFieldId && defaultDateField) {
          dateFieldId = defaultDateField.field.name
        }
        
        // CalendarView will load view config and use that; it shows empty state if tableId or date field is missing
        return (
          <ErrorBoundary
            fallback={
              <div className="h-full flex items-center justify-center p-4 border border-red-200 bg-red-50 rounded-lg">
                <div className="text-center">
                  <p className="text-sm font-medium text-red-800 mb-1">Calendar error</p>
                  <p className="text-xs text-red-600">This calendar block encountered an error. Please refresh or configure the date field.</p>
                </div>
              </div>
            }
          >
          <CalendarView
            ref={calendarScrollRef}
            key={block.id}
            tableId={tableId ?? ''}
            viewId={viewUuid || ''}
            dateFieldId={dateFieldId}
            fieldIds={fieldIds}
            tableFields={tableFields}
            filters={allFilters}
            filterTree={filterTree}
            blockConfig={stableBlockConfig}
            modalFields={modalFieldsForRecord}
            onRecordClick={onRecordClick}
            colorField={appearance.color_field}
            imageField={appearance.image_field}
            fitImageSize={appearance.fit_image_size}
            reloadKey={refreshKey}
            dateFrom={calendarDateFrom}
            dateTo={calendarDateTo}
            onDateFromChange={setCalendarDateFrom}
            onDateToChange={setCalendarDateTo}
            showDateRangeControls={false}
            highlightRules={config.highlight_rules}
            onModalLayoutSave={onModalLayoutSave}
            canEditLayout={canEditLayout}
            interfaceMode={interfaceMode}
            blockId={block.id}
          />
          </ErrorBoundary>
        )
      }
      
      case 'kanban': {
        // Kanban requires a tableId and a grouping field (typically a select/single_select field)
        if (!tableId) {
          return (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
              <div className="text-center">
                <p className="mb-2">{isEditing ? "Kanban view requires a table connection." : "No table configured"}</p>
                {isEditing && (
                  <p className="text-xs text-gray-400">Configure a table in block settings.</p>
                )}
              </div>
            </div>
          )
        }
        
        const groupByFieldFromConfig = config.group_by_field || config.kanban_group_field
        const groupByFieldFromFields = visibleFields.find(f => {
          const field = safeTableFields.find(tf => tf.name === f.field_name || tf.id === f.field_name)
          return field && (field.type === 'single_select' || field.type === 'multi_select')
        })
        const groupByFieldId = groupByFieldFromConfig || groupByFieldFromFields?.field_name || ''
        
        if (!groupByFieldId) {
          return (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
              <div className="text-center">
                <p className="mb-2">{isEditing ? "Kanban view requires a grouping field." : "No grouping field configured"}</p>
                {isEditing && (
                  <p className="text-xs text-gray-400">Configure a select field for grouping in block settings.</p>
                )}
              </div>
            </div>
          )
        }
        
        return (
          <KanbanView
            highlightRules={config.highlight_rules}
            tableId={tableId}
            viewId={viewUuid || ''}
            groupingFieldId={groupByFieldId}
            fieldIds={kanbanFieldIds}
            searchQuery=""
            tableFields={tableFields}
            colorField={appearance.color_field}
            imageField={appearance.image_field}
            fitImageSize={appearance.fit_image_size}
            showFieldLabels={(appearance as any)?.kanban_show_field_labels === true}
            blockConfig={config}
            modalFields={modalFieldsForRecord}
            onRecordClick={onRecordClick}
            cascadeContext={cascadeContext}
            reloadKey={refreshKey}
            interfaceMode={interfaceMode}
            onRecordDeleted={() => setRefreshKey((k) => k + 1)}
            onModalLayoutSave={onModalLayoutSave ?? undefined}
            displayMode={displaySettings.displayMode}
            overflowBehaviour={displaySettings.overflowBehaviour}
            recordLimit={displaySettings.recordLimit}
            forceInternalScroll={allowInternalScroll}
          />
        )
      }
      
      case 'timeline': {
        // Timeline requires a date field - check for date_from (default) or date_to
        const dateFromFieldFromConfig = config.date_from || config.from_date_field || config.start_date_field || config.timeline_date_field || config.calendar_date_field
        const dateToFieldFromConfig = config.date_to || config.to_date_field || config.end_date_field
        
        const dateFieldFromFields = visibleFields.find(f => {
          const field = safeTableFields.find(tf => tf.name === f.field_name || tf.id === f.field_name)
          return field && field.type === 'date'
        })
        const dateFieldId = dateFromFieldFromConfig || dateFieldFromFields?.field_name || ''
        
        // Don't require date field if we have date_from or date_to in config, as TimelineView will auto-detect
        if (!dateFieldId && !dateFromFieldFromConfig && !dateToFieldFromConfig) {
          return (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
              <div className="text-center">
                <p className="mb-2">{isEditing ? "Timeline view requires a date field." : "No date field configured"}</p>
                {isEditing && (
                  <p className="text-xs text-gray-400">Configure a date field in block settings.</p>
                )}
              </div>
            </div>
          )
        }
        
        return (
          <div className="flex flex-col h-full min-h-0">
            <TimelineView
              tableId={tableId!}
              viewId={viewUuid || ''}
              dateFieldId={dateFieldId}
              startDateFieldId={dateFromFieldFromConfig}
              endDateFieldId={dateToFieldFromConfig}
              fieldIds={fieldIds}
              searchQuery=""
              tableFields={tableFields}
              filters={allFilters}
              blockConfig={config}
              modalFields={modalFieldsForRecord}
              colorField={appearance.color_field}
              onRecordClick={onRecordClick}
              reloadKey={refreshKey}
              onRecordDeleted={() => setRefreshKey((k) => k + 1)}
              titleField={config.timeline_title_field || config.card_title_field}
              tagField={config.timeline_tag_field || config.timeline_field_1 || config.card_field_1}
              groupByField={config.timeline_group_by || config.group_by_field || config.group_by}
              rowSize={appearance.row_height as 'compact' | 'medium' | 'comfortable' || 'medium'}
              compactMode={config.timeline_compact_mode ?? (appearance.row_height === 'compact')}
              highlightRules={config.highlight_rules}
              interfaceMode={interfaceMode}
              onModalLayoutSave={onModalLayoutSave ?? undefined}
            />
          </div>
        )
      }
      
      case 'gallery': {
        if (!tableId) {
          return (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
              <div className="text-center">
                <p className="mb-2">{isEditing ? "Gallery view requires a table connection." : "No table configured"}</p>
                {isEditing && (
                  <p className="text-xs text-gray-400">Configure a table in block settings.</p>
                )}
              </div>
            </div>
          )
        }

        // Gallery group default collapse behavior (default: collapsed/closed)
        const galleryDefaultGroupsCollapsed =
          (config as any)?.gallery_groups_default_collapsed ??
          (config as any)?.grid_groups_default_collapsed ??
          true

        return (
          <GalleryView
            tableId={tableId}
            viewId={viewUuid || undefined}
            fieldIds={fieldIds}
            searchQuery=""
            tableFields={tableFields}
            filters={allFilters}
            filterTree={filterTree}
            onRecordClick={onRecordClick}
            blockConfig={config}
            modalFields={modalFieldsForRecord}
            defaultGroupsCollapsed={galleryDefaultGroupsCollapsed}
            colorField={appearance.color_field}
            imageField={appearance.image_field}
            fitImageSize={appearance.fit_image_size}
            reloadKey={refreshKey}
            highlightRules={config.highlight_rules}
            interfaceMode={interfaceMode}
            onRecordDeleted={() => setRefreshKey((k) => k + 1)}
            onModalLayoutSave={onModalLayoutSave ?? undefined}
            marketingDashboardStyle={marketingDashboardStyle}
            recordLimit={displaySettings.recordLimit}
            displayMode={displaySettings.displayMode}
            overflowBehaviour={displaySettings.overflowBehaviour}
          />
        )
      }
      
      case 'list': {
        if (!tableId) {
          return (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
              <div className="text-center">
                <p className="mb-2">{isEditing ? "List view requires a table connection." : "No table configured"}</p>
                {isEditing && (
                  <p className="text-xs text-gray-400">Configure a table in block settings.</p>
                )}
              </div>
            </div>
          )
        }

        if (!table) {
          return (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
              <div className="text-center">
                <p className="mb-2">Loading table...</p>
              </div>
            </div>
          )
        }

        // Get list-specific field configuration
        const titleField = config.list_title_field || config.title_field || ""
        const subtitleFields = config.list_subtitle_fields || []
        const imageField = config.list_image_field || config.image_field || ""
        const pillFields = config.list_pill_fields || []
        const metaFields = config.list_meta_fields || []
        
        // Grouping (optional) for list view:
        // Support both nested groups (group_by_rules) and legacy single field (group_by_field/group_by)
        const groupByRulesFromConfig = (config as any).group_by_rules as GroupRule[] | undefined
        const groupByFromConfigRaw = (config as any).group_by_field || (config as any).group_by
        const groupByFromConfigResolved = (() => {
          if (!groupByFromConfigRaw || typeof groupByFromConfigRaw !== 'string') return undefined
          const match = safeTableFields.find((f) => f.name === groupByFromConfigRaw || f.id === groupByFromConfigRaw)
          return match?.name || groupByFromConfigRaw
        })()
        // If group_by_rules exists, use first rule's field for backward compatibility
        const effectiveGroupBy = groupByRulesFromConfig && groupByRulesFromConfig.length > 0 && groupByRulesFromConfig[0].type === 'field'
          ? groupByRulesFromConfig[0].field
          : groupByFromConfigResolved || groupBy

        // List group default collapse behavior (default: collapsed/closed)
        const defaultChoiceGroupsCollapsed =
          (config as any)?.list_groups_default_collapsed ??
          (config as any)?.list_choice_groups_default_collapsed ??
          true

        // Read block permissions
        const permissions = config.permissions || {}
        const isViewOnly = permissions.mode === 'view'
        const allowInlineCreate = permissions.allowInlineCreate ?? true
        const canCreateRecord = !isViewOnly && allowInlineCreate

        // Convert sorts to ListView format
        const activeSorts = sortsConfig.length > 0
          ? sortsConfig.map((s: any) => ({
              field_name: s.field || s.field_name || '',
              direction: s.direction || 'asc',
            }))
          : viewSorts.map(s => ({
              field_name: s.field_name,
              direction: s.direction as 'asc' | 'desc',
            }))

        const canAutoSizeListHeight = !isFullPage

        return (
          <ListView
            highlightRules={config.highlight_rules}
            tableId={tableId}
            viewId={viewUuid || undefined}
            supabaseTableName={table.supabase_table}
            tableFields={tableFields}
            filters={allFilters}
            sorts={activeSorts}
            groupBy={effectiveGroupBy}
            groupByRules={groupByRulesFromConfig}
            defaultChoiceGroupsCollapsed={defaultChoiceGroupsCollapsed}
            searchQuery=""
            onRecordClick={onRecordClick}
            showAddRecord={showAddRecord}
            canCreateRecord={canCreateRecord}
            titleField={titleField}
            subtitleFields={subtitleFields}
            imageField={imageField}
            pillFields={pillFields}
            metaFields={metaFields}
            modalFields={modalFieldsForRecord}
            blockConfig={config}
            reloadKey={refreshKey}
            onHeightChange={canAutoSizeListHeight ? handleHeightChange : undefined}
            rowHeight={rowHeight}
            colorField={appearance.color_field}
            cascadeContext={cascadeContext}
            interfaceMode={interfaceMode}
            onRecordDeleted={() => setRefreshKey((k) => k + 1)}
            onModalLayoutSave={onModalLayoutSave ?? undefined}
            marketingDashboardStyle={marketingDashboardStyle}
            recordLimit={displaySettings.recordLimit}
            displayMode={displaySettings.displayMode}
            overflowBehaviour={displaySettings.overflowBehaviour}
            forceInternalScroll={allowInternalScroll}
          />
        )
      }
      
      case 'grid':
      default:
        // Read block permissions
        const permissions = config.permissions || {}
        const isViewOnly = permissions.mode === 'view'
        const allowInlineCreate = permissions.allowInlineCreate ?? true
        const allowInlineDelete = permissions.allowInlineDelete ?? true
        const allowOpenRecord = permissions.allowOpenRecord ?? true

        // Grouping (optional) for grid/table view:
        // Support both nested groups (group_by_rules) and legacy single field (group_by_field/group_by)
        const groupByRulesFromConfig = (config as any).group_by_rules as GroupRule[] | undefined
        const groupByFromConfigRaw = (config as any).group_by_field || (config as any).group_by
        const groupByFromConfigResolved = (() => {
          if (!groupByFromConfigRaw || typeof groupByFromConfigRaw !== 'string') return undefined
          const match = safeTableFields.find((f) => f.name === groupByFromConfigRaw || f.id === groupByFromConfigRaw)
          return match?.name || groupByFromConfigRaw
        })()
        // If group_by_rules exists, use first rule's field for backward compatibility
        const effectiveGroupBy = groupByRulesFromConfig && groupByRulesFromConfig.length > 0 && groupByRulesFromConfig[0].type === 'field'
          ? groupByRulesFromConfig[0].field
          : groupByFromConfigResolved || groupBy

        // Grid group default collapse behavior (default: collapsed/closed)
        const defaultGroupsCollapsed =
          (config as any)?.grid_groups_default_collapsed ??
          (config as any)?.gallery_groups_default_collapsed ??
          true

        // Determine if record clicks should be enabled (modal only; never full-page from blocks)
        const handleRecordClick = allowOpenRecord
          ? (onRecordClick || ((clickedRecordId: string) => {
              if (tableId && table?.supabase_table) {
                openRecordModal({
                  tableId,
                  recordId: clickedRecordId,
                  supabaseTableName: table.supabase_table,
                  modalFields: modalFieldsForRecord,
                  modalLayout: (config as any).modal_layout,
                  cascadeContext: { blockConfig: config },
                  interfaceMode,
                  onDeleted: () => setRefreshKey((k) => k + 1),
                  onRecordUpdated: () => setRefreshKey((k) => k + 1),
                  fieldLayout: (config as any).field_layout,
                  onLayoutSave: onModalLayoutSave ?? undefined,
                  tableFields,
                })
              }
            }))
          : undefined // Disable record clicks if not allowed

        // CRITICAL: Only hide the "No columns configured" empty state in RECORD contexts.
        // Previously this was based solely on layout (x >= 4) which caused normal pages to render a blank block.
        const isRightColumnBlock = block.x !== undefined && block.x >= 4
        const isRecordContext = !!recordId
        const hideEmptyState = isRecordContext && isRightColumnBlock

        // Determine which settings come from block config (should be hidden from UI)
        const blockLevelSettings = {
          filters: blockBaseFilters.length > 0, // Filters from block config
          sorts: sortsConfig.length > 0, // Sorts from block config
          groupBy: !!effectiveGroupBy && (!!config.group_by_field || !!config.group_by || !!(config as any).group_by_rules), // GroupBy from block config (including nested groups)
        }

        const shouldReportHeight =
          !isFullPage && (displaySettings.displayMode === "fit" || !!effectiveGroupBy)

        return (
          <GridViewWrapper
            tableId={tableId!}
            viewId={viewUuid || ''}
            supabaseTableName={table.supabase_table}
            viewFields={visibleFields}
            initialFilters={activeFilters}
            standardizedFilters={allFilters}
            filterTree={filterTree}
            initialSorts={activeSorts}
            initialGroupBy={effectiveGroupBy}
            initialGroupByRules={groupByRulesFromConfig}
            initialTableFields={tableFields}
            isEditing={isEditing}
            interfaceMode={interfaceMode}
            onRecordClick={handleRecordClick}
            modalFields={modalFieldsForRecord}
            modalLayout={(config as any).modal_layout}
            fieldLayout={(config as any).field_layout}
            cascadeContext={cascadeContext}
            reloadKey={refreshKey}
            defaultGroupsCollapsed={defaultGroupsCollapsed}
            appearance={{
              ...appearance,
              color_field: appearance.color_field,
              image_field: appearance.image_field,
              fit_image_size: appearance.fit_image_size,
              enable_record_open: appearance.enable_record_open,
              record_open_style: appearance.record_open_style,
            }}
            highlightRules={config.highlight_rules}
            permissions={{
              mode: permissions.mode || 'edit',
              allowInlineCreate: isViewOnly ? false : allowInlineCreate,
              allowInlineDelete: isViewOnly ? false : allowInlineDelete,
              allowOpenRecord,
            }}
            hideEmptyState={hideEmptyState}
            blockLevelSettings={blockLevelSettings}
            onHeightChange={shouldReportHeight ? handleHeightChange : undefined}
            rowHeightPixels={rowHeight}
            onModalLayoutSave={onModalLayoutSave}
            canEditLayout={canEditLayout}
            blockId={block.id}
            recordLimit={displaySettings.recordLimit}
            overflowBehaviour={displaySettings.overflowBehaviour}
            displayMode={displaySettings.displayMode}
            forceInternalScroll={allowInternalScroll}
            openRecordInEditMode={
              openRecordInEditModeForBlock &&
              openRecordInEditModeForBlock.blockId === block.id &&
              openRecordInEditModeForBlock.tableId === tableId &&
              openRecordInEditMode
                ? openRecordInEditMode
                : null
            }
          />
        )
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        isFitMode ? "h-auto" : "h-full",
        isFullPage && "h-full",
        "w-full max-w-full min-h-0 min-w-0 flex flex-col",
        (isGridWithPushDown || (viewType === "calendar" && !isFullPage) || !allowInternalScroll) ? "overflow-visible" : "overflow-hidden"
      )}
      style={blockStyle}
    >
      {/* Legacy header (title + optional add record) - only when appearance wrapper is not active */}
      {!wrapperHasAppearanceSettings &&
        (((appearance.showTitle ?? (appearance as any).show_title) !== false && blockTitle) ||
          showAddRecord) && (
          <BlockHeader
            title={((appearance.showTitle ?? (appearance as any).show_title) !== false && blockTitle) ? blockTitle : undefined}
            actions={
              <>
                {showQuickFilters && viewType !== "calendar" && (
                  <QuickFilterBar
                    storageKey={`mh:quickFilters:${pageId || "page"}:${block.id}`}
                    tableFields={safeTableFields}
                    viewDefaultFilters={viewDefaultFilters}
                    onChange={setUserQuickFilters}
                    compact
                    extraCompact
                    showFilteredIconOnly
                    iconOnly
                  />
                )}
                {showAddRecord && (
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={handleAddRecord}
                    disabled={isAddRecordDisabled}
                    title={!canCreateRecord ? 'Adding records is disabled for this block' : 'Add a new record'}
                    className="h-7 w-7"
                    aria-label="Add record"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </>
            }
            className="border-border/80"
          />
        )}

      {(() => {
        const showUnifiedCalendarHeader = viewType === "calendar"
        if (!showUnifiedCalendarHeader) return null
        const hasAnyDateField = (safeTableFields || []).some((f) => f && f.type === "date")
        const compactBar = true
        const headerCompact = isFullPage
        const hasActiveQuickFilters = userQuickFilters.length > 0
        const calendarTitle = (blockTitle || "Planning Calendar").trim()

        return (
          <div className={cn("flex w-full min-w-0 flex-col border-b border-gray-200/80 bg-white", marketingDashboardStyle && "border-border/40 bg-muted/10")}>
            <div className="flex h-10 min-w-0 items-center justify-between gap-2 px-3 py-1.5">
              <h3 className="truncate text-base font-semibold text-foreground">{calendarTitle}</h3>
              <div className="flex items-center gap-2">
                {showAddRecord && canCreateRecord && (
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={handleAddRecord}
                    disabled={isAddRecordDisabled}
                    title="Add a new record"
                    className="h-7 w-7"
                    aria-label="Add record"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
                <Button type="button" size="sm" variant="outline" className="h-7 px-2.5 text-xs">
                  {hasActiveQuickFilters ? "Filtered" : "Filter"}
                </Button>
              </div>
            </div>
            <div className={`flex min-w-0 flex-wrap items-center gap-1.5 px-3 pb-1.5 ${headerCompact ? "pt-0" : "pt-0.5"}`}>
              {showQuickFilters && (
                <QuickFilterBar
                  storageKey={`mh:quickFilters:${pageId || "page"}:${block.id}`}
                  tableFields={safeTableFields}
                  viewDefaultFilters={viewDefaultFilters}
                  onChange={setUserQuickFilters}
                  compact
                  extraCompact={headerCompact}
                />
              )}
              {showQuickFilters && hasAnyDateField && <div className="h-4 w-px flex-shrink-0 bg-gray-200" aria-hidden />}
              {hasAnyDateField && (
                <CalendarAnchorControls
                  onScrollToDate={(date) => calendarScrollRef.current?.scrollToDate(date)}
                  disabled={false}
                  compact={compactBar}
                  extraCompact={headerCompact}
                />
              )}
            </div>
          </div>
        )
      })()}

      {/* New appearance wrapper active: it renders the title header. Keep Add record available without duplicating the title. */}
      {wrapperHasAppearanceSettings && showAddRecord && viewType !== "calendar" && (
        <div className="mb-1.5 flex flex-wrap justify-end gap-1.5">
          {showQuickFilters && (
            <QuickFilterBar
              storageKey={`mh:quickFilters:${pageId || "page"}:${block.id}`}
              tableFields={safeTableFields}
              viewDefaultFilters={viewDefaultFilters}
              onChange={setUserQuickFilters}
              compact
              extraCompact
              showFilteredIconOnly
              iconOnly
            />
          )}
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={handleAddRecord}
            disabled={isAddRecordDisabled}
            title={!canCreateRecord ? 'Adding records is disabled for this block' : 'Add a new record'}
            className="h-7 w-7"
            aria-label="Add record"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Single scroll container: GridView/CalendarView owns scroll; flex so child can flex-1. Calendar needs overflow-hidden so child controls scroll. */}
      {/* Non-full-page calendar must not force viewport min-height inside a fixed grid item, or lower content gets clipped. */}
      {/* When grid uses push-down (grouping), overflow-visible so content can grow and flow to page scroll. */}
      <div className={cn(
        isFitMode ? "h-auto" : "flex-1",
        isFullPage && "flex-1 min-h-0",
        "flex flex-col min-w-0 w-full min-h-0",
        (isGridWithPushDown || marketingDashboardStyle || (viewType === "calendar" && !isFullPage) || !allowInternalScroll) ? "overflow-visible" : "overflow-hidden"
      )}>
        {renderView()}
      </div>
    </div>
  )
}

