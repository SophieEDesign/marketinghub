"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import { filterRowsBySearch } from "@/lib/search/filterRows"
import { resolveChoiceColor, normalizeHexColor } from '@/lib/field-colors'
import { formatDateUK } from "@/lib/utils"
import type { TableField } from "@/types/fields"
import { applyFiltersToQuery, deriveDefaultValuesFromFilters, type FilterConfig } from "@/lib/interface/filters"
import type { FilterType } from "@/types/database"
import { ChevronDown, ChevronRight, Filter, Group, MapPin, MoreHorizontal, Plus } from "lucide-react"
import { useIsMobile } from "@/hooks/useResponsive"
import { Button } from "@/components/ui/button"
import RecordModal from "@/components/calendar/RecordModal"
import GroupDialog from "@/components/grid/GroupDialog"
import FilterDialog from "@/components/grid/FilterDialog"
import { toPostgrestColumn } from "@/lib/supabase/postgrest"
import { buildGroupTree, flattenGroupTree } from "@/lib/grouping/groupTree"
import type { GroupRule } from "@/lib/grouping/types"
import { isAbortError } from "@/lib/api/error-handling"
import type { LinkedField } from "@/types/fields"
import { resolveLinkedFieldDisplayMap } from "@/lib/dataView/linkedFields"
import { normalizeUuid } from "@/lib/utils/ids"

// PostgREST expects unquoted identifiers in order clauses; see `lib/supabase/postgrest`.

interface ListViewProps {
  tableId: string
  viewId?: string
  supabaseTableName: string
  tableFields: TableField[]
  filters?: FilterConfig[]
  sorts?: Array<{ field_name: string; direction: 'asc' | 'desc' }>
  groupBy?: string
  /** Nested grouping rules (preferred). If omitted, falls back to `groupBy`. */
  groupByRules?: GroupRule[]
  /** When grouping, should groups start collapsed? Default: true (closed). */
  defaultChoiceGroupsCollapsed?: boolean
  searchQuery?: string
  onRecordClick?: (recordId: string) => void
  // Creation controls (wired from block settings)
  showAddRecord?: boolean
  canCreateRecord?: boolean
  // List-specific field configuration
  titleField?: string // Required: field name for title
  subtitleFields?: string[] // Optional: up to 3 subtitle fields
  imageField?: string // Optional: field name for image/attachment
  pillFields?: string[] // Optional: select/multi-select fields to show as pills
  metaFields?: string[] // Optional: date, number, etc. for metadata
  // Callbacks for block config updates (when not using views)
  onGroupByChange?: (fieldName: string | null) => void
  onFiltersChange?: (filters: FilterConfig[]) => void
  /** Optional external trigger to reload rows (e.g. after create in a parent block). */
  reloadKey?: any
}

