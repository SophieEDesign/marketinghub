"use client"

/**
 * Filter Block Component
 * Standalone block that emits filter state to control other blocks on the page
 * 
 * Features:
 * - Renders filter UI (field + operator + value)
 * - Emits filter state via FilterStateContext
 * - Can target specific blocks or all blocks
 * - Filters narrow results, never override base filters
 */

import { useEffect, useState, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { PageBlock, BlockFilter } from "@/lib/interface/types"
import { useFilterState } from "@/lib/interface/filter-state"
import { type FilterConfig } from "@/lib/interface/filters"
import { Filter, X, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"

interface FilterBlockProps {
  block: PageBlock
  isEditing?: boolean
  pageTableId?: string | null
  pageId?: string | null
  onUpdate?: (blockId: string, config: Partial<PageBlock["config"]>) => void
}

const OPERATORS: Array<{ value: FilterConfig['operator']; label: string }> = [
  { value: 'equal', label: 'equals' },
  { value: 'not_equal', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'greater_than', label: 'greater than' },
  { value: 'less_than', label: 'less than' },
  { value: 'greater_than_or_equal', label: 'greater than or equal' },
  { value: 'less_than_or_equal', label: 'less than or equal' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
]

export default function FilterBlock({ block, isEditing = false, pageTableId = null, pageId = null, onUpdate }: FilterBlockProps) {
  const { config } = block
  const { updateFilterBlock, removeFilterBlock } = useFilterState()
  
  // Config: target blocks and allowed fields
  const targetBlocks = config?.target_blocks || 'all'
  const allowedFields = config?.allowed_fields || []
  const allowedOperators = config?.allowed_operators || OPERATORS.map(op => op.value)
  
  // Convert BlockFilter[] from config to FilterConfig[] for internal use
  const convertToFilterConfigs = useCallback((blockFilters: BlockFilter[] | FilterConfig[] | undefined): FilterConfig[] => {
    if (!blockFilters || blockFilters.length === 0) return []
    // If already FilterConfig[], return as-is
    return blockFilters.map(f => ({
      field: f.field,
      operator: f.operator as FilterConfig['operator'],
      value: f.value,
    }))
  }, [])

  // Current filter state (stored in config.filters as BlockFilter[], used as FilterConfig[])
  const [filters, setFilters] = useState<FilterConfig[]>(() => convertToFilterConfigs(config?.filters))
  const [tableFields, setTableFields] = useState<Array<{ name: string; type: string }>>([])
  const [loading, setLoading] = useState(false)

  // Load table fields if table_id is configured
  const tableId = config?.table_id || pageTableId

  // Sync filters when config changes externally
  useEffect(() => {
    const configFilters = convertToFilterConfigs(config?.filters)
    setFilters(prev => {
      // Only update if config actually changed (prevent unnecessary re-renders)
      const prevStr = JSON.stringify(prev)
      const configStr = JSON.stringify(configFilters)
      if (prevStr !== configStr) {
        return configFilters
      }
      return prev
    })
  }, [config?.filters, convertToFilterConfigs])

  useEffect(() => {
    if (tableId) {
      loadTableFields()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId])

  // Emit filter state to context whenever filters change
  useEffect(() => {
    if (block.id) {
      updateFilterBlock(block.id, filters, targetBlocks)
    }
    
    return () => {
      // Cleanup on unmount
      if (block.id) {
        removeFilterBlock(block.id)
      }
    }
  }, [block.id, filters, targetBlocks, updateFilterBlock, removeFilterBlock])

  // Convert FilterConfig[] to BlockFilter[] for saving to config
  // BlockFilter supports fewer operators, so we filter out unsupported ones
  const convertToBlockFilters = useCallback((filterConfigs: FilterConfig[]): BlockFilter[] => {
    const supportedOperators: BlockFilter['operator'][] = [
      'equal',
      'not_equal',
      'contains',
      'greater_than',
      'less_than',
      'is_empty',
      'is_not_empty',
    ]
    
    return filterConfigs
      .filter(f => supportedOperators.includes(f.operator as BlockFilter['operator']))
      .map(f => ({
        field: f.field,
        operator: f.operator as BlockFilter['operator'],
        value: f.value,
      }))
  }, [])

  // Persist filters to config when they change (debounced)
  useEffect(() => {
    if (!onUpdate) return
    
    const timeoutId = setTimeout(() => {
      // Convert FilterConfig[] to BlockFilter[] for saving
      const blockFilters = convertToBlockFilters(filters)
      onUpdate(block.id, { filters: blockFilters })
    }, 1000) // Debounce saves
    
    return () => clearTimeout(timeoutId)
  }, [filters, block.id, onUpdate, convertToBlockFilters])

  async function loadTableFields() {
    if (!tableId) return
    
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: fields } = await supabase
        .from("table_fields")
        .select("name, type")
        .eq("table_id", tableId)
        .order("position", { ascending: true })
      
      if (fields) {
        setTableFields(fields.map(f => ({ name: f.name, type: f.type })))
      }
    } catch (error) {
      console.error("Error loading table fields:", error)
    } finally {
      setLoading(false)
    }
  }

  // Get available fields (filter by allowed_fields if configured)
  const availableFields = useMemo(() => {
    if (allowedFields.length === 0) {
      return tableFields
    }
    return tableFields.filter(f => allowedFields.includes(f.name))
  }, [tableFields, allowedFields])

  // Get available operators (filter by allowed_operators if configured)
  const availableOperators = useMemo(() => {
    return OPERATORS.filter(op => allowedOperators.includes(op.value))
  }, [allowedOperators])

  // Clean up invalid filters (fields/operators that no longer exist)
  useEffect(() => {
    if (availableFields.length === 0 || availableOperators.length === 0) return
    
    const validFieldNames = new Set<string>(availableFields.map(f => f.name))
    const validOperators = new Set<string>(availableOperators.map(op => op.value))
    
    setFilters(prev => {
      const cleaned = prev.filter(f => 
        validFieldNames.has(f.field) && validOperators.has(f.operator)
      )
      // Only update if filters were actually removed
      if (cleaned.length !== prev.length) {
        return cleaned
      }
      return prev
    })
  }, [availableFields, availableOperators])

  function addFilter() {
    if (availableFields.length === 0 || availableOperators.length === 0) return
    
    setFilters(prev => [...prev, {
      field: availableFields[0].name,
      operator: availableOperators[0]?.value || 'equal',
      value: '',
    }])
  }

  function removeFilter(index: number) {
    setFilters(prev => prev.filter((_, i) => i !== index))
  }

  function updateFilter(index: number, updates: Partial<FilterConfig>) {
    setFilters(prev => prev.map((f, i) => i === index ? { ...f, ...updates } : f))
  }

  // Apply appearance settings
  const appearance = config.appearance || {}
  const blockStyle: React.CSSProperties = {
    backgroundColor: appearance.background_color,
    borderColor: appearance.border_color,
    borderWidth: appearance.border_width !== undefined ? `${appearance.border_width}px` : '1px',
    borderRadius: appearance.border_radius !== undefined ? `${appearance.border_radius}px` : '8px',
    padding: appearance.padding !== undefined ? `${appearance.padding}px` : '16px',
  }

  const title = appearance.title || config.title || "Filters"
  const showTitle = appearance.show_title !== false && title

  // Empty state
  if (!tableId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4" style={blockStyle}>
        <div className="text-center">
          <Filter className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="mb-2">{isEditing ? "This filter block isn't connected to a table yet." : "No table connection"}</p>
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
            <p className="text-xs text-gray-400">Configure allowed fields in block settings.</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full overflow-auto flex flex-col" style={blockStyle}>
      {showTitle && (
        <div
          className="mb-4 pb-2 border-b"
          style={{
            backgroundColor: appearance.header_background,
            color: appearance.header_text_color || appearance.title_color,
          }}
        >
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
      )}
      
      <div className="flex-1 space-y-3">
        {filters.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Filter className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm mb-2">No filters applied</p>
            <Button
              onClick={addFilter}
              variant="outline"
              size="sm"
              className="mt-2"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Filter
            </Button>
          </div>
        ) : (
          <>
            {filters.map((filter, index) => (
              <div key={index} className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex-1 grid grid-cols-3 gap-2">
                  {/* Field Select */}
                  <Select
                    value={availableFields.some(f => f.name === filter.field) ? filter.field : availableFields[0]?.name || ''}
                    onValueChange={(value) => updateFilter(index, { field: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Field" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFields.map(field => (
                        <SelectItem key={field.name} value={field.name}>
                          {field.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Operator Select */}
                  <Select
                    value={availableOperators.some(op => op.value === filter.operator) ? filter.operator : availableOperators[0]?.value || 'equal'}
                    onValueChange={(value) => updateFilter(index, { operator: value as FilterConfig['operator'] })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Operator" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableOperators.map(op => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Value Input (hidden for is_empty/is_not_empty) */}
                  {filter.operator !== 'is_empty' && filter.operator !== 'is_not_empty' ? (
                    <Input
                      value={filter.value || ''}
                      onChange={(e) => updateFilter(index, { value: e.target.value })}
                      placeholder="Value"
                    />
                  ) : (
                    <div className="flex items-center text-sm text-gray-500">
                      No value needed
                    </div>
                  )}
                </div>

                {/* Remove Button */}
                <Button
                  onClick={() => removeFilter(index)}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {/* Add Filter Button */}
            {isEditing && (
              <Button
                onClick={addFilter}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Filter
              </Button>
            )}
          </>
        )}
      </div>

      {/* Target Blocks Info */}
      {targetBlocks !== 'all' && (
        <div className="mt-4 pt-3 border-t text-xs text-gray-500">
          Targeting {Array.isArray(targetBlocks) ? targetBlocks.length : 0} block(s)
        </div>
      )}
    </div>
  )
}

