"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { X, Plus, Search, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { createClient } from "@/lib/supabase/client"
import type { TableField } from "@/types/fields"
import { cn } from "@/lib/utils"
import { getPrimaryFieldName } from "@/lib/fields/primary"
import { toPostgrestColumn } from "@/lib/supabase/postgrest"
import { resolveFieldColor, normalizeHexColor, getTextColorForBackground } from "@/lib/field-colors"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v)
}

type TableInfo = {
  supabase_table: string
  name?: string | null
  primary_field_name?: string | null
}
type LookupFieldMeta = { id?: string; name: string; type: string }

// Module-level caches to avoid repeated metadata queries across many pickers.
const tableInfoCache = new Map<string, TableInfo>()
const fieldsCache = new Map<string, LookupFieldMeta[]>()
const physicalColsCache = new Map<string, Set<string>>()
// Cache resolved record options per "context" (table + requested label fields).
const recordOptionCache = new Map<string, Map<string, RecordOption>>()

function buildContextKey(lookupTableId: string, primary?: string, secondary?: string[]) {
  const s = (secondary || []).filter(Boolean).slice(0, 2).join("|")
  return `${lookupTableId}::p=${primary || ""}::s=${s}`
}

async function getTableInfoCached(lookupTableId: string): Promise<TableInfo | null> {
  const cached = tableInfoCache.get(lookupTableId)
  if (cached) return cached
  const supabase = createClient()
  const { data: table, error } = await supabase
    .from("tables")
    .select("supabase_table, name, primary_field_name")
    .eq("id", lookupTableId)
    .single()
  if (error || !table) return null
  tableInfoCache.set(lookupTableId, table as TableInfo)
  return table as TableInfo
}

async function getFieldsCached(lookupTableId: string): Promise<LookupFieldMeta[]> {
  const cached = fieldsCache.get(lookupTableId)
  if (cached) return cached
  const supabase = createClient()
  const { data, error } = await supabase
    .from("table_fields")
    .select("id, name, type")
    .eq("table_id", lookupTableId)
    .order("position", { ascending: true })
  if (error || !Array.isArray(data)) return []
  const fields = data as LookupFieldMeta[]
  fieldsCache.set(lookupTableId, fields)
  return fields
}

async function getPhysicalColsCached(supabaseTableName: string): Promise<Set<string>> {
  const cached = physicalColsCache.get(supabaseTableName)
  if (cached) return cached
  const supabase = createClient()
  const { data: physicalCols, error } = await supabase.rpc("get_table_columns", {
    table_name: supabaseTableName,
  })
  if (error || !Array.isArray(physicalCols)) return new Set()
  const cols = new Set(
    physicalCols.map((c: any) => String(c?.column_name ?? "")).filter(Boolean)
  )
  physicalColsCache.set(supabaseTableName, cols)
  return cols
}

function resolveEffectiveLabelFields(args: {
  table: TableInfo
  lookupFields: LookupFieldMeta[]
  physicalCols: Set<string> | null
  requestedPrimaryLabelField?: string
  requestedSecondaryLabelFields?: string[]
}): { primary: string; secondary: string[] } {
  const {
    table,
    lookupFields,
    physicalCols,
    requestedPrimaryLabelField,
    requestedSecondaryLabelFields,
  } = args

  const hasPhysical = !!physicalCols && physicalCols.size > 0
  const hasField = (name: string) => lookupFields.some((f) => f.name === name)
  const isPhysical = (name: string) => !hasPhysical || physicalCols!.has(name)

  const configuredPrimary =
    typeof (table as any)?.primary_field_name === "string" &&
    String((table as any).primary_field_name).trim().length > 0
      ? String((table as any).primary_field_name).trim()
      : null

  const candidatePrimary =
    requestedPrimaryLabelField && hasField(requestedPrimaryLabelField)
      ? requestedPrimaryLabelField
      : configuredPrimary && configuredPrimary !== "id" && hasField(configuredPrimary)
        ? configuredPrimary
        : getPrimaryFieldName(lookupFields as any) || "id"

  const safePrimary = toPostgrestColumn(candidatePrimary)
  const primary =
    candidatePrimary !== "id" && (!safePrimary || !isPhysical(candidatePrimary)) ? "id" : candidatePrimary

  const secondary = (requestedSecondaryLabelFields || [])
    .filter((fieldName) => fieldName && fieldName !== primary)
    .filter((fieldName) => hasField(fieldName))
    .filter((fieldName) => toPostgrestColumn(fieldName) && isPhysical(fieldName))
    .slice(0, 2)

  return { primary, secondary }
}

