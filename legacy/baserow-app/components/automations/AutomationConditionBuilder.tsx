"use client"

import { useState, useCallback, useEffect } from "react"
import { Plus, X, ChevronDown, ChevronRight, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import type { TableField } from "@/types/fields"
import type { FilterTree, FilterGroup, FilterCondition, GroupOperator } from "@/lib/filters/canonical-model"
import { normalizeFilterTree, isEmptyFilterTree } from "@/lib/filters/canonical-model"
import { getOperatorsForFieldType, getDefaultOperatorForFieldType } from "@/lib/filters/field-operators"
import FilterValueInput from "@/components/filters/FilterValueInput"
import { filterTreeToFormula, generateConditionSummary } from "@/lib/automations/condition-formula"

interface AutomationConditionBuilderProps {
  filterTree: FilterTree
  tableFields: TableField[]
  tableName?: string
  onChange: (filterTree: FilterTree) => void
  className?: string
}

/**
 * Simplified Condition Builder for Automations
 * 
 * Features:
 * - Toggle between "Run every time" and "Only run when..."
 * - Simple condition rows (field + operator + value)
 * - Global AND/OR toggle
 * - Human-readable summary
 * - Advanced formula view (read-only)
 */
export default function AutomationConditionBuilder({
  filterTree,
  tableFields,
  tableName,
  onChange,
  className = "",
}: AutomationConditionBuilderProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  const normalized = normalizeFilterTree(filterTree) || {
    operator: 'AND' as GroupOperator,
    children: [],
  }

  const hasConditions = !isEmptyFilterTree(normalized)
  const [showConditions, setShowConditions] = useState(hasConditions)

  // Update showConditions when filterTree changes externally (but not from our own changes)
  useEffect(() => {
    const hasConditionsNow = !isEmptyFilterTree(normalizeFilterTree(filterTree))
    setShowConditions(hasConditionsNow)
  }, [filterTree])

  // Add a new condition
  const addCondition = useCallback(() => {
    const newCondition: FilterCondition = {
      field_id: tableFields[0]?.name || '',
      operator: tableFields[0] ? getDefaultOperatorForFieldType(tableFields[0].type) : 'equal',
      value: undefined,
    }

    const newTree: FilterGroup = {
      ...normalized,
      children: [...normalized.children, newCondition],
    }
    onChange(newTree)
  }, [normalized, tableFields, onChange])

  // Remove a condition
  const removeCondition = useCallback((index: number) => {
    const newChildren = normalized.children.filter((_, i) => i !== index)
    if (newChildren.length === 0) {
      onChange(null)
      setShowConditions(false)
    } else {
      onChange({
        ...normalized,
        children: newChildren,
      })
    }
  }, [normalized, onChange])

  // Update a condition
  const updateCondition = useCallback((index: number, updates: Partial<FilterCondition>) => {
    const newChildren = normalized.children.map((child, i) => {
      if (i === index && 'field_id' in child) {
        return { ...child, ...updates } as FilterCondition
      }
      return child
    })
    onChange({
      ...normalized,
      children: newChildren,
    })
  }, [normalized, onChange])

  // Update group operator
  const updateOperator = useCallback((operator: GroupOperator) => {
    onChange({
      ...normalized,
      operator,
    })
  }, [normalized, onChange])

  // Toggle conditions on/off
  const handleToggleConditions = useCallback(() => {
    if (showConditions) {
      // Turning off - clear conditions
      onChange(null)
      setShowConditions(false)
    } else {
      // Turning on - add first condition
      setShowConditions(true)
      if (normalized.children.length === 0) {
        addCondition()
      }
    }
  }, [showConditions, normalized, onChange, addCondition])

  const formula = filterTreeToFormula(normalized, tableFields)
  const summary = generateConditionSummary(normalized, tableFields, tableName)

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Toggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleToggleConditions}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          {showConditions ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span>{showConditions ? 'Only run when…' : 'Run every time'}</span>
        </button>
      </div>

      {/* Condition Builder */}
      {showConditions && (
        <div className="space-y-4 pl-6 border-l-2 border-blue-200">
          {/* Global Operator Toggle */}
          {normalized.children.length > 1 && (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-gray-600">Match</Label>
              <Select
                value={normalized.operator}
                onValueChange={(value) => updateOperator(value as GroupOperator)}
              >
                <SelectTrigger className="h-8 w-20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AND">All</SelectItem>
                  <SelectItem value="OR">Any</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-gray-500">of the following conditions</span>
            </div>
          )}

          {/* Condition Rows */}
          <div className="space-y-3">
            {normalized.children.map((child, index) => {
              if (!('field_id' in child)) {
                // Skip nested groups for now (simplified UI)
                return null
              }

              const condition = child as FilterCondition
              const field = tableFields.find(f => f.name === condition.field_id || f.id === condition.field_id)
              const operators = field ? getOperatorsForFieldType(field.type) : []

              return (
                <div key={index} className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="grid grid-cols-12 gap-2 items-end">
                    {/* Field selector */}
                    <div className="col-span-4">
                      <Label className="text-xs text-gray-600 mb-1 block">Field</Label>
                      <Select
                        value={condition.field_id}
                        onValueChange={(value) => {
                          const newField = tableFields.find(f => f.name === value || f.id === value)
                          updateCondition(index, {
                            field_id: value,
                            operator: newField ? getDefaultOperatorForFieldType(newField.type) : 'equal',
                            value: undefined,
                          })
                        }}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          {tableFields.map((f) => (
                            <SelectItem key={f.id || f.name} value={f.name}>
                              {f.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Operator selector */}
                    <div className="col-span-3">
                      <Label className="text-xs text-gray-600 mb-1 block">Operator</Label>
                      <Select
                        value={condition.operator}
                        onValueChange={(value) => {
                          updateCondition(index, { operator: value as FilterCondition['operator'] })
                        }}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {operators.map((op) => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Value input */}
                    <div className="col-span-4">
                      <Label className="text-xs text-gray-600 mb-1 block">Value</Label>
                      <FilterValueInput
                        field={field || null}
                        operator={condition.operator}
                        value={condition.value}
                        onChange={(value) => updateCondition(index, { value })}
                      />
                    </div>

                    {/* Remove button */}
                    <div className="col-span-1 flex items-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCondition(index)}
                        className="h-9 w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Remove condition"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Add Condition Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCondition}
            className="border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add condition
          </Button>

          {/* Human-readable Summary */}
          {normalized.children.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-900">
                <strong>Summary:</strong> {summary}
              </p>
            </div>
          )}

          {/* Advanced: View Formula */}
          <div className="mt-4 border-t pt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900"
            >
              {showAdvanced ? (
                <EyeOff className="h-3 w-3" />
              ) : (
                <Eye className="h-3 w-3" />
              )}
              <span>Advanced: View formula</span>
            </button>

            {showAdvanced && (
              <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-md">
                <textarea
                  readOnly
                  value={formula || '(no conditions)'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-xs bg-white"
                  rows={3}
                />
                <p className="text-xs text-gray-500 mt-2">
                  This formula is generated automatically from your conditions above.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
