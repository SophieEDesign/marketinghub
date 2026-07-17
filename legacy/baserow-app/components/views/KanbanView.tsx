"use client"

import { useState, useEffect, useMemo, useCallback, memo } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import CardContainer from "@/components/ui/CardContainer"
import { ChevronRight, Plus, Settings, Columns } from "lucide-react"
import { filterRowsBySearch } from "@/lib/search/filterRows"
import type { TableRow } from "@/types/database"
import type { TableField } from "@/types/fields"
import { resolveChoiceColor, normalizeHexColor } from '@/lib/field-colors'
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import { applyFiltersToQuery, deriveDefaultValuesFromFilters, type FilterConfig } from "@/lib/interface/filters"
import { isAbortError } from "@/lib/api/error-handling"
import { getOptionValueToLabelMap } from "@/lib/fields/select-options"
import EmptyState from "@/components/empty-states/EmptyState"
import type { HighlightRule } from "@/lib/interface/types"
import { evaluateHighlightRules, getFormattingStyle } from "@/lib/conditional-formatting/evaluator"
import { getLinkedFieldValueFromRow, linkedValueToIds, resolveLinkedFieldDisplayMap } from "@/lib/dataView/linkedFields"
import type { LinkedField } from "@/types/fields"
import { getFieldDisplayName } from "@/lib/fields/display"
import RecordCard from "@/components/views/cards/RecordCard"
import { cn } from "@/lib/utils"
import { normalizeSelectOptionsForUi } from "@/lib/fields/select-options"
import {
  applySoftDeleteFilter,
  fetchPhysicalColumns,
  filterConfigsToQueryableColumns,
  hasPhysicalColumnName,
} from "@/lib/supabase/physical-columns"

function normalizeKanbanGroupKey(value: unknown): string {
  if (value == null) return "Uncategorized"
  const trimmed = String(value).trim()
  return trimmed === "" ? "Uncategorized" : trimmed
}

function getKanbanGroupKeys(value: unknown): string[] {
  if (Array.isArray(value)) {
    const keys = value.map((v) => normalizeKanbanGroupKey(v)).filter(Boolean)
    return keys.length > 0 ? Array.from(new Set(keys)) : ["Uncategorized"]
  }
  return [normalizeKanbanGroupKey(value)]
}

interface KanbanViewProps {
  tableId: string
  viewId: string
  groupingFieldId: string
  fieldIds: string[]
  searchQuery?: string
  tableFields?: any[]
  filters?: FilterConfig[] // Active filters applied to this view
  colorField?: string // Field name to use for card colors (single-select field)
  imageField?: string // Field name to use for card images
  fitImageSize?: boolean // Whether to fit image to container size
  showFieldLabels?: boolean // Whether to show field names above values on cards
  wrapText?: boolean // Whether to wrap long text in card cells (default true)
  blockConfig?: Record<string, any> // Block config for modal_fields
  /** Modal field list (from field_layout when available); same as Calendar/List for consistent modal editor */
  modalFields?: string[]
  onRecordClick?: (recordId: string) => void
  /** Optional: pass to RecordPanel for permission cascade */
  cascadeContext?: { pageConfig?: any; blockConfig?: any } | null
  /** Bump to force a refetch (e.g. after external record creation). */
  reloadKey?: number
  /** Callback to open block settings (for configuration) */
  onOpenSettings?: () => void
  /** Conditional formatting rules */
  highlightRules?: HighlightRule[]
  /** Interface mode: 'view' | 'edit'. When 'edit', record panel opens editable (Airtable-style). */
  interfaceMode?: 'view' | 'edit'
  /** Called when a record is deleted from RecordPanel; use to refresh core data. */
  onRecordDeleted?: () => void
  /** Callback to save field layout when user edits modal layout in right panel. */
  onModalLayoutSave?: (fieldLayout: import("@/lib/interface/field-layout-utils").FieldLayoutItem[]) => void
  displayMode?: 'fit' | 'fixed'
  overflowBehaviour?: 'view_all' | 'scroll' | 'paginate'
  recordLimit?: number
  /** Full-page mode: scroll inside the block when content overflows. */
  forceInternalScroll?: boolean
}

