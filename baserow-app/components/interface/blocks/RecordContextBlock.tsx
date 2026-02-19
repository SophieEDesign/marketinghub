"use client"

import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import type { PageBlock, BlockFilter } from "@/lib/interface/types"
import type { RecordContext } from "@/lib/interface/types"
import { applyFiltersToQuery, normalizeFilter, type FilterConfig } from "@/lib/interface/filters"
import type { FilterTree } from "@/lib/filters/canonical-model"
import { filterRowsBySearch } from "@/lib/search/filterRows"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import type { TableField } from "@/types/fields"
import { renderPills } from "@/lib/ui/pills"
import { formatDateUK } from "@/lib/utils"
import { formatDateByField, formatNumericValue } from "@/lib/fields/format"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isUuidLike(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value)
}

interface RecordContextBlockProps {
  block: PageBlock
  isEditing?: boolean
  pageTableId?: string | null
  recordId?: string | null
  recordTableId?: string | null
  onRecordContextChange?: (context: RecordContext) => void
}

export default function RecordContextBlock({
  block,
  isEditing = false,
  pageTableId = null,
  recordId = null,
  recordTableId = null,
  onRecordContextChange,
}: RecordContextBlockProps) {
  const config = block.config || {}
  const tableId = config.table_id ?? (config as any).tableId ?? pageTableId ?? null
  const displayMode = config.displayMode ?? (config as any).display_mode ?? "list"
  const showSearch = config.show_search !== false
  const showAddRecord = (config as any).show_add_record === true

  const [table, setTable] = useState<{ id: string; supabase_table: string; name?: string | null } | null>(null)
  const [records, setRecords] = useState<{ id: string; [k: string]: unknown }[]>([])
  const [loading, setLoading] = useState(true)
  const [titleField, setTitleField] = useState<string | null>(null)
  const [tableFields, setTableFields] = useState<TableField[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const { toast } = useToast()

  const filterMode = (config as any).filter_mode || "all"
  const filterTree = (config as any).filter_tree as FilterTree | undefined
  const blockFilters = (config.filters || []) as Array<{ field: string; operator: string; value: unknown }>
  const sortsConfig = Array.isArray(config.sorts) ? config.sorts : []
  const listTitleField = config.list_title_field ?? (config as any).title_field
  const listSubtitleFields = config.list_subtitle_fields || []
  const listImageField = config.list_image_field ?? (config as any).image_field
  const listPillFields = config.list_pill_fields || []
  const listMetaFields = config.list_meta_fields || []
  const visibleFields = Array.isArray(config.visible_fields) ? config.visible_fields : []

  useEffect(() => {
    if (!tableId) {
      setLoading(false)
      setTable(null)
      setRecords([])
      setTitleField(null)
      return
    }

    let cancelled = false

    async function load() {
      const supabase = createClient()
      let resolved: { id: string; supabase_table: string; name?: string | null } | null = null

      if (isUuidLike(tableId)) {
        const { data } = await supabase
          .from("tables")
          .select("id, supabase_table, name")
          .eq("id", tableId)
          .maybeSingle()
        if (data) resolved = data as any
      } else {
        const { data: byName } = await supabase
          .from("tables")
          .select("id, supabase_table, name")
          .eq("name", tableId)
          .maybeSingle()
        if (byName) {
          resolved = byName as any
        } else {
          const { data: bySupabase } = await supabase
            .from("tables")
            .select("id, supabase_table, name")
            .eq("supabase_table", tableId)
            .maybeSingle()
          if (bySupabase) resolved = bySupabase as any
        }
      }

      if (cancelled || !resolved?.id) {
        if (!cancelled) {
          setTable(null)
          setRecords([])
          setTitleField(null)
        }
        return
      }

      setTable(resolved)

      const { data: fields } = await supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", resolved.id)
        .order("position", { ascending: true })

      const fieldList = (fields || []) as TableField[]
      setTableFields(fieldList)
      const firstText = fieldList.find((f) => f.type === "text" || f.type === "long_text" || f.type === "single_line_text")
      const titleKey = (listTitleField && fieldList.some((f) => f.name === listTitleField))
        ? listTitleField
        : visibleFields.length > 0 && fieldList.some((f) => f.name === visibleFields[0])
          ? visibleFields[0]
          : (firstText?.name ?? "id")
      setTitleField(titleKey)

      const cardCols = [
        "id",
        titleKey,
        ...listSubtitleFields,
        ...(listImageField ? [listImageField] : []),
        ...listPillFields,
        ...listMetaFields,
      ]
      const visibleCols = visibleFields.length > 0
        ? visibleFields.filter((c) => fieldList.some((f) => f.name === c))
        : cardCols.slice(1)
      const allCols = ["id", ...new Set([...visibleCols, ...cardCols.slice(1)])]
      const selectCols = allCols.filter((c) => c === "id" || fieldList.some((f) => f.name === c))

      let query = supabase
        .from(resolved.supabase_table)
        .select(selectCols.join(", "))
        .limit(200)

      // Respect filter_mode: "all" = no filters, "specific" = use config filters, "viewer" = user-scoped (TODO)
      const filtersToApply =
        filterMode === "specific"
          ? filterTree ?? (blockFilters.length > 0 ? blockFilters.map((f) => normalizeFilter(f as BlockFilter | FilterConfig)) : null)
          : null
      if (filtersToApply) {
        query = applyFiltersToQuery(query, filtersToApply, fieldList)
      }

      if (sortsConfig.length > 0) {
        const first = sortsConfig[0] as { field: string; direction: "asc" | "desc" }
        const sortField = fieldList.some((f) => f.name === first.field) ? first.field : "id"
        query = query.order(sortField, { ascending: first.direction === "asc" })
      } else {
        query = query.order("id", { ascending: false })
      }

      const { data: rows } = await query

      if (!cancelled) {
        setRecords((rows as unknown as { id: string; [k: string]: unknown }[]) || [])
      }
    }

    setLoading(true)
    load().finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [
    tableId,
    filterMode,
    filterTree ? JSON.stringify(filterTree) : null,
    blockFilters.length,
    JSON.stringify(blockFilters),
    JSON.stringify(sortsConfig),
    listTitleField,
    JSON.stringify(listSubtitleFields),
    listImageField,
    JSON.stringify(listPillFields),
    JSON.stringify(listMetaFields),
    JSON.stringify(visibleFields),
    refreshTrigger,
  ])

  const filteredRecords = useMemo((): { id: string; [k: string]: unknown }[] => {
    if (!searchQuery.trim() || !tableFields.length) return records
    return filterRowsBySearch(
      records as Record<string, unknown>[],
      tableFields as Parameters<typeof filterRowsBySearch>[1],
      searchQuery.trim(),
      undefined
    ) as { id: string; [k: string]: unknown }[]
  }, [records, tableFields, searchQuery])

  const handleSelect = (record: { id: string }) => {
    if (!table || !onRecordContextChange) return
    onRecordContextChange({ tableId: table.id, recordId: record.id })
  }

  const handleAddNew = async () => {
    if (!table || !onRecordContextChange) return
    const supabase = createClient()
    try {
      const { data: inserted, error } = await supabase
        .from(table.supabase_table)
        .insert({})
        .select("id")
        .single()
      if (error) throw error
      if (inserted?.id) {
        setRefreshTrigger((c) => c + 1)
        onRecordContextChange({ tableId: table.id, recordId: inserted.id })
        toast({ title: "Record created", description: "New record added and selected." })
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Could not add record",
        description: e?.message ?? "The table may require fields to be set.",
      })
    }
  }

  const selectedInThisBlock = table && recordTableId === table.id && recordId

  useEffect(() => {
    if (!table || !onRecordContextChange || filteredRecords.length === 0) return
    const hasSelection = recordTableId === table.id && recordId && filteredRecords.some((r) => r.id === recordId)
    if (!hasSelection) {
      onRecordContextChange({ tableId: table.id, recordId: filteredRecords[0].id })
    }
  }, [table?.id, filteredRecords, recordId, recordTableId, onRecordContextChange])

  const handleDelete = async () => {
    if (!table || !recordId || recordTableId !== table.id || !onRecordContextChange) return
    const supabase = createClient()
    try {
      const { error } = await supabase.from(table.supabase_table).delete().eq("id", recordId)
      if (error) throw error
      setRefreshTrigger((c) => c + 1)
      const remaining = filteredRecords.filter((r) => r.id !== recordId)
      if (remaining.length > 0) {
        onRecordContextChange({ tableId: table.id, recordId: remaining[0].id })
        toast({ title: "Record deleted", description: "Selecting next record." })
      } else {
        onRecordContextChange(null)
        toast({ title: "Record deleted", description: "No more records." })
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Could not delete record",
        description: e?.message ?? "You may not have permission.",
      })
    }
  }

  if (!tableId) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-4 rounded-md border border-dashed">
        {isEditing ? "Configure a table in block settings." : "No table selected."}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-4">
        Loading…
      </div>
    )
  }

  if (!table) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-4 rounded-md border border-dashed">
        Table not found.
      </div>
    )
  }

  const formatCellValue = (v: unknown): string => {
    if (v == null) return ""
    if (typeof v === "string") return v.trim()
    if (typeof v === "number" || typeof v === "boolean") return String(v)
    if (Array.isArray(v)) return v.map(formatCellValue).filter(Boolean).join(", ")
    if (typeof v === "object" && v !== null && "value" in (v as object)) return formatCellValue((v as { value: unknown }).value)
    return String(v)
  }

  const getLabel = (record: { id: string; [k: string]: unknown }) => {
    if (titleField) {
      const raw = record[titleField]
      const s = formatCellValue(raw)
      if (s) return s
    }
    return record.id
  }

  const getSubtitle = (record: { id: string; [k: string]: unknown }) => {
    if (!listSubtitleFields.length) return null
    const parts = listSubtitleFields
      .map((name) => formatCellValue(record[name]))
      .filter((s) => s !== "")
    return parts.length ? parts.join(" · ") : null
  }

  const getImageUrl = (record: { id: string; [k: string]: unknown }): string | null => {
    if (!listImageField) return null
    const raw = record[listImageField]
    if (!raw) return null
    if (typeof raw === "string" && /^https?:\/\//.test(raw)) return raw
    if (Array.isArray(raw) && raw.length > 0) {
      const first = raw[0]
      if (typeof first === "object" && first !== null && "url" in first) return (first as { url: string }).url
      if (typeof first === "string" && /^https?:\/\//.test(first)) return first
    }
    return null
  }

  const formatMetaValue = (field: TableField, value: unknown): string => {
    if (value == null || value === "") return "—"
    switch (field.type) {
      case "date":
        return formatDateByField(String(value), field)
      case "number":
      case "percent":
      case "currency":
        return formatNumericValue(Number(value), field)
      default:
        return String(value)
    }
  }

  return (
    <div className="h-full w-full flex flex-col gap-2 p-2 rounded-md border bg-card">
      {(showSearch || showAddRecord || selectedInThisBlock) && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {showSearch && (
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          )}
          {showAddRecord && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 flex-shrink-0"
              onClick={handleAddNew}
              title="Add new record"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
          {selectedInThisBlock && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 flex-shrink-0 text-destructive hover:text-destructive"
              onClick={handleDelete}
              title="Delete record"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
      <div
        className={cn(
          "flex flex-1 min-h-0 overflow-auto",
          displayMode === "grid" && "flex flex-wrap content-start gap-2",
          displayMode === "compact" && "flex flex-wrap gap-1"
        )}
      >
        {filteredRecords.length === 0 ? (
          <p className="text-muted-foreground text-sm p-2">
            {records.length === 0 ? "No records in this table." : "No records match your search."}
          </p>
        ) : displayMode === "grid" ? (
          filteredRecords.map((record) => {
            const isActive = selectedInThisBlock === record.id
            return (
              <button
                key={record.id}
                type="button"
                onClick={() => handleSelect(record)}
                className={cn(
                  "rounded-lg border p-3 text-left text-sm transition-colors hover:bg-accent",
                  isActive && "ring-2 ring-primary bg-accent"
                )}
              >
                {getLabel(record)}
              </button>
            )
          })
        ) : displayMode === "compact" ? (
          filteredRecords.map((record) => {
            const isActive = selectedInThisBlock === record.id
            return (
              <button
                key={record.id}
                type="button"
                onClick={() => handleSelect(record)}
                className={cn(
                  "rounded-md border px-2 py-1 text-xs transition-colors hover:bg-accent",
                  isActive && "ring-2 ring-primary bg-accent"
                )}
              >
                {getLabel(record)}
              </button>
            )
          })
        ) : (
          <ul className="w-full space-y-1">
            {filteredRecords.map((record) => {
              const isActive = selectedInThisBlock === record.id
              const subtitle = getSubtitle(record)
              const imageUrl = getImageUrl(record)
              const pillFieldObjs = listPillFields
                .map((fn) => tableFields.find((f) => f.name === fn || f.id === fn))
                .filter((f): f is TableField => !!f && (f.type === "single_select" || f.type === "multi_select"))
              const metaFieldObjs = listMetaFields
                .map((fn) => tableFields.find((f) => f.name === fn || f.id === fn))
                .filter((f): f is TableField => !!f && ["date", "number", "percent", "currency"].includes(f.type))
              return (
                <li key={record.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(record)}
                    className={cn(
                      "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-accent flex gap-3 items-start",
                      isActive && "ring-2 ring-primary bg-accent"
                    )}
                  >
                    {imageUrl && (
                      <div className="flex-shrink-0 w-10 h-10 rounded overflow-hidden bg-muted">
                        <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="block font-medium truncate">{getLabel(record)}</span>
                      {subtitle && (
                        <span className="block text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</span>
                      )}
                      {pillFieldObjs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5 items-center">
                          {pillFieldObjs.map((f) => {
                            const raw = record[f.name]
                            if (raw == null || raw === "" || (Array.isArray(raw) && raw.length === 0)) return null
                            const values = Array.isArray(raw) ? raw.filter((v) => v != null && String(v).trim() !== "") : [raw]
                            if (values.length === 0) return null
                            return (
                              <span key={f.id}>
                                {renderPills(f, values, { density: "compact", max: 3 })}
                              </span>
                            )
                          })}
                        </div>
                      )}
                      {metaFieldObjs.length > 0 && (
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                          {metaFieldObjs.map((f) => {
                            const val = formatMetaValue(f, record[f.name])
                            if (val === "—") return null
                            return (
                              <span key={f.id}>
                                {val}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
