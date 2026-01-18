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
import { useViewMeta } from "@/hooks/useViewMeta"
import { asArray } from "@/lib/utils/asArray"
import type { TableField } from "@/types/fields"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import QuickFilterBar from "@/components/filters/QuickFilterBar"
import CreateRecordModal from "@/components/records/CreateRecordModal"
import { useToast } from "@/components/ui/use-toast"
import { VIEWS_ENABLED } from "@/lib/featureFlags"

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
  onRecordClick?: (recordId: string) => void
  pageShowAddRecord?: boolean // Page-level default for showing Add record
}

export default function ListBlock({
  block,
  isEditing = false,
  pageTableId = null,
  pageId = null,
  filters = [],
  onRecordClick,
  pageShowAddRecord = false,
}: ListBlockProps) {
  const { toast } = useToast()
  const { config } = block
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
  const [creating, setCreating] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [table, setTable] = useState<{ id: string; supabase_table: string; name?: string | null } | null>(null)
  const [tableFields, setTableFields] = useState<TableField[]>([])
  
  // Get groupBy from block config (not view config)
  const groupBy = config?.group_by
  
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

  // Get list-specific field configuration (must be declared before any early return)
  const titleField = config.list_title_field || config.title_field || ""
  const subtitleFields = config.list_subtitle_fields || []
  const imageField = config.list_image_field || config.image_field || ""
  const pillFields = config.list_pill_fields || []
  const metaFields = config.list_meta_fields || []

  // Apply appearance settings (must be declared before any early return)
  const appearance = config.appearance || {}
  const blockStyle: React.CSSProperties = {
    backgroundColor: appearance.background_color,
    borderColor: appearance.border_color,
    borderWidth: appearance.border_width !== undefined ? `${appearance.border_width}px` : "1px",
    borderRadius: appearance.border_radius !== undefined ? `${appearance.border_radius}px` : "8px",
    padding: appearance.padding !== undefined ? `${appearance.padding}px` : "16px",
  }

  const blockShowAddRecord = (appearance as any).show_add_record
  const showAddRecord =
    blockShowAddRecord === true || (blockShowAddRecord == null && pageShowAddRecord)
  const permissions = config.permissions || {}
  const isViewOnly = permissions.mode === "view"
  const allowInlineCreate = permissions.allowInlineCreate ?? true
  const canCreateRecord = !isViewOnly && allowInlineCreate
  const canEdit = !isViewOnly
  const allowOpenRecord = permissions.allowOpenRecord ?? true
  const enableRecordOpen = appearance.enable_record_open ?? true
  const canOpenRecord = allowOpenRecord && enableRecordOpen

  const titleFieldObj = useMemo(() => {
    if (!titleField) return null
    return safeTableFields.find((f) => f.name === titleField || f.id === titleField) ?? null
  }, [safeTableFields, titleField])

  const canPrefillTitle =
    titleFieldObj?.type === "text" ||
    titleFieldObj?.type === "long_text" ||
    titleFieldObj?.type === "email" ||
    titleFieldObj?.type === "url"

  const handleOpenCreateModal = () => {
    if (!showAddRecord || !canCreateRecord || isLoading || !table || !tableId) return
    if (creating) return
    setCreateModalOpen(true)
  }

  const handleCreateRecord = useCallback(
    async (primaryValue: string) => {
      if (!showAddRecord || !canCreateRecord || isLoading || !table || !tableId) return
      if (creating) return

      setCreating(true)
      try {
        const supabase = createClient()
        const newData: Record<string, any> = {}

        const defaultsFromFilters = deriveDefaultValuesFromFilters(allFilters, safeTableFields)
        if (Object.keys(defaultsFromFilters).length > 0) {
          Object.assign(newData, defaultsFromFilters)
        }

        if (canPrefillTitle && titleFieldObj?.name && primaryValue) {
          newData[titleFieldObj.name] = primaryValue
        }

        const { data, error } = await supabase
          .from(table.supabase_table)
          .insert([newData])
          .select()
          .single()

        if (error) throw error

        const createdId = (data as any)?.id || (data as any)?.record_id
        if (!createdId) return

        toast({ title: "Record created" })
        // Contract: creating a record must NOT auto-open it.
        // User can open via the dedicated chevron (or optional double-click) in the list.
        setCreateModalOpen(false)
        setRefreshKey((k) => k + 1)
      } finally {
        setCreating(false)
      }
    },
    [
      canCreateRecord,
      canPrefillTitle,
      creating,
      isLoading,
      onRecordClick,
      showAddRecord,
      table,
      tableId,
      titleFieldObj?.name,
      toast,
    ]
  )

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

  // Check if title field is configured
  if (!titleField && !isEditing) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <p className="mb-2">List view requires a title field</p>
          <p className="text-xs text-gray-400">Configure the title field in block settings.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full overflow-auto" style={blockStyle}>
      <CreateRecordModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        tableName={table?.name || undefined}
        primaryFieldLabel={canPrefillTitle ? (titleFieldObj?.name || null) : null}
        primaryFieldPlaceholder={
          canPrefillTitle && titleFieldObj?.name ? `Enter ${titleFieldObj.name}` : undefined
        }
        isSaving={creating}
        onCreate={handleCreateRecord}
      />
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
              disabled={!canCreateRecord || isLoading || !table || !tableId || creating}
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
        tableId={table.id}
        viewId={viewId || undefined}
        supabaseTableName={table.supabase_table}
        tableFields={safeTableFields}
        filters={allFilters}
        sorts={activeSorts}
        groupBy={groupBy}
        defaultChoiceGroupsCollapsed={defaultChoiceGroupsCollapsed}
        searchQuery=""
        onRecordClick={onRecordClick}
        showAddRecord={showAddRecord}
        canCreateRecord={canCreateRecord}
        canEdit={canEdit}
        canOpenRecord={canOpenRecord}
        titleField={titleField}
        subtitleFields={subtitleFields}
        imageField={imageField}
        pillFields={pillFields}
        metaFields={metaFields}
        reloadKey={refreshKey}
      />
    </div>
  )
}

