"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { TableRow } from "@/types/database"
import type { TableField } from "@/types/fields"
import { Card, CardContent } from "@/components/ui/card"
import { filterRowsBySearch } from "@/lib/search/filterRows"
import { applyFiltersToQuery, stripFilterBlockFilters, type FilterConfig } from "@/lib/interface/filters"
import type { FilterTree } from "@/lib/filters/canonical-model"
import { resolveChoiceColor, normalizeHexColor } from "@/lib/field-colors"
import { ChevronDown, ChevronRight } from "lucide-react"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import { CellFactory } from "../grid/CellFactory"
import { buildGroupTree } from "@/lib/grouping/groupTree"
import type { GroupedNode } from "@/lib/grouping/types"

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
}: GalleryViewProps) {
  const { openRecord } = useRecordPanel()
  const [rows, setRows] = useState<TableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [supabaseTableName, setSupabaseTableName] = useState<string | null>(null)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set())

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

  const effectiveGroupByField = useMemo(() => {
    const raw =
      (blockConfig as any)?.gallery_group_by ||
      (blockConfig as any)?.group_by_field ||
      (blockConfig as any)?.group_by
    if (typeof raw !== "string") return null
    const trimmed = raw.trim()
    if (!trimmed) return null

    const tf = (Array.isArray(tableFields) ? tableFields : []).find(
      (f: any) => f?.name === trimmed || f?.id === trimmed
    )
    return (tf?.name as string | undefined) || trimmed
  }, [blockConfig, tableFields])

  // Reset collapsed groups when grouping field changes
  useEffect(() => {
    setCollapsedGroups(new Set())
  }, [effectiveGroupByField])

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

  type GalleryGroupItem = Record<string, any> & { __row: TableRow; __rowId: string }

  const groupedRows = useMemo((): GroupedNode<GalleryGroupItem>[] | null => {
    if (!effectiveGroupByField) return null
    const safeFields = (Array.isArray(tableFields) ? tableFields : []).filter(Boolean) as TableField[]
    const items: GalleryGroupItem[] = filteredRows.map((r) => ({
      ...(r.data || {}),
      __row: r,
      __rowId: String(r.id),
    }))
    const { rootGroups } = buildGroupTree(items, safeFields, [{ type: "field", field: effectiveGroupByField }], {
      emptyLabel: "(Empty)",
      emptyLast: true,
    })
    return rootGroups
  }, [effectiveGroupByField, filteredRows, tableFields])

  const toggleGroupCollapsed = useCallback((pathKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(pathKey)) next.delete(pathKey)
      else next.add(pathKey)
      return next
    })
  }, [])

  const handleOpenRecord = useCallback((recordId: string) => {
    if (onRecordClick) {
      onRecordClick(recordId)
      return
    }
    if (!supabaseTableName) return
    openRecord(tableId, recordId, supabaseTableName)
  }, [onRecordClick, openRecord, supabaseTableName, tableId])

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

  const renderCard = useCallback(
    (row: TableRow, reactKey: string) => {
      const cardColor = getCardColor(row)
      const cardImage = getCardImage(row)
      const borderColor = cardColor ? { borderLeftColor: cardColor, borderLeftWidth: "4px" } : {}
      const titleFieldObj = (Array.isArray(tableFields) ? tableFields : []).find(
        (f: any) => f?.name === titleField || f?.id === titleField
      ) as TableField | undefined
      const titleValue = titleFieldObj ? row.data?.[titleFieldObj.name] : row.data?.[titleField]

      return (
        <Card
          key={reactKey}
          className={`hover:shadow-md transition-shadow bg-white border-gray-200 rounded-lg overflow-hidden cursor-default ${
            selectedCardId === String(row.id) ? "ring-1 ring-blue-400/40 bg-blue-50/30" : ""
          }`}
          style={borderColor}
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
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <p className="mb-1">Gallery view requires a table connection.</p>
          <p className="text-xs text-gray-400">Configure a table in block settings.</p>
        </div>
      </div>
    )
  }

  if (!imageField) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <p className="mb-1">Gallery view needs an image field.</p>
          <p className="text-xs text-gray-400">Set it in Appearance → Cover image field.</p>
        </div>
      </div>
    )
  }

  if (filteredRows.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <p className="mb-1">No records found</p>
          {filters.length > 0 && <p className="text-xs text-gray-400">Try adjusting filters.</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full overflow-auto bg-gray-50">
      {Array.isArray(groupedRows) && groupedRows.length > 0 ? (
        <div className="p-6 space-y-6">
          {groupedRows.map((group) => {
            const isCollapsed = collapsedGroups.has(group.pathKey)
            const items = Array.isArray(group.items) ? group.items : []
            return (
              <div key={group.pathKey} className="space-y-3">
                <button
                  type="button"
                  onClick={() => toggleGroupCollapsed(group.pathKey)}
                  className="w-full flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2 text-left hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">
                      {group.label}
                    </div>
                    <div className="text-xs text-gray-500">
                      {group.size} {group.size === 1 ? "record" : "records"}
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-gray-500 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
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

