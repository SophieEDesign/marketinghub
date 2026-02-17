"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ChevronRight, Plus, Settings, Columns } from "lucide-react"
import { filterRowsBySearch } from "@/lib/search/filterRows"
import type { TableRow } from "@/types/database"
import type { TableField } from "@/types/fields"
import { resolveChoiceColor, normalizeHexColor } from '@/lib/field-colors'
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import { CellFactory } from "@/components/grid/CellFactory"
import { applyFiltersToQuery, deriveDefaultValuesFromFilters, type FilterConfig } from "@/lib/interface/filters"
import { isAbortError } from "@/lib/api/error-handling"
import { getOptionValueToLabelMap } from "@/lib/fields/select-options"
import EmptyState from "@/components/empty-states/EmptyState"
import type { HighlightRule } from "@/lib/interface/types"
import { evaluateHighlightRules, getFormattingStyle } from "@/lib/conditional-formatting/evaluator"
import { getLinkedFieldValueFromRow, linkedValueToIds, resolveLinkedFieldDisplayMap } from "@/lib/dataView/linkedFields"
import type { LinkedField } from "@/types/fields"

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
  wrapText?: boolean // Whether to wrap long text in card cells (default true)
  blockConfig?: Record<string, any> // Block config for modal_fields
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
}

export default function KanbanView({ 
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
  wrapText = true,
  blockConfig = {},
  onRecordClick,
  cascadeContext = null,
  reloadKey,
  onOpenSettings,
  highlightRules = [],
  interfaceMode = 'view',
  onRecordDeleted,
}: KanbanViewProps) {
  // All hooks must be at the top level, before any conditional returns
  const { openRecord } = useRecordPanel()
  const [rows, setRows] = useState<TableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [supabaseTableName, setSupabaseTableName] = useState<string | null>(null)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [groupValueLabelMaps, setGroupValueLabelMaps] = useState<Record<string, Record<string, string>>>({})

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

      // Load rows from the actual table (not table_rows)
      let query = supabase
        .from(table.supabase_table)
        .select("*")

      query = applyFiltersToQuery(query, filters, tableFields as any)

      const { data, error } = await query
        .order("created_at", { ascending: false })

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
      (blockConfig as any)?.modal_fields,
      (blockConfig as any)?.modal_layout,
      cascadeContext ?? (blockConfig ? { blockConfig } : undefined),
      interfaceMode,
      onRecordDeleted,
      (blockConfig as any)?.field_layout
    )
  }, [blockConfig, cascadeContext, onRecordClick, openRecord, supabaseTableName, tableId, interfaceMode, onRecordDeleted])

  const handleCellSave = useCallback(async (rowId: string, fieldName: string, value: any) => {
    if (!supabaseTableName) return
    const { error } = await supabase
      .from(supabaseTableName)
      .update({ [fieldName]: value })
      .eq("id", rowId)
    if (error) throw error

    setRows((prev) =>
      prev.map((r) =>
        String(r.id) === String(rowId)
          ? { ...r, data: { ...(r.data || {}), [fieldName]: value } }
          : r
      )
    )
  }, [supabaseTableName])

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

  function groupRowsByField() {
    const groups: Record<string, TableRow[]> = {}
    const isLinkField = groupingField?.type === "link_to_table"
    filteredRows.forEach((row) => {
      let groupValue: string
      if (!groupingFieldName) {
        groupValue = "Uncategorized"
      } else if (isLinkField && groupingField) {
        const fieldValue = getLinkedFieldValueFromRow(row as { data?: Record<string, unknown> }, groupingField as LinkedField)
        const ids = linkedValueToIds(fieldValue)
        groupValue = ids.length > 0 ? ids[0] : "Uncategorized"
      } else {
        const raw = row.data?.[groupingFieldName]
        groupValue = raw != null && raw !== "" ? String(raw).trim() : "Uncategorized"
      }
      if (!groups[groupValue]) {
        groups[groupValue] = []
      }
      groups[groupValue].push(row)
    })
    return groups
  }

  if (loading) {
    return <div className="p-4">Loading...</div>
  }

  // Empty state: no grouping field configured
  if (!groupingFieldName) {
    return (
      <EmptyState
        icon={<Columns className="h-12 w-12" />}
        title="Grouping field required"
        description="Kanban view needs a grouping field to organize cards into columns. Configure the grouping field in block settings."
        action={onOpenSettings ? {
          label: "Configure Grouping",
          onClick: onOpenSettings,
        } : undefined}
      />
    )
  }

  const groupedRows = groupRowsByField()
  const groups = Object.keys(groupedRows)

  // Empty state for search
  if (searchQuery && filteredRows.length === 0) {
    return (
      <EmptyState
        icon={<Columns className="h-12 w-12" />}
        title="No records match your search"
        description="Try adjusting your search query or clear it to see all records."
        action={{
          label: "Clear Search",
          onClick: () => {
            const params = new URLSearchParams(window.location.search)
            params.delete("q")
            window.history.replaceState({}, "", `?${params.toString()}`)
            window.location.reload()
          },
        }}
      />
    )
  }

  // Empty state: no records
  if (filteredRows.length === 0 && !searchQuery) {
    return (
      <EmptyState
        icon={<Columns className="h-12 w-12" />}
        title="No records yet"
        description="This table doesn't have any records. Create your first record to get started with the Kanban board."
      />
    )
  }

  return (
    <div className="w-full h-full overflow-x-auto bg-gray-50">
      <div className="flex gap-4 min-w-max p-6">
        {groups.map((groupName) => {
          const displayName =
            groupValueToLabel.get(groupName) ??
            groupValueLabelMaps[groupingFieldName]?.[groupName] ??
            groupName
          const headerColor = getColumnHeaderColor(groupName)
          return (
          <div key={groupName} className="flex-shrink-0 w-80">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                {headerColor ? (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white shrink-0"
                    style={{ backgroundColor: headerColor }}
                  >
                    {displayName}
                  </span>
                ) : (
                  <h3 className="text-sm font-semibold text-gray-900">{displayName}</h3>
                )}
                <span className="text-xs text-gray-500">{groupedRows[groupName].length} items</span>
              </div>
            </div>
            <div className="space-y-2">
              {groupedRows[groupName].map((row) => {
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
                
                return (() => {
                  const cardFieldIds = (Array.isArray(fieldIds) ? fieldIds : [])
                    .filter((fid) => fid !== groupingFieldId)
                    .slice(0, 6)
                  const cardFields = cardFieldIds
                    .map((fieldId) => (Array.isArray(tableFields) ? tableFields : []).find(
                      (f: any) => f?.name === fieldId || f?.id === fieldId
                    ) as TableField | undefined)
                    .filter((f): f is TableField => !!f)
                  const titleField = cardFields[0]
                  const otherFields = cardFields.slice(1)
                  const pillMetaFields = otherFields.length >= 2 ? otherFields.slice(0, -1) : otherFields
                  const contentField = otherFields.length >= 2 ? otherFields[otherFields.length - 1] : null
                  const data = row.data || {}

                  return (
                <Card 
                  key={row.id} 
                  className={`hover:shadow-md transition-shadow bg-white border-gray-200 rounded-lg cursor-default min-w-0 ${
                    selectedCardId === String(row.id) ? "ring-1 ring-blue-400/40 bg-blue-50/30" : ""
                  }`}
                  style={{ ...borderColor, ...rowFormattingStyle }}
                  onClick={() => setSelectedCardId(String(row.id))}
                  onDoubleClick={() => row.id != null && handleOpenRecord(String(row.id))}
                >
                  <CardContent className="p-3 min-w-0">
                    <div className="space-y-2 min-w-0">
                      {/* Title row: primary value + open button (Airtable-style) */}
                      <div className="flex items-start gap-1.5 min-w-0">
                        {titleField && (
                          <div
                            className="flex-1 min-w-0 line-clamp-2 overflow-hidden font-semibold text-sm text-gray-900 leading-tight"
                            onClick={(e) => e.stopPropagation()}
                            onDoubleClick={(e) => e.stopPropagation()}
                          >
                            <CellFactory
                              field={titleField}
                              value={data[titleField.name]}
                              rowId={String(row.id)}
                              tableName={supabaseTableName || ""}
                              editable={!titleField.options?.read_only && titleField.type !== "formula" && titleField.type !== "lookup" && !!supabaseTableName}
                              wrapText={wrapText}
                              rowHeight={undefined}
                              onSave={(value) => handleCellSave(String(row.id), titleField.name, value)}
                            />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (row.id != null) handleOpenRecord(String(row.id))
                          }}
                          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50/60 transition-colors"
                          title="Open record"
                          aria-label="Open record"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Image if configured */}
                      {cardImage && (
                        <div className={`w-full min-w-0 ${fitImageSize ? 'h-auto' : 'h-28'} rounded overflow-hidden bg-gray-100`}>
                          <img
                            src={cardImage}
                            alt=""
                            className={`w-full ${fitImageSize ? 'h-auto object-contain' : 'h-28 object-cover'}`}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        </div>
                      )}

                      {/* Category/Date pills (Airtable-style colored tags) */}
                      {pillMetaFields.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 min-w-0" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                          {pillMetaFields.map((fieldObj) => {
                            const isVirtual = fieldObj.type === "formula" || fieldObj.type === "lookup"
                            const isSelect = fieldObj.type === "single_select" || fieldObj.type === "multi_select"
                            const rawVal = data[fieldObj.name]
                            const pillLabel = isSelect && rawVal
                              ? (getOptionValueToLabelMap(fieldObj.type as "single_select" | "multi_select", fieldObj.options).get(String(rawVal).trim()) ?? String(rawVal))
                              : null
                            const pillColor = isSelect && rawVal
                              ? normalizeHexColor(resolveChoiceColor(String(rawVal).trim(), fieldObj.type as "single_select" | "multi_select", fieldObj.options, true))
                              : null
                            return (
                              <div key={fieldObj.id ?? fieldObj.name} className="min-w-0 max-w-full">
                                {isSelect && pillColor && pillLabel ? (
                                  <span
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white truncate max-w-full"
                                    style={{ backgroundColor: pillColor }}
                                  >
                                    {pillLabel}
                                  </span>
                                ) : (
                                  <CellFactory
                                    field={fieldObj}
                                    value={data[fieldObj.name]}
                                    rowId={String(row.id)}
                                    tableName={supabaseTableName || ""}
                                    editable={!fieldObj.options?.read_only && !isVirtual && !!supabaseTableName}
                                    wrapText={wrapText}
                                    rowHeight={22}
                                    onSave={(value) => handleCellSave(String(row.id), fieldObj.name, value)}
                                  />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Content preview (larger, 2-3 lines) - leave blank when empty */}
                      {contentField && data[contentField.name] != null && String(data[contentField.name]).trim() !== "" ? (
                        <div className="text-sm text-gray-600 line-clamp-3 min-w-0" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                          <CellFactory
                            field={contentField}
                            value={data[contentField.name]}
                            rowId={String(row.id)}
                            tableName={supabaseTableName || ""}
                            editable={!contentField.options?.read_only && contentField.type !== "formula" && contentField.type !== "lookup" && !!supabaseTableName}
                            wrapText={wrapText}
                            rowHeight={undefined}
                            onSave={(value) => handleCellSave(String(row.id), contentField.name, value)}
                          />
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
                  );
                })();
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
  )
}