export interface LookupFieldConfig {
  // Optional: field to use as primary label (defaults to the table's primary field)
  primaryLabelField?: string
  
  // Optional: up to 2 fields for secondary context
  secondaryLabelFields?: string[]
  
  // Relationship type
  relationshipType?: 'one-to-one' | 'one-to-many' | 'many-to-many'
  
  // Max selections (for multi-select)
  maxSelections?: number
  
  // Required field
  required?: boolean
  
  // Allow creating new records
  allowCreate?: boolean
  
  // Table to lookup from
  lookupTableId: string
}

export interface LookupFieldPickerProps {
  field: TableField
  value: string | string[] | null
  onChange: (value: string | string[] | null) => void
  config?: LookupFieldConfig
  disabled?: boolean
  placeholder?: string
  onRecordClick?: (tableId: string, recordId: string) => void
  onCreateRecord?: (tableId: string) => Promise<string | null> // Returns new record ID
  isLookupField?: boolean // True for derived lookup fields, false for editable linked fields
  /** Compact inline rendering (e.g. grid rows). */
  compact?: boolean
}

interface RecordOption {
  id: string
  primaryLabel: string
  secondaryLabels?: string[]
  data: Record<string, any>
}

export default function LookupFieldPicker({
  field,
  value,
  onChange,
  config,
  disabled = false,
  placeholder = "Search and select...",
  onRecordClick,
  onCreateRecord,
  isLookupField = false,
  compact = false,
}: LookupFieldPickerProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [options, setOptions] = useState<RecordOption[]>([])
  const [loading, setLoading] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const loadedSelectedIdsRef = useRef<string>("")
  const loadOptionsSeqRef = useRef(0)
  const loadSelectedSeqRef = useRef(0)

  // Determine if multi-select
  const isMultiSelect = 
    config?.relationshipType === 'one-to-many' || 
    config?.relationshipType === 'many-to-many' ||
    field.type === 'multi_select' ||
    Array.isArray(value)

  // Get selected IDs - handle both array and comma-separated string (for filters)
  const selectedIds = Array.isArray(value) 
    ? value 
    : value 
      ? (typeof value === 'string' && value.includes(',') ? value.split(',').filter(Boolean) : [value])
      : []
  const selectedIdsKey = useMemo(() => selectedIds.slice().sort().join("|"), [selectedIds])

  // Some older/legacy data stores display labels instead of UUID record IDs.
  // Supabase/PostgREST cannot handle `in.(Sophie Edgerley)` without quoting, and `id` is a uuid column.
  // Treat non-UUID selected values as "legacy pills" and avoid querying by `id` for them.
  const { uuidSelectedIds, legacySelectedValues } = useMemo(() => {
    const uuids: string[] = []
    const legacy: string[] = []
    for (const raw of selectedIds) {
      const s = String(raw ?? '').trim()
      if (!s) continue
      if (isUuid(s)) uuids.push(s)
      else legacy.push(s)
    }
    // de-dupe while preserving order
    const uniq = (arr: string[]) => Array.from(new Set(arr))
    return { uuidSelectedIds: uniq(uuids), legacySelectedValues: uniq(legacy) }
  }, [selectedIds])

  // Get lookup table ID
  const lookupTableId = config?.lookupTableId || 
    (field.type === 'link_to_table' ? field.options?.linked_table_id : field.options?.lookup_table_id) ||
    field.options?.linked_table_id

  // Requested label fields (may be undefined); effective fields are resolved per-table after loading fields.
  // CRITICAL: Use stable primitive for deps to avoid effect loops (new array ref every render).
  const requestedPrimaryLabelField = config?.primaryLabelField
  const requestedSecondaryLabelFields = config?.secondaryLabelFields ?? []
  const requestedSecondaryKey = useMemo(
    () => (Array.isArray(requestedSecondaryLabelFields) ? requestedSecondaryLabelFields.join("|") : ""),
    [requestedSecondaryLabelFields]
  )
  const contextKey = useMemo(
    () => (lookupTableId ? buildContextKey(lookupTableId, requestedPrimaryLabelField, requestedSecondaryLabelFields) : ""),
    [lookupTableId, requestedPrimaryLabelField, requestedSecondaryKey]
  )

  // Get table name for display
  const [tableName, setTableName] = useState<string | null>(null)
  
  useEffect(() => {
    let cancelled = false
    if (!lookupTableId) {
      setTableName(null)
      return
    }
    getTableInfoCached(lookupTableId).then((t) => {
      if (cancelled) return
      setTableName(t?.name ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [lookupTableId])

  useEffect(() => {
    loadedSelectedIdsRef.current = ""
  }, [lookupTableId])

  // If we've already cached selected record labels (from another picker instance),
  // seed local options immediately to avoid any extra round-trip.
  useEffect(() => {
    if (!contextKey) return
    if (uuidSelectedIds.length === 0) return
    const cacheForContext = recordOptionCache.get(contextKey)
    if (!cacheForContext) return

    const cached = uuidSelectedIds
      .map((id) => cacheForContext.get(id))
      .filter(Boolean) as RecordOption[]

    if (cached.length === 0) return

    setOptions((prev) => {
      const existingIds = new Set(prev.map((o) => o.id))
      const add = cached.filter((o) => !existingIds.has(o.id))
      return add.length > 0 ? [...prev, ...add] : prev
    })
  }, [contextKey, uuidSelectedIds.join("|")])

  const isMirroredLinkedField =
    field.type === 'link_to_table' &&
    !isLookupField &&
    disabled &&
    !!field.options?.read_only

  const handleNavigateToRecord = useCallback(
    (e: React.MouseEvent, recordId: string) => {
      e.stopPropagation()
      // Only navigate when the selected value is a real record UUID.
      if (!isUuid(recordId)) return
      if (onRecordClick && lookupTableId) {
        onRecordClick(lookupTableId, recordId)
      }
    },
    [onRecordClick, lookupTableId]
  )

  const loadOptions = useCallback(
    async (query: string = "") => {
      if (!lookupTableId) return

      const seq = ++loadOptionsSeqRef.current
      setLoading(true)
      try {
        const table = await getTableInfoCached(lookupTableId)
        if (seq !== loadOptionsSeqRef.current) return
        if (!table) {
          setOptions([])
          return
        }

        const lookupFields = await getFieldsCached(lookupTableId)
        if (seq !== loadOptionsSeqRef.current) return

        const physicalCols = await getPhysicalColsCached(table.supabase_table)
        if (seq !== loadOptionsSeqRef.current) return

        const { primary: effectivePrimaryLabelField, secondary: effectiveSecondaryLabelFields } =
          resolveEffectiveLabelFields({
            table,
            lookupFields,
            physicalCols,
            requestedPrimaryLabelField,
            requestedSecondaryLabelFields,
          })

        const fieldsToSelect = ["id", effectivePrimaryLabelField, ...effectiveSecondaryLabelFields].filter(Boolean)

        const supabase = createClient()
        let queryBuilder = supabase
          .from(table.supabase_table)
          .select(fieldsToSelect.join(", "))
          .limit(50)

        if (query.trim()) {
          const primaryField = lookupFields.find((f: any) => f.name === effectivePrimaryLabelField)
          if (primaryField) {
            queryBuilder = queryBuilder.ilike(effectivePrimaryLabelField, `%${query}%`)
          }
        }

        const { data: records, error } = await queryBuilder
        if (seq !== loadOptionsSeqRef.current) return

        if (error) {
          console.error("Error loading records:", error)
          setOptions([])
          return
        }

        const transformedOptions: RecordOption[] = (records || []).map((record: any) => {
          const primaryLabel = record[effectivePrimaryLabelField] ? String(record[effectivePrimaryLabelField]) : "Untitled"
          const secondaryLabels = effectiveSecondaryLabelFields
            .map((fieldName) => record[fieldName])
            .filter(Boolean)
            .map(String)

          return {
            id: record.id,
            primaryLabel,
            secondaryLabels: secondaryLabels.length > 0 ? secondaryLabels : undefined,
            data: record,
          }
        })

        // Warm the per-context cache for selected rendering in other pickers.
        if (contextKey) {
          const existing = recordOptionCache.get(contextKey) || new Map<string, RecordOption>()
          for (const opt of transformedOptions) existing.set(opt.id, opt)
          recordOptionCache.set(contextKey, existing)
        }

        setOptions(transformedOptions)
      } catch (error) {
        console.error("Error in loadOptions:", error)
        setOptions([])
      } finally {
        if (seq === loadOptionsSeqRef.current) setLoading(false)
      }
    },
    [lookupTableId, contextKey, requestedPrimaryLabelField, requestedSecondaryKey]
  )

  const loadSelectedRecords = useCallback(async () => {
    if (!lookupTableId || selectedIds.length === 0) return

    const seq = ++loadSelectedSeqRef.current
    setLoading(true)
    try {
      const table = await getTableInfoCached(lookupTableId)
      if (seq !== loadSelectedSeqRef.current) return
      if (!table) return

      const lookupFields = await getFieldsCached(lookupTableId)
      if (seq !== loadSelectedSeqRef.current) return

      // For selected records we also validate physical columns to avoid PostgREST 400s.
      const physicalCols = await getPhysicalColsCached(table.supabase_table)
      if (seq !== loadSelectedSeqRef.current) return

      const { primary: effectivePrimaryLabelField, secondary: effectiveSecondaryLabelFields } =
        resolveEffectiveLabelFields({
          table,
          lookupFields,
          physicalCols,
          requestedPrimaryLabelField,
          requestedSecondaryLabelFields,
        })

      // Always include "legacy" selected values as pills so the UI can render them without
      // making invalid PostgREST queries (e.g. `id=in.(Sophie Edgerley)`).
      if (legacySelectedValues.length > 0) {
        const legacyOptions: RecordOption[] = legacySelectedValues.map((v) => ({
          id: v,
          primaryLabel: v,
          secondaryLabels: undefined,
          data: { id: v, [effectivePrimaryLabelField]: v },
        }))
        setOptions((prev) => {
          const existingIds = new Set(prev.map((o) => o.id))
          const add = legacyOptions.filter((o) => !existingIds.has(o.id))
          return add.length > 0 ? [...prev, ...add] : prev
        })
      }

      if (uuidSelectedIds.length === 0) return

      const fieldsToSelect = ["id", effectivePrimaryLabelField, ...effectiveSecondaryLabelFields].filter(Boolean)

      const cacheForContext = contextKey ? recordOptionCache.get(contextKey) : undefined
      const missingIds = cacheForContext
        ? uuidSelectedIds.filter((id) => !cacheForContext.has(id))
        : uuidSelectedIds

      // If everything is cached, just merge into local options and return.
      if (cacheForContext && missingIds.length === 0) {
        const cachedOptions = uuidSelectedIds
          .map((id) => cacheForContext.get(id))
          .filter(Boolean) as RecordOption[]
        setOptions((prev) => {
          const existingIds = new Set(prev.map((o) => o.id))
          const add = cachedOptions.filter((o) => !existingIds.has(o.id))
          return add.length > 0 ? [...prev, ...add] : prev
        })
        return
      }

      const supabase = createClient()
      const { data: records, error } = await supabase
        .from(table.supabase_table)
        .select(fieldsToSelect.join(", "))
        .in("id", missingIds)

      if (seq !== loadSelectedSeqRef.current) return
      if (error) {
        console.error("Error loading selected records:", error)
        return
      }

      const transformed: RecordOption[] = (records || []).map((record: any) => ({
        id: record.id,
        primaryLabel: record[effectivePrimaryLabelField] ? String(record[effectivePrimaryLabelField]) : "Untitled",
        secondaryLabels: effectiveSecondaryLabelFields
          .map((fieldName) => record[fieldName])
          .filter(Boolean)
          .map(String),
        data: record,
      }))

      if (contextKey) {
        const existing = recordOptionCache.get(contextKey) || new Map<string, RecordOption>()
        for (const opt of transformed) existing.set(opt.id, opt)
        recordOptionCache.set(contextKey, existing)
      }

      setOptions((prev) => {
        const existingIds = new Set(prev.map((o) => o.id))
        const newOptions = transformed.filter((o) => !existingIds.has(o.id))
        return newOptions.length > 0 ? [...prev, ...newOptions] : prev
      })
    } catch (error) {
      console.error("Error loading selected records:", error)
    } finally {
      if (seq === loadSelectedSeqRef.current) setLoading(false)
    }
  }, [
    lookupTableId,
    selectedIds.length,
    uuidSelectedIds.join("|"),
    legacySelectedValues.join("|"),
    contextKey,
    requestedPrimaryLabelField,
    requestedSecondaryKey,
  ])

  // Load options when search query changes
  useEffect(() => {
    if (open && lookupTableId) {
      const timeoutId = setTimeout(() => {
        loadOptions(searchQuery)
      }, 300) // Debounce search

      return () => clearTimeout(timeoutId)
    }
  }, [open, searchQuery, lookupTableId, loadOptions])

  const hasMissingSelected = useMemo(() => {
    if (selectedIds.length === 0) return false
    const optionIds = new Set(options.map((opt) => opt.id))
    return selectedIds.some((id) => !optionIds.has(id))
  }, [options, selectedIds])

  useEffect(() => {
    if (!lookupTableId || selectedIds.length === 0) return
    if (!hasMissingSelected) return
    if (loadedSelectedIdsRef.current === selectedIdsKey) return
    loadedSelectedIdsRef.current = selectedIdsKey
    loadSelectedRecords()
  }, [lookupTableId, selectedIdsKey, selectedIds.length, hasMissingSelected, loadSelectedRecords])

  function handleSelect(option: RecordOption) {
    if (disabled) return

    if (isMultiSelect) {
      const newValue = selectedIds.includes(option.id)
        ? selectedIds.filter(id => id !== option.id)
        : [...selectedIds, option.id]
      
      // Check max selections
      if (config?.maxSelections && newValue.length > config.maxSelections) {
        return
      }
      
      // For filters, return comma-separated string; otherwise return array
      const isFilterContext = typeof value === 'string' && value.includes(',')
      onChange(isFilterContext 
        ? (newValue.length > 0 ? newValue.join(',') : '')
        : (newValue.length > 0 ? newValue : null)
      )
    } else {
      onChange(option.id)
      setOpen(false)
    }
  }

  function handleRemove(id: string) {
    if (disabled) return
    
    if (isMultiSelect) {
      const newValue = selectedIds.filter(selectedId => selectedId !== id)
      // For filters, return comma-separated string; otherwise return array
      const isFilterContext = typeof value === 'string' && value.includes(',')
      onChange(isFilterContext 
        ? (newValue.length > 0 ? newValue.join(',') : '')
        : (newValue.length > 0 ? newValue : null)
      )
    } else {
      onChange(null)
    }
  }

  function handleCreateNew() {
    if (!onCreateRecord || !lookupTableId) return
    
    onCreateRecord(lookupTableId).then((newRecordId) => {
      if (newRecordId) {
        // Reload options to include new record
        loadOptions(searchQuery).then(() => {
          // Select the new record
          if (newRecordId) {
            handleSelect({ id: newRecordId, primaryLabel: 'New Record', data: {} })
          }
        })
      }
    })
  }


  // Get selected options
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIdsKey])
  const selectedOptions = useMemo(() => options.filter((opt) => selectedIdSet.has(opt.id)), [options, selectedIdSet])

  // Filter out selected options from dropdown (unless multi-select and showing all)
  const availableOptions = useMemo(
    () => (isMultiSelect ? options : options.filter((opt) => !selectedIdSet.has(opt.id))),
    [isMultiSelect, options, selectedIdSet]
  )

  // Resolve color for linked field pills
  const fieldColor = useMemo(() => {
    if (field.type === 'link_to_table' || field.type === 'lookup') {
      return resolveFieldColor(field.type, null, field.options)
    }
    return null
  }, [field.type, field.options])

  // For lookup fields (read-only), render as informational pills without popover
  if (isLookupField || disabled) {
    return (
      <div className={cn(compact ? "space-y-0" : "space-y-2")} ref={containerRef}>
        {isMirroredLinkedField && !compact && (
          <div className="text-xs text-gray-500">
            Linked from {tableName || 'linked table'}
          </div>
        )}
        <div
          className={cn(
            compact
              ? "min-h-[32px] w-full rounded-md border border-gray-200/50 bg-gray-50/50 px-2 py-1.5 text-sm"
              : "min-h-[40px] w-full rounded-md border border-gray-200/50 bg-gray-50/50 px-3 py-2.5 text-sm",
            compact ? "flex flex-nowrap items-center gap-2 overflow-hidden" : "flex flex-wrap items-center gap-2",
            isLookupField && "cursor-default"
          )}
        >
          {selectedOptions.length > 0 ? (
            selectedOptions.map((option) => {
              // Same as normal pill: light tint, subtle border, dark text
              const hex = fieldColor ? normalizeHexColor(fieldColor) : null
              const bgColor = hex ? `${hex}1A` : '#F3F4F6'
              const borderColor = hex ? `${hex}33` : '#E5E7EB'
              const textColorClass = hex ? 'text-gray-700' : getTextColorForBackground(bgColor)
              return (
                <button
                  key={option.id}
                  type="button"
                  className={cn(
                    "inline-flex items-center gap-1.5 max-w-[200px] shrink-0 px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap overflow-hidden text-ellipsis",
                    textColorClass,
                    onRecordClick && "group cursor-pointer hover:opacity-80 transition-opacity"
                  )}
                  style={{
                    backgroundColor: bgColor,
                    borderColor: borderColor,
                  }}
                  onClick={(e) => handleNavigateToRecord(e, option.id)}
                  title="Open linked record"
                  aria-label={`Open linked record: ${option.primaryLabel}`}
                >
                  <span className={cn("block min-w-0 truncate", onRecordClick && "hover:underline transition-colors")}>
                    {option.primaryLabel}
                  </span>
                </button>
              )
            })
          ) : (
            <span className="text-gray-400 italic">{placeholder}</span>
          )}
        </div>
      </div>
    )
  }

  // For linked fields (editable), render with popover
  return (
    <div className={cn(compact ? "space-y-0" : "space-y-2")} ref={containerRef}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div
            className={cn(
              compact
                ? "min-h-[32px] w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm"
                : "min-h-[40px] w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm",
              compact
                ? "flex flex-nowrap items-center gap-2 transition-colors overflow-hidden"
                : "flex flex-wrap items-center gap-2 transition-colors",
              !disabled && "cursor-pointer hover:border-blue-300 hover:bg-blue-50/30",
              "focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400/20 focus-within:ring-offset-1",
              disabled && "opacity-50 cursor-not-allowed bg-gray-50"
            )}
            onMouseDown={(e) => {
              // Allow drag operations to pass through (same as select fields)
              e.stopPropagation()
            }}
            onClick={() => !disabled && setOpen(true)}
          >
            {selectedOptions.length > 0 ? (
              <>
                {selectedOptions.map((option) => {
                  // Same visual as normal pills: light tint, subtle border, dark text, compact
                  const hex = fieldColor ? normalizeHexColor(fieldColor) : null
                  const bgColor = hex ? `${hex}1A` : '#F3F4F6'
                  const borderColor = hex ? `${hex}33` : '#E5E7EB'
                  const hoverBorderColor = hex ? `${hex}66` : '#D1D5DB'
                  const textColorClass = hex ? 'text-gray-700' : getTextColorForBackground(bgColor)
                  return (
                    <span
                      key={option.id}
                      className={cn(
                        "inline-flex items-center gap-1.5 max-w-[200px] px-3 py-1 rounded-full text-xs font-medium border cursor-pointer shrink-0",
                        textColorClass
                      )}
                      style={{
                        backgroundColor: bgColor,
                        borderColor: borderColor,
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation()
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (onRecordClick && lookupTableId) {
                          onRecordClick(lookupTableId, option.id)
                        }
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = hoverBorderColor
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = borderColor
                      }}
                      title="Open linked record"
                      role="button"
                    >
                      <span
                        onMouseDown={(e) => {
                          e.stopPropagation()
                        }}
                        onClick={(e) => {
                          handleNavigateToRecord(e, option.id)
                        }}
                        className="block min-w-0 truncate hover:underline transition-colors"
                      >
                        {option.primaryLabel}
                      </span>
                      {!disabled && (
                        <button
                          onMouseDown={(e) => {
                            e.stopPropagation()
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemove(option.id)
                          }}
                          className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 transition-colors opacity-70 hover:opacity-100 shrink-0"
                          title="Remove"
                          aria-label="Remove"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  )
                })}
                {isMultiSelect && selectedOptions.length > 1 && (
                  <span className="text-gray-500 text-xs ml-1">
                    {selectedOptions.length} selected
                  </span>
                )}
                {/* Add button - neutral style to match normal pill row */}
                {!disabled && (
                  <button
                    onMouseDown={(e) => {
                      e.stopPropagation()
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpen(true)
                    }}
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex-shrink-0"
                    title={tableName ? `Add record from ${tableName}` : "Add record"}
                    aria-label={tableName ? `Add record from ${tableName}` : "Add record"}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between w-full">
                <span className="text-gray-400 italic">{placeholder}</span>
                {!disabled && (
                  <button
                    onMouseDown={(e) => {
                      // Allow drag operations to pass through (same as select fields)
                      e.stopPropagation()
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpen(true)
                    }}
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex-shrink-0"
                    title={tableName ? `Add record from ${tableName}` : "Add record"}
                    aria-label={tableName ? `Add record from ${tableName}` : "Add record"}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[400px] p-0" 
          align="start"
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            searchInputRef.current?.focus()
          }}
        >
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type to search..."
                className="pl-8"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-[300px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : availableOptions.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                {searchQuery ? "No results found" : "Start typing to search"}
              </div>
            ) : (
              <>
                {availableOptions.map((option) => {
                  const isSelected = selectedIds.includes(option.id)
                  return (
                    <div
                      key={option.id}
                      className={cn(
                        "px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors",
                        isSelected && "bg-blue-50/50"
                      )}
                      onClick={() => handleSelect(option)}
                    >
                      <div className="font-medium text-sm text-gray-900">{option.primaryLabel}</div>
                      {option.secondaryLabels && option.secondaryLabels.length > 0 && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {option.secondaryLabels.join(" • ")}
                        </div>
                      )}
                    </div>
                  )
                })}
                
                {config?.allowCreate && onCreateRecord && (
                  <div
                    className="px-3 py-2 border-t border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm text-gray-600"
                    onClick={handleCreateNew}
                  >
                    <Plus className="h-4 w-4 text-gray-500" />
                    <span>Create new record</span>
                  </div>
                )}
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

