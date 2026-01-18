"use client"

/**
 * Filter Block Component
 * First-class control element that drives connected elements
 * 
 * Features:
 * - Full filter system support (AND/OR groups, nested groups)
 * - Explicit connection model (shows which elements are connected)
 * - Field awareness (only shows fields common to all connected elements)
 * - Reset & defaults support
 * - Clear visual feedback on affected blocks
 * - Instant reactivity (no Save required)
 */

import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { PageBlock } from "@/lib/interface/types"
import { useFilterState } from "@/lib/interface/filter-state"
import type { FilterConfig } from "@/lib/interface/filters"
import type { FilterTree, FilterGroup, FilterCondition } from "@/lib/filters/canonical-model"
import { normalizeFilterTree, isEmptyFilterTree, conditionsToFilterTree } from "@/lib/filters/canonical-model"
import { filterConfigsToFilterTree, filterTreeToDbFormat } from "@/lib/filters/converters"
import { Filter, RotateCcw, Settings, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import FilterBuilder from "@/components/filters/FilterBuilder"
import type { TableField } from "@/types/fields"
import { Badge } from "@/components/ui/badge"

interface FilterBlockProps {
  block: PageBlock
  isEditing?: boolean
  pageTableId?: string | null
  pageId?: string | null
  onUpdate?: (blockId: string, config: Partial<PageBlock["config"]>) => void
  allBlocks?: PageBlock[] // All blocks on the page for connection awareness
}

export default function FilterBlock({ 
  block, 
  isEditing = false, 
  pageTableId = null, 
  pageId = null, 
  onUpdate,
  allBlocks = []
}: FilterBlockProps) {
  const { config } = block
  const { updateFilterBlock, removeFilterBlock, getAllFilterBlocks } = useFilterState()
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  // Config: target blocks and allowed fields
  const targetBlocks = config?.target_blocks || 'all'
  const allowedFields = config?.allowed_fields || []
  const defaultFilters = config?.default_filters || null // Default filter tree
  
  // Current filter state (stored as FilterTree)
  const [filterTree, setFilterTree] = useState<FilterTree>(() => {
    // Initialize from config.filters (legacy BlockFilter[]) or config.filter_tree (new FilterTree)
    if (config?.filter_tree) {
      return config.filter_tree as FilterTree
    }
    if (config?.filters && Array.isArray(config.filters) && config.filters.length > 0) {
      // Convert legacy BlockFilter[] to FilterTree
      const filterConfigs = config.filters.map((f: any) => ({
        field: f.field,
        operator: f.operator,
        value: f.value,
      }))
      return filterConfigsToFilterTree(filterConfigs, 'AND')
    }
    // Use defaults if available
    if (defaultFilters) {
      return defaultFilters as FilterTree
    }
    return null
  })
  
  const [tableFields, setTableFields] = useState<TableField[]>([])
  const [loading, setLoading] = useState(false)
  
  // Cache serialized filter tree to avoid repeated JSON.stringify calls
  const cachedFilterTreeStrRef = useRef<string>("")
  const prevFilterTreeStrRef = useRef<string>("")
  
  // Load table fields if table_id is configured
  const tableId = config?.table_id || pageTableId

  // Sync filter tree when config changes externally
  useEffect(() => {
    const configFilterTree = config?.filter_tree 
      ? (config.filter_tree as FilterTree)
      : (config?.filters && Array.isArray(config.filters) && config.filters.length > 0
          ? filterConfigsToFilterTree(
              config.filters.map((f: any) => ({
                field: f.field,
                operator: f.operator,
                value: f.value,
              })),
              'AND'
            )
          : (defaultFilters ? (defaultFilters as FilterTree) : null))
    
    const configStr = JSON.stringify(configFilterTree)
    
    if (cachedFilterTreeStrRef.current === configStr) {
      return
    }
    
    cachedFilterTreeStrRef.current = configStr
    
    setFilterTree(prev => {
      const prevStr = prevFilterTreeStrRef.current || JSON.stringify(prev)
      if (prevStr !== configStr) {
        prevFilterTreeStrRef.current = configStr
        return configFilterTree
      }
      return prev
    })
  }, [config?.filter_tree, config?.filters, defaultFilters])

  useEffect(() => {
    if (tableId) {
      loadTableFields()
    }
  }, [tableId])

  // Get connected blocks
  const connectedBlocks = useMemo(() => {
    if (targetBlocks === 'all') {
      return allBlocks.filter(b => 
        b.id !== block.id && 
        ['grid', 'chart', 'kpi', 'kanban', 'calendar', 'timeline', 'list'].includes(b.type)
      )
    }
    if (Array.isArray(targetBlocks)) {
      return allBlocks.filter(b => targetBlocks.includes(b.id))
    }
    return []
  }, [targetBlocks, allBlocks, block.id])

  // Get fields common to all connected blocks
  const availableFields = useMemo(() => {
    if (tableFields.length === 0) return []
    
    // If no connections, show all fields (or allowed fields if configured)
    if (connectedBlocks.length === 0) {
      if (allowedFields.length === 0) {
        return tableFields
      }
      return tableFields.filter(f => allowedFields.includes(f.name))
    }
    
    // Get table IDs from connected blocks
    const connectedTableIds = new Set<string>()
    connectedBlocks.forEach(b => {
      const blockTableId = b.config?.table_id || pageTableId
      if (blockTableId) {
        connectedTableIds.add(blockTableId)
      }
    })
    
    // If connected blocks use different tables, we can't determine common fields
    // Show all fields from the filter block's table
    if (connectedTableIds.size > 1 || (connectedTableIds.size === 1 && !connectedTableIds.has(tableId || ''))) {
      // Different tables - show all fields from filter block's table
      if (allowedFields.length === 0) {
        return tableFields
      }
      return tableFields.filter(f => allowedFields.includes(f.name))
    }
    
    // Same table - show all fields (or allowed fields if configured)
    if (allowedFields.length === 0) {
      return tableFields
    }
    return tableFields.filter(f => allowedFields.includes(f.name))
  }, [tableFields, allowedFields, connectedBlocks, tableId, pageTableId])

  // Convert FilterTree to flat FilterConfig[] for filter state context
  // This maintains backward compatibility with existing filter state system
  const filterConfigs = useMemo(() => {
    const normalized = normalizeFilterTree(filterTree)
    if (!normalized) return []
    
    const configs: FilterConfig[] = []
    
    function traverse(node: FilterGroup | FilterCondition) {
      if ('field_id' in node) {
        configs.push({
          field: node.field_id,
          operator: node.operator as FilterConfig['operator'],
          value: node.value,
        })
      } else {
        for (const child of node.children) {
          traverse(child)
        }
      }
    }
    
    traverse(normalized)
    return configs
  }, [filterTree])

  // Stable signature to ensure we only emit when payload meaningfully changes.
  // This avoids Provider/Consumer update loops if arrays/objects are re-created with identical values.
  const emitSignature = useMemo(() => {
    const blockTitle = config?.title || block.id
    return JSON.stringify({
      blockId: block.id,
      filterConfigs,
      targetBlocks,
      blockTitle,
    })
  }, [block.id, filterConfigs, targetBlocks, config?.title])

  // Emit filter state to context whenever filters change
  useEffect(() => {
    if (block.id) {
      const blockTitle = config?.title || block.id
      updateFilterBlock(block.id, filterConfigs, targetBlocks, blockTitle)
    }
    
    return () => {
      if (block.id) {
        removeFilterBlock(block.id)
      }
    }
  }, [emitSignature, block.id, updateFilterBlock, removeFilterBlock])

  // Persist filter tree to config when it changes (debounced)
  useEffect(() => {
    if (!onUpdate) return
    // CRITICAL: In view mode, user changes must never persist to the interface/view config.
    // Advanced filter editing is builder-only.
    if (!isEditing) return
    
    const timeoutId = setTimeout(() => {
      onUpdate(block.id, { 
        filter_tree: filterTree,
        // Keep legacy filters for backward compatibility
        filters: filterConfigs.map(c => ({
          field: c.field,
          operator: c.operator as any,
          value: c.value,
        }))
      })
    }, 1000)
    
    return () => clearTimeout(timeoutId)
  }, [filterTree, filterConfigs, block.id, onUpdate])

  async function loadTableFields() {
    if (!tableId) return
    
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: fields } = await supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", tableId)
        .order("position", { ascending: true })
      
      if (fields) {
        setTableFields(fields as TableField[])
      }
    } catch (error) {
      console.error("Error loading table fields:", error)
    } finally {
      setLoading(false)
    }
  }

  // Reset to defaults
  const handleReset = useCallback(() => {
    if (defaultFilters) {
      setFilterTree(defaultFilters as FilterTree)
    } else {
      setFilterTree(null)
    }
  }, [defaultFilters])

  // Apply appearance settings
  const appearance = config.appearance || {}
  const blockStyle: React.CSSProperties = {
    backgroundColor: appearance.background_color || '#f9fafb', // Default light grey
    borderColor: appearance.border_color || '#e5e7eb',
    borderWidth: appearance.border_width !== undefined ? `${appearance.border_width}px` : '1px',
    borderRadius: appearance.border_radius !== undefined ? `${appearance.border_radius}px` : '8px',
    padding: appearance.padding !== undefined ? `${appearance.padding}px` : '0px', // No padding, we'll add it to inner elements
  }

  const title = appearance.title || config.title || "Filters"
  const showTitle = appearance.show_title !== false && title

  // Count conditions in filter tree
  const conditionCount = useMemo(() => {
    const normalized = normalizeFilterTree(filterTree)
    if (!normalized) return 0
    
    let count = 0
    function traverse(node: FilterGroup | FilterCondition) {
      if ('field_id' in node) {
        count++
      } else {
        for (const child of node.children) {
          traverse(child)
        }
      }
    }
    traverse(normalized)
    return count
  }, [filterTree])

  // Empty state
  if (!tableId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4" style={blockStyle}>
        <div className="text-center">
          <Filter className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="mb-2">{isEditing ? "This filter control isn't connected to a table yet." : "No table connection"}</p>
          {isEditing && (
            <p className="text-xs text-gray-400">Configure the table in block settings.</p>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 p-4" style={blockStyle}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mx-auto mb-2"></div>
          <p className="text-sm">Loading fields...</p>
        </div>
      </div>
    )
  }

  if (availableFields.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4" style={blockStyle}>
        <div className="text-center">
          <Filter className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="mb-2">No fields available</p>
          {isEditing && (
            <p className="text-xs text-gray-400">
              {connectedBlocks.length === 0 
                ? "Configure allowed fields in block settings."
                : "No common fields found in connected elements."}
            </p>
          )}
        </div>
      </div>
    )
  }

  const isEmpty = isEmptyFilterTree(filterTree)
  const hasDefaults = defaultFilters !== null && !isEmptyFilterTree(defaultFilters as FilterTree)
  const isAtDefaults = JSON.stringify(filterTree) === JSON.stringify(defaultFilters)

  return (
    <div className="h-full w-full overflow-auto flex flex-col rounded-lg border border-gray-200" style={blockStyle}>
      {/* Header with title and Filtered button */}
      <div className={`flex items-center justify-between px-4 pt-4 ${isEditing ? "mb-2" : "mb-4"}`}>
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {!isAtDefaults && (hasDefaults || !isEmpty) && (
          <Button
            onClick={handleReset}
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-gray-600 hover:text-gray-900"
            title="Reset filters"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Reset
          </Button>
        )}
      </div>

      {/* All modes: show Airtable-like inline filter rows (view mode changes are session-only) */}
      <div className="px-4 pb-4">
        <FilterBuilder
          filterTree={filterTree}
          tableFields={availableFields}
          onChange={setFilterTree}
          variant="airtable"
        />

        {/* Info Message */}
        <div className="flex items-start gap-2 text-xs text-gray-600 mt-4 pt-3 border-t border-gray-200">
          <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-gray-500" />
          <span>These filters refine results in connected elements.</span>
        </div>
      </div>

      {/* Connection Status - only show in edit mode */}
      {isEditing && connectedBlocks.length > 0 && (
        <div className="px-4 pb-4 mt-auto">
          <div className="text-xs text-gray-500">
            Connected to {connectedBlocks.length} element{connectedBlocks.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Filter Modal */}
      {isEditing && (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Filters</DialogTitle>
              <DialogDescription>
                Configure filters that will be applied to connected elements.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Connection Info */}
              {connectedBlocks.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 text-sm text-blue-800">
                      <p className="font-medium mb-1">
                        Connected to {connectedBlocks.length} element{connectedBlocks.length !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-blue-700">
                        These filters are applied in addition to each element&apos;s own filters.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Filter Builder */}
              <FilterBuilder
                filterTree={filterTree}
                tableFields={availableFields}
                onChange={setFilterTree}
              />

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  {hasDefaults && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleReset}
                      disabled={isAtDefaults}
                      className="text-xs"
                      title="Reset filters to default values"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Reset to Defaults
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-gray-600"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('open-block-settings', { detail: { blockId: block.id } }))
                      setIsModalOpen(false)
                    }}
                  >
                    <Settings className="h-4 w-4 mr-1" />
                    Settings
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Done
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
