"use client"

import { useState, useEffect, useMemo } from "react"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { BlockConfig, BlockFilter } from "@/lib/interface/types"
import type { Table, TableField } from "@/types/database"
import { createClient } from "@/lib/supabase/client"
import { Filter, Plus, X, Link2, CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import LookupFieldPicker, { type LookupFieldConfig } from "@/components/fields/LookupFieldPicker"
import { getOperatorsForFieldType, getDefaultOperatorForFieldType } from "@/lib/filters/field-operators"

interface FilterBlockSettingsProps {
  config: BlockConfig
  tables: Table[]
  fields: TableField[]
  allBlocks?: Array<{ id: string; type: string; config?: BlockConfig }> // All blocks on the page
  onUpdate: (updates: Partial<BlockConfig>) => void
  onTableChange: (tableId: string) => Promise<void>
}

// Get all possible operators across all field types for the "Allowed Operators" setting
// This includes date-specific operators
const ALL_OPERATORS = [
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
  // Date-specific operators
  { value: 'date_equal', label: 'is (date)' },
  { value: 'date_before', label: 'before (date)' },
  { value: 'date_after', label: 'after (date)' },
  { value: 'date_on_or_before', label: 'on or before (date)' },
  { value: 'date_on_or_after', label: 'on or after (date)' },
  { value: 'date_range', label: 'is within (date range)' },
  // Link/lookup operators
  { value: 'has', label: 'has record matching' },
  { value: 'does_not_have', label: 'does not have record matching' },
]

export default function FilterBlockSettings({
  config,
  tables,
  fields,
  allBlocks = [],
  onUpdate,
  onTableChange,
}: FilterBlockSettingsProps) {
  const tableId = config?.table_id || ''
  const targetBlocks = config?.target_blocks || 'all'
  const allowedFields = config?.allowed_fields || []
  const allowedOperators = config?.allowed_operators || ALL_OPERATORS.map(op => op.value)
  const [defaultFilters, setDefaultFilters] = useState<BlockFilter[]>(config?.filters || [])
  const [fieldsWithOptions, setFieldsWithOptions] = useState<Map<string, any>>(new Map())

  // Load field options when table/fields change
  useEffect(() => {
    if (tableId && fields.length > 0) {
      loadFieldOptions()
    } else {
      setFieldsWithOptions(new Map())
    }
  }, [tableId, fields])

  function loadFieldOptions() {
    const optionsMap = new Map()
    
    for (const field of fields) {
      if (field.type === 'single_select' || field.type === 'multi_select') {
        // Field options can be in options.choices or options directly
        const fieldOptions = (field as any).options
        if (fieldOptions) {
          optionsMap.set(field.name, fieldOptions)
        }
      }
    }
    
    setFieldsWithOptions(optionsMap)
  }

  // Sync defaultFilters with config.filters
  useEffect(() => {
    setDefaultFilters(config?.filters || [])
  }, [config?.filters])

  // Get data blocks that can be filtered
  const filterableBlocks = allBlocks.filter(b => 
    ['grid', 'chart', 'kpi', 'kanban', 'calendar', 'timeline', 'list'].includes(b.type)
  )
  
  // Get currently connected blocks
  const connectedBlocks = useMemo(() => {
    if (targetBlocks === 'all') {
      return filterableBlocks
    }
    if (Array.isArray(targetBlocks)) {
      return filterableBlocks.filter(b => targetBlocks.includes(b.id))
    }
    return []
  }, [targetBlocks, filterableBlocks])

  // Get available fields for filters (respect allowed_fields if set)
  const availableFilterFields = allowedFields.length === 0 
    ? fields 
    : fields.filter(f => allowedFields.includes(f.name))

  // Get available operators for filters (respect allowed_operators if set)
  const availableFilterOperators = allowedOperators.length === ALL_OPERATORS.length
    ? ALL_OPERATORS
    : ALL_OPERATORS.filter(op => allowedOperators.includes(op.value))

  function handleTargetBlocksChange(value: string) {
    if (value === 'all') {
      onUpdate({ target_blocks: 'all' })
    } else {
      // For now, we'll use 'all' - specific block targeting can be added later
      onUpdate({ target_blocks: 'all' })
    }
  }

  function toggleField(fieldName: string) {
    const newFields = allowedFields.includes(fieldName)
      ? allowedFields.filter(f => f !== fieldName)
      : [...allowedFields, fieldName]
    onUpdate({ allowed_fields: newFields })
  }

  function toggleOperator(operator: string) {
    const newOperators = allowedOperators.includes(operator)
      ? allowedOperators.filter(op => op !== operator)
      : [...allowedOperators, operator]
    onUpdate({ allowed_operators: newOperators })
  }

  function addDefaultFilter() {
    if (availableFilterFields.length === 0) return
    
    const firstField = availableFilterFields[0]
    const fieldOperators = getOperatorsForFieldType(firstField.type)
    const defaultOp = getDefaultOperatorForFieldType(firstField.type)
    
    const newFilter: BlockFilter = {
      field: firstField.name,
      operator: defaultOp as BlockFilter['operator'],
      value: '',
    }
    const newFilters = [...defaultFilters, newFilter]
    setDefaultFilters(newFilters)
    onUpdate({ filters: newFilters })
  }

  function removeDefaultFilter(index: number) {
    const newFilters = defaultFilters.filter((_, i) => i !== index)
    setDefaultFilters(newFilters)
    onUpdate({ filters: newFilters })
  }

  function updateDefaultFilter(index: number, updates: Partial<BlockFilter>) {
    const newFilters = defaultFilters.map((f, i) => 
      i === index ? { ...f, ...updates } : f
    )
    setDefaultFilters(newFilters)
    onUpdate({ filters: newFilters })
  }

  return (
    <div className="space-y-6">
      {/* Table Selection */}
      <div className="space-y-2">
        <Label>Table</Label>
        <Select
          value={tableId}
          onValueChange={async (value) => {
            await onTableChange(value)
            onUpdate({ table_id: value })
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a table" />
          </SelectTrigger>
          <SelectContent>
            {tables.map((table) => (
              <SelectItem key={table.id} value={table.id}>
                {table.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">
          Select the table that contains the fields you want to filter by.
        </p>
      </div>

      {/* Connected Elements */}
      <div className="space-y-2">
        <Label>Connected Elements</Label>
        <div className="space-y-3">
          <Select
            value={typeof targetBlocks === 'string' ? targetBlocks : 'specific'}
            onValueChange={(value) => {
              if (value === 'all') {
                onUpdate({ target_blocks: 'all' })
              } else {
                // For specific selection, we'll implement a multi-select UI
                // For now, keep 'all' behavior
                onUpdate({ target_blocks: 'all' })
              }
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All compatible elements</SelectItem>
              {filterableBlocks.length > 0 && (
                <SelectItem value="specific">Select specific elements</SelectItem>
              )}
            </SelectContent>
          </Select>
          
          {/* Connected Elements List */}
          {connectedBlocks.length > 0 && (
            <div className="border rounded-lg p-3 bg-blue-50 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
                <Link2 className="h-4 w-4" />
                <span>Connected elements ({connectedBlocks.length})</span>
              </div>
              <div className="space-y-1">
                {connectedBlocks.map((block: { id: string; type: string; config?: BlockConfig }) => {
                  const blockTitle = block.config?.title || block.id
                  const blockTypeLabel = block.type.charAt(0).toUpperCase() + block.type.slice(1)
                  return (
                    <div
                      key={block.id}
                      className="flex items-center justify-between p-2 bg-white rounded border border-blue-200"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium">{blockTitle}</span>
                        <Badge variant="secondary" className="text-xs">
                          {blockTypeLabel}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          
          {connectedBlocks.length === 0 && filterableBlocks.length > 0 && (
            <div className="border rounded-lg p-3 bg-gray-50 text-sm text-gray-500 text-center">
              No elements connected. Select &quot;All compatible elements&quot; or choose specific ones.
            </div>
          )}
          
          {filterableBlocks.length === 0 && (
            <div className="border rounded-lg p-3 bg-gray-50 text-sm text-gray-500 text-center">
              No filterable elements found on this page. Add grid, chart, or KPI blocks to connect.
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500">
          These filters will be applied on top of each element&apos;s own filters.
        </p>
      </div>

      {/* Allowed Fields */}
      {tableId && fields.length > 0 && (
        <div className="space-y-2">
          <Label>Allowed Fields</Label>
          <p className="text-xs text-gray-500 mb-2">
            Select which fields users can filter by. Leave empty to allow all fields.
          </p>
          <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
            {fields.length === 0 ? (
              <p className="text-sm text-gray-400">No fields available</p>
            ) : (
              fields.map((field) => (
                <div key={field.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`field-${field.id}`}
                    checked={allowedFields.length === 0 || allowedFields.includes(field.name)}
                    onCheckedChange={() => toggleField(field.name)}
                  />
                  <label
                    htmlFor={`field-${field.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                  >
                    {field.name}
                    <span className="text-xs text-gray-400 ml-2">({field.type})</span>
                  </label>
                </div>
              ))
            )}
          </div>
          {allowedFields.length === 0 && (
            <p className="text-xs text-gray-500 italic">All fields are allowed</p>
          )}
        </div>
      )}

      {/* Allowed Operators */}
      <div className="space-y-2">
        <Label>Allowed Operators</Label>
        <p className="text-xs text-gray-500 mb-2">
          Select which filter operators users can use. Leave empty to allow all operators.
        </p>
        <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
          {ALL_OPERATORS.map((op) => (
            <div key={op.value} className="flex items-center space-x-2">
              <Checkbox
                id={`operator-${op.value}`}
                checked={allowedOperators.includes(op.value)}
                onCheckedChange={() => toggleOperator(op.value)}
              />
              <label
                htmlFor={`operator-${op.value}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
              >
                {op.label}
              </label>
            </div>
          ))}
        </div>
        {allowedOperators.length === ALL_OPERATORS.length && (
          <p className="text-xs text-gray-500 italic">All operators are allowed</p>
        )}
      </div>

      {/* Default Filters */}
      {tableId && availableFilterFields.length > 0 && (
        <div className="space-y-2">
          <Label>Default Filters</Label>
          <p className="text-xs text-gray-500 mb-2">
            Set default filter values that will be applied when the page loads. Users can modify these filters.
          </p>
          <div className="space-y-2">
            {defaultFilters.length === 0 ? (
              <div className="border rounded-lg p-4 text-center text-sm text-gray-400">
                No default filters set. Click &quot;Add Filter&quot; to create one.
              </div>
            ) : (
              defaultFilters.map((filter, index) => {
                const selectedField = fields.find(f => f.name === filter.field)
                const fieldOptions = fieldsWithOptions.get(filter.field)
                const isSelectField = selectedField?.type === 'single_select' || selectedField?.type === 'multi_select'
                // Get field-specific operators to determine if value is needed
                const fieldOperators = selectedField 
                  ? getOperatorsForFieldType(selectedField.type)
                  : []
                const selectedOperator = fieldOperators.find(op => op.value === filter.operator)
                const needsValue = selectedOperator?.requiresValue !== false
                
                return (
                  <div key={index} className="border rounded-lg p-3 bg-gray-50 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      {/* Field Select */}
                      <Select
                        value={filter.field}
                        onValueChange={(value) => {
                          const newField = fields.find(f => f.name === value)
                          const defaultOp = newField 
                            ? getDefaultOperatorForFieldType(newField.type)
                            : 'equal'
                          updateDefaultFilter(index, { 
                            field: value, 
                            operator: defaultOp as BlockFilter['operator'],
                            value: '' 
                          })
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Field" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableFilterFields.map(field => (
                            <SelectItem key={field.id} value={field.name}>
                              {field.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Operator Select - Field-aware operators */}
                      <Select
                        value={filter.operator}
                        onValueChange={(value) => {
                          const fieldOperators = selectedField 
                            ? getOperatorsForFieldType(selectedField.type)
                            : []
                          const selectedOp = fieldOperators.find(op => op.value === value)
                          const needsValue = selectedOp?.requiresValue !== false
                          
                          updateDefaultFilter(index, { 
                            operator: value as BlockFilter['operator'],
                            value: needsValue ? filter.value : ''
                          })
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Operator" />
                        </SelectTrigger>
                        <SelectContent>
                          {(() => {
                            // Get field-specific operators, filtered by allowed operators
                            const fieldOperators = selectedField 
                              ? getOperatorsForFieldType(selectedField.type)
                              : []
                            
                            // Filter by allowed operators if configured
                            const filteredOperators = allowedOperators.length === ALL_OPERATORS.length
                              ? fieldOperators
                              : fieldOperators.filter(op => allowedOperators.includes(op.value))
                            
                            return filteredOperators.map(op => (
                              <SelectItem key={op.value} value={op.value}>
                                {op.label}
                              </SelectItem>
                            ))
                          })()}
                        </SelectContent>
                      </Select>

                      {/* Value Input/Select */}
                      {needsValue ? (
                        (() => {
                          // Check if this is a lookup or link_to_table field
                          const isLookupField = selectedField?.type === 'link_to_table' || selectedField?.type === 'lookup'
                          const linkedTableId = selectedField?.type === 'link_to_table'
                            ? (selectedField.options as any)?.linked_table_id
                            : (selectedField?.type === 'lookup' ? (selectedField.options as any)?.lookup_table_id : null)

                          if (isLookupField && linkedTableId) {
                            const lookupConfig: LookupFieldConfig = {
                              lookupTableId: linkedTableId,
                              relationshipType: (selectedField.options as any)?.relationship_type || (selectedField.type === 'link_to_table' ? 'one-to-many' : 'one-to-one'),
                              maxSelections: (selectedField.options as any)?.max_selections,
                            }

                            return (
                              <LookupFieldPicker
                                field={selectedField as any}
                                value={filter.value || null}
                                onChange={(value) => {
                                  const stringValue = Array.isArray(value) ? value.join(',') : (value || '')
                                  updateDefaultFilter(index, { value: stringValue })
                                }}
                                config={lookupConfig}
                                placeholder="Select value..."
                              />
                            )
                          }

                          // Check for select field options (same pattern as FilterBlock)
                          const selectOptions = fieldOptions?.choices || fieldOptions || []
                          const hasSelectOptions = isSelectField && Array.isArray(selectOptions) && selectOptions.length > 0
                          
                          if (hasSelectOptions) {
                            return (
                              <Select
                                value={filter.value || ''}
                                onValueChange={(value) => updateDefaultFilter(index, { value })}
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
                            )
                          }
                          
                          return (
                            <Input
                              value={filter.value || ''}
                              onChange={(e) => updateDefaultFilter(index, { value: e.target.value })}
                              placeholder="Value"
                            />
                          )
                        })()
                      ) : (
                        <div className="flex items-center text-sm text-gray-500 px-3">
                          No value needed
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <Button
                        onClick={() => removeDefaultFilter(index)}
                        variant="ghost"
                        size="sm"
                        className="text-gray-400 hover:text-red-600 h-7"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
            <Button
              onClick={addDefaultFilter}
              variant="outline"
              size="sm"
              className="w-full"
              disabled={availableFilterFields.length === 0 || availableFilterOperators.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Filter
            </Button>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start space-x-2">
          <Filter className="h-4 w-4 text-blue-600 mt-0.5" />
          <div className="text-xs text-blue-800">
            <p className="font-medium mb-1">How Filter Controls Work</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>Filter controls are shared controls that drive connected elements</li>
              <li>Filters apply in addition to each element&apos;s own filters (never replace them)</li>
              <li>Full filter system: supports AND/OR groups and nested groups</li>
              <li>Changes apply instantly - no Save required</li>
              <li>Only fields common to all connected elements are shown</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