function KanbanView({ 
  tableId, 
  viewId, 
  groupingFieldId, 
  fieldIds,
  searchQuery = "",
  tableFields = [],
  filters = [],
  colorField,
  imageField,
  fitImageSize = false,
  showFieldLabels = false,
  wrapText = true,
  blockConfig = {},
  modalFields,
  onRecordClick,
  cascadeContext = null,
  reloadKey,
  onOpenSettings,
  highlightRules = [],
  interfaceMode = 'view',
  onRecordDeleted,
  onModalLayoutSave,
  displayMode = 'fit',
  overflowBehaviour = 'view_all',
  recordLimit = 20,
  forceInternalScroll = false,
}: KanbanViewProps) {
  // All hooks must be at the top level, before any conditional returns
  const router = useRouter()
  const { openRecord } = useRecordPanel()
  const [rows, setRows] = useState<TableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [supabaseTableName, setSupabaseTableName] = useState<string | null>(null)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [groupValueLabelMaps, setGroupValueLabelMaps] = useState<Record<string, Record<string, string>>>({})
  const cardImageDisplay = ((blockConfig as any)?.card_image_display || "show_if_available") as "show_if_available" | "placeholder" | "hide_when_empty"
  const cardShowLabels = Boolean((blockConfig as any)?.card_show_labels ?? showFieldLabels ?? false)
  const cardShowEmptyFields = Boolean((blockConfig as any)?.card_show_empty_fields ?? false)
  const cardTextBehaviour = ((blockConfig as any)?.card_text_behaviour || "wrap") as "wrap" | "truncate_1" | "truncate_2" | "truncate_3"
  const cardHeightMode = ((blockConfig as any)?.card_height_mode || "fit") as "fit" | "fixed"
  const cardFixedHeightPx = Number((blockConfig as any)?.card_fixed_height_px || 0)

  // IMPORTANT: config may provide field IDs or display names; row data keys are field NAMES (supabase columns).
  const groupingFieldName = useMemo(() => {
    const raw = typeof groupingFieldId === "string" ? groupingFieldId.trim() : ""
    if (!raw) return ""
    const arr = Array.isArray(tableFields) ? tableFields : []
    const match = arr.find(
      (f: any) => f && (f.name === raw || f.id === raw || (f.label && String(f.label).trim() === raw))
    )
    return (match?.name as string) || raw
  }, [groupingFieldId, tableFields])

  const colorFieldName = useMemo(() => {
    if (!colorField || typeof colorField !== "string") return null
    const raw = colorField.trim()
    if (!raw) return null
    const match = (Array.isArray(tableFields) ? tableFields : []).find(
      (f: any) => f && (f.name === raw || f.id === raw)
    )
    return (match?.name as string) || raw
  }, [colorField, tableFields])

  const imageFieldName = useMemo(() => {
    if (!imageField || typeof imageField !== "string") return null
    const raw = imageField.trim()
    if (!raw) return null
    const match = (Array.isArray(tableFields) ? tableFields : []).find(
      (f: any) => f && (f.name === raw || f.id === raw)
    )
    return (match?.name as string) || raw
  }, [imageField, tableFields])

  // Resolve group value (option id or label as stored in DB) to display label for column header.
  // For single_select/multi_select uses options; for link_to_table we use groupValueLabelMaps (loaded in useEffect).
  const groupValueToLabel = useMemo(() => {
    const arr = Array.isArray(tableFields) ? tableFields : []
    const field = arr.find(
      (f: any) => f && (f.name === groupingFieldName || f.id === groupingFieldName)
    ) as TableField | undefined
    if (!field || (field.type !== "single_select" && field.type !== "multi_select")) {
      return new Map<string, string>()
    }
    const map = getOptionValueToLabelMap(field.type, field.options)
    map.set("Uncategorized", "Uncategorized")
    map.set("—", "—")
    return map
  }, [tableFields, groupingFieldName])

  const groupingField = useMemo(() => {
    const arr = Array.isArray(tableFields) ? tableFields : []
    return arr.find(
      (f: any) => f && (f.name === groupingFieldName || f.id === groupingFieldName)
    ) as TableField | undefined
  }, [tableFields, groupingFieldName])

  // Airtable-style: resolve column header color from grouping field options
  const getColumnHeaderColor = useCallback((groupValue: string): string | null => {
    if (!groupingField || (groupingField.type !== "single_select" && groupingField.type !== "multi_select")) {
      return null
    }
    const hex = normalizeHexColor(
      resolveChoiceColor(
        groupValue,
        groupingField.type as "single_select" | "multi_select",
        groupingField.options,
        true
      )
    )
    return hex
  }, [groupingField])

  // Filter rows by search query
  const filteredRows = useMemo(() => {
    if (!searchQuery || !tableFields.length) return rows
    
    // Convert TableRow format to flat format for search
    const flatRows = rows.map((row) => ({
      ...row.data,
      _rowId: row.id, // Preserve row ID
    }))
    
    // Filter using search helper
    const filtered = filterRowsBySearch(flatRows, tableFields, searchQuery, fieldIds)
    const filteredIds = new Set(filtered.map((r) => r._rowId))
    
    // Map back to TableRow format
    return rows.filter((row) => filteredIds.has(row.id))
  }, [rows, tableFields, searchQuery, fieldIds])

  // Resolve linked record (link_to_table) grouping IDs to display labels for column headers.
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!groupingField || groupingField.type !== "link_to_table") {
        setGroupValueLabelMaps({})
        return
      }
      const linkField = groupingField as LinkedField
      const ids = new Set<string>()
      for (const row of Array.isArray(filteredRows) ? filteredRows : []) {
        const fieldValue = getLinkedFieldValueFromRow(row as { data?: Record<string, unknown> }, linkField)
        for (const id of linkedValueToIds(fieldValue)) ids.add(id)
      }
      if (ids.size === 0) {
        setGroupValueLabelMaps({})
        return
      }
      const map = await resolveLinkedFieldDisplayMap(linkField, Array.from(ids))
      const next: Record<string, Record<string, string>> = {
        [linkField.name]: Object.fromEntries(map.entries()),
        [(linkField as any).id]: Object.fromEntries(map.entries()),
      }
      if (!cancelled) setGroupValueLabelMaps(next)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [groupingField, filteredRows])

  // Helper to get color from color field
  const getCardColor = useCallback((row: TableRow): string | null => {
    if (!colorFieldName) return null
    
    const colorFieldObj = tableFields.find((f: any) => f?.name === colorFieldName || f?.id === colorFieldName)
    if (!colorFieldObj || (colorFieldObj.type !== 'single_select' && colorFieldObj.type !== 'multi_select')) {
      return null
    }
    
    const colorValue = row.data[colorFieldName]
    if (!colorValue || !(colorFieldObj.type === 'single_select' || colorFieldObj.type === 'multi_select')) return null
    
    const normalizedValue = String(colorValue).trim()
    return normalizeHexColor(
      resolveChoiceColor(
        normalizedValue,
        colorFieldObj.type,
        colorFieldObj.options,
        colorFieldObj.type === 'single_select'
      )
    )
  }, [colorFieldName, tableFields])

  // Helper to get image from image field
  const getCardImage = useCallback((row: TableRow): string | null => {
    if (!imageFieldName) return null
    
    const imageValue = row.data[imageFieldName]
    if (!imageValue) return null
    
    // Handle attachment field (array of URLs) or URL field (single URL)
    if (Array.isArray(imageValue) && imageValue.length > 0) {
      return imageValue[0]
    }
    if (typeof imageValue === 'string' && (imageValue.startsWith('http') || imageValue.startsWith('/'))) {
      return imageValue
    }
    
    return null
  }, [imageFieldName])

  useEffect(() => {
    loadRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, reloadKey])

  async function loadRows() {
    if (!tableId) {
      console.warn("KanbanView: tableId is required")
      setRows([])
      setLoading(false)
      return
    }
    
    // Sanitize tableId - remove any trailing :X patterns (might be view ID or malformed)
    const sanitizedTableId = tableId.split(':')[0]
    
    setLoading(true)
    try {
      // First, get the table to find its supabase_table name
      const { data: table, error: tableError } = await supabase
        .from("tables")
        .select("supabase_table")
        .eq("id", sanitizedTableId)
        .single()

      if (tableError || !table) {
        console.error("Error loading table:", tableError)
        setRows([])
        setLoading(false)
        return
      }
      setSupabaseTableName(table.supabase_table)

      const physicalColumns = await fetchPhysicalColumns(supabase, table.supabase_table)
      const safeFields = Array.isArray(tableFields) ? tableFields : []
      const queryableFilters = filterConfigsToQueryableColumns(filters, safeFields, physicalColumns)

      let query = supabase.from(table.supabase_table).select("*")
      query = applySoftDeleteFilter(query, physicalColumns)

      if (queryableFilters.length > 0) {
        query = applyFiltersToQuery(query, queryableFilters, safeFields as any)
      }

      const orderCol = hasPhysicalColumnName(physicalColumns, 'created_at') ? 'created_at' : 'id'
      const { data, error } = await query.order(orderCol, { ascending: false })

      if (error) {
        if (!isAbortError(error)) {
          console.error("Error loading rows:", error)
          setRows([])
        }
      } else {
        // Convert flat rows to TableRow format for compatibility
        const tableRows = (data || []).map((row: any) => ({
          id: row.id,
          table_id: sanitizedTableId,
          data: row,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }))
        setRows(tableRows)
      }
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Error loading kanban rows:", error)
        setRows([])
      }
    }
    setLoading(false)
  }

  const showAddRecord = (blockConfig as any)?.appearance?.show_add_record === true
  const permissions = (blockConfig as any)?.permissions || {}
  const isViewOnly = permissions.mode === 'view'
  const allowInlineCreate = permissions.allowInlineCreate ?? true
  const canCreateRecord = !isViewOnly && allowInlineCreate

  const handleOpenRecord = useCallback((recordId: string) => {
    const id = recordId != null ? String(recordId).trim() : ""
    if (!id || !supabaseTableName || !tableId) return
    if (onRecordClick) {
      onRecordClick(id)
      return
    }
    openRecord(
      tableId,
      id,
      supabaseTableName,
      (blockConfig as any)?.modal_fields ?? modalFields,
      (blockConfig as any)?.modal_layout,
      cascadeContext ?? (blockConfig ? { blockConfig } : undefined),
      interfaceMode,
      onRecordDeleted,
      () => loadRows(),
      (blockConfig as any)?.field_layout,
      onModalLayoutSave ?? undefined,
      tableFields
    )
  }, [blockConfig, cascadeContext, modalFields, onRecordClick, openRecord, supabaseTableName, tableId, interfaceMode, onRecordDeleted, onModalLayoutSave, tableFields, loadRows])

  const handleCreateInGroup = useCallback(async (groupName: string) => {
    if (!showAddRecord || !canCreateRecord) return
    if (!supabaseTableName || !tableId) return
    try {
      const newData: Record<string, any> = {}
      const defaultsFromFilters = deriveDefaultValuesFromFilters(filters, tableFields as any)
      if (Object.keys(defaultsFromFilters).length > 0) {
        Object.assign(newData, defaultsFromFilters)
      }
      if (!groupingFieldName) {
        throw new Error("Grouping field is not configured.")
      }
      if (groupName && groupName !== "Uncategorized") {
        newData[groupingFieldName] = groupName
      } else {
        newData[groupingFieldName] = null
      }

      const { data, error } = await supabase
        .from(supabaseTableName)
        .insert([newData])
        .select()
        .single()

      if (error) throw error
      const createdId = (data as any)?.id || (data as any)?.record_id
      if (!createdId) return

      await loadRows()

      // Contract: creating a record must NOT auto-open it.
      // User can open via the dedicated chevron (or optional double-click).
      setSelectedCardId(String(createdId))
    } catch (error) {
      console.error("Error creating record:", error)
      alert("Failed to create record")
    }
  }, [showAddRecord, canCreateRecord, supabaseTableName, tableId, groupingFieldName, handleOpenRecord])

  const groupedRows = useMemo(() => {
    const groups: Record<string, TableRow[]> = {}
    const isLinkField = groupingField?.type === "link_to_table"
    filteredRows.forEach((row) => {
      let groupValues: string[]
      if (!groupingFieldName) {
        groupValues = ["Uncategorized"]
      } else if (isLinkField && groupingField) {
        const fieldValue = getLinkedFieldValueFromRow(row as { data?: Record<string, unknown> }, groupingField as LinkedField)
        const ids = linkedValueToIds(fieldValue)
        groupValues = ids.length > 0 ? Array.from(new Set(ids.map((id) => normalizeKanbanGroupKey(id)))) : ["Uncategorized"]
      } else {
        const raw = row.data?.[groupingFieldName]
        groupValues = getKanbanGroupKeys(raw)
      }
      groupValues.forEach((groupValue) => {
        if (!groups[groupValue]) {
          groups[groupValue] = []
        }
        groups[groupValue].push(row)
      })
    })
    return groups
  }, [filteredRows, groupingField, groupingFieldName])

  const groupedRowsLimited = useMemo(() => {
    const hasLimit = Number.isFinite(recordLimit) && recordLimit > 0
    if (!hasLimit) return groupedRows
    const out: Record<string, TableRow[]> = {}
    for (const [group, rowsInGroup] of Object.entries(groupedRows)) {
      out[group] = rowsInGroup.slice(0, recordLimit)
    }
    return out
  }, [groupedRows, recordLimit])

  const groups = useMemo(() => {
    const existing = Object.keys(groupedRowsLimited)
    const hideEmptyStacks = Boolean((blockConfig as any)?.appearance?.kanban_hide_empty_stacks)
    if (hideEmptyStacks) return existing
    if (!groupingField || (groupingField.type !== "single_select" && groupingField.type !== "multi_select")) {
      return existing
    }
    const { selectOptions } = normalizeSelectOptionsForUi(groupingField.type, groupingField.options)
    const optionKeys = selectOptions
      .map((o) => normalizeKanbanGroupKey(o.label))
      .filter(Boolean)
    return Array.from(new Set([...optionKeys, ...existing]))
  }, [groupedRowsLimited, blockConfig, groupingField])

  if (loading) {
    return <div className="p-4">Loading...</div>
  }

  // Empty state: no grouping field configured
  if (!groupingFieldName) {
    return (
      <EmptyState
        variant="compact"
        icon={<Columns className="h-8 w-8" />}
        title="Grouping field required"
        description="Kanban view needs a grouping field to organize cards into columns. Configure the grouping field in block settings."
        action={onOpenSettings ? {
          label: "Configure Grouping",
          onClick: onOpenSettings,
        } : undefined}
      />
    )
  }

  // Empty state for search
  if (searchQuery && filteredRows.length === 0) {
    return (
      <EmptyState
        variant="compact"
        icon={<Columns className="h-8 w-8" />}
        title="No records match your search"
        description="Try adjusting your search query or clear it to see all records."
        action={{
          label: "Clear Search",
          onClick: () => {
            const params = new URLSearchParams(window.location.search)
            params.delete("q")
            window.history.replaceState({}, "", `?${params.toString()}`)
            router.refresh()
          },
        }}
      />
    )
  }

  // Empty state: no records
  if (filteredRows.length === 0 && !searchQuery) {
    return (
      <EmptyState
        variant="compact"
        icon={<Columns className="h-8 w-8" />}
        title="No records yet"
        description="This table doesn't have any records. Create your first record to get started with the Kanban board."
      />
    )
  }

  const allowInternalScroll =
    forceInternalScroll || (displayMode === "fixed" && overflowBehaviour === "scroll")

  return (
    <div className={cn("w-full min-w-0 min-h-0 flex flex-col bg-background", allowInternalScroll ? "h-full overflow-hidden" : "h-auto overflow-visible")}>
      <div className={cn("min-h-0 flex flex-col", allowInternalScroll ? "flex-1 overflow-x-auto overflow-y-hidden snap-x snap-proximity" : "overflow-x-auto snap-x snap-proximity overflow-y-visible")}>
        <div className="flex gap-4 min-w-max p-4">
        {groups.map((groupName) => {
          const displayName =
            groupValueToLabel.get(groupName) ??
            groupValueLabelMaps[groupingFieldName]?.[groupName] ??
            groupName
          const headerColor = getColumnHeaderColor(groupName)
          return (
          <div key={groupName} className="w-[280px] flex-shrink-0 flex flex-col gap-2 p-2 rounded-card-lg bg-muted/20 border border-border/30 snap-start">
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {headerColor ? (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white shrink-0"
                  style={{ backgroundColor: headerColor }}
                >
                  {displayName}
                </span>
              ) : (
                <h3 className="text-sm font-semibold text-gray-900 truncate min-w-0">{displayName}</h3>
              )}
              <span className="text-xs text-gray-500">{(groupedRows[groupName] || []).length} items</span>
            </div>
            <div className={cn("space-y-2", allowInternalScroll ? "flex-1 min-h-0 overflow-y-auto" : "overflow-visible")}>
              {(groupedRowsLimited[groupName] || []).map((row) => {
                const cardColor = getCardColor(row)
                const cardImage = getCardImage(row)
                const borderColor = cardColor ? { borderLeftColor: cardColor, borderLeftWidth: '4px' } : {}
                
                // Evaluate conditional formatting rules
                const matchingRule = highlightRules && highlightRules.length > 0
                  ? evaluateHighlightRules(highlightRules, row.data || {}, tableFields as TableField[])
                  : null
                
                // Get formatting style for row-level rules
                const rowFormattingStyle = matchingRule && matchingRule.scope !== 'cell'
                  ? getFormattingStyle(matchingRule)
                  : {}
                
                const cardFieldIds = (Array.isArray(fieldIds) ? fieldIds : [])
                  .filter((fid) => fid !== groupingFieldId)
                const primaryField = cardFieldIds[0]
                const secondaryFields = cardFieldIds.slice(1, 5)
                return (
                  <div key={row.id} style={{ ...rowFormattingStyle }}>
                    <RecordCard
                      recordId={String(row.id)}
                      rowData={row.data || {}}
                      fields={tableFields as TableField[]}
                      primaryFieldName={primaryField}
                      secondaryFieldNames={secondaryFields}
                      imageFieldName={imageFieldName}
                      imageDisplayMode={cardImageDisplay}
                      showFieldLabels={cardShowLabels}
                      showEmptyFields={cardShowEmptyFields}
                      textBehaviour={cardTextBehaviour}
                      fixedHeightPx={cardHeightMode === "fixed" && cardFixedHeightPx > 0 ? cardFixedHeightPx : null}
                      selected={selectedCardId === String(row.id)}
                      borderColor={cardColor}
                      onOpen={handleOpenRecord}
                    />
                  </div>
                )
              })}
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                onClick={() => handleCreateInGroup(groupName)}
                disabled={!showAddRecord || !canCreateRecord || !supabaseTableName}
                title={
                  !showAddRecord
                    ? 'Enable "Show Add record button" in block settings to add records'
                    : !canCreateRecord
                      ? 'Adding records is disabled for this block'
                      : 'Add a new record to this column'
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Card
              </Button>
            </div>
          </div>
          )
        })}
        </div>
      </div>
    </div>
  )
}

export default memo(KanbanView)