export default function ListView({
  tableId,
  viewId,
  supabaseTableName,
  tableFields,
  filters = [],
  sorts = [],
  groupBy,
  groupByRules,
  defaultChoiceGroupsCollapsed = true,
  searchQuery = "",
  onRecordClick,
  showAddRecord = false,
  canCreateRecord = false,
  titleField,
  subtitleFields = [],
  imageField,
  pillFields = [],
  metaFields = [],
  onGroupByChange,
  onFiltersChange,
  reloadKey,
}: ListViewProps) {
  const { openRecord } = useRecordPanel()
  const isMobile = useIsMobile()
  const viewUuid = useMemo(() => normalizeUuid(viewId), [viewId])
  const [rows, setRows] = useState<Record<string, any>[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const prevGroupByRef = useRef<string | undefined>(undefined)
  const didInitChoiceGroupCollapseRef = useRef(false)
  const [tableName, setTableName] = useState<string | null>(null)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [filterDialogOpen, setFilterDialogOpen] = useState(false)
  const [currentGroupBy, setCurrentGroupBy] = useState<string | undefined>(groupBy)
  const [currentFilters, setCurrentFilters] = useState<FilterConfig[]>(filters)
  const [groupValueLabelMaps, setGroupValueLabelMaps] = useState<Record<string, Record<string, string>>>({})

  // Create flow: open modal first; only insert on Save inside modal.
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createInitialData, setCreateInitialData] = useState<Record<string, any> | null>(null)

  // Load table name for record panel
  useEffect(() => {
    if (tableId && !tableName) {
      const loadTableName = async () => {
        const supabase = createClient()
        const { data } = await supabase
          .from("tables")
          .select("name, supabase_table")
          .eq("id", tableId)
          .single()
        if (data) {
          setTableName(data.supabase_table)
        }
      }
      loadTableName()
    }
  }, [tableId, tableName])

  const handleOpenRecord = useCallback((recordId: string) => {
    if (onRecordClick) {
      onRecordClick(recordId)
      return
    }
    const effectiveTableName = tableName || supabaseTableName
    if (tableId && effectiveTableName) {
      openRecord(tableId, recordId, effectiveTableName)
    }
  }, [onRecordClick, openRecord, supabaseTableName, tableId, tableName])

  // Update currentGroupBy when groupBy prop changes
  useEffect(() => {
    setCurrentGroupBy(groupBy)
  }, [groupBy])

  // Update currentFilters when filters prop changes
  useEffect(() => {
    setCurrentFilters(filters)
  }, [filters])

  // Load rows
  useEffect(() => {
    loadRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, supabaseTableName, currentFilters, sorts, reloadKey])

  async function loadRows() {
    if (!supabaseTableName) {
      setRows([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      let query = supabase.from(supabaseTableName).select("*")

      // Apply filters using shared unified filter engine (includes date operators)
      if (currentFilters.length > 0) {
        const normalizedFields = tableFields.map((f) => ({
          name: f.name,
          type: f.type,
          id: f.id,
          options: (f as any).options,
        }))
        query = applyFiltersToQuery(query, currentFilters, normalizedFields)
      }

      // Apply sorting
      if (sorts.length > 0) {
        sorts.forEach((sort, index) => {
          if (index === 0) {
            const col = toPostgrestColumn(sort.field_name)
            if (!col) {
              console.warn('[ListView] Skipping sort on invalid column:', sort.field_name)
              return
            }
            query = query.order(col, { ascending: sort.direction === 'asc' })
          } else {
            // Supabase only supports one order() call, so we'd need to sort in memory for multiple sorts
            // For now, just use the first sort
          }
        })
      } else {
        query = query.order('created_at', { ascending: false })
      }

      const { data, error } = await query

      if (error) {
        if (isAbortError(error)) return
        console.error("Error loading rows:", error)
        setRows([])
      } else {
        setRows(data || [])
      }
    } catch (error) {
      if (isAbortError(error)) return
      console.error("Error loading rows:", error)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  // Filter rows by search query
  const filteredRows = useMemo(() => {
    if (!searchQuery || !tableFields.length) return rows

    const fieldIds = tableFields.map(f => f.name)
    return filterRowsBySearch(rows, tableFields, searchQuery, fieldIds)
  }, [rows, tableFields, searchQuery])

  const effectiveGroupRules = useMemo<GroupRule[]>(() => {
    const safe = Array.isArray(groupByRules) ? groupByRules.filter(Boolean) : []
    if (safe.length > 0) return safe
    if (currentGroupBy && typeof currentGroupBy === 'string' && currentGroupBy.trim()) {
      return [{ type: 'field', field: currentGroupBy.trim() }]
    }
    return []
  }, [currentGroupBy, groupByRules])

  const groupModel = useMemo(() => {
    if (effectiveGroupRules.length === 0) return null
    return buildGroupTree(filteredRows, tableFields, effectiveGroupRules, {
      emptyLabel: '(Empty)',
      emptyLast: true,
      valueLabelMaps: groupValueLabelMaps,
    })
  }, [effectiveGroupRules, filteredRows, tableFields, groupValueLabelMaps])

  // Resolve grouping labels for linked record fields (link_to_table).
  useEffect(() => {
    let cancelled = false

    const collectIds = (raw: any): string[] => {
      if (raw == null) return []
      if (Array.isArray(raw)) return raw.flatMap(collectIds)
      if (typeof raw === 'object') {
        if (raw && 'id' in raw) return [String((raw as any).id)]
        return []
      }
      const s = String(raw).trim()
      return s ? [s] : []
    }

    async function load() {
      const rules = Array.isArray(effectiveGroupRules) ? effectiveGroupRules : []
      if (rules.length === 0) {
        setGroupValueLabelMaps({})
        return
      }

      const safeFields = Array.isArray(tableFields) ? tableFields : []
      const fieldByNameOrId = new Map<string, TableField>()
      for (const f of safeFields) {
        if (!f) continue
        if (f.name) fieldByNameOrId.set(f.name, f)
        if ((f as any).id) fieldByNameOrId.set(String((f as any).id), f)
      }

      const groupedLinkFields: LinkedField[] = []
      for (const r of rules) {
        if (!r || r.type !== 'field') continue
        const f = fieldByNameOrId.get(r.field)
        if (f && f.type === 'link_to_table') groupedLinkFields.push(f as LinkedField)
      }

      if (groupedLinkFields.length === 0) {
        setGroupValueLabelMaps({})
        return
      }

      const next: Record<string, Record<string, string>> = {}
      for (const f of groupedLinkFields) {
        const ids = new Set<string>()
        for (const row of Array.isArray(filteredRows) ? filteredRows : []) {
          for (const id of collectIds((row as any)?.[f.name])) ids.add(id)
        }
        if (ids.size === 0) continue
        const map = await resolveLinkedFieldDisplayMap(f, Array.from(ids))
        next[f.name] = Object.fromEntries(map.entries())
        next[(f as any).id] = next[f.name]
      }

      if (!cancelled) setGroupValueLabelMaps(next)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [effectiveGroupRules, filteredRows, tableFields])

  const flattenedGroups = useMemo(() => {
    if (!groupModel || groupModel.rootGroups.length === 0) return null
    return flattenGroupTree(groupModel.rootGroups, collapsedGroups)
  }, [collapsedGroups, groupModel])

  const groupPathMap = useMemo(() => {
    const map = new Map<string, any[]>()
    if (!groupModel) return map
    const walk = (node: any, ancestors: any[]) => {
      const next = [...ancestors, node]
      map.set(String(node.pathKey), next)
      const children = Array.isArray(node.children) ? node.children : []
      children.forEach((c: any) => walk(c, next))
    }
    const roots = Array.isArray(groupModel.rootGroups) ? groupModel.rootGroups : []
    roots.forEach((g) => walk(g, []))
    return map
  }, [groupModel])

  // When grouping, allow "start collapsed" behavior (default: collapsed).
  // This is intentionally applied only on initial load / when the groupBy field changes / when the setting flips,
  // so we don't override the user's manual expand/collapse interactions mid-session.
  useEffect(() => {
    const groupByChanged = prevGroupByRef.current !== currentGroupBy
    prevGroupByRef.current = currentGroupBy

    if (groupByChanged) {
      didInitChoiceGroupCollapseRef.current = false
      setCollapsedGroups(new Set())
    }

    // No grouping: always open (nothing to collapse)
    if (effectiveGroupRules.length === 0) {
      didInitChoiceGroupCollapseRef.current = false
      return
    }

    // If the setting is "open", force-expand (clear collapsed set).
    if (!defaultChoiceGroupsCollapsed) {
      didInitChoiceGroupCollapseRef.current = false
      setCollapsedGroups(new Set())
      return
    }

    // Setting is "closed": collapse all groups once, when we have keys.
    if (didInitChoiceGroupCollapseRef.current) return
    const top = groupModel?.rootGroups || []
    if (top.length === 0) return
    setCollapsedGroups(new Set(top.map((n) => n.pathKey)))
    didInitChoiceGroupCollapseRef.current = true
  }, [currentGroupBy, defaultChoiceGroupsCollapsed, effectiveGroupRules.length, groupModel?.rootGroups])

  // Handle group change
  const handleGroupChange = useCallback(async (fieldName: string | null) => {
    setCurrentGroupBy(fieldName || undefined)
    
    // If callback provided (block config), use it
    if (onGroupByChange) {
      onGroupByChange(fieldName)
      return
    }
    
    // Otherwise, try to save to view config if viewId exists
    if (!viewUuid) {
      return
    }

    try {
      const supabase = createClient()
      const groupByValue = fieldName || null

      // Update view config
      const { data: viewData } = await supabase
        .from("views")
        .select("config")
        .eq("id", viewUuid)
        .single()

      if (viewData) {
        const config = (viewData.config as Record<string, any>) || {}
        config.groupBy = groupByValue

        await supabase
          .from("views")
          .update({ config })
          .eq("id", viewUuid)
      }
    } catch (error) {
      console.error("Error saving group setting:", error)
    }
  }, [viewUuid, onGroupByChange])

  // Handle filters change
  const handleFiltersChange = useCallback((newFilters: Array<{ id?: string; field_name: string; operator: any; value?: string }>) => {
    const filterConfigs: FilterConfig[] = newFilters.map(f => ({
      field: f.field_name,
      operator: f.operator,
      value: f.value || '',
    }))
    setCurrentFilters(filterConfigs)
    
    // If callback provided (block config), use it
    if (onFiltersChange) {
      onFiltersChange(filterConfigs)
    }
  }, [onFiltersChange])

  // Helper to get image from image field
  const getRowValue = useCallback(
    (row: Record<string, any>, fieldNameOrId?: string | null) => {
      if (!fieldNameOrId) return null
      const f = tableFields.find((tf) => tf.name === fieldNameOrId || tf.id === fieldNameOrId)
      const key = f?.name || fieldNameOrId
      return row?.[key] ?? null
    },
    [tableFields]
  )

  const getImageUrlFromValue = useCallback((imageValue: any): string | null => {
    if (!imageValue) return null

    // Handle attachment field (array of URLs/objects) or URL field (single URL)
    if (Array.isArray(imageValue) && imageValue.length > 0) {
      const firstItem = imageValue[0]
      if (typeof firstItem === 'string') {
        return firstItem
      }
      if (typeof firstItem === 'object' && firstItem?.url) {
        return firstItem.url
      }
    }
    if (typeof imageValue === 'string' && (imageValue.startsWith('http') || imageValue.startsWith('/'))) {
      return imageValue
    }

    return null
  }, [])

  // Helper to format field value for display
  const formatFieldValue = useCallback((field: TableField, value: any): string => {
    if (value === null || value === undefined || value === '') {
      return '—'
    }

    switch (field.type) {
      case 'date':
        return formatDateUK(value)
      case 'number':
      case 'percent':
      case 'currency':
        return String(value)
      case 'checkbox':
        return value ? 'Yes' : 'No'
      case 'single_select':
      case 'multi_select':
        if (Array.isArray(value)) {
          return value.join(', ')
        }
        return String(value)
      case 'attachment':
        if (Array.isArray(value)) {
          return `${value.length} file${value.length !== 1 ? 's' : ''}`
        }
        return '—'
      default:
        return String(value)
    }
  }, [])

  // Helper to get pill color
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

  const handleAddRecordToGroup = useCallback(async (groupKey: string) => {
    if (!showAddRecord || !canCreateRecord) return
    if (!supabaseTableName || !tableId) return
    if (effectiveGroupRules.length === 0) return

    try {
      const newData: Record<string, any> = {}

      const defaultsFromFilters = deriveDefaultValuesFromFilters(filters, tableFields)
      if (Object.keys(defaultsFromFilters).length > 0) {
        Object.assign(newData, defaultsFromFilters)
      }

      const chain = groupPathMap.get(groupKey as any) || []
      for (const node of chain as any[]) {
        const rule = (node as any).rule as GroupRule
        if (rule.type === 'field') {
          // For "(Empty)" groups, store null so the record lands in the empty bucket.
          if ((node as any).key === '(Empty)') {
            newData[rule.field] = null
          } else {
            // Checkbox buckets use keys "true"/"false"
            const field = tableFields.find((f) => f.name === rule.field || f.id === rule.field)
            if (field?.type === 'checkbox') {
              newData[rule.field] = String((node as any).key) === 'true'
            } else {
              newData[rule.field] = (node as any).key
            }
          }
        } else if (rule.type === 'date') {
          if ((node as any).key === '(Empty)') {
            newData[rule.field] = null
          } else if (rule.granularity === 'year') {
            const y = String((node as any).key)
            newData[rule.field] = /^\d{4}$/.test(y) ? `${y}-01-01` : null
          } else {
            const ym = String((node as any).key)
            newData[rule.field] = /^\d{4}-\d{2}$/.test(ym) ? `${ym}-01` : null
          }
        }
      }
      // Do NOT insert yet — open the modal with pre-filled data.
      setCreateInitialData(newData)
      setCreateModalOpen(true)
    } catch (error) {
      console.error('Failed to create record:', error)
      alert('Failed to create record. Please try again.')
    }
  }, [showAddRecord, canCreateRecord, supabaseTableName, tableId, effectiveGroupRules.length, groupPathMap, tableFields, filters])

  const createRecordModal = (
    <RecordModal
      open={createModalOpen}
      onClose={() => {
        setCreateModalOpen(false)
        setCreateInitialData(null)
      }}
      tableId={tableId}
      recordId={null}
      tableFields={Array.isArray(tableFields) ? tableFields : []}
      initialData={createInitialData || undefined}
      onSave={async () => {
        await loadRows()
        setCreateModalOpen(false)
        setCreateInitialData(null)
      }}
    />
  )

  // Render a list item
  const renderListItem = useCallback((row: Record<string, any>) => {
    const recordId = row.id

    // Get title field
    const titleFieldObj = tableFields.find(f => f.name === titleField || f.id === titleField)
    const titleRaw = titleFieldObj ? row?.[titleFieldObj.name] : null
    const titleText = titleFieldObj ? formatFieldValue(titleFieldObj, titleRaw) : 'Untitled'

    // Get image
    const imageRaw = imageField ? getRowValue(row, imageField) : null
    const imageUrl = imageField ? getImageUrlFromValue(imageRaw) : null

    // Subtitle mapping (to match card style)
    const descriptionKey = subtitleFields?.[0]
    const locationKey = subtitleFields?.[1]
    const extraSubtitleKeys = (subtitleFields || []).slice(2, 3)

    const descriptionField = descriptionKey ? tableFields.find((f) => f.name === descriptionKey || f.id === descriptionKey) : null
    const locationField = locationKey ? tableFields.find((f) => f.name === locationKey || f.id === locationKey) : null
    const descriptionText = descriptionField ? formatFieldValue(descriptionField, row?.[descriptionField.name]) : ''
    const locationText = locationField ? formatFieldValue(locationField, row?.[locationField.name]) : ''

    const extraSubtitle = extraSubtitleKeys
      .map((k) => {
        const f = tableFields.find((tf) => tf.name === k || tf.id === k)
        if (!f) return null
        const t = formatFieldValue(f, row?.[f.name])
        if (!t || t === '—') return null
        return { key: k, label: f.name, text: t }
      })
      .filter(Boolean) as Array<{ key: string; label: string; text: string }>

    return (
      <div
        key={recordId}
        onClick={() => setSelectedRecordId(String(recordId))}
        onDoubleClick={() => handleOpenRecord(String(recordId))}
        className={`group touch-manipulation cursor-default rounded-xl border bg-white shadow-sm transition-all ${
          selectedRecordId === String(recordId)
            ? "border-blue-200 ring-2 ring-blue-100"
            : "border-gray-200 hover:border-gray-300 hover:shadow-md active:shadow-sm"
        }`}
      >
        <div className={`flex items-start gap-4 ${isMobile ? 'p-3' : 'p-4'}`}>
          {/* Thumbnail (always reserved, matches card style) */}
          <div className={`flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 ${isMobile ? 'w-14 h-14' : 'w-20 h-20'}`}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className={`font-semibold text-gray-900 ${isMobile ? 'text-sm' : 'text-base'} leading-snug line-clamp-2`}>
                  {titleText && titleText !== '—' ? titleText : 'Untitled'}
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleOpenRecord(String(recordId))
                }}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                title="Open"
                aria-label="Open"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>

            {/* Description */}
            {descriptionText && descriptionText !== '—' && (
              <div className={`mt-1 text-gray-600 ${isMobile ? 'text-xs' : 'text-sm'} leading-snug line-clamp-2`}>
                {descriptionText}
              </div>
            )}

            {/* Location */}
            {locationText && locationText !== '—' && (
              <div className={`mt-2 flex items-center gap-1.5 text-gray-500 ${isMobile ? 'text-xs' : 'text-sm'} min-w-0`}>
                <MapPin className="h-4 w-4 flex-shrink-0 text-gray-400" />
                <span className="truncate">{locationText}</span>
              </div>
            )}

            {/* Extra subtitle (optional) */}
            {extraSubtitle.length > 0 && (
              <div className="mt-1 space-y-1">
                {extraSubtitle.map((s) => (
                  <div key={s.key} className={`text-gray-500 ${isMobile ? 'text-xs' : 'text-sm'} truncate`}>
                    {s.text}
                  </div>
                ))}
              </div>
            )}

            {/* Tags (pills) */}
            {pillFields.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {pillFields.flatMap((fieldNameOrId) => {
                  const field = tableFields.find((f) => f.name === fieldNameOrId || f.id === fieldNameOrId)
                  if (!field) return []
                  const raw = row?.[field.name]
                  if (raw == null || raw === '' || (Array.isArray(raw) && raw.length === 0)) return []

                  const values = field.type === 'multi_select' ? (Array.isArray(raw) ? raw : []) : [raw]
                  return values
                    .filter((v) => v != null && String(v).trim() !== '')
                    .map((v) => {
                      const label = String(v).trim()
                      const color = getPillColor(field, label)
                      const bg = color ? `${color}1A` : '#F3F4F6'
                      const border = color ? `${color}33` : '#E5E7EB'
                      const text = color || '#374151'
                      return (
                        <span
                          key={`${field.name}:${label}`}
                          className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border"
                          style={{ backgroundColor: bg, borderColor: border, color: text }}
                        >
                          {label}
                        </span>
                      )
                    })
                })}
              </div>
            )}

            {/* Metadata (optional) */}
            {metaFields.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                {metaFields.map((fieldNameOrId) => {
                  const field = tableFields.find((f) => f.name === fieldNameOrId || f.id === fieldNameOrId)
                  if (!field) return null
                  const text = formatFieldValue(field, row?.[field.name])
                  if (!text || text === '—') return null
                  return (
                    <span key={`meta:${field.name}`} className="truncate">
                      <span className="text-gray-400">{field.name}:</span> {text}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }, [
    tableFields,
    titleField,
    subtitleFields,
    imageField,
    pillFields,
    metaFields,
    getRowValue,
    getImageUrlFromValue,
    handleOpenRecord,
    isMobile,
    selectedRecordId,
    formatFieldValue,
    getPillColor,
  ])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        Loading...
      </div>
    )
  }

  // Render grouped (nested) or ungrouped
  if (flattenedGroups && flattenedGroups.length > 0) {
    return (
      <div className="h-full flex flex-col">
        {/* Toolbar */}
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b bg-white">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGroupDialogOpen(true)}
            className="h-8"
          >
            <Group className="h-4 w-4 mr-2" />
            Group
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilterDialogOpen(true)}
            className="h-8"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filter
            {currentFilters.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                {currentFilters.length}
              </span>
            )}
          </Button>
        </div>

        {/* Grouped Content */}
        <div className="flex-1 overflow-y-auto">
          {flattenedGroups.map((it) => {
            if (it.type === 'group') {
              const node = it.node
              const isCollapsed = collapsedGroups.has(node.pathKey)
              const ruleLabel =
                node.rule.type === 'date'
                  ? node.rule.granularity === 'year'
                    ? 'Year'
                    : 'Month'
                  : node.rule.field

              // Group color (only for select-type field group nodes)
              let groupColor: string | null = null
              if (node.rule.type === 'field') {
                const groupField = tableFields.find((f) => f.name === node.rule.field || f.id === node.rule.field)
                if (groupField && (groupField.type === 'single_select' || groupField.type === 'multi_select')) {
                  groupColor = getPillColor(groupField, node.key)
                }
              }

              return (
                <div key={node.pathKey} className="border-b border-gray-200 last:border-b-0">
                  <div className="flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100 transition-colors">
                    <button
                      onClick={() => {
                        setCollapsedGroups((prev) => {
                          const next = new Set(prev)
                          if (next.has(node.pathKey)) next.delete(node.pathKey)
                          else next.add(node.pathKey)
                          return next
                        })
                      }}
                      className="flex items-center gap-2 text-left flex-1"
                      style={{ paddingLeft: 8 + (it.level || 0) * 16 }}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      )}
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-sm font-medium"
                        style={{
                          backgroundColor: groupColor ? `${groupColor}20` : undefined,
                          color: groupColor || undefined,
                          border: groupColor ? `1px solid ${groupColor}40` : undefined,
                        }}
                      >
                        {ruleLabel}: {node.label}
                      </span>
                      <span className="text-sm text-gray-500 ml-2">{node.size}</span>
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        handleAddRecordToGroup(node.pathKey)
                      }}
                      className="h-7 text-xs"
                      disabled={!showAddRecord || !canCreateRecord}
                      title={
                        !showAddRecord
                          ? 'Enable "Show Add record button" in block settings to add records'
                          : !canCreateRecord
                            ? 'Adding records is disabled for this block'
                            : 'Add a new record to this group'
                      }
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add content
                    </Button>
                  </div>
                </div>
              )
            }

            // Item row (card)
            const row = it.item as any
            const key = `${String(row?.id ?? Math.random())}::${it.groupPathKey}`
            return (
              <div key={key} className="px-4 py-3">
                {renderListItem(row)}
              </div>
            )
          })}
        </div>

        {/* Dialogs */}
        {viewId ? (
          <>
            <GroupDialog
              isOpen={groupDialogOpen}
              onClose={() => setGroupDialogOpen(false)}
              viewId={viewId}
              tableFields={tableFields}
              groupBy={currentGroupBy}
              onGroupChange={handleGroupChange}
            />
            <FilterDialog
              isOpen={filterDialogOpen}
              onClose={() => setFilterDialogOpen(false)}
              viewId={viewId}
              tableFields={tableFields}
              filters={currentFilters.map((f, idx) => ({
                id: `filter-${idx}`,
                field_name: f.field,
                operator: f.operator as FilterType,
                value: f.value,
              }))}
              onFiltersChange={handleFiltersChange}
            />
          </>
        ) : (groupDialogOpen || filterDialogOpen) && (
          // Simple dialog for when there's no viewId
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md">
              <h3 className="text-lg font-semibold mb-2">
                {groupDialogOpen ? 'Grouping Settings' : 'Filter Settings'}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Configure {groupDialogOpen ? 'grouping' : 'filter'} settings in the block settings panel (Data tab).
              </p>
              <Button onClick={() => {
                setGroupDialogOpen(false)
                setFilterDialogOpen(false)
              }}>Close</Button>
            </div>
          </div>
        )}

        {createRecordModal}
      </div>
    )
  }

  // Render ungrouped list
  const rowsToRender = filteredRows

  if (rowsToRender.length === 0) {
    return (
      <div className="h-full flex flex-col">
        {/* Toolbar */}
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b bg-white">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGroupDialogOpen(true)}
            className="h-8"
          >
            <Group className="h-4 w-4 mr-2" />
            Group
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilterDialogOpen(true)}
            className="h-8"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filter
            {currentFilters.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                {currentFilters.length}
              </span>
            )}
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm p-4">
          <div className="text-center">
            <p className="mb-2">No records found</p>
            {searchQuery && (
              <p className="text-xs text-gray-400">Try adjusting your search or filters</p>
            )}
          </div>
        </div>
        {/* Dialogs */}
        {viewId ? (
          <>
            <GroupDialog
              isOpen={groupDialogOpen}
              onClose={() => setGroupDialogOpen(false)}
              viewId={viewId}
              tableFields={tableFields}
              groupBy={currentGroupBy}
              onGroupChange={handleGroupChange}
            />
            <FilterDialog
              isOpen={filterDialogOpen}
              onClose={() => setFilterDialogOpen(false)}
              viewId={viewId}
              tableFields={tableFields}
              filters={currentFilters.map((f, idx) => ({
                id: `filter-${idx}`,
                field_name: f.field,
                operator: f.operator as FilterType,
                value: f.value,
              }))}
              onFiltersChange={handleFiltersChange}
            />
          </>
        ) : (groupDialogOpen || filterDialogOpen) && (
          // Simple dialog for when there's no viewId
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md">
              <h3 className="text-lg font-semibold mb-2">
                {groupDialogOpen ? 'Grouping Settings' : 'Filter Settings'}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Configure {groupDialogOpen ? 'grouping' : 'filter'} settings in the block settings panel (Data tab).
              </p>
              <Button onClick={() => {
                setGroupDialogOpen(false)
                setFilterDialogOpen(false)
              }}>Close</Button>
            </div>
          </div>
        )}

        {createRecordModal}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b bg-white">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setGroupDialogOpen(true)}
          className="h-8"
        >
          <Group className="h-4 w-4 mr-2" />
          Group
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFilterDialogOpen(true)}
          className="h-8"
        >
          <Filter className="h-4 w-4 mr-2" />
          Filter
          {currentFilters.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
              {currentFilters.length}
            </span>
          )}
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-3">
          {rowsToRender.map((row) => renderListItem(row))}
        </div>
      </div>
      {/* Dialogs */}
      {viewId ? (
        <>
          <GroupDialog
            isOpen={groupDialogOpen}
            onClose={() => setGroupDialogOpen(false)}
            viewId={viewId}
            tableFields={tableFields}
            groupBy={currentGroupBy}
            onGroupChange={handleGroupChange}
          />
          <FilterDialog
            isOpen={filterDialogOpen}
            onClose={() => setFilterDialogOpen(false)}
            viewId={viewId}
            tableFields={tableFields}
            filters={currentFilters.map((f, idx) => ({
              id: `filter-${idx}`,
              field_name: f.field,
              operator: f.operator,
              value: f.value,
            }))}
            onFiltersChange={handleFiltersChange}
          />
        </>
      ) : (groupDialogOpen || filterDialogOpen) && (
        // Simple dialog for when there's no viewId
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-semibold mb-2">
              {groupDialogOpen ? 'Grouping Settings' : 'Filter Settings'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {groupDialogOpen ? 'Grouping' : 'Filter'} settings require a view to be configured. Please configure a view in the block settings.
            </p>
            <Button onClick={() => {
              setGroupDialogOpen(false)
              setFilterDialogOpen(false)
            }}>Close</Button>
          </div>
        </div>
      )}

      {createRecordModal}
    </div>
  )
}

