"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { PageBlock } from "@/lib/interface/types"
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
import { asArray } from "@/lib/utils/asArray"
import type { TableField } from "@/types/fields"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import QuickFilterBar from "@/components/filters/QuickFilterBar"
import { useRecordModal } from "@/contexts/RecordModalContext"
import { useToast } from "@/components/ui/use-toast"
import { VIEWS_ENABLED } from "@/lib/featureFlags"
import type { GroupRule } from "@/lib/grouping/types"
import type { FieldLayoutItem } from "@/lib/interface/field-layout-utils"
import { getVisibleFieldsForCard } from "@/lib/interface/field-layout-helpers"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isUuidLike(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value)
}

interface ListBlockProps {
  block: PageBlock
  isEditing?: boolean
  pageTableId?: string | null
  pageId?: string | null
  filters?: FilterConfig[]
  filterTree?: FilterTree
  onRecordClick?: (recordId: string) => void
  pageShowAddRecord?: boolean // Page-level default for showing Add record
  onEphemeralHeightDelta?: (blockId: string, deltaPx: number) => void // Callback for ephemeral height changes (collapsible expansion)
  rowHeight?: number // Row height in pixels (for height calculation)
}

export default function ListBlock({
  block,
  isEditing = false,
  pageTableId = null,
  pageId = null,
  filters = [],
  filterTree = null,
  onRecordClick,
  pageShowAddRecord = false,
  onEphemeralHeightDelta,
  rowHeight = 30,
}: ListBlockProps) {
  const { toast } = useToast()
  const { config } = block
  const cascadeContext = useMemo(
    () => (config ? { blockConfig: config } : undefined),
    [config]
  )

  // Track base height (collapsed state) to calculate deltas
  const baseHeightRef = useRef<number | null>(null)
  const previousHeightRef = useRef<number | null>(null)
  
  // Convert total height to ephemeral delta
  const handleHeightChange = useCallback((totalHeightGridUnits: number) => {
    if (!onEphemeralHeightDelta) return
    
    const totalHeightPx = totalHeightGridUnits * rowHeight
    
    if (baseHeightRef.current === null) {
      baseHeightRef.current = totalHeightPx
      previousHeightRef.current = totalHeightPx
      return
    }
    
    baseHeightRef.current = Math.min(baseHeightRef.current, totalHeightPx)
    const deltaPx = totalHeightPx - baseHeightRef.current
    
    if (previousHeightRef.current !== null && Math.abs(totalHeightPx - previousHeightRef.current) > 1) {
      const previousDelta = (previousHeightRef.current || baseHeightRef.current) - baseHeightRef.current
      const deltaChange = deltaPx - previousDelta
      
      if (Math.abs(deltaChange) > 1) {
        onEphemeralHeightDelta(block.id, deltaChange)
      }
    }
    
    previousHeightRef.current = totalHeightPx
  }, [onEphemeralHeightDelta, block.id, rowHeight])
  const tableId = config?.table_id || pageTableId || (config as any)?.base_table || null
  // RULE: Views are currently not used; ignore view_id unless explicitly enabled.
  const viewId = VIEWS_ENABLED ? config?.view_id : null
  const blockBaseFilters = Array.isArray(config?.filters) ? config.filters : []
  const sortsConfig = Array.isArray(config?.sorts) ? config.sorts : []
  
  const viewDefaultFilters = useMemo<FilterConfig[]>(() => {
    return (blockBaseFilters || []).map((f: any) => normalizeFilter(f))
  }, [blockBaseFilters])

  const [userQuickFilters, setUserQuickFilters] = useState<FilterConfig[]>([])

  const viewFiltersWithUserOverrides = useMemo(() => {
    return mergeViewDefaultFiltersWithUserQuickFilters(viewDefaultFilters, userQuickFilters)
  }, [viewDefaultFilters, userQuickFilters])

  // Merge filters (view defaults + session-only user overrides) + filter block filters
  const allFilters = useMemo(() => {
    return mergeFilters(viewFiltersWithUserOverrides, filters, [])
  }, [viewFiltersWithUserOverrides, filters])

  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const { openRecordModal } = useRecordModal()
  const [table, setTable] = useState<{ id: string; supabase_table: string; name?: string | null } | null>(null)
  const [tableFields, setTableFields] = useState<TableField[]>([])
  
  // Get groupBy from block config (not view config)
  const groupBy = config?.group_by
  
  // Grouping (optional) for list view:
  // Support both nested groups (group_by_rules) and legacy single field (group_by_field/group_by)
  const groupByRulesFromConfig = (config as any).group_by_rules as GroupRule[] | undefined
  
  // List group default collapse behavior (List view specific)
  // Default: collapsed/closed unless explicitly set to false.
  // Back-compat: `list_choice_groups_default_collapsed` (older key name).
  const defaultChoiceGroupsCollapsed =
    (config as any)?.list_groups_default_collapsed ??
    (config as any)?.list_choice_groups_default_collapsed ??
    true

  // For hooks/queries, ensure we only pass a real UUID table id.
  const effectiveTableIdForHooks = useMemo(() => {
    if (!tableId) return null
    if (isUuidLike(tableId)) return tableId
    // If tableId is a name, we will resolve it during load and then re-render with `table.id`.
    return table?.id || null
  }, [tableId, table?.id])

  // Use cached metadata hook
  const { metadata: viewMeta, loading: metaLoading } = useViewMeta(viewId, effectiveTableIdForHooks)

  const safeTableFields = asArray<TableField>(tableFields)

  const viewSorts = useMemo(() => {
    if (!viewMeta?.sorts) return []
    return viewMeta.sorts.map(s => ({
      id: s.id || '',
      field_name: s.field_name,
      direction: s.direction,
    }))
  }, [viewMeta?.sorts])

  // Track loading state
  const loadingRef = useRef(false)
  const tableIdRef = useRef<string | null>(null)
  const viewIdRef = useRef<string | null | undefined>(null)
  const prevTableIdRef = useRef<string | null>(null)
  const prevViewIdRef = useRef<string | null | undefined>(null)

  useEffect(() => {
    if (!tableId) {
      setLoading(false)
      prevTableIdRef.current = null
      prevViewIdRef.current = null
      return
    }

    const tableIdChanged = prevTableIdRef.current !== tableId
    const viewIdChanged = prevViewIdRef.current !== viewId
    
    if (!tableIdChanged && !viewIdChanged) {
      return
    }

    if (loadingRef.current && tableIdRef.current === tableId && viewIdRef.current === viewId) {
      return
    }

    prevTableIdRef.current = tableId
    prevViewIdRef.current = viewId
    loadingRef.current = true
    tableIdRef.current = tableId
    viewIdRef.current = viewId
    setLoading(true)

    async function loadTableData() {
      try {
        const supabase = createClient()

        // Resolve tableId which may be:
        // - a UUID (tables.id)
        // - a legacy table name (tables.name)
        // - a supabase table name (tables.supabase_table)
        let resolvedTable: { id: string; supabase_table: string; name?: string | null } | null = null

        if (isUuidLike(tableId)) {
          const byId = await supabase
            .from("tables")
            .select("id, supabase_table, name")
            .eq("id", tableId)
            .maybeSingle()
          if (byId.data) resolvedTable = byId.data as any
        } else {
          const byName = await supabase
            .from("tables")
            .select("id, supabase_table, name")
            .eq("name", tableId)
            .maybeSingle()
          if (byName.data) {
            resolvedTable = byName.data as any
          } else {
            const bySupabaseTable = await supabase
              .from("tables")
              .select("id, supabase_table, name")
              .eq("supabase_table", tableId)
              .maybeSingle()
            if (bySupabaseTable.data) resolvedTable = bySupabaseTable.data as any
          }
        }

        if (!resolvedTable?.id) {
          setTable(null)
          setTableFields([])
          return
        }

        setTable(resolvedTable)

        const tableFieldsRes = await supabase
          .from("table_fields")
          .select("*")
          .eq("table_id", resolvedTable.id)
          .order("position", { ascending: true })

        const normalizedFields = asArray<TableField>(tableFieldsRes.data)
        setTableFields(normalizedFields)
      } catch (error) {
        console.error("Error loading table data:", error)
      } finally {
        setLoading(false)
        loadingRef.current = false
      }
    }

    loadTableData()
  }, [tableId, viewId])

  const isLoading = loading || metaLoading

  /**
   * Airtable-style card layout:
   * - Primary source: field_layout items where visible_in_card !== false
   * - Fallback: visible_fields / legacy list_* config
   *
   * Mental model:
   * Tables show fields, cards show layouts. Interface List = vertical cards.
   */
  const fieldLayout = (config as any)?.field_layout as FieldLayoutItem[] | undefined

  const layoutCardFields: TableField[] = useMemo(() => {
    if (!Array.isArray(fieldLayout) || fieldLayout.length === 0) {
      return []
    }
    try {
      return getVisibleFieldsForCard(fieldLayout, safeTableFields)
    } catch {
      // Defensive: if layout is malformed, fall back to legacy behaviour.
      return []
    }
  }, [fieldLayout, safeTableFields])

  // Legacy visible_fields are still used as a fallback when no card layout exists.
  const visibleFields = Array.isArray(config.visible_fields) ? config.visible_fields : []

  const layoutFieldNames = layoutCardFields.map((f) => f.name)

  // Title: prefer explicit override that also lives in the card layout, then layout order, then legacy fallbacks.
  const layoutTitleFieldName =
    (config.list_title_field && layoutFieldNames.includes(config.list_title_field)
      ? config.list_title_field
      : null) ||
    (config.title_field && layoutFieldNames.includes(config.title_field)
      ? config.title_field
      : null) ||
    layoutCardFields[0]?.name

  const legacyTitleFallback =
    visibleFields[0] ||
    safeTableFields.find((f) => f.name !== "id" && (f.type === "text" || f.type === "long_text"))?.name ||
    safeTableFields.find((f) => f.name !== "id")?.name ||
    ""

  const titleField = layoutCardFields.length > 0 ? layoutTitleFieldName || legacyTitleFallback : (
    config.list_title_field ||
    config.title_field ||
    legacyTitleFallback
  )

  // Subtitle fields: remaining card layout fields after the title (max 3), or legacy subtitle config.
  const subtitleFields =
    layoutCardFields.length > 0
      ? layoutCardFields
          .map((f) => f.name)
          .filter((name) => name && name !== titleField)
          .slice(0, 3)
      : (() => {
          const restVisible = visibleFields.filter((f) => f !== titleField)
          return restVisible.length > 0 ? restVisible.slice(0, 3) : (config.list_subtitle_fields || [])
        })()

  // Image: explicit per-block overrides win; otherwise fall back to first attachment/URL field in the card layout.
  let imageField: string =
    config.list_image_field || (config.appearance as any)?.image_field || config.image_field || ""

  // Color field for status-based row coloring (single-select; uses choice colors)
  const colorField = (config.appearance as any)?.color_field || config.color_field || ""
  if (!imageField && layoutCardFields.length > 0) {
    const attachmentOrUrl = layoutCardFields.find(
      (f) => f.type === "attachment" || f.type === "url"
    )
    if (attachmentOrUrl) {
      imageField = attachmentOrUrl.name
    }
  }

  // Pills: any single_select / multi_select fields in the card layout; fallback to legacy list_pill_fields.
  const pillFields =
    layoutCardFields.length > 0
      ? layoutCardFields
          .filter((f) => f.type === "single_select" || f.type === "multi_select")
          .map((f) => f.name)
      : visibleFields.length > 0
        ? visibleFields.filter((fn) => {
            const f = safeTableFields.find((x) => x.name === fn || x.id === fn)
            return f && (f.type === "single_select" || f.type === "multi_select")
          })
        : (config.list_pill_fields || [])

  // Meta fields: date/number-style fields in the card layout; fallback to legacy list_meta_fields.
  const metaFields =
    layoutCardFields.length > 0
      ? layoutCardFields
          .filter((f) => ["date", "number", "percent", "currency"].includes(f.type as string))
          .map((f) => f.name)
      : visibleFields.length > 0
        ? visibleFields.filter((fn) => {
            const f = safeTableFields.find((x) => x.name === fn || x.id === fn)
            return f && ["date", "number", "percent", "currency"].includes(f.type as string)
          })
        : (config.list_meta_fields || [])

  // Apply appearance settings (must be declared before any early return)
  const appearance = config.appearance || {}
  const blockStyle: React.CSSProperties = {
    backgroundColor: appearance.background_color,
    borderColor: appearance.border_color,
    borderWidth: appearance.border_width !== undefined ? `${appearance.border_width}px` : "1px",
    borderRadius: appearance.border_radius !== undefined ? `${appearance.border_radius}px` : "8px",
    padding: appearance.padding !== undefined ? `${appearance.padding}px` : "16px",
  }

  // Add record button: when Appearance toggle was removed, default to Data > Permissions (allowInlineCreate)
  const blockShowAddRecord = (appearance as any).show_add_record
  const permissions = config.permissions || {}
  const showAddRecord =
    blockShowAddRecord === true ||
    (blockShowAddRecord == null && (pageShowAddRecord || (permissions.allowInlineCreate ?? true)))
  const isViewOnly = permissions.mode === "view"
  const allowInlineCreate = permissions.allowInlineCreate ?? true
  const canCreateRecord = !isViewOnly && allowInlineCreate

  const titleFieldObj = useMemo(() => {
    if (!titleField) return null
    return safeTableFields.find((f) => f.name === titleField || f.id === titleField) ?? null
  }, [safeTableFields, titleField])

  const canPrefillTitle =
    titleFieldObj?.type === "text" ||
    titleFieldObj?.type === "long_text" ||
    titleFieldObj?.type === "email" ||
    titleFieldObj?.type === "url"

  // Modal uses same field set as Data (single source of truth) — must be before handleOpenCreateModal
  const modalFields = (config.visible_fields?.length ? config.visible_fields : (config as any)?.modal_fields) as
    | string[]
    | undefined

  const handleOpenCreateModal = useCallback(() => {
    if (!showAddRecord || !canCreateRecord || isLoading || !table || !tableId) return
    const createInitialData = deriveDefaultValuesFromFilters(allFilters, safeTableFields)
    const initialData = Object.keys(createInitialData).length > 0 ? createInitialData : undefined
    openRecordModal({
      tableId: table.id,
      recordId: null,
      tableFields: safeTableFields,
      modalFields,
      initialData,
      supabaseTableName: table.supabase_table,
      cascadeContext,
      interfaceMode: "view",
      onSave: () => {
        toast({ title: "Record created" })
        setRefreshKey((k) => k + 1)
      },
      onDeleted: () => setRefreshKey((k) => k + 1),
    })
  }, [showAddRecord, canCreateRecord, isLoading, table, tableId, allFilters, safeTableFields, modalFields, config, openRecordModal, toast])

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

  // Convert sorts to ListView format
  const activeSorts = sortsConfig.length > 0
    ? sortsConfig.map((s: any) => ({
        field_name: s.field || '',
        direction: s.direction || 'asc',
      }))
    : viewSorts.map(s => ({
        field_name: s.field_name,
        direction: s.direction as 'asc' | 'desc',
      }))

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        Loading...
      </div>
    )
  }

  if (!table) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <p className="mb-2">
            {isEditing ? "This block requires a valid table connection." : "Table not found"}
          </p>
          {isEditing && (
            <p className="text-xs text-gray-400">Select a table in block settings.</p>
          )}
        </div>
      </div>
    )
  }

  // Title: from override, first visible field, or table default (single source of truth)
  const effectiveTitleField =
    titleField ||
    visibleFields[0] ||
    safeTableFields.find((f) => f.name !== "id" && (f.type === "text" || f.type === "long_text"))?.name ||
    safeTableFields.find((f) => f.name !== "id")?.name
  if (!effectiveTitleField && !isEditing) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <p className="mb-2">List view requires a title field</p>
          <p className="text-xs text-gray-400">Add fields in the Data tab or set a title field override.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full overflow-auto" style={blockStyle}>
      {(((appearance.showTitle ?? (appearance as any).show_title) !== false && (appearance.title || (isEditing ? config.title : table?.name))) || showAddRecord) && (
        <div
          className="mb-4 pb-2 border-b flex items-center justify-between gap-3"
          style={{
            backgroundColor: appearance.header_background,
            color: appearance.header_text_color || appearance.title_color,
          }}
        >
          <div className="min-w-0 flex-1">
            {((appearance.showTitle ?? (appearance as any).show_title) !== false && (appearance.title || (isEditing ? config.title : table?.name))) && (
              <h3 className="text-lg font-semibold truncate">{appearance.title || (isEditing ? config.title : table?.name)}</h3>
            )}
          </div>
          {showAddRecord && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleOpenCreateModal}
              disabled={!canCreateRecord || isLoading || !table || !tableId}
              title={!canCreateRecord ? 'Adding records is disabled for this block' : 'Add a new record'}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add record
            </Button>
          )}
        </div>
      )}

      {/* Airtable-style quick filters (session-only; never saved to the view) */}
      {!isEditing && (
        <QuickFilterBar
          storageKey={`mh:quickFilters:${pageId || "page"}:${block.id}`}
          tableFields={safeTableFields}
          viewDefaultFilters={viewDefaultFilters}
          onChange={setUserQuickFilters}
        />
      )}

      <ListView
        highlightRules={config.highlight_rules}
        colorField={colorField || undefined}
        tableId={table.id}
        viewId={viewId || undefined}
        supabaseTableName={table.supabase_table}
        tableFields={safeTableFields}
        filters={allFilters}
        sorts={activeSorts}
        groupBy={groupBy}
        groupByRules={groupByRulesFromConfig}
        defaultChoiceGroupsCollapsed={defaultChoiceGroupsCollapsed}
        searchQuery=""
        onRecordClick={onRecordClick}
        showAddRecord={showAddRecord}
        canCreateRecord={canCreateRecord}
        titleField={effectiveTitleField || titleField}
        subtitleFields={subtitleFields}
        imageField={imageField}
        pillFields={pillFields}
        metaFields={metaFields}
        modalFields={modalFields}
        reloadKey={refreshKey}
        onHeightChange={(groupBy || (groupByRulesFromConfig && groupByRulesFromConfig.length > 0)) ? handleHeightChange : undefined}
        rowHeight={rowHeight}
        cascadeContext={cascadeContext}
      />
    </div>
  )
}

