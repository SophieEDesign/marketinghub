"use client"

/**
 * Record Review Left Column (Fixed Structural UI)
 * 
 * This is NOT a block - it's a fixed structural component that:
 * - Shows record list/table
 * - Provides search, filter, sort
 * - Manages field visibility settings
 * - Handles record selection (sets recordId in UI state)
 * 
 * The left column is always present, regardless of edit/view mode.
 * It's not draggable, not part of the canvas blocks.
 */

import { useState, useEffect, useCallback, useMemo, type CSSProperties, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import type { TableField } from "@/types/fields"
import { Plus, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import CreateRecordModal from "@/components/records/CreateRecordModal"
import { useToast } from "@/components/ui/use-toast"
import { formatDateUK } from "@/lib/utils"
import { resolveChoiceColor, normalizeHexColor, getTextColorForBackground } from "@/lib/field-colors"
import { useUserRole } from "@/lib/hooks/useUserRole"
import { canCreateRecord } from "@/lib/interface/record-actions"
import { evaluateFilterTree } from "@/lib/filters/evaluation"
import { filterConfigsToFilterTree } from "@/lib/filters/converters"
import type { FilterTree } from "@/lib/filters/canonical-model"
import { isAbortError } from "@/lib/api/error-handling"

interface RecordReviewLeftColumnProps {
  pageId?: string
  tableId: string | null // From page.settings.tableId
  selectedRecordId: string | null
  onRecordSelect: (recordId: string) => void
  deletedRecordId?: string | null
  showAddRecord?: boolean
  pageConfig?: any
  leftPanelSettings?: {
    // For record_review pages: full field list
    visibleFieldIds?: string[]
    fieldOrder?: string[]
    showLabels?: boolean
    compact?: boolean
    // For record_view pages: simplified 3-field configuration
    titleFieldId?: string | null
    subtitleFieldId?: string | null
    additionalFieldId?: string | null
    // Backward compatibility: support old field name format (snake_case)
    title_field?: string | null
    field_1?: string | null
    field_2?: string | null
    // Shared record list options (record_view + record_review)
    filter_by?: Array<{ field: string; operator: string; value: any }>
    filter_tree?: FilterTree
    sort_by?: Array<{ field: string; direction: "asc" | "desc" }>
    group_by?: string | string[] // Legacy: single field or array of fields
    group_by_rules?: GroupRule[] // New: nested grouping rules (takes precedence over group_by)
    color_field?: string
    image_field?: string
  }
  pageType?: 'record_view' | 'record_review' // To determine which settings format to use
}

export default function RecordReviewLeftColumn({
  pageId,
  tableId,
  selectedRecordId,
  onRecordSelect,
  deletedRecordId = null,
  showAddRecord = false,
  pageConfig,
  leftPanelSettings,
  pageType = 'record_review', // Default to record_review for backward compatibility
}: RecordReviewLeftColumnProps) {
  const { toast } = useToast()
  const { role: userRole } = useUserRole()
  const [records, setRecords] = useState<any[]>([])
  const [fields, setFields] = useState<TableField[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [tableName, setTableName] = useState<string | null>(null)
  const [supabaseTableName, setSupabaseTableName] = useState<string | null>(null)
  
  // If a record was deleted elsewhere (e.g. right canvas action), remove it from this list immediately.
  useEffect(() => {
    if (!deletedRecordId) return
    setRecords((prev) => prev.filter((r) => String(r?.id) !== String(deletedRecordId)))
  }, [deletedRecordId])

  // Get settings based on page type
  const isRecordView = pageType === 'record_view'
  const isRecordReview = pageType === 'record_review'
  
  // For record_review: full field list configuration
  const visibleFieldIds = isRecordReview ? (leftPanelSettings?.visibleFieldIds || []) : []
  const fieldOrder = isRecordReview ? (leftPanelSettings?.fieldOrder || []) : []
  const showLabels = isRecordReview ? (leftPanelSettings?.showLabels ?? true) : false
  const compact = isRecordReview ? (leftPanelSettings?.compact ?? false) : false
  
  // For record_view: simplified 3-field configuration
  // CRITICAL: RecordViewPageSettings saves field names (title_field, field_1, field_2), not IDs
  // Support both field names and field IDs for backward compatibility
  const titleFieldNameOrId = isRecordView ? (
    leftPanelSettings?.title_field || 
    leftPanelSettings?.titleFieldId || 
    null
  ) : null
  const subtitleFieldNameOrId = isRecordView ? (
    leftPanelSettings?.field_1 || 
    leftPanelSettings?.subtitleFieldId || 
    null
  ) : null
  const additionalFieldNameOrId = isRecordView ? (
    leftPanelSettings?.field_2 || 
    leftPanelSettings?.additionalFieldId || 
    null
  ) : null
  
  // Convert field names to field IDs once fields are loaded
  const titleFieldId = useMemo(() => {
    if (!titleFieldNameOrId || fields.length === 0) return null
    // Check if it's already an ID (UUID format) or a field name
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(titleFieldNameOrId)
    if (isUUID) return titleFieldNameOrId
    // It's a field name, find the field ID
    const field = fields.find(f => f.name === titleFieldNameOrId)
    return field?.id || null
  }, [titleFieldNameOrId, fields])
  
  const subtitleFieldId = useMemo(() => {
    if (!subtitleFieldNameOrId || fields.length === 0) return null
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subtitleFieldNameOrId)
    if (isUUID) return subtitleFieldNameOrId
    const field = fields.find(f => f.name === subtitleFieldNameOrId)
    return field?.id || null
  }, [subtitleFieldNameOrId, fields])
  
  const additionalFieldId = useMemo(() => {
    if (!additionalFieldNameOrId || fields.length === 0) return null
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(additionalFieldNameOrId)
    if (isUUID) return additionalFieldNameOrId
    const field = fields.find(f => f.name === additionalFieldNameOrId)
    return field?.id || null
  }, [additionalFieldNameOrId, fields])

  const primaryCreateField = useMemo(() => {
    if (!isRecordView || !titleFieldId) return null
    return fields.find((f) => f.id === titleFieldId) ?? null
  }, [fields, isRecordView, titleFieldId])

  const canPrefillPrimaryCreateField =
    primaryCreateField?.type === "text" ||
    primaryCreateField?.type === "long_text" ||
    primaryCreateField?.type === "email" ||
    primaryCreateField?.type === "url"

  const effectiveLeftPanelConfig = useMemo(() => {
    // Prefer config.left_panel if provided (single source of truth for record_view settings)
    // but keep backward compatibility with `leftPanelSettings` and other legacy shapes.
    return (
      pageConfig?.left_panel ||
      pageConfig?.leftPanel ||
      leftPanelSettings ||
      {}
    )
  }, [leftPanelSettings, pageConfig?.leftPanel, pageConfig?.left_panel])

  const leftPanelColorField: string | undefined = effectiveLeftPanelConfig?.color_field
  const leftPanelImageField: string | undefined = effectiveLeftPanelConfig?.image_field

  const leftPanelFilterTree: FilterTree = useMemo(() => {
    const directTree = effectiveLeftPanelConfig?.filter_tree
    if (directTree) return directTree
    const raw = effectiveLeftPanelConfig?.filter_by
    if (Array.isArray(raw) && raw.length > 0) {
      return filterConfigsToFilterTree(raw, "AND")
    }
    return null
  }, [effectiveLeftPanelConfig?.filter_by, effectiveLeftPanelConfig?.filter_tree])

  const leftPanelSorts: Array<{ field: string; direction: "asc" | "desc" }> = useMemo(() => {
    const sorts = effectiveLeftPanelConfig?.sort_by
    return Array.isArray(sorts) ? sorts : []
  }, [effectiveLeftPanelConfig?.sort_by])

  // Support both nested groups (group_by_rules) and legacy single field/array (group_by)
  const groupByRules: GroupRule[] | undefined = useMemo(() => {
    const rules = effectiveLeftPanelConfig?.group_by_rules
    if (Array.isArray(rules) && rules.length > 0) {
      return rules.filter(Boolean) as GroupRule[]
    }
    return undefined
  }, [effectiveLeftPanelConfig?.group_by_rules])

  const groupByFields: string[] = useMemo(() => {
    // If group_by_rules exists, convert to legacy format for backward compatibility
    if (groupByRules && groupByRules.length > 0) {
      return groupByRules
        .filter(r => r.type === 'field')
        .map(r => r.field)
    }
    // Otherwise use legacy group_by
    const gb = effectiveLeftPanelConfig?.group_by
    if (!gb) return []
    if (Array.isArray(gb)) return gb.filter(Boolean)
    if (typeof gb === "string" && gb.trim()) return [gb.trim()]
    return []
  }, [effectiveLeftPanelConfig?.group_by, groupByRules])

  // Load table name and fields
  useEffect(() => {
    if (!tableId) return

    async function loadTableInfo() {
      const supabase = createClient()
      
      // Load table name
      const { data: table } = await supabase
        .from("tables")
        .select("name, supabase_table")
        .eq("id", tableId)
        .single()

      if (table) {
        setTableName(table.name)
        setSupabaseTableName(table.supabase_table || null)
        
        // Load fields
        const { data: tableFields } = await supabase
          .from("table_fields")
          .select("*")
          .eq("table_id", tableId)
          .order("order_index", { ascending: true })

        if (tableFields) {
          setFields(tableFields as TableField[])
        }

        // Load records
        await loadRecords(table.supabase_table)
      }
    }

    loadTableInfo()
  }, [tableId])

  const loadRecords = useCallback(async (supabaseTableName: string) => {
    if (!supabaseTableName) return

    setLoading(true)
    try {
      const supabase = createClient()
      const query = supabase.from(supabaseTableName).select("*").limit(500)

      const { data, error } = await query

      if (error) {
        // Ignore abort errors (expected during navigation/unmount)
        if (!isAbortError(error)) {
          console.error("Error loading records:", error)
        }
      } else {
        setRecords(data || [])
      }
    } catch (error) {
      // Ignore abort errors (expected during navigation/unmount)
      if (!isAbortError(error)) {
        console.error("Error loading records:", error)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tableId) {
      const supabase = createClient()
      supabase
        .from("tables")
        .select("supabase_table")
        .eq("id", tableId)
        .single()
        .then(({ data: table }) => {
          if (table?.supabase_table) {
            setSupabaseTableName(table.supabase_table)
            loadRecords(table.supabase_table)
          }
        })
    }
  }, [tableId, loadRecords])

  const handleOpenCreateModal = useCallback(() => {
    // Only enable this UX for record_view pages (requested)
    if (!isRecordView) return
    if (!supabaseTableName || creating) return
    if (!canCreateRecord(userRole, pageConfig)) {
      toast({
        variant: "destructive",
        title: "Not allowed",
        description: "You don't have permission to create records on this page.",
      })
      return
    }
    setCreateModalOpen(true)
  }, [creating, isRecordView, pageConfig, supabaseTableName, toast, userRole])

  const handleCreateRecord = useCallback(async (primaryValue: string) => {
    if (!isRecordView) return
    if (!showAddRecord || !supabaseTableName || creating) return
    if (!canCreateRecord(userRole, pageConfig)) {
      throw new Error("You don't have permission to create records on this page.")
    }

    setCreating(true)
    try {
      if (!pageId) {
        throw new Error('Missing page ID for create action.')
      }

      const fieldName =
        canPrefillPrimaryCreateField && primaryCreateField?.name ? primaryCreateField.name : null
      const fieldValue = fieldName ? primaryValue?.trim() : null

      let res: Response
      try {
        res = await fetch(`/api/interface-pages/${pageId}/records`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fieldName: fieldName || undefined,
            fieldValue: fieldValue || undefined,
          }),
        })
      } catch (fetchError) {
        // Check if fetch itself was aborted
        if (isAbortError(fetchError)) {
          return
        }
        throw fetchError
      }

      let payload: any = {}
      try {
        payload = await res.json()
      } catch (jsonError) {
        // If JSON parsing fails, check if it's an abort error
        if (isAbortError(jsonError)) {
          return
        }
        // If response is not ok, use the status text
        if (!res.ok) {
          throw new Error(res.statusText || 'Failed to create record')
        }
      }

      if (!res.ok) {
        const errorMsg = payload?.error || res.statusText || 'Failed to create record'
        // Check if the error message indicates an abort
        if (isAbortError({ message: errorMsg, details: payload?.details })) {
          return
        }
        throw new Error(errorMsg)
      }

      const createdId = payload?.recordId || payload?.record?.id
      if (!createdId) return

      // Ensure the newly created record is visible/selectable
      setSearchQuery("")
      await loadRecords(supabaseTableName)
      onRecordSelect(String(createdId))

      toast({
        title: "Record created",
        description: "Your new record has been created.",
      })
    } catch (error) {
      // Ignore abort errors (expected during navigation/unmount)
      // Check both the error itself and any nested error properties
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
      const errorMessage = (error as any)?.message || (error as any)?.error?.message || 'Failed to create record'
      toast({
        title: "Failed to create record",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }, [
    canPrefillPrimaryCreateField,
    creating,
    isRecordView,
    loadRecords,
    onRecordSelect,
    pageId,
    pageConfig,
    primaryCreateField?.name,
    supabaseTableName,
    toast,
    userRole,
  ])

  const filteredRecords = useMemo(() => {
    let result = [...records]

    const q = searchQuery.trim().toLowerCase()
    if (q) {
      result = result.filter((record) => {
        // lightweight global search (best-effort) across primitive values
        return Object.values(record).some((v) => {
          if (v === null || v === undefined) return false
          if (typeof v === "object") return false
          return String(v).toLowerCase().includes(q)
        })
      })
    }

    if (leftPanelFilterTree) {
      result = result.filter((record) => {
        return evaluateFilterTree(record, leftPanelFilterTree, (row, fieldId) => {
          const field = fields.find((f) => f.name === fieldId || f.id === fieldId)
          if (field) return row[field.name]
          return row[fieldId]
        })
      })
    }

    // Apply left panel sorts (stable multi-sort)
    if (leftPanelSorts.length > 0) {
      result.sort((a, b) => {
        for (const sort of leftPanelSorts) {
          const aValue = a?.[sort.field]
          const bValue = b?.[sort.field]
          if (aValue === bValue) continue

          const direction = sort.direction === "desc" ? -1 : 1
          if (aValue === null || aValue === undefined) return 1 * direction
          if (bValue === null || bValue === undefined) return -1 * direction

          if (typeof aValue === "number" && typeof bValue === "number") {
            return (aValue - bValue) * direction
          }
          return String(aValue).localeCompare(String(bValue)) * direction
        }
        return 0
      })
    }

    return result
  }, [fields, leftPanelFilterTree, leftPanelSorts, records, searchQuery])

  // Auto-select first visible record when the visible set changes and none is selected
  useEffect(() => {
    if (!selectedRecordId && !loading && filteredRecords.length > 0) {
      const first = filteredRecords[0]
      if (first?.id) onRecordSelect(String(first.id))
    }
  }, [filteredRecords, loading, onRecordSelect, selectedRecordId])

  const getGroupOrder = useCallback((fieldName: string): string[] => {
    const def = fields.find((f) => f.name === fieldName)
    const choices = def?.options?.choices
    return Array.isArray(choices) ? choices : []
  }, [fields])

  // Build effective group rules: prefer group_by_rules, fallback to group_by fields
  const effectiveGroupRules = useMemo<GroupRule[]>(() => {
    if (groupByRules && groupByRules.length > 0) {
      return groupByRules
    }
    // Convert legacy group_by fields to rules format
    if (groupByFields.length > 0) {
      return groupByFields.map(field => ({ type: 'field' as const, field }))
    }
    return []
  }, [groupByRules, groupByFields])

  // Build group tree using the grouping library
  const groupModel = useMemo(() => {
    if (effectiveGroupRules.length === 0) return null
    return buildGroupTree(filteredRecords, fields, effectiveGroupRules, {
      emptyLabel: '(Empty)',
      emptyLast: true,
    })
  }, [effectiveGroupRules, filteredRecords, fields])

  // Flatten the group tree for rendering
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const toggleGroupCollapsed = useCallback((pathKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(pathKey)) {
        next.delete(pathKey)
      } else {
        next.add(pathKey)
      }
      return next
    })
  }, [])

  const flattenedGroups = useMemo(() => {
    if (!groupModel || groupModel.rootGroups.length === 0) return null
    return flattenGroupTree(groupModel.rootGroups, collapsedGroups)
  }, [groupModel, collapsedGroups])

  const renderGroupHeader = useCallback((node: any, level: number) => {
    const fieldName = node.rule?.field || ''
    const fieldDef = fields.find((f) => f.name === fieldName || f.id === fieldName)
    const isCollapsed = collapsedGroups.has(node.pathKey)
    const ruleLabel = node.rule?.type === 'date'
      ? node.rule.granularity === 'year' ? 'Year' : 'Month'
      : fieldName

    // If it's a select field, reuse choice color logic for a badge-like header.
    if (fieldDef?.type === "single_select" || fieldDef?.type === "multi_select") {
      const normalizedColor = normalizeHexColor(
        resolveChoiceColor(String(node.key), fieldDef.type, fieldDef.options, fieldDef.type === "single_select")
      )
      const textColor = getTextColorForBackground(normalizedColor)
      return (
        <button
          type="button"
          onClick={() => toggleGroupCollapsed(node.pathKey)}
          className="w-full flex items-center justify-between px-2 py-1 hover:bg-gray-50 rounded"
          style={{ paddingLeft: 8 + level * 16 }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Badge className={`text-xs font-medium ${textColor} border border-opacity-20`} style={{ backgroundColor: normalizedColor }}>
              {node.label}
            </Badge>
            <span className="text-xs text-gray-500">{node.size}</span>
          </div>
          <span className="text-xs text-gray-400">{isCollapsed ? "▸" : "▾"}</span>
        </button>
      )
    }

    return (
      <button
        type="button"
        onClick={() => toggleGroupCollapsed(node.pathKey)}
        className="w-full flex items-center justify-between px-2 py-1 hover:bg-gray-50 rounded"
        style={{ paddingLeft: 8 + level * 16 }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-gray-700 truncate">
            {ruleLabel}: {node.label}
          </span>
          <span className="text-xs text-gray-500">{node.size}</span>
        </div>
        <span className="text-xs text-gray-400">{isCollapsed ? "▸" : "▾"}</span>
      </button>
    )
  }, [collapsedGroups, fields, toggleGroupCollapsed])

  // Get ordered fields based on page settings
  const orderedFields = useMemo(() => {
    if (isRecordView) {
      // For record_view: return fields in order: title, subtitle, additional
      const titleField = titleFieldId ? fields.find(f => f.id === titleFieldId) : null
      const subtitleField = subtitleFieldId ? fields.find(f => f.id === subtitleFieldId) : null
      const additionalField = additionalFieldId ? fields.find(f => f.id === additionalFieldId) : null
      
      return [titleField, subtitleField, additionalField].filter((f): f is TableField => f !== null)
    } else {
      // For record_review: use fieldOrder or table field order
      if (fieldOrder.length > 0) {
        return fieldOrder
          .map(id => fields.find(f => f.id === id))
          .filter((f): f is TableField => f !== undefined)
          .concat(fields.filter(f => !fieldOrder.includes(f.id)))
      }
      return fields
    }
  }, [fields, fieldOrder, isRecordView, titleFieldId, subtitleFieldId, additionalFieldId])

  const renderValue = useCallback((field: TableField | null | undefined, value: any) => {
    if (!field) return <span className="text-gray-400">—</span>
    if (value === null || value === undefined || value === "") {
      return <span className="text-gray-400">—</span>
    }

    // Dates
    if (field.type === "date") {
      return <span>{formatDateUK(String(value), "—")}</span>
    }

    // Multi-select pills
    if (field.type === "multi_select") {
      const values = Array.isArray(value) ? value : [value]
      return (
        <div className="flex flex-wrap gap-1">
          {values.slice(0, 4).map((v: any, i: number) => {
            const normalizedColor = normalizeHexColor(
              resolveChoiceColor(String(v), "multi_select", field.options, false)
            )
            const textColor = getTextColorForBackground(normalizedColor)
            return (
              <Badge
                key={`${field.id}-${i}`}
                className={`text-[11px] font-medium ${textColor} border border-opacity-20`}
                style={{ backgroundColor: normalizedColor }}
              >
                {String(v)}
              </Badge>
            )
          })}
          {values.length > 4 && (
            <span className="text-[11px] text-gray-500">+{values.length - 4}</span>
          )}
        </div>
      )
    }

    // Single select pill
    if (field.type === "single_select") {
      const normalizedColor = normalizeHexColor(
        resolveChoiceColor(String(value), "single_select", field.options, true)
      )
      const textColor = getTextColorForBackground(normalizedColor)
      return (
        <Badge
          className={`text-[11px] font-medium ${textColor} border border-opacity-20`}
          style={{ backgroundColor: normalizedColor }}
        >
          {String(value)}
        </Badge>
      )
    }

    return <span>{String(value)}</span>
  }, [])

  const renderRecordRow = useCallback((record: any) => {
    const isSelected = record.id === selectedRecordId

    const imageValue = leftPanelImageField ? record[leftPanelImageField] : null
    const colorValue = leftPanelColorField ? record[leftPanelColorField] : null
    const colorField = leftPanelColorField ? fields.find((f) => f.name === leftPanelColorField) : null

    let borderColorStyle: CSSProperties | undefined = undefined
    if (colorValue && colorField?.type === "single_select") {
      const hexColor = resolveChoiceColor(String(colorValue), "single_select", colorField.options, true)
      const normalizedColor = normalizeHexColor(hexColor)
      borderColorStyle = { borderLeftColor: normalizedColor, borderLeftWidth: "4px" }
    }

    if (isRecordView) {
      const titleField = titleFieldId ? (fields.find((f) => f.id === titleFieldId) ?? null) : null
      const subtitleField = subtitleFieldId ? (fields.find((f) => f.id === subtitleFieldId) ?? null) : null
      const additionalField = additionalFieldId ? (fields.find((f) => f.id === additionalFieldId) ?? null) : null

      const titleValue = titleField ? (record[titleField.name] || "Untitled") : "Untitled"
      const subtitleValue = subtitleField ? record[subtitleField.name] : null
      const additionalValue = additionalField ? record[additionalField.name] : null

      return (
        <button
          key={record.id}
          onClick={() => onRecordSelect(record.id)}
          className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors flex gap-2 border-l-4 ${
            isSelected ? "bg-blue-50 border-blue-500" : "border-transparent"
          }`}
          style={borderColorStyle}
        >
          {/* Image (optional) */}
          {leftPanelImageField && imageValue && (
            <div className="flex-shrink-0 w-9 h-9 rounded overflow-hidden bg-gray-100 mt-0.5">
              {typeof imageValue === "string" && (imageValue.startsWith("http") || imageValue.startsWith("/")) ? (
                <img
                  src={imageValue}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).style.display = "none"
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                  {String(imageValue).substring(0, 2).toUpperCase()}
                </div>
              )}
            </div>
          )}

          <div className="min-w-0 flex-1">
            {/* Title */}
            <div className="text-sm font-medium text-gray-900 truncate">
              {String(titleValue || "Untitled")}
            </div>

            {/* Subtitle */}
            {subtitleValue && (
              <div className="mt-1 text-xs text-gray-600 truncate">
                {renderValue(subtitleField, subtitleValue)}
              </div>
            )}

            {/* Additional Field */}
            {additionalValue && (
              <div className="mt-1 text-xs text-gray-500 truncate">
                {renderValue(additionalField, additionalValue)}
              </div>
            )}
          </div>
        </button>
      )
    }

    // record_review fallback: first configured field only (existing behavior)
    const displayFields = visibleFieldIds.length === 0
      ? orderedFields
      : orderedFields.filter((f) => visibleFieldIds.includes(f.id))

    const displayField = displayFields[0]
    const displayValue = displayField ? record[displayField.name] || "Untitled" : record.name || "Untitled"

    return (
      <button
        key={record.id}
        onClick={() => onRecordSelect(record.id)}
        className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors ${
          isSelected ? "bg-blue-50 border-l-4 border-blue-500" : ""
        } ${compact ? "py-2" : ""}`}
      >
        <div className={`font-medium text-gray-900 truncate ${compact ? "text-xs" : "text-sm"}`}>
          {String(displayValue || "Untitled")}
        </div>
        {showLabels && displayField && (
          <div className="text-xs text-gray-500 mt-0.5">
            {displayField.name}
          </div>
        )}
      </button>
    )
  }, [
    additionalFieldId,
    compact,
    fields,
    isRecordView,
    leftPanelColorField,
    leftPanelImageField,
    onRecordSelect,
    orderedFields,
    renderValue,
    selectedRecordId,
    showLabels,
    subtitleFieldId,
    titleFieldId,
    visibleFieldIds,
  ])

  if (!tableId) {
    return (
      <div className="w-80 border-r border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-500">No table selected</p>
      </div>
    )
  }

  return (
    <div className="w-80 border-r border-gray-200 bg-white flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">{tableName || "Records"}</h3>

        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          {isRecordView && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              onClick={handleOpenCreateModal}
              disabled={creating || !supabaseTableName}
              aria-label="Add record"
              title={!supabaseTableName ? "No table configured" : "Add a new record"}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Create record modal (record_view only) */}
      {isRecordView && (
        <CreateRecordModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          tableName={tableName || undefined}
          primaryFieldLabel={canPrefillPrimaryCreateField ? primaryCreateField?.name : null}
          primaryFieldPlaceholder={
            canPrefillPrimaryCreateField && primaryCreateField?.name
              ? `Enter ${primaryCreateField.name}`
              : undefined
          }
          isSaving={creating}
          onCreate={handleCreateRecord}
        />
      )}

      {/* Record List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-sm text-gray-500">Loading records...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">No records found</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {!flattenedGroups ? (
              filteredRecords.map(renderRecordRow)
            ) : (
              // Render nested groups using flattened structure
              flattenedGroups.map((it, idx) => {
                if (it.type === 'group') {
                  const node = it.node
                  return (
                    <div key={node.pathKey} className="border-b border-gray-100">
                      {renderGroupHeader(node, it.level || 0)}
                    </div>
                  )
                } else {
                  // Render record row with indentation based on level
                  return (
                    <div key={`record-${it.item?.id || idx}`}>
                      {renderRecordRow(it.item)}
                    </div>
                  )
                }
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
