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

import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { PageBlock, BlockFilter } from "@/lib/interface/types"
import { useFilterState } from "@/lib/interface/filter-state"
import { type FilterConfig } from "@/lib/interface/filters"
import { Filter, X, Plus, Settings, Trash2, MoreVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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

// Date-specific operators for the modal view (mapped to FilterConfig operators)
const DATE_OPERATORS: Array<{ value: string; label: string; mappedOperator: FilterConfig['operator'] }> = [
  { value: 'date_equal', label: 'is', mappedOperator: 'equal' },
  { value: 'date_after', label: 'is after', mappedOperator: 'greater_than' },
  { value: 'date_before', label: 'is before', mappedOperator: 'less_than' },
  { value: 'date_on_or_after', label: 'on or after', mappedOperator: 'greater_than_or_equal' },
  { value: 'date_on_or_before', label: 'on or before', mappedOperator: 'less_than_or_equal' },
  { value: 'is_empty', label: 'is empty', mappedOperator: 'is_empty' },
  { value: 'is_not_empty', label: 'is not empty', mappedOperator: 'is_not_empty' },
]

// Get operators for a field type
function getOperatorsForFieldType(fieldType: string): Array<{ value: string; label: string; mappedOperator?: FilterConfig['operator'] }> {
  if (fieldType === 'date') {
    return DATE_OPERATORS
  }
  return OPERATORS.map(op => ({ value: op.value, label: op.label }))
}

// Map date operator to FilterConfig operator
function mapDateOperatorToFilterConfig(dateOperator: string): FilterConfig['operator'] {
  const dateOp = DATE_OPERATORS.find(op => op.value === dateOperator)
  return dateOp ? dateOp.mappedOperator : 'equal'
}

// Map FilterConfig operator to date operator (for display)
function mapFilterConfigToDateOperator(operator: FilterConfig['operator'], fieldType: string): string {
  if (fieldType !== 'date') return operator
  const dateOp = DATE_OPERATORS.find(op => op.mappedOperator === operator)
  return dateOp ? dateOp.value : operator
}

export default function FilterBlock({ block, isEditing = false, pageTableId = null, pageId = null, onUpdate }: FilterBlockProps) {
  const { config } = block
  const { updateFilterBlock, removeFilterBlock } = useFilterState()
  const [isModalOpen, setIsModalOpen] = useState(false)
  
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
  const [tableFields, setTableFields] = useState<Array<{ name: string; type: string; options?: any }>>([])
  const [loading, setLoading] = useState(false)
  
  // Cache serialized config filters to avoid repeated JSON.stringify calls
  const cachedConfigFiltersStrRef = useRef<string>("")
  const prevFiltersStrRef = useRef<string>("")

  // Load table fields if table_id is configured
  const tableId = config?.table_id || pageTableId

  // Sync filters when config changes externally
  // CRITICAL: Cache serialized config filters to avoid JSON.stringify in hot paths
  useEffect(() => {
    const configFilters = convertToFilterConfigs(config?.filters)
    // Serialize config filters once and cache in ref
    const configStr = JSON.stringify(configFilters)
    
    // Only update if config actually changed (prevent unnecessary re-renders)
    if (cachedConfigFiltersStrRef.current === configStr) {
      return // Config filters haven't changed, skip update
    }
    
    // Update cached string
    cachedConfigFiltersStrRef.current = configStr
    
    setFilters(prev => {
      // Compare with cached previous filters string to avoid JSON.stringify
      const prevStr = prevFiltersStrRef.current || JSON.stringify(prev)
      if (prevStr !== configStr) {
        // Update cached previous string
        prevFiltersStrRef.current = configStr
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
      const blockTitle = config?.title || block.id
      updateFilterBlock(block.id, filters, targetBlocks, blockTitle)
    }
    
    return () => {
      // Cleanup on unmount
      if (block.id) {
        removeFilterBlock(block.id)
      }
    }
  }, [block.id, filters, targetBlocks, config?.title, updateFilterBlock, removeFilterBlock])

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
        .select("name, type, options")
        .eq("table_id", tableId)
        .order("position", { ascending: true })
      
      if (fields) {
        setTableFields(fields.map(f => ({ name: f.name, type: f.type, options: f.options })))
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

  // Get operators for a specific field (for modal view)
  const getOperatorsForField = useCallback((fieldName: string) => {
    const field = tableFields.find(f => f.name === fieldName)
    if (!field) return availableOperators.map(op => ({ value: op.value, label: op.label }))
    
    const fieldOperators = getOperatorsForFieldType(field.type)
    // Filter by allowed operators, but map date operators to their mapped operators
    return fieldOperators.filter(op => {
      if (field.type === 'date' && op.mappedOperator) {
        return allowedOperators.includes(op.mappedOperator)
      }
      return allowedOperators.includes(op.value as FilterConfig['operator'])
    })
  }, [tableFields, allowedOperators, availableOperators])

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
          className="mb-3 pb-2 border-b"
          style={{
            backgroundColor: appearance.header_background,
            color: appearance.header_text_color || appearance.title_color,
          }}
        >
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
      )}
      
      {/* Filter Summary - Clickable to open modal */}
      {filters.length > 0 && (
        <div className="mb-3">
          <Button
            onClick={() => setIsModalOpen(true)}
            variant="outline"
            size="sm"
            className="w-full justify-between text-sm"
          >
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span>Filter</span>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                {filters.length} condition{filters.length !== 1 ? 's' : ''}
              </span>
            </div>
            <span className="text-gray-400">{isEditing ? 'Open filter editor' : 'Click to edit'}</span>
          </Button>
        </div>
      )}
      
      {/* Airtable-style horizontal filter dropdowns (shown in edit mode) */}
      {isEditing && (
        <div className="flex items-center gap-2.5 flex-wrap">
        {filters.map((filter, index) => {
          const selectedField = tableFields.find(f => f.name === filter.field)
          const isSelectField = selectedField?.type === 'single_select' || selectedField?.type === 'multi_select' || selectedField?.type === 'select'
          const selectOptions = selectedField?.options?.choices || selectedField?.options || []
          const hasSelectOptions = isSelectField && Array.isArray(selectOptions) && selectOptions.length > 0
          
          // Get display label for selected value
          const selectedValueLabel = filter.value && hasSelectOptions
            ? (() => {
                const foundOpt = selectOptions.find((opt: string | { value: string; label: string }) => {
                  const optVal = typeof opt === 'string' ? opt : opt.value
                  return optVal === filter.value
                })
                if (!foundOpt) return filter.value
                return typeof foundOpt === 'string' ? foundOpt : (foundOpt.label || foundOpt.value || filter.value)
              })()
            : filter.value
          
          return (
            <div key={index} className="flex items-center gap-1.5 group relative">
              {/* Single integrated dropdown showing field name and value */}
              <div className="flex items-center gap-1.5">
                {/* Field Name Dropdown */}
                <Select
                  value={availableFields.some(f => f.name === filter.field) ? filter.field : availableFields[0]?.name || ''}
                  onValueChange={(value) => updateFilter(index, { field: value, value: '', operator: 'equal' })}
                >
                  <SelectTrigger className="h-8 px-3 text-sm border-gray-300 bg-white hover:bg-gray-50 shadow-sm">
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

                {/* Value Dropdown/Input */}
                {hasSelectOptions ? (
                  <Select
                    value={filter.value || '__all__'}
                    onValueChange={(value) => updateFilter(index, { value: value === '__all__' ? '' : value, operator: 'equal' })}
                  >
                    <SelectTrigger className={`h-8 px-3 text-sm border-gray-300 bg-white hover:bg-gray-50 shadow-sm ${
                      filter.value ? 'min-w-[140px]' : 'min-w-[120px]'
                    }`}>
                      <SelectValue placeholder={`All ${filter.field}`}>
                        {selectedValueLabel || `All ${filter.field}`}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All {filter.field}</SelectItem>
                      {selectOptions.map((option: string | { value: string; label: string }, idx: number) => {
                        const optionValue = typeof option === 'string' ? option : option.value
                        const optionLabel = typeof option === 'string' ? option : option.label
                        return (
                          <SelectItem key={idx} value={optionValue}>
                            {optionLabel}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                ) : filter.operator !== 'is_empty' && filter.operator !== 'is_not_empty' ? (
                  <Input
                    value={filter.value || ''}
                    onChange={(e) => updateFilter(index, { value: e.target.value })}
                    placeholder={`Filter ${filter.field}`}
                    className="h-8 min-w-[140px] text-sm border-gray-300 shadow-sm"
                  />
                ) : null}
              </div>

              {/* Remove Button - visible on hover or always in edit mode */}
              {isEditing && (
                <Button
                  onClick={() => removeFilter(index)}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove filter"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )
        })}

        {/* Add Filter Button */}
        {isEditing && (
          <Button
            onClick={addFilter}
            variant="outline"
            size="sm"
            className="h-8 px-3 text-sm border-gray-300 bg-white hover:bg-gray-50 text-gray-600 shadow-sm"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Filter
          </Button>
        )}
        </div>
      )}

      {/* Empty State */}
      {filters.length === 0 && !isEditing && (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm py-8">
          <div className="text-center">
            <Filter className="h-6 w-6 mx-auto mb-2 text-gray-300" />
            <p>No filters applied</p>
          </div>
        </div>
      )}

      {/* Target Blocks Info */}
      {targetBlocks !== 'all' && (
        <div className="mt-3 pt-2 border-t text-xs text-gray-500">
          Targeting {Array.isArray(targetBlocks) ? targetBlocks.length : 0} block(s)
        </div>
      )}

      {/* Filter Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Filter</DialogTitle>
            <DialogDescription>
              For the connected elements, show records...
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {filters.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">No filters applied</p>
                <p className="text-xs mt-1">Add a condition to filter records</p>
              </div>
            ) : (
              filters.map((filter, index) => {
                const selectedField = tableFields.find(f => f.name === filter.field)
                const fieldOperators = selectedField ? getOperatorsForField(filter.field) : availableOperators
                const isDateField = selectedField?.type === 'date'
                const isSelectField = selectedField?.type === 'single_select' || selectedField?.type === 'multi_select' || selectedField?.type === 'select'
                const selectOptions = selectedField?.options?.choices || selectedField?.options || []
                const hasSelectOptions = isSelectField && Array.isArray(selectOptions) && selectOptions.length > 0
                const needsValue = filter.operator !== 'is_empty' && filter.operator !== 'is_not_empty'
                
                // Get display label for selected value
                const selectedValueLabel = filter.value && hasSelectOptions
                  ? (() => {
                      const foundOpt = selectOptions.find((opt: string | { value: string; label: string }) => {
                        const optVal = typeof opt === 'string' ? opt : opt.value
                        return optVal === filter.value
                      })
                      if (!foundOpt) return filter.value
                      return typeof foundOpt === 'string' ? foundOpt : (foundOpt.label || foundOpt.value || filter.value)
                    })()
                  : filter.value

                return (
                  <div key={index} className="flex items-start gap-3 p-3 border rounded-lg bg-gray-50">
                    {/* Connector Label */}
                    <div className="pt-2 text-sm font-medium text-gray-600 min-w-[60px]">
                      {index === 0 ? 'Where' : 'and'}
                    </div>

                    {/* Filter Controls */}
                    <div className="flex-1 space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        {/* Field Select */}
                        <Select
                          value={availableFields.some(f => f.name === filter.field) ? filter.field : availableFields[0]?.name || ''}
                          onValueChange={(value) => {
                            const newField = tableFields.find(f => f.name === value)
                            const newOperators = newField ? getOperatorsForField(value) : availableOperators
                            updateFilter(index, { 
                              field: value, 
                              value: '', 
                              operator: (newOperators[0]?.value || 'equal') as FilterConfig['operator']
                            })
                          }}
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
                          value={isDateField ? mapFilterConfigToDateOperator(filter.operator, 'date') : filter.operator}
                          onValueChange={(value) => {
                            const mappedOperator = isDateField ? mapDateOperatorToFilterConfig(value) : (value as FilterConfig['operator'])
                            updateFilter(index, { 
                              operator: mappedOperator,
                              value: (mappedOperator === 'is_empty' || mappedOperator === 'is_not_empty') ? '' : filter.value
                            })
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Operator" />
                          </SelectTrigger>
                          <SelectContent>
                            {fieldOperators.map(op => (
                              <SelectItem key={op.value} value={op.value}>
                                {op.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Value Input/Select */}
                        {needsValue ? (
                          isDateField ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="date"
                                value={filter.value ? (typeof filter.value === 'string' && filter.value.includes('T') 
                                  ? filter.value.split('T')[0] 
                                  : filter.value) : ''}
                                onChange={(e) => updateFilter(index, { value: e.target.value })}
                                className="flex-1"
                                placeholder="Enter a date"
                              />
                              <span className="text-xs text-gray-500 whitespace-nowrap">GMT</span>
                            </div>
                          ) : hasSelectOptions ? (
                            <Select
                              value={filter.value || ''}
                              onValueChange={(value) => updateFilter(index, { value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select value" />
                              </SelectTrigger>
                              <SelectContent>
                                {selectOptions.map((option: string | { value: string; label: string }, idx: number) => {
                                  const optionValue = typeof option === 'string' ? option : option.value
                                  const optionLabel = typeof option === 'string' ? option : option.label
                                  return (
                                    <SelectItem key={idx} value={optionValue}>
                                      {optionLabel}
                                    </SelectItem>
                                  )
                                })}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              value={filter.value || ''}
                              onChange={(e) => updateFilter(index, { value: e.target.value })}
                              placeholder="Enter a value"
                            />
                          )
                        ) : (
                          <div className="flex items-center text-sm text-gray-500 px-3">
                            No value needed
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-start gap-1 pt-2">
                      <Button
                        onClick={() => removeFilter(index)}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                        title="Remove condition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-gray-400 hover:bg-gray-100"
                        title="More options"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })
            )}

            {/* Add Condition Button */}
            <Button
              onClick={addFilter}
              variant="outline"
              size="sm"
              className="w-full"
              disabled={availableFields.length === 0 || availableOperators.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add condition
            </Button>

            {/* Settings Icon - Only show in edit mode */}
            {isEditing && (
              <div className="flex justify-end pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-gray-600"
                  title="Filter settings"
                  onClick={() => {
                    // Settings could open block settings panel
                    // For now, just close modal - settings are in block settings
                    setIsModalOpen(false)
                  }}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Info Text */}
            <div className="pt-2 border-t text-xs text-gray-500">
              Connected elements will use these filter conditions in addition to their existing ones.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

