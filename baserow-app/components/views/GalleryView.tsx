"use client"

import { useCallback, useEffect, useMemo, useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { TableRow } from "@/types/database"
import type { LinkedField, TableField } from "@/types/fields"
import { Card, CardContent } from "@/components/ui/card"
import { filterRowsBySearch } from "@/lib/search/filterRows"
import { applyFiltersToQuery, stripFilterBlockFilters, type FilterConfig } from "@/lib/interface/filters"
import type { FilterTree } from "@/lib/filters/canonical-model"
import { resolveChoiceColor, normalizeHexColor, getTextColorForBackground, SEMANTIC_COLORS } from "@/lib/field-colors"
import { ChevronDown, ChevronRight, Settings, Image, Database } from "lucide-react"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import { CellFactory } from "@/components/grid/CellFactory"
import { buildGroupTree } from "@/lib/grouping/groupTree"
import type { GroupedNode } from "@/lib/grouping/types"
import { getLinkedFieldValueFromRow, linkedValueToIds, resolveLinkedFieldDisplayMap } from "@/lib/dataView/linkedFields"
import { Button } from "@/components/ui/button"
import EmptyState from "@/components/empty-states/EmptyState"
import type { HighlightRule } from "@/lib/interface/types"
import { evaluateHighlightRules, getFormattingStyle } from "@/lib/conditional-formatting/evaluator"

interface GalleryViewProps {
  tableId: string
  viewId?: string
  fieldIds: string[]
  searchQuery?: string
  tableFields?: any[]
  filters?: FilterConfig[]
  filterTree?: FilterTree
  onRecordClick?: (recordId: string) => void
  /** Bump to force a refetch (e.g. after external record creation). */
  reloadKey?: number
  // Visual card fields
  colorField?: string
  imageField?: string
  fitImageSize?: boolean
  // Block config (optional, for future card settings)
  blockConfig?: Record<string, any>
  /** When grouping, should groups start collapsed? Default: true (closed). */
  defaultGroupsCollapsed?: boolean
  /** Callback to open block settings (for configuration) */
  onOpenSettings?: () => void
  /** Callback when block content height changes (for grouped blocks) */
  onHeightChange?: (height: number) => void
  /** Row height in pixels (for height calculation) */
  rowHeight?: number
  /** Conditional formatting rules */
  highlightRules?: HighlightRule[]
  /** Interface mode: 'view' | 'edit'. When 'edit', record panel opens editable (Airtable-style). */
  interfaceMode?: 'view' | 'edit'
  /** Called when a record is deleted from RecordPanel; use to refresh core data. */
  onRecordDeleted?: () => void
}

export default function GalleryView({
  tableId,
  viewId,
  fieldIds,
  searchQuery = "",
  tableFields = [],
  filters = [],
  filterTree = null,
  onRecordClick,
  reloadKey,
  colorField,
  imageField,
  fitImageSize = false,
  blockConfig = {},
  defaultGroupsCollapsed = true,
  onOpenSettings,
  onHeightChange,
  rowHeight = 30,
  highlightRules = [],
  interfaceMode = 'view',
  onRecordDeleted,
}: GalleryViewProps) {
  const { openRecord } = useRecordPanel()
  const [rows, setRows] = useState<TableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [supabaseTableName, setSupabaseTableName] = useState<string | null>(null)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set())
  const [groupValueLabelMaps, setGroupValueLabelMaps] = useState<Record<string, Record<string, string>>>({})
  // Ref for measuring content height
  const contentRef = useRef<HTMLDivElement>(null)

  // Resolve supabase table name
  useEffect(() => {
    async function loadTableInfo() {
      if (!tableId) {
        setSupabaseTableName(null)
        return
      }
      try {
        const supabase = createClient()
        const sanitizedTableId = tableId.split(":")[0]
        const { data, error } = await supabase
          .from("tables")
          .select("supabase_table")
          .eq("id", sanitizedTableId)
          .single()
        if (error || !data?.supabase_table) {
          setSupabaseTableName(null)
          return
        }
        setSupabaseTableName(data.supabase_table)
      } catch (e) {
        console.error("GalleryView: error loading table info", e)
        setSupabaseTableName(null)
      }
    }

    loadTableInfo()
  }, [tableId])

  // Load rows
  useEffect(() => {
    async function loadRows() {
      // Guardrail: during page transitions/unmounts, tableId can temporarily be undefined
      // while supabaseTableName is still set from a previous render. Never call split on it.
      if (!supabaseTableName || !tableId) {
        setRows([])
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const supabase = createClient()

        let query = supabase.from(supabaseTableName).select("*")

        // Apply unified filters (supports date_range etc.)
        const normalizedFields = (Array.isArray(tableFields) ? tableFields : []).map((f: any) => ({
          name: f.name || f.field_name || f.id || f.field_id,
          id: f.id || f.field_id,
          type: f.type || f.field_type,
          options: f.options || f.field_options,
        }))
        const baseFilters = filterTree ? stripFilterBlockFilters(filters || []) : (filters || [])
        if (filterTree) {
          query = applyFiltersToQuery(query, filterTree, normalizedFields)
        }
        query = applyFiltersToQuery(query, baseFilters, normalizedFields)

        // Default ordering
        query = query.order("created_at", { ascending: false })

        const { data, error } = await query
        if (error) {
          console.error("GalleryView: error loading rows", error)
          setRows([])
          return
        }

        const sanitizedTableId = tableId.split(":")[0]
        const tableRows: TableRow[] = (data || []).map((row: any) => ({
          id: row.id,
          table_id: sanitizedTableId,
          data: row,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }))
        setRows(tableRows)
      } catch (e) {
        console.error("GalleryView: exception loading rows", e)
        setRows([])
      } finally {
        setLoading(false)
      }
    }

    loadRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseTableName, tableId, JSON.stringify(filters), reloadKey])

  const safeFieldIds = useMemo(() => (Array.isArray(fieldIds) ? fieldIds : []), [fieldIds])

  // Support both nested groups (group_by_rules) and legacy single field
  const effectiveGroupByRules = useMemo(() => {
    const rules = (blockConfig as any)?.group_by_rules
    if (Array.isArray(rules) && rules.length > 0) {
      return rules
    }
    const raw =
      (blockConfig as any)?.gallery_group_by ||
      (blockConfig as any)?.group_by_field ||
      (blockConfig as any)?.group_by
    if (typeof raw === "string" && raw.trim()) {
      return [{ type: 'field' as const, field: raw.trim() }]
    }
    return null
  }, [blockConfig])

  const effectiveGroupByField = useMemo(() => {
    if (effectiveGroupByRules && effectiveGroupByRules.length > 0 && effectiveGroupByRules[0].type === 'field') {
      return effectiveGroupByRules[0].field
    }
    return null
  }, [effectiveGroupByRules])

  // Track previous groupBy to detect changes
  const prevGroupByRef = useRef<string | null>(effectiveGroupByField)
  // Track whether we've initialized collapsed groups for the current groupBy
  const didInitGroupCollapseRef = useRef(false)

  // Pick a title field for cards (simple heuristic, configurable later)
  const titleField = useMemo(() => {
    const configured =
      (blockConfig as any)?.gallery_title_field ||
      (blockConfig as any)?.card_title_field ||
      (blockConfig as any)?.title_field
    if (typeof configured === "string" && configured.trim() !== "") return configured
    return safeFieldIds[0] || "id"
  }, [blockConfig, safeFieldIds])

  const secondaryFields = useMemo(() => {
    const exclude = new Set<string>([titleField])
    if (typeof imageField === "string" && imageField) exclude.add(imageField)
    if (typeof colorField === "string" && colorField) exclude.add(colorField)
    return safeFieldIds.filter((f) => !exclude.has(f)).slice(0, 3)
  }, [safeFieldIds, titleField, imageField, colorField])

  const getCardColor = useCallback(
    (row: TableRow): string | null => {
      if (!colorField) return null

      const colorFieldObj = (Array.isArray(tableFields) ? tableFields : []).find(
        (f: any) => f.name === colorField || f.id === colorField
      )
      if (!colorFieldObj || (colorFieldObj.type !== "single_select" && colorFieldObj.type !== "multi_select")) {
        return null
      }

      const colorValue = row.data?.[colorFieldObj.name || colorField]
      if (!colorValue) return null

      const normalizedValue = String(colorValue).trim()
      return normalizeHexColor(
        resolveChoiceColor(
          normalizedValue,
          colorFieldObj.type,
          colorFieldObj.options,
          colorFieldObj.type === "single_select"
        )
      )
    },
    [colorField, tableFields]
  )

  const getCardImage = useCallback(
    (row: TableRow): string | null => {
      if (!imageField) return null

      const imageValue = row.data?.[imageField]
      if (!imageValue) return null

      // Attachment field (array of strings/objects)
      if (Array.isArray(imageValue) && imageValue.length > 0) {
        const first = imageValue[0]
        if (typeof first === "string") return first
        if (first && typeof first === "object" && typeof (first as any).url === "string") return (first as any).url
      }

      // URL field (string)
      if (typeof imageValue === "string" && (imageValue.startsWith("http") || imageValue.startsWith("/"))) {
        return imageValue
      }

      return null
    },
    [imageField]
  )

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

  const filteredRows = useMemo(() => {
    if (!searchQuery || !Array.isArray(tableFields) || tableFields.length === 0) return rows

    const flatRows = rows.map((r) => ({
      ...(r.data || {}),
      _rowId: r.id,
    }))

    const filtered = filterRowsBySearch(flatRows, tableFields, searchQuery, safeFieldIds)
    const ids = new Set((filtered || []).map((r: any) => r._rowId))
    return rows.filter((r) => ids.has(r.id))
  }, [rows, tableFields, searchQuery, safeFieldIds])

  // Resolve grouping labels for linked record fields (link_to_table).
  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!effectiveGroupByField) {
        setGroupValueLabelMaps({})
        return
      }

      const safeFields = (Array.isArray(tableFields) ? tableFields : []).filter(Boolean) as TableField[]
      const fieldObj = safeFields.find((f: any) => f?.name === effectiveGroupByField || f?.id === effectiveGroupByField) as
        | TableField
        | undefined

      if (!fieldObj || fieldObj.type !== "link_to_table") {
        setGroupValueLabelMaps({})
        return
      }

      const linkField = fieldObj as LinkedField
      const ids = new Set<string>()
      for (const r of Array.isArray(filteredRows) ? filteredRows : []) {
        const fieldValue = getLinkedFieldValueFromRow(r as { data?: Record<string, unknown> }, linkField)
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
  }, [effectiveGroupByField, filteredRows, tableFields])

  type GalleryGroupItem = Record<string, any> & { __row: TableRow; __rowId: string }

  const groupedRows = useMemo((): GroupedNode<GalleryGroupItem>[] | null => {
    if (!effectiveGroupByRules || effectiveGroupByRules.length === 0) return null
    const safeFields = (Array.isArray(tableFields) ? tableFields : []).filter(Boolean) as TableField[]
    const items: GalleryGroupItem[] = filteredRows.map((r) => ({
      ...(r.data || {}),
      __row: r,
      __rowId: String(r.id),
    }))
    const { rootGroups } = buildGroupTree(items, safeFields, effectiveGroupByRules, {
      emptyLabel: "(Empty)",
      emptyLast: true,
      valueLabelMaps: groupValueLabelMaps,
    })
    return rootGroups
  }, [effectiveGroupByRules, filteredRows, tableFields, groupValueLabelMaps])

  // When grouping, allow "start collapsed" behavior (default: collapsed).
  // This is intentionally applied only on initial load / when the groupBy field changes / when the setting flips,
  // so we don't override the user's manual expand/collapse interactions mid-session.
  useEffect(() => {
    const groupByChanged = prevGroupByRef.current !== effectiveGroupByField
    prevGroupByRef.current = effectiveGroupByField

    if (groupByChanged) {
      didInitGroupCollapseRef.current = false
      setCollapsedGroups(new Set())
    }

    // No grouping: always open (nothing to collapse)
    if (!effectiveGroupByField || !groupedRows || groupedRows.length === 0) {
      didInitGroupCollapseRef.current = false
      return
    }

    // If the setting is "open", force-expand (clear collapsed set).
    if (!defaultGroupsCollapsed) {
      didInitGroupCollapseRef.current = false
      setCollapsedGroups(new Set())
      return
    }

    // Setting is "closed": collapse all groups once, when we have keys.
    if (didInitGroupCollapseRef.current) return
    setCollapsedGroups(new Set(groupedRows.map((n) => n.pathKey)))
    didInitGroupCollapseRef.current = true
  }, [effectiveGroupByField, defaultGroupsCollapsed, groupedRows])

  const toggleGroupCollapsed = useCallback((pathKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(pathKey)) next.delete(pathKey)
      else next.add(pathKey)
      return next
    })
  }, [])

  // Measure content height when grouping changes (expand/collapse or enable/disable)
  // CRITICAL: No debouncing - measure immediately for instant reflow on collapse
  // Height must be DERIVED from content, not remembered
  useEffect(() => {
    if (!onHeightChange || !contentRef.current) return
    
    const isGrouped = !!effectiveGroupByField && !!groupedRows && groupedRows.length > 0
    if (!isGrouped) return // No grouping, skip measurement

    // Measure immediately - no debouncing
    // This ensures immediate reflow when blocks collapse
    const pixelHeight = contentRef.current.scrollHeight || contentRef.current.clientHeight || 0
    
    // Convert to grid units (round up to ensure content fits)
    const heightInGridUnits = Math.ceil(pixelHeight / rowHeight)
    
    // Minimum height of 2 grid units to prevent blocks from being too small
    const finalHeight = Math.max(heightInGridUnits, 2)
    
    // Update height immediately - no delay
    onHeightChange(finalHeight)
  }, [collapsedGroups, effectiveGroupByField, groupedRows, onHeightChange, rowHeight])

  const handleOpenRecord = useCallback((recordId: string) => {
    if (onRecordClick) {
      onRecordClick(recordId)
      return
    }
    if (!supabaseTableName) return
    openRecord(tableId, recordId, supabaseTableName, undefined, undefined, undefined, interfaceMode, onRecordDeleted)
  }, [onRecordClick, openRecord, supabaseTableName, tableId, interfaceMode, onRecordDeleted])

  const handleCellSave = useCallback(async (rowId: string, fieldName: string, value: any) => {
    if (!supabaseTableName) return
    const supabase = createClient()
    const { error } = await supabase
      .from(supabaseTableName)
      .update({ [fieldName]: value })
      .eq("id", rowId)
    if (error) throw error

    setRows((prev) =>
      prev.map((r) =>
        String(r.id) === String(rowId)
          ? { ...r, data: { ...(r.data || {}), [fieldName]: value } as any }
          : r
      )
    )
  }, [supabaseTableName])

  // Card layout: title and secondary fields from visible_fields (first = title, next 3 = secondary); cover image and color from appearance.image_field / color_field.
  const renderCard = useCallback(
    (row: TableRow, reactKey: string) => {
      const cardColor = getCardColor(row)
      const cardImage = getCardImage(row)
      const borderColor = cardColor ? { borderLeftColor: cardColor, borderLeftWidth: "4px" } : {}
      const titleFieldObj = (Array.isArray(tableFields) ? tableFields : []).find(
        (f: any) => f?.name === titleField || f?.id === titleField
      ) as TableField | undefined
      const titleValue = titleFieldObj ? row.data?.[titleFieldObj.name] : row.data?.[titleField]

      // Evaluate conditional formatting rules
      const matchingRule = highlightRules && highlightRules.length > 0
        ? evaluateHighlightRules(highlightRules, row.data || {}, tableFields as TableField[])
        : null
      
      // Get formatting style for row-level rules
      const rowFormattingStyle = matchingRule && matchingRule.scope !== 'cell'
        ? getFormattingStyle(matchingRule)
        : {}

      return (
        <Card
          key={reactKey}
          className={`hover:shadow-md transition-shadow bg-white border-gray-200 rounded-lg overflow-hidden cursor-default ${
            selectedCardId === String(row.id) ? "ring-1 ring-blue-400/40 bg-blue-50/30" : ""
          }`}
          style={{ ...borderColor, ...rowFormattingStyle }}
          onClick={() => setSelectedCardId(String(row.id))}
          onDoubleClick={() => handleOpenRecord(String(row.id))}
        >
          {cardImage && (
            <div className={`w-full ${fitImageSize ? "h-auto" : "h-40"} bg-gray-100`}>
              <img
                src={cardImage}
                alt=""
                className={`w-full ${fitImageSize ? "h-auto object-contain" : "h-40 object-cover"}`}
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = "none"
                }}
              />
            </div>
          )}
          <CardContent className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div
                className="min-w-0 flex-1 text-sm font-semibold text-gray-900 line-clamp-2"
                onDoubleClick={(e) => e.stopPropagation()}
              >
                {titleFieldObj ? (
                  <CellFactory
                    field={titleFieldObj}
                    value={titleValue}
                    rowId={String(row.id)}
                    tableName={supabaseTableName || ""}
                    editable={
                      !titleFieldObj.options?.read_only &&
                      titleFieldObj.type !== "formula" &&
                      titleFieldObj.type !== "lookup" &&
                      !!supabaseTableName
                    }
                    wrapText={true}
                    rowHeight={32}
                    onSave={(value) => handleCellSave(String(row.id), titleFieldObj.name, value)}
                  />
                ) : (
                  <span>
                    {titleValue !== undefined && titleValue !== null && String(titleValue).trim() !== ""
                      ? String(titleValue)
                      : "Untitled"}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleOpenRecord(String(row.id))
                }}
                className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50/60 transition-colors flex-shrink-0"
                title="Open record"
                aria-label="Open record"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1">
              {secondaryFields.map((fieldName) => {
                const fieldObj = (Array.isArray(tableFields) ? tableFields : []).find(
                  (f: any) => f.name === fieldName || f.id === fieldName
                ) as TableField | undefined
                const label = fieldObj?.name || fieldName
                const fieldValue = row.data?.[fieldObj?.name || fieldName]
                const isVirtual = fieldObj?.type === "formula" || fieldObj?.type === "lookup"
                return (
                  <div key={fieldName} className="text-xs text-gray-700">
                    <span className="text-gray-500 font-medium">{label}:</span>{" "}
                    <span className="text-gray-900" onDoubleClick={(e) => e.stopPropagation()}>
                      {fieldObj ? (
                        <CellFactory
                          field={fieldObj}
                          value={fieldValue}
                          rowId={String(row.id)}
                          tableName={supabaseTableName || ""}
                          editable={!fieldObj.options?.read_only && !isVirtual && !!supabaseTableName}
                          wrapText={true}
                          rowHeight={28}
                          onSave={(value) => handleCellSave(String(row.id), fieldObj.name, value)}
                        />
                      ) : (
                        <span>
                          {fieldValue === null || fieldValue === undefined || fieldValue === "" ? "—" : String(fieldValue)}
                        </span>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )
    },
    [
      fitImageSize,
      getCardColor,
      getCardImage,
      handleCellSave,
      handleOpenRecord,
      secondaryFields,
      selectedCardId,
      supabaseTableName,
      highlightRules,
      tableFields,
      titleField,
    ]
  )

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        Loading...
      </div>
    )
  }

  if (!supabaseTableName) {
    return (
      <EmptyState
        icon={<Database className="h-12 w-12" />}
        title="Table connection required"
        description="Gallery view needs to be connected to a table to display records."
        action={onOpenSettings ? {
          label: "Configure Table",
          onClick: onOpenSettings,
        } : undefined}
      />
    )
  }

  if (!imageField) {
    return (
      <EmptyState
        icon={<Image className="h-12 w-12" />}
        title="Image field required"
        description="Gallery view needs an image field to display cards. Set the cover image field in block settings."
        action={onOpenSettings ? {
          label: "Configure Image Field",
          onClick: onOpenSettings,
        } : undefined}
      />
    )
  }

  if (filteredRows.length === 0) {
    return (
      <EmptyState
        icon={<Database className="h-12 w-12" />}
        title="No records found"
        description={filters.length > 0 
          ? "No records match your current filters. Try adjusting your filters or create a new record."
          : "This table doesn't have any records yet. Create your first record to get started."}
        action={undefined}
      />
    )
  }

  return (
    <div ref={contentRef} className="w-full h-full overflow-auto bg-gray-50">
      {Array.isArray(groupedRows) && groupedRows.length > 0 ? (
        <div className="p-6 space-y-6">
          {groupedRows.map((group) => {
            const isCollapsed = collapsedGroups.has(group.pathKey)
            const items = Array.isArray(group.items) ? group.items : []
            
            // Get group color - generate for ALL groups
            let groupColor: string | null = null
            if (group.rule && group.rule.type === 'field') {
              const groupField = (Array.isArray(tableFields) ? tableFields : []).find(
                (f: any) => f && (f.name === group.rule.field || f.id === group.rule.field)
              ) as TableField | undefined
              if (groupField && (groupField.type === 'single_select' || groupField.type === 'multi_select')) {
                // Use field-specific color for select fields
                groupColor = getPillColor(groupField, group.key)
              } else {
                // Generate hash-based color for all other field types
                groupColor = getGroupColor(group.key)
              }
            } else if (group.rule && group.rule.type === 'date') {
              // For date-based grouping, generate color from the date value
              groupColor = getGroupColor(group.key)
            }

            // Evaluate conditional formatting rules for group headers
            // Create a mock row with the group value for evaluation
            const groupMockRow: Record<string, any> = {}
            if (group.rule && group.rule.type === 'field') {
              const groupField = (Array.isArray(tableFields) ? tableFields : []).find(
                (f: any) => f && (f.name === group.rule.field || f.id === group.rule.field)
              ) as TableField | undefined
              if (groupField && group.key) {
                groupMockRow[groupField.name] = group.key
              }
            }
            const groupMatchingRule = highlightRules && highlightRules.length > 0 && Object.keys(groupMockRow).length > 0
              ? evaluateHighlightRules(
                  highlightRules.filter(r => r.scope === 'group'),
                  groupMockRow,
                  Array.isArray(tableFields) ? tableFields : []
                )
              : null
            
            // Get formatting style for group-level rules
            const groupFormattingStyle = groupMatchingRule
              ? getFormattingStyle(groupMatchingRule)
              : {}
            
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
                    return {}
                  })()
                : {}
            
            // Determine text color for contrast (conditional formatting takes precedence)
            const finalTextColor = groupFormattingStyle.color || undefined
            const textColorClass = finalTextColor ? '' : (groupColor ? getTextColorForBackground(groupColor) : 'text-gray-900')
            const textColorStyle = finalTextColor ? { color: finalTextColor } : (groupColor ? {} : { color: undefined })
            
            return (
              <div key={group.pathKey} className="space-y-3">
                <button
                  type="button"
                  onClick={() => toggleGroupCollapsed(group.pathKey)}
                  className={`w-full flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
                    groupFormattingStyle.backgroundColor || groupColor ? '' : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                  style={{
                    ...bgColorStyle,
                    ...textColorStyle,
                  }}
                >
                  <div className="min-w-0">
                    <div className={`text-sm font-semibold truncate ${textColorClass}`} style={textColorStyle}>
                      {group.label}
                    </div>
                    <div className={`text-xs ${groupFormattingStyle.backgroundColor || groupColor ? 'opacity-80' : 'text-gray-500'}`} style={textColorStyle}>
                      {group.size} {group.size === 1 ? "record" : "records"}
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${isCollapsed ? "-rotate-90" : ""} ${
                      groupFormattingStyle.backgroundColor || groupColor ? textColorClass : 'text-gray-500'
                    }`}
                    style={textColorStyle}
                  />
                </button>

                {!isCollapsed && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {items.map((item) => renderCard(item.__row, `${group.pathKey}:${item.__rowId}`))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredRows.map((row) => renderCard(row, String(row.id)))}
        </div>
      )}
    </div>
  )
}

