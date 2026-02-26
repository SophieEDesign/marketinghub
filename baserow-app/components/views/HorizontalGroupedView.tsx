"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { filterRowsBySearch } from "@/lib/search/filterRows"
import type { TableField } from "@/types/fields"
import { applyFiltersToQuery, stripFilterBlockFilters, type FilterConfig } from "@/lib/interface/filters"
import { formatErrorForLog } from "@/lib/api/error-handling"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { buildGroupTree } from "@/lib/grouping/groupTree"
import type { GroupRule } from "@/lib/grouping/types"
import { toPostgrestColumn } from "@/lib/supabase/postgrest"
import { normalizeUuid } from "@/lib/utils/ids"
import { getLinkedFieldValueFromRow, linkedValueToIds, resolveLinkedFieldDisplayMap } from "@/lib/dataView/linkedFields"
import type { LinkedField } from "@/types/fields"
import EmptyState from "@/components/empty-states/EmptyState"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { resolveChoiceColor, normalizeHexColor, getTextColorForBackground, SEMANTIC_COLORS } from '@/lib/field-colors'
import Canvas from "@/components/interface/Canvas"
import BlockRenderer from "@/components/interface/BlockRenderer"
import { FilterStateProvider } from "@/lib/interface/filter-state"
import type { PageBlock, LayoutItem } from "@/lib/interface/types"
import type { FilterTree } from "@/lib/filters/canonical-model"
import type { HighlightRule } from "@/lib/interface/types"
import { evaluateHighlightRules, getFormattingStyle } from "@/lib/conditional-formatting/evaluator"

interface FieldConfig {
  field: string // Field name or ID
  editable?: boolean
  order?: number
}

interface HorizontalGroupedViewProps {
  tableId: string
  viewId?: string
  supabaseTableName: string
  tableFields: TableField[]
  filters?: FilterConfig[]
  filterTree?: FilterTree | null // Filter tree from filter blocks (supports groups/OR)
  sorts?: Array<{ field_name: string; direction: 'asc' | 'desc' }>
  groupBy?: string
  groupByRules?: GroupRule[]
  searchQuery?: string
  onRecordClick?: (recordId: string) => void
  reloadKey?: any
  // Field configuration for record display
  recordFields?: FieldConfig[] // Configured fields to show in record canvas
  isEditing?: boolean // Whether canvas is in edit mode
  onBlockUpdate?: (blocks: PageBlock[]) => void | Promise<void> // Callback when blocks are updated
  onBlockSettingsClick?: (blockId: string) => void // Called when user clicks gear on a block (e.g. to open field appearance in modal)
  storedLayout?: PageBlock[] | null // Stored layout from block config
  highlightRules?: HighlightRule[] // Conditional formatting rules
}

