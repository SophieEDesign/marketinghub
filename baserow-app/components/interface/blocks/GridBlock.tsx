"use client"

import { useEffect, useState, useMemo, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { PageBlock, ViewType } from "@/lib/interface/types"
import GridViewWrapper from "@/components/grid/GridViewWrapper"
import CalendarView from "@/components/views/CalendarView"
import KanbanView from "@/components/views/KanbanView"
import TimelineView from "@/components/views/TimelineView"
import GalleryView from "@/components/views/GalleryView"
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
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import QuickFilterBar from "@/components/filters/QuickFilterBar"
import CalendarDateRangeControls from "@/components/views/calendar/CalendarDateRangeControls"
import { VIEWS_ENABLED } from "@/lib/featureFlags"
import { normalizeUuid } from "@/lib/utils/ids"
import { isAbortError } from "@/lib/api/error-handling"
import { startOfWeek, endOfWeek, startOfDay, addWeeks, startOfMonth, endOfMonth, addMonths } from "date-fns"
import type { GroupRule } from "@/lib/grouping/types"

interface GridBlockProps {
  block: PageBlock
  isEditing?: boolean
  pageTableId?: string | null // Table ID from the page
  pageId?: string | null // Page ID
  recordId?: string | null // Record ID for record review pages (used to detect record context)
  filters?: FilterConfig[] // Page-level or filter block filters
  filterTree?: FilterTree // Canonical filter tree from filter blocks (supports groups/OR)
  onRecordClick?: (recordId: string, tableId?: string) => void // Callback for record clicks (for RecordReview integration)
  pageShowAddRecord?: boolean // Page-level default for showing Add record
  onEphemeralHeightDelta?: (blockId: string, deltaPx: number) => void // Callback for ephemeral height changes (collapsible expansion)
  rowHeight?: number // Row height in pixels (for height calculation)
}

export default function GridBlock({
  block,
  isEditing = false,
  pageTableId = null,
  pageId = null,
  recordId = null,
  filters = [],
  filterTree = null,
  onRecordClick,
  pageShowAddRecord = false,
  onEphemeralHeightDelta,
  rowHeight = 30,
}: GridBlockProps) {
  const { config } = block
  
  // Track base height (collapsed state) to calculate deltas
  const baseHeightRef = useRef<number | null>(null)
  const previousHeightRef = useRef<number | null>(null)
  
  // Convert total height from GridView to ephemeral delta
  const handleHeightChange = useCallback((totalHeightGridUnits: number) => {
    if (!onEphemeralHeightDelta) return
    
    // Convert grid units back to pixels for delta calculation
    const totalHeightPx = totalHeightGridUnits * rowHeight
    
    // Track minimum height as base (when most collapsed)
    if (baseHeightRef.current === null) {
      baseHeightRef.current = totalHeightPx
      previousHeightRef.current = totalHeightPx
      return // First measurement, no delta yet
    }
    
    // Update base if current is lower (more collapsed)
    baseHeightRef.current = Math.min(baseHeightRef.current, totalHeightPx)
    
    // Calculate delta from base (ephemeral expansion)
    const deltaPx = totalHeightPx - baseHeightRef.current
    
    // Only report if height actually changed
    if (previousHeightRef.current !== null && Math.abs(totalHeightPx - previousHeightRef.current) > 1) {
      // Calculate previous delta
      const previousDelta = (previousHeightRef.current || baseHeightRef.current) - baseHeightRef.current
      const deltaChange = deltaPx - previousDelta
      
      // Report delta change (positive = expanding, negative = collapsing)
      if (Math.abs(deltaChange) > 1) {
        onEphemeralHeightDelta(block.id, deltaChange)
      }
    }
    
    previousHeightRef.current = totalHeightPx
  }, [onEphemeralHeightDelta, block.id, rowHeight])
  // Grid block table_id resolution: use config.table_id first, fallback to pageTableId
  // This ensures calendar/list/kanban pages work even if table_id isn't explicitly set in block config
  // Backward compatibility: some legacy data used camelCase `tableId`
  const legacyTableId = (config as any)?.tableId
  const tableId = config?.table_id || legacyTableId || pageTableId || config?.base_table || null
  // RULE: Views are currently not used; ignore view_id unless explicitly enabled.
  const viewId = VIEWS_ENABLED ? config?.view_id : null
  const viewUuid = useMemo(() => normalizeUuid(viewId), [viewId])
  const viewType: ViewType = config?.view_type || 'grid'
  
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
  const visibleFieldsConfig = Array.isArray(config?.visible_fields) 
    ? config.visible_fields 
    : (config?.visible_fields ? [config.visible_fields] : [])
  const blockBaseFilters = Array.isArray(config?.filters) ? config.filters : []
  const sortsConfig = Array.isArray(config?.sorts) ? config.sorts : []

  const viewDefaultFilters = useMemo<FilterConfig[]>(() => {
    return (blockBaseFilters || []).map((f: any) => normalizeFilter(f))
  }, [blockBaseFilters])

  const [userQuickFilters, setUserQuickFilters] = useState<FilterConfig[]>([])
  // Calendar-only: date range filter state (lifted here so we can render controls in a unified header panel)
  const [calendarDateFrom, setCalendarDateFrom] = useState<Date | undefined>(undefined)
  const [calendarDateTo, setCalendarDateTo] = useState<Date | undefined>(undefined)
  
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

  // Merge filters with proper precedence:
  // - builder-owned view defaults (with session-only user overrides)
  // - filter block filters (additive, cannot override)
  const allFilters = useMemo(() => {
    return mergeFilters(viewFiltersWithUserOverrides, filters, [])
  }, [viewFiltersWithUserOverrides, filters])
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

  // Determine visible fields: use config.visible_fields if provided, otherwise use view_fields
  // Ensure all values are arrays to prevent runtime errors
  type ViewFieldType = {
    field_name: string
    visible: boolean
    position: number
  }
  const safeViewFields = asArray<ViewFieldType>(viewFields)
  const visibleFields = visibleFieldsConfig.length > 0
    ? visibleFieldsConfig.map((fieldName: string) => {
        const field = safeTableFields.find(f => f.name === fieldName || f.id === fieldName)
        return field ? { field_name: field.name, visible: true, position: 0 } : null
      }).filter(Boolean) as Array<{ field_name: string; visible: boolean; position: number }>
    : safeViewFields.filter(f => f && f.visible)

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

  const blockShowAddRecord = (appearance as any).show_add_record
  const showAddRecord =
    blockShowAddRecord === true || (blockShowAddRecord == null && pageShowAddRecord)

  // Toolbar visibility: keep edit mode WYSIWYG (match live view).
  const showToolbar = appearance.show_toolbar !== false
  // For non-grid views, the only "toolbar" we currently render is QuickFilterBar (filters).
  const showQuickFilters = showToolbar && appearance.show_filter !== false

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
    const fieldIds = visibleFields.map(f => f.field_name)
    
    switch (viewType) {
      case 'calendar': {
        // Calendar requires tableId - if missing, show error or let CalendarView handle it
        if (!tableId) {
          return (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
              <div className="text-center">
                <p className="mb-2">{isEditing ? "Calendar view requires a table connection." : "No table configured"}</p>
                {isEditing && (
                  <p className="text-xs text-gray-400">Configure a table in block settings.</p>
                )}
              </div>
            </div>
          )
        }
        
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
        
        // Check block config first
        const dateFieldFromConfig = config.calendar_date_field || config.start_date_field
        
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
        
        // CalendarView will load view config and use that, so we don't need to error here
        // Just pass the fallback dateFieldId in case view config doesn't have one
        // Pass tableId as string (not null) since we've validated it above
        
        return (
          <CalendarView
            tableId={tableId}
            viewId={viewUuid || ''}
            dateFieldId={dateFieldId}
            fieldIds={fieldIds}
            tableFields={tableFields}
            filters={allFilters}
            filterTree={filterTree}
            blockConfig={config} // Pass block config so CalendarView can read date_field from page settings
            onRecordClick={onRecordClick} // CRITICAL: Pass onRecordClick for RecordReview integration
            colorField={appearance.color_field}
            imageField={appearance.image_field}
            fitImageSize={appearance.fit_image_size}
            reloadKey={refreshKey}
            dateFrom={calendarDateFrom}
            dateTo={calendarDateTo}
            onDateFromChange={setCalendarDateFrom}
            onDateToChange={setCalendarDateTo}
            showDateRangeControls={false}
          />
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
            tableId={tableId}
            viewId={viewUuid || ''}
            groupingFieldId={groupByFieldId}
            fieldIds={fieldIds}
            searchQuery=""
            tableFields={tableFields}
            colorField={appearance.color_field}
            imageField={appearance.image_field}
            fitImageSize={appearance.fit_image_size}
            blockConfig={config}
            onRecordClick={onRecordClick}
            reloadKey={refreshKey}
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
          <TimelineView
            tableId={tableId!}
            viewId={viewUuid || ''}
            dateFieldId={dateFieldId}
            startDateFieldId={dateFromFieldFromConfig}
            endDateFieldId={dateToFieldFromConfig}
            fieldIds={fieldIds}
            searchQuery=""
            tableFields={tableFields}
            filters={allFilters} // Pass merged filters
            blockConfig={config} // Pass block config so TimelineView can read date_from/date_to from page settings
            colorField={appearance.color_field}
            imageField={appearance.image_field}
            fitImageSize={appearance.fit_image_size}
            onRecordClick={onRecordClick}
            reloadKey={refreshKey}
            // Card field configuration
            titleField={config.timeline_title_field || config.card_title_field}
            cardField1={config.timeline_field_1 || config.card_field_1}
            cardField2={config.timeline_field_2 || config.card_field_2}
            cardField3={config.timeline_field_3 || config.card_field_3}
            // Grouping
            groupByField={config.timeline_group_by || config.group_by_field || config.group_by}
            // Appearance settings
            wrapTitle={appearance.timeline_wrap_title || appearance.card_wrap_title}
            rowSize={appearance.row_height as 'compact' | 'medium' | 'comfortable' || 'medium'}
          />
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
            defaultGroupsCollapsed={galleryDefaultGroupsCollapsed}
            colorField={appearance.color_field}
            imageField={appearance.image_field}
            fitImageSize={appearance.fit_image_size}
            reloadKey={refreshKey}
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

        // Determine if record clicks should be enabled
        const handleRecordClick = allowOpenRecord
          ? (onRecordClick || ((recordId) => {
              // Default: navigate to record page if no callback provided
              if (tableId) {
                window.location.href = `/tables/${tableId}/records/${recordId}`
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

        // Only pass onHeightChange when grouping is active
        const isGrouped = !!effectiveGroupBy

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
            initialTableFields={tableFields}
            isEditing={isEditing}
            onRecordClick={handleRecordClick}
            modalFields={(config as any).modal_fields}
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
            permissions={{
              mode: permissions.mode || 'edit',
              allowInlineCreate: isViewOnly ? false : allowInlineCreate,
              allowInlineDelete: isViewOnly ? false : allowInlineDelete,
              allowOpenRecord,
            }}
            hideEmptyState={hideEmptyState}
            blockLevelSettings={blockLevelSettings}
            onHeightChange={isGrouped ? handleHeightChange : undefined}
            rowHeightPixels={rowHeight}
          />
        )
    }
  }

  return (
    <div className="h-full w-full flex flex-col overflow-hidden" style={blockStyle}>
      {/* Legacy header (title + optional add record) - only when appearance wrapper is not active */}
      {!wrapperHasAppearanceSettings &&
        (((appearance.showTitle ?? (appearance as any).show_title) !== false && blockTitle) ||
          showAddRecord) && (
          <div
            className="mb-4 pb-2 border-b flex items-center justify-between gap-3"
            style={{
              backgroundColor: appearance.header_background,
              color: appearance.header_text_color || appearance.title_color,
            }}
          >
            <div className="min-w-0 flex-1">
              {((appearance.showTitle ?? (appearance as any).show_title) !== false && blockTitle) && (
                <h3 className="text-lg font-semibold truncate">
                  {blockTitle}
                </h3>
              )}
            </div>
            {showAddRecord && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddRecord}
                disabled={isAddRecordDisabled}
                title={!canCreateRecord ? 'Adding records is disabled for this block' : 'Add a new record'}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add record
              </Button>
            )}
          </div>
        )}

      {(() => {
        const showUnifiedCalendarHeader = !isEditing && viewType === "calendar"
        if (!showUnifiedCalendarHeader) return null
        const hasAnyDateField = (safeTableFields || []).some((f) => f && f.type === "date")

        return (
          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              {showQuickFilters && (
                <QuickFilterBar
                  storageKey={`mh:quickFilters:${pageId || "page"}:${block.id}`}
                  tableFields={safeTableFields}
                  viewDefaultFilters={viewDefaultFilters}
                  onChange={setUserQuickFilters}
                />
              )}

              {showAddRecord && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddRecord}
                  disabled={isAddRecordDisabled}
                  title={!canCreateRecord ? "Adding records is disabled for this block" : "Add a new record"}
                  className="bg-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add record
                </Button>
              )}
            </div>

            {/* Date Range (calendar-only) */}
            {hasAnyDateField && (
              <CalendarDateRangeControls
                dateFrom={calendarDateFrom}
                dateTo={calendarDateTo}
                onDateFromChange={setCalendarDateFrom}
                onDateToChange={setCalendarDateTo}
                disabled={false}
                defaultPreset={config?.default_date_range_preset && config.default_date_range_preset !== 'none' 
                  ? (config.default_date_range_preset as 'today' | 'thisWeek' | 'thisMonth' | 'nextWeek' | 'nextMonth' | 'custom')
                  : null}
              />
            )}
          </div>
        )
      })()}

      {/* New appearance wrapper active: it renders the title header. Keep Add record available without duplicating the title. */}
      {wrapperHasAppearanceSettings && showAddRecord && viewType !== "calendar" && (
        <div className="mb-3 flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleAddRecord}
            disabled={isAddRecordDisabled}
            title={!canCreateRecord ? 'Adding records is disabled for this block' : 'Add a new record'}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add record
          </Button>
        </div>
      )}

      {/* Airtable-style quick filters (session-only; never saved to the view) */}
      {showQuickFilters && viewType !== "calendar" && (
        <QuickFilterBar
          storageKey={`mh:quickFilters:${pageId || "page"}:${block.id}`}
          tableFields={safeTableFields}
          viewDefaultFilters={viewDefaultFilters}
          onChange={setUserQuickFilters}
        />
      )}

      <div className="flex-1 min-h-0">
        {renderView()}
      </div>
    </div>
  )
}

