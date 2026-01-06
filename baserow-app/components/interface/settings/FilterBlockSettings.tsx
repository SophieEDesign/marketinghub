"use client"

import { useState, useEffect } from "react"
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
import { Filter, Plus, X } from "lucide-react"

interface FilterBlockSettingsProps {
  config: BlockConfig
  tables: Table[]
  fields: TableField[]
  allBlocks?: Array<{ id: string; type: string; config?: BlockConfig }> // All blocks on the page
  onUpdate: (updates: Partial<BlockConfig>) => void
  onTableChange: (tableId: string) => Promise<void>
}

const OPERATORS = [
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
  const allowedOperators = config?.allowed_operators || OPERATORS.map(op => op.value)
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
      if (field.type === 'single_select' || field.type === 'select') {
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
    ['grid', 'chart', 'kpi'].includes(b.type)
  )

  // Get available fields for filters (respect allowed_fields if set)
  const availableFilterFields = allowedFields.length === 0 
    ? fields 
    : fields.filter(f => allowedFields.includes(f.name))

  // Get available operators for filters (respect allowed_operators if set)
  const availableFilterOperators = allowedOperators.length === OPERATORS.length
    ? OPERATORS
    : OPERATORS.filter(op => allowedOperators.includes(op.value))

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
    if (availableFilterFields.length === 0 || availableFilterOperators.length === 0) return
    
    const newFilter: BlockFilter = {
      field: availableFilterFields[0].name,
      operator: availableFilterOperators[0]?.value as BlockFilter['operator'] || 'equal',
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

      {/* Target Blocks */}
      <div className="space-y-2">
        <Label>Target Blocks</Label>
        <Select
          value={typeof targetBlocks === 'string' ? targetBlocks : 'specific'}
          onValueChange={handleTargetBlocksChange}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All compatible blocks</SelectItem>
            {filterableBlocks.length > 0 && (
              <SelectItem value="specific">Specific blocks (coming soon)</SelectItem>
            )}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">
          Choose which blocks on this page should be affected by these filters.
        </p>
        {filterableBlocks.length > 0 && (
          <div className="mt-2 text-xs text-gray-400">
            Found {filterableBlocks.length} filterable block(s) on this page
          </div>
        )}
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
          {OPERATORS.map((op) => (
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
        {allowedOperators.length === OPERATORS.length && (
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
                No default filters set. Click "Add Filter" to create one.
              </div>
            ) : (
              defaultFilters.map((filter, index) => {
                const selectedField = fields.find(f => f.name === filter.field)
                const fieldOptions = fieldsWithOptions.get(filter.field)
                const isSelectField = selectedField?.type === 'single_select' || selectedField?.type === 'select'
                const needsValue = filter.operator !== 'is_empty' && filter.operator !== 'is_not_empty'
                
                return (
                  <div key={index} className="border rounded-lg p-3 bg-gray-50 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      {/* Field Select */}
                      <Select
                        value={filter.field}
                        onValueChange={(value) => updateDefaultFilter(index, { field: value, value: '' })}
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

                      {/* Operator Select */}
                      <Select
                        value={filter.operator}
                        onValueChange={(value) => updateDefaultFilter(index, { 
                          operator: value as BlockFilter['operator'],
                          value: (value === 'is_empty' || value === 'is_not_empty') ? '' : filter.value
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Operator" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableFilterOperators.map(op => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Value Input/Select */}
                      {needsValue ? (
                        (() => {
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
            <p className="font-medium mb-1">How Filter Blocks Work</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>Filter blocks narrow results but never override block base filters</li>
              <li>Multiple filter blocks can work together (AND logic)</li>
              <li>Filters are applied at the SQL query level for performance</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