export default function HorizontalGroupedView({
  tableId,
  viewId,
  supabaseTableName,
  tableFields,
  filters = [],
  filterTree = null,
  sorts = [],
  groupBy,
  groupByRules,
  searchQuery = "",
  onRecordClick,
  reloadKey,
  recordFields = [],
  isEditing = false,
  onBlockUpdate,
  onBlockSettingsClick,
  storedLayout: storedLayoutProp,
  highlightRules = [],
}: HorizontalGroupedViewProps) {
  const [rows, setRows] = useState<Record<string, any>[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [groupValueLabelMaps, setGroupValueLabelMaps] = useState<Record<string, Record<string, string>>>({})

  // Resolve effective group rules
  const effectiveGroupRules = useMemo<GroupRule[]>(() => {
    const safe = Array.isArray(groupByRules) ? groupByRules.filter(Boolean) : []
    if (safe.length > 0) return safe
    if (groupBy && typeof groupBy === 'string' && groupBy.trim()) {
      return [{ type: 'field', field: groupBy.trim() }]
    }
    return []
  }, [groupBy, groupByRules])

  // Load rows
  useEffect(() => {
    let cancelled = false

    async function loadRows() {
      if (!tableId || !supabaseTableName) return

      setLoading(true)
      try {
        const supabase = createClient()
        let query = supabase.from(supabaseTableName).select("*")

        // Apply filter tree first (supports groups/OR), then apply remaining flat filters
        const normalizedFields = (Array.isArray(tableFields) ? tableFields : []).map((f: any) => ({
          name: f.name || f.field_name || f.id || f.field_id,
          id: f.id || f.field_id,
          type: f.type || f.field_type,
          options: f.options || f.field_options,
        }))
        
        if (filterTree) {
          query = applyFiltersToQuery(query, filterTree, normalizedFields)
        }
        
        // Apply remaining filters (after stripping filter block filters if filterTree exists)
        const baseFilters = filterTree ? stripFilterBlockFilters(filters || []) : (filters || [])
        if (baseFilters.length > 0) {
          query = applyFiltersToQuery(query, baseFilters, normalizedFields)
        }

        // Apply sorts
        if (sorts.length > 0) {
          for (const sort of sorts) {
            if (sort.field_name) {
              const column = toPostgrestColumn(sort.field_name)
              if (column) {
                query = query.order(column, { ascending: sort.direction === 'asc' })
              }
            }
          }
        } else {
          // Default sort by created_at
          query = query.order('created_at', { ascending: false })
        }

        // Explicit limit so we don't rely on Supabase default (often 20–30); show all rows up to a safe cap
        const ROWS_LIMIT = 2000
        query = query.limit(ROWS_LIMIT)

        const { data, error } = await query

        if (error) throw error
        if (cancelled) return

        // Transform data to include id
        const rowsWithId = (data || []).map((row: any) => ({
          ...row,
          id: row.id || row[`${supabaseTableName}_id`] || crypto.randomUUID(),
        }))

        setRows(rowsWithId)
      } catch (error) {
        console.error("Error loading rows:", formatErrorForLog(error))
        if (!cancelled) {
          setRows([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadRows()
    return () => {
      cancelled = true
    }
  }, [tableId, supabaseTableName, JSON.stringify(filters), JSON.stringify(filterTree), JSON.stringify(sorts), reloadKey])

  // Filter rows by search query
  const filteredRows = useMemo(() => {
    if (!searchQuery || !tableFields.length) return rows

    const fieldIds = tableFields.map(f => f.name)
    return filterRowsBySearch(rows, tableFields, searchQuery, fieldIds)
  }, [rows, tableFields, searchQuery])

  // Resolve grouping labels for linked record fields
  useEffect(() => {
    let cancelled = false

    async function load() {
      const rules = Array.isArray(effectiveGroupRules) ? effectiveGroupRules : []
      if (rules.length === 0) {
        setGroupValueLabelMaps({})
        return
      }

      const safeFields = Array.isArray(tableFields) ? tableFields.filter(Boolean) : []
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
        for (const row of filteredRows) {
          const fieldValue = getLinkedFieldValueFromRow(row as Record<string, unknown>, f)
          for (const id of linkedValueToIds(fieldValue)) ids.add(id)
        }
        if (ids.size === 0) continue
        const map = await resolveLinkedFieldDisplayMap(f, Array.from(ids))
        next[f.name] = Object.fromEntries(map.entries())
        if ((f as any).id) next[(f as any).id] = next[f.name]
      }

      if (!cancelled) setGroupValueLabelMaps(next)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [effectiveGroupRules, filteredRows, tableFields])

  // Build group tree
  const groupModel = useMemo(() => {
    if (effectiveGroupRules.length === 0) return null
    // Don't build group tree if fields aren't loaded yet (needed to resolve field names)
    if (!tableFields || tableFields.length === 0) return null
    return buildGroupTree(filteredRows, tableFields, effectiveGroupRules, {
      emptyLabel: '(Empty)',
      emptyLast: true,
      valueLabelMaps: groupValueLabelMaps,
    })
  }, [effectiveGroupRules, filteredRows, tableFields, groupValueLabelMaps])

  // Get all groups (flattened for tabs)
  const groups = useMemo(() => {
    if (!groupModel) return []
    
    // Flatten the tree to get all leaf groups
    const flattenGroups = (nodes: typeof groupModel.rootGroups): Array<{ key: string; label: string; items: any[] }> => {
      const result: Array<{ key: string; label: string; items: any[] }> = []
      
      for (const node of nodes) {
        if (node.items && node.items.length > 0) {
          // Leaf group with items
          result.push({
            key: node.pathKey,
            label: node.label,
            items: node.items,
          })
        } else if (node.children && node.children.length > 0) {
          // Has children, recurse
          result.push(...flattenGroups(node.children))
        }
      }
      
      return result
    }
    
    return flattenGroups(groupModel.rootGroups)
  }, [groupModel])

  // Set active tab to first group on load
  useEffect(() => {
    if (groups.length > 0 && !activeTab) {
      setActiveTab(groups[0].key)
    }
  }, [groups, activeTab])

  // Get records for active tab
  const activeGroupRecords = useMemo(() => {
    if (!activeTab) return []
    const group = groups.find(g => g.key === activeTab)
    return group?.items || []
  }, [activeTab, groups])

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

  // Get group field for color calculation
  const groupField = useMemo(() => {
    if (effectiveGroupRules.length === 0) return null
    const firstRule = effectiveGroupRules[0]
    if (firstRule.type === 'field') {
      return tableFields.find(f => f.name === firstRule.field || f.id === firstRule.field)
    }
    return null
  }, [effectiveGroupRules, tableFields])

  const defaultBlockH = useCallback((field: TableField) => {
    return field.type === 'link_to_table' || field.type === 'lookup' ? 3 : 2
  }, [])

  // Create field blocks from recordFields configuration
  // Merge stored layout with record_fields: layout is source of truth for position, record_fields for which fields exist.
  // New fields in record_fields get a block added; fields removed from record_fields are removed from layout.
  const createFieldBlocks = useCallback((recordId: string, template?: PageBlock[]): PageBlock[] => {
    const recordFieldSet = new Set(
      recordFields.map((c) => {
        const f = tableFields.find((tf) => tf.name === c.field || tf.id === c.field)
        return f?.name
      }).filter(Boolean) as string[]
    )

    // If we have a stored layout: keep only blocks whose field is in record_fields, then add blocks for record_fields not in layout
    // If recordFields is empty but we have a template, use the template as-is (backward compatibility)
    if (template && template.length > 0) {
      // If recordFields is empty, use template blocks as-is (don't filter)
      if (recordFields.length === 0) {
        return template.map((block) => {
          const fieldName = block.config?.field_name || ''
          return {
            ...block,
            id: `field-${recordId}-${fieldName}`,
            page_id: `${viewId || `view-${tableId}`}-${recordId}`,
            config: {
              ...block.config,
              table_id: tableId,
              field_name: fieldName,
            },
          }
        })
      }

      // Otherwise, filter template blocks by recordFields
      const existingByField = new Map<string, PageBlock>()
      for (const block of template) {
        const fieldName = block.config?.field_name || ''
        if (fieldName && recordFieldSet.has(fieldName)) {
          existingByField.set(fieldName, block)
        }
      }

      const result: PageBlock[] = []
      let maxY = -1
      for (const block of template) {
        const fieldName = block.config?.field_name || ''
        if (fieldName && recordFieldSet.has(fieldName)) {
          const h = block.h ?? 2
          maxY = Math.max(maxY, (block.y ?? 0) + h)
          result.push({
            ...block,
            id: `field-${recordId}-${fieldName}`,
            page_id: `${viewId || `view-${tableId}`}-${recordId}`,
            config: {
              ...block.config,
              table_id: tableId,
              field_name: fieldName,
            },
          })
        }
      }

      // Add blocks for record_fields that don't have a block yet (e.g. new fields added in panel)
      const orderedRecordFields = recordFields
        .map((c) => {
          const field = tableFields.find((f) => f.name === c.field || f.id === c.field)
          return field ? { field, config: c } : null
        })
        .filter((x): x is { field: TableField; config: FieldConfig } => x != null)

      let newBlockIndex = 0
      for (const { field, config } of orderedRecordFields) {
        if (existingByField.has(field.name)) continue
        const row = Math.floor(newBlockIndex / 2)
        const col = newBlockIndex % 2
        const y = maxY + 1 + row * 2
        result.push({
          id: `field-${recordId}-${field.name}`,
          page_id: viewId || `view-${tableId}`,
          type: 'field' as const,
          x: col === 0 ? 0 : 6,
          y,
          w: 6,
          h: defaultBlockH(field),
          config: {
            field_id: field.id,
            field_name: field.name,
            table_id: tableId,
            allow_inline_edit: config.editable !== false,
          },
          order_index: result.length,
          created_at: new Date().toISOString(),
        })
        newBlockIndex++
      }
      return result
    }

    // No stored layout: build from record_fields or default
    if (recordFields.length === 0) {
      const defaultFields = tableFields.slice(0, 10)
      return defaultFields.map((field, index) => ({
        id: `field-${recordId}-${field.name}`,
        page_id: viewId || `view-${tableId}`,
        type: 'field' as const,
        x: index % 2 === 0 ? 0 : 6,
        y: Math.floor(index / 2) * 2,
        w: 6,
        h: defaultBlockH(field),
        config: {
          field_id: field.id,
          field_name: field.name,
          table_id: tableId,
        },
        order_index: index,
        created_at: new Date().toISOString(),
      }))
    }

    return recordFields.map((fieldConfig, index) => {
      const field = tableFields.find((f) => f.name === fieldConfig.field || f.id === fieldConfig.field)
      if (!field) return null
      return {
        id: `field-${recordId}-${field.name}`,
        page_id: viewId || `view-${tableId}`,
        type: 'field' as const,
        x: (fieldConfig as any).x ?? (index % 2 === 0 ? 0 : 6),
        y: (fieldConfig as any).y ?? Math.floor(index / 2) * 2,
        w: (fieldConfig as any).w ?? 6,
        h: (fieldConfig as any).h ?? defaultBlockH(field),
        config: {
          field_id: field.id,
          field_name: field.name,
          table_id: tableId,
          allow_inline_edit: fieldConfig.editable !== false,
        },
        order_index: fieldConfig.order ?? index,
        created_at: new Date().toISOString(),
      }
    }).filter(Boolean) as PageBlock[]
  }, [recordFields, tableFields, tableId, viewId, defaultBlockH])

  // Store layout template (shared across all records)
  // Load from stored layout if available (from block config)
  const [layoutTemplate, setLayoutTemplate] = useState<PageBlock[] | null>(storedLayoutProp || null)
  const [currentBlocks, setCurrentBlocks] = useState<PageBlock[]>([])

  // When stored layout changes (e.g. from parent), update template
  useEffect(() => {
    if (storedLayoutProp) {
      setLayoutTemplate(storedLayoutProp)
      setCurrentBlocks(storedLayoutProp)
    }
  }, [storedLayoutProp])

  // When entering edit mode, merge record_fields with stored layout once and persist so new fields appear
  const hasInitializedEditRef = useRef(false)
  useEffect(() => {
    if (!isEditing) {
      hasInitializedEditRef.current = false
      return
    }
    if (groups.length === 0 || !activeTab) return
    const activeGroup = groups.find((g) => g.key === activeTab)
    if (!activeGroup?.items?.length) return
    const firstRecordId = activeGroup.items[0].id || activeGroup.items[0][`${supabaseTableName}_id`]
    if (!firstRecordId) return
    if (hasInitializedEditRef.current) return
    hasInitializedEditRef.current = true
    const blocks = createFieldBlocks(firstRecordId, layoutTemplate || undefined)
    setCurrentBlocks(blocks)
    setLayoutTemplate(blocks)
    if (onBlockUpdate) onBlockUpdate(blocks)
  }, [isEditing, groups, activeTab, layoutTemplate, supabaseTableName, createFieldBlocks, onBlockUpdate])

  // Handle layout changes from Canvas
  const handleLayoutChange = useCallback((layout: LayoutItem[]) => {
    if (!isEditing) return

    setCurrentBlocks((prevBlocks) => {
      const updated = prevBlocks.map((block) => {
        const layoutItem = layout.find((item) => item.i === block.id)
        if (layoutItem) {
          return {
            ...block,
            x: layoutItem.x,
            y: layoutItem.y,
            w: layoutItem.w,
            h: layoutItem.h,
          }
        }
        return block
      })
      setLayoutTemplate(updated)
      if (onBlockUpdate) {
        setTimeout(() => onBlockUpdate(updated), 500)
      }
      return updated
    })
  }, [isEditing, onBlockUpdate])

  // Remove a field block from the canvas and persist
  const handleBlockDelete = useCallback(
    (blockId: string) => {
      setCurrentBlocks((prev) => {
        const updated = prev.filter((b) => b.id !== blockId)
        setLayoutTemplate(updated)
        if (onBlockUpdate) onBlockUpdate(updated)
        return updated
      })
    },
    [onBlockUpdate]
  )

  // Add a field block to the canvas (for record_fields not yet in layout)
  const handleAddFieldBlock = useCallback(
    (fieldNameOrId: string) => {
      const field = tableFields.find((f) => f.name === fieldNameOrId || f.id === fieldNameOrId)
      if (!field) return
      const fieldConfig = recordFields.find((c) => c.field === field.name || c.field === field.id)
      if (!fieldConfig) return
      setCurrentBlocks((prev) => {
        const maxY = prev.length > 0 ? Math.max(...prev.map((b) => (b.y ?? 0) + (b.h ?? 2))) : -1
        const y = maxY + 1
        const x = 0
        const firstRecordId =
          groups.length > 0 && activeTab
            ? (() => {
                const g = groups.find((gr) => gr.key === activeTab)
                const first = g?.items?.[0]
                return first?.id || first?.[`${supabaseTableName}_id`]
              })()
            : null
        if (!firstRecordId) return prev
        const newBlock: PageBlock = {
          id: `field-${firstRecordId}-${field.name}`,
          page_id: viewId || `view-${tableId}`,
          type: 'field',
          x,
          y,
          w: 6,
          h: 2,
          config: {
            field_id: field.id,
            field_name: field.name,
            table_id: tableId,
            allow_inline_edit: fieldConfig.editable !== false,
          },
          order_index: prev.length,
          created_at: new Date().toISOString(),
        }
        const updated = [...prev, newBlock]
        setLayoutTemplate(updated)
        if (onBlockUpdate) onBlockUpdate(updated)
        return updated
      })
    },
    [tableFields, recordFields, groups, activeTab, supabaseTableName, viewId, tableId, onBlockUpdate]
  )

  // Initialize current blocks from first record when editing starts
  useEffect(() => {
    if (isEditing && groups.length > 0 && activeTab) {
      const activeGroup = groups.find(g => g.key === activeTab)
      if (activeGroup && activeGroup.items.length > 0 && currentBlocks.length === 0) {
        const firstRecordId = activeGroup.items[0].id || activeGroup.items[0][`${supabaseTableName}_id`]
        if (firstRecordId) {
          const blocks = createFieldBlocks(firstRecordId, layoutTemplate || undefined)
          setCurrentBlocks(blocks)
          if (!layoutTemplate) {
            setLayoutTemplate(blocks)
          }
        }
      }
    }
  }, [isEditing, groups, activeTab, layoutTemplate, currentBlocks.length, supabaseTableName, createFieldBlocks])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (effectiveGroupRules.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState
          title="No grouping configured"
          description="Please configure a grouping field in view settings."
        />
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState
          title="No records found"
          description="No records match the current filters."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <Tabs value={activeTab ?? ""} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="border-b bg-background px-4">
          <TabsList className="w-full justify-start h-auto p-0 bg-transparent">
            {groups.map((group) => {
              // Get group color
              let groupColor: string | null = null
              if (groupField && (groupField.type === 'single_select' || groupField.type === 'multi_select')) {
                // Use field-specific color for select fields
                groupColor = getPillColor(groupField, group.label)
              } else {
                // Generate hash-based color for all other field types
                groupColor = getGroupColor(group.label)
              }

              // Evaluate conditional formatting rules for group headers (tabs)
              // Create a mock row with the group value for evaluation
              const groupMockRow: Record<string, any> = {}
              if (groupField && group.label) {
                groupMockRow[groupField.name] = group.label
              }
              const groupMatchingRule = highlightRules && highlightRules.length > 0 && Object.keys(groupMockRow).length > 0
                ? evaluateHighlightRules(
                    highlightRules.filter((r: HighlightRule) => r.scope === 'group'),
                    groupMockRow,
                    tableFields
                  )
                : null
              
              // Get formatting style for group-level rules
              const groupFormattingStyle = groupMatchingRule
                ? getFormattingStyle(groupMatchingRule)
                : {}
              
              // Combine group color with conditional formatting (conditional formatting takes precedence)
              const finalTabBgColor = groupFormattingStyle.backgroundColor || (groupColor ? groupColor + '1A' : undefined)
              const finalTabTextColor = groupFormattingStyle.color || (groupColor ? groupColor : undefined)
              const borderColorValue = activeTab === group.key ? (groupColor ?? 'transparent') : 'transparent'
              const finalTabBorderColor: string | undefined = groupFormattingStyle.backgroundColor || borderColorValue || undefined
              
              // Determine text color for contrast (only if no conditional formatting text color)
              const textColorClass = finalTabTextColor ? '' : (groupColor ? getTextColorForBackground(groupColor) : 'text-gray-900')
              
              return (
                <TabsTrigger
                  key={group.key}
                  value={group.key}
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                  style={finalTabBgColor || finalTabTextColor || finalTabBorderColor ? {
                    backgroundColor: finalTabBgColor,
                    borderBottomColor: finalTabBorderColor,
                    color: finalTabTextColor,
                  } : undefined}
                >
                  <span className={textColorClass} style={finalTabTextColor ? { color: finalTabTextColor } : undefined}>
                    {group.label} ({group.items.length})
                  </span>
                </TabsTrigger>
              )
            })}
          </TabsList>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          {groups.map((group) => (
            <TabsContent
              key={group.key}
              value={group.key}
              className="mt-0 h-full"
            >
              <div className="p-4 space-y-4">
                {group.items.length === 0 ? (
                  <EmptyState
                    title="No records in this group"
                    description="This group is empty."
                  />
                ) : (
                  group.items.map((record: any, recordIndex: number) => {
                    const recordId = record.id || record[`${supabaseTableName}_id`]
                    const blocks = createFieldBlocks(recordId, layoutTemplate || undefined)
                    
                    // Only allow editing on the first record (acts as template)
                    // All records share the same layout
                    const canEditThisRecord = isEditing && recordIndex === 0
                    
                    // Use current blocks if editing, otherwise use generated blocks
                    const displayBlocks = canEditThisRecord && currentBlocks.length > 0 ? currentBlocks : blocks
                    
                    const fieldsInLayout = new Set(
                      (canEditThisRecord ? displayBlocks : []).map((b) => b.config?.field_name).filter(Boolean)
                    )
                    const availableToAdd =
                      canEditThisRecord
                        ? recordFields
                            .map((c) => {
                              const f = tableFields.find((tf) => tf.name === c.field || tf.id === c.field)
                              return f && !fieldsInLayout.has(f.name) ? f : null
                            })
                            .filter((x): x is TableField => x != null)
                        : []

                    return (
                      <div
                        key={recordId}
                        className="border rounded-lg bg-card overflow-hidden shadow-sm"
                        style={{ minHeight: '200px' }}
                      >
                        {canEditThisRecord && (
                          <div className="flex items-center gap-3 px-3 py-2.5 border-b bg-muted/40 text-muted-foreground">
                            {availableToAdd.length > 0 ? (
                              <Select
                                value=""
                                onValueChange={(value) => {
                                  if (value) handleAddFieldBlock(value)
                                }}
                              >
                                <SelectTrigger className="w-[200px] h-8 text-xs">
                                  <SelectValue placeholder="Add a field…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableToAdd.map((f) => (
                                    <SelectItem key={f.id} value={f.name}>
                                      {f.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : null}
                            <span className="text-xs text-muted-foreground">
                              Drag to move · Resize with the corner · Delete to remove from card
                            </span>
                          </div>
                        )}
                        <FilterStateProvider>
                          <Canvas
                            blocks={displayBlocks}
                            isEditing={canEditThisRecord}
                            onLayoutChange={canEditThisRecord ? handleLayoutChange : undefined}
                            onBlockUpdate={
                              canEditThisRecord
                                ? (blockId, config) => {
                                    // Find the block being updated to get its field_name
                                    const updatedBlock = displayBlocks.find(b => b.id === blockId)
                                    const fieldName = updatedBlock?.config?.field_name
                                    
                                    // Deep merge config, especially appearance settings
                                    const mergeConfig = (existingConfig: any, newConfig: any) => {
                                      const merged = { ...existingConfig, ...newConfig }
                                      // Deep merge appearance if both exist
                                      if (existingConfig?.appearance && newConfig?.appearance) {
                                        merged.appearance = {
                                          ...existingConfig.appearance,
                                          ...newConfig.appearance,
                                        }
                                      }
                                      return merged
                                    }
                                    
                                    if (!fieldName) {
                                      // Fallback to ID matching if no field_name
                                      setCurrentBlocks((prev) =>
                                        prev.map((b) =>
                                          b.id === blockId ? { ...b, config: mergeConfig(b.config || {}, config) } : b
                                        )
                                      )
                                      setLayoutTemplate((prev) =>
                                        prev
                                          ? prev.map((b) =>
                                              b.id === blockId ? { ...b, config: mergeConfig(b.config || {}, config) } : b
                                            )
                                          : null
                                      )
                                      return
                                    }
                                    
                                    // Update currentBlocks by blockId (for the specific record)
                                    setCurrentBlocks((prev) =>
                                      prev.map((b) =>
                                        b.id === blockId ? { ...b, config: mergeConfig(b.config || {}, config) } : b
                                      )
                                    )
                                    
                                    // Update layoutTemplate by field_name (so all records get the update)
                                    setLayoutTemplate((prev) =>
                                      prev
                                        ? prev.map((b) => {
                                            const blockFieldName = b.config?.field_name
                                            if (blockFieldName === fieldName) {
                                              return { ...b, config: mergeConfig(b.config || {}, config) }
                                            }
                                            return b
                                          })
                                        : null
                                    )
                                  }
                                : undefined
                            }
                            onBlockDelete={canEditThisRecord ? handleBlockDelete : undefined}
                            onBlockSettingsClick={canEditThisRecord ? onBlockSettingsClick : undefined}
                            pageTableId={tableId}
                            pageId={viewId || `view-${tableId}`}
                            recordId={recordId}
                            mode={canEditThisRecord ? 'edit' : 'view'}
                          />
                        </FilterStateProvider>
                      </div>
                    )
                  })
                )}
              </div>
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  )
}
