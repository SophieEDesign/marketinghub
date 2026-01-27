"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { filterRowsBySearch } from "@/lib/search/filterRows"
import type { TableField } from "@/types/fields"
import { applyFiltersToQuery, type FilterConfig } from "@/lib/interface/filters"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { buildGroupTree } from "@/lib/grouping/groupTree"
import type { GroupRule } from "@/lib/grouping/types"
import { toPostgrestColumn } from "@/lib/supabase/postgrest"
import { normalizeUuid } from "@/lib/utils/ids"
import { resolveLinkedFieldDisplayMap } from "@/lib/dataView/linkedFields"
import type { LinkedField } from "@/types/fields"
import EmptyState from "@/components/empty-states/EmptyState"

interface HorizontalGroupedViewProps {
  tableId: string
  viewId?: string
  supabaseTableName: string
  tableFields: TableField[]
  filters?: FilterConfig[]
  sorts?: Array<{ field_name: string; direction: 'asc' | 'desc' }>
  groupBy?: string
  groupByRules?: GroupRule[]
  searchQuery?: string
  onRecordClick?: (recordId: string) => void
  reloadKey?: any
}

export default function HorizontalGroupedView({
  tableId,
  viewId,
  supabaseTableName,
  tableFields,
  filters = [],
  sorts = [],
  groupBy,
  groupByRules,
  searchQuery = "",
  onRecordClick,
  reloadKey,
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

        // Apply filters
        if (filters.length > 0) {
          query = applyFiltersToQuery(query, filters, tableFields)
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
        console.error("Error loading rows:", error)
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
  }, [tableId, supabaseTableName, JSON.stringify(filters), JSON.stringify(sorts), reloadKey])

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
          const value = (row as any)?.[f.name]
          if (Array.isArray(value)) {
            value.forEach((id: string) => ids.add(String(id)))
          } else if (value) {
            ids.add(String(value))
          }
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

  // Build group tree
  const groupModel = useMemo(() => {
    if (effectiveGroupRules.length === 0) return null
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

  // Get primary field for record title (first text field or first field)
  const primaryField = useMemo(() => {
    return tableFields.find(f => f.type === 'text') || tableFields[0]
  }, [tableFields])

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
    <div className="flex flex-col h-full">
      <Tabs value={activeTab || undefined} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b bg-background px-4">
          <TabsList className="w-full justify-start h-auto p-0 bg-transparent">
            {groups.map((group) => (
              <TabsTrigger
                key={group.key}
                value={group.key}
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
              >
                {group.label} ({group.items.length})
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto">
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
                  group.items.map((record: any) => {
                    const recordId = record.id || record[`${supabaseTableName}_id`]
                    const recordTitle = primaryField ? (record[primaryField.name] || 'Untitled') : 'Record'
                    
                    return (
                      <div
                        key={recordId}
                        className="border rounded-lg p-4 bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                        onClick={() => onRecordClick?.(recordId)}
                      >
                        <div className="space-y-2">
                          <h3 className="font-semibold text-lg">{String(recordTitle)}</h3>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {tableFields.slice(0, 6).map((field) => {
                              if (field.name === primaryField?.name) return null
                              const value = record[field.name]
                              if (value === null || value === undefined || value === '') return null
                              
                              return (
                                <div key={field.name} className="flex flex-col">
                                  <span className="text-muted-foreground text-xs">{field.label || field.name}</span>
                                  <span className="font-medium">
                                    {Array.isArray(value) 
                                      ? `${value.length} item${value.length !== 1 ? 's' : ''}`
                                      : String(value)
                                    }
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
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
