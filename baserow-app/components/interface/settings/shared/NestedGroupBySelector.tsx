"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { TableField } from "@/types/fields"
import { FIELD_TYPES } from "@/types/fields"
import type { GroupRule } from "@/lib/grouping/types"
import { GripVertical, X, Plus, ArrowUp, ArrowDown } from "lucide-react"

interface NestedGroupBySelectorProps {
  value?: string | undefined // Legacy: single field
  groupByRules?: GroupRule[] | null // New: nested grouping rules
  onChange?: (fieldName: string | undefined) => void // Legacy callback
  onRulesChange?: (rules: GroupRule[] | null) => void // New callback
  fields: TableField[]
  label?: string
  description?: string
  filterGroupableFields?: boolean
}

export default function NestedGroupBySelector({
  value,
  groupByRules,
  onChange,
  onRulesChange,
  fields,
  label = "Group by (Optional)",
  description,
  filterGroupableFields = true,
}: NestedGroupBySelectorProps) {
  // Initialize rules from props, or convert legacy value to rules
  const [rules, setRules] = useState<GroupRule[]>(() => {
    if (groupByRules && groupByRules.length > 0) {
      return groupByRules
    }
    if (value) {
      return [{ type: 'field', field: value }]
    }
    return []
  })

  useEffect(() => {
    if (groupByRules && groupByRules.length > 0) {
      setRules(groupByRules)
    } else if (value) {
      setRules([{ type: 'field', field: value }])
    } else {
      setRules([])
    }
  }, [groupByRules, value])

  // Filter fields that can be grouped (not formula, not lookup)
  const groupableFields = filterGroupableFields
    ? fields.filter((f) => f.type !== "formula" && f.type !== "lookup")
    : fields

  // Get date fields for date grouping
  const dateFields = fields.filter(
    (f) => f.type === "date"
  )

  function addRule() {
    if (groupableFields.length === 0 || rules.length >= 2) return
    const newRules = [...rules, { type: 'field' as const, field: groupableFields[0].name }]
    setRules(newRules)
    notifyChange(newRules)
  }

  function removeRule(index: number) {
    const newRules = rules.filter((_, i) => i !== index)
    setRules(newRules)
    notifyChange(newRules)
  }

  function updateRule(index: number, rule: GroupRule) {
    const newRules = [...rules]
    newRules[index] = rule
    setRules(newRules)
    notifyChange(newRules)
  }

  function moveRule(index: number, direction: 'up' | 'down') {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === rules.length - 1) return
    
    const newRules = [...rules]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    ;[newRules[index], newRules[targetIndex]] = [newRules[targetIndex], newRules[index]]
    setRules(newRules)
    notifyChange(newRules)
  }

  function notifyChange(newRules: GroupRule[]) {
    // Call both callbacks for backward compatibility
    if (onRulesChange) {
      onRulesChange(newRules.length > 0 ? newRules : null)
    }
    if (onChange) {
      const firstField = newRules.length > 0 && newRules[0].type === 'field' ? newRules[0].field : undefined
      onChange(firstField)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>{label}</Label>
        {description && (
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        )}
        {!description && (
          <p className="text-xs text-gray-500 mt-1">
            Add up to 2 grouping levels to create nested groups (like Airtable). Records will be grouped hierarchically by the selected fields.
          </p>
        )}
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-4 text-gray-500 border border-dashed rounded-lg">
          <p className="text-sm">No grouping rules added yet.</p>
          <p className="text-xs mt-1">Click &quot;Add Grouping Rule&quot; to start grouping your records.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule, index) => (
            <div key={index} className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50">
              <div className="flex items-center gap-2 flex-1">
                <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                <span className="text-sm font-medium text-gray-600 w-6">
                  {index + 1}.
                </span>
                
                {rule.type === 'field' ? (
                  <Select
                    value={rule.field}
                    onValueChange={(fieldName) => {
                      updateRule(index, { type: 'field', field: fieldName })
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a field" />
                    </SelectTrigger>
                    <SelectContent>
                      {groupableFields.map((field) => (
                        <SelectItem key={field.id} value={field.name}>
                          {field.name} ({FIELD_TYPES.find(t => t.type === field.type)?.label})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex-1 flex gap-2">
                    <Select
                      value={rule.field}
                      onValueChange={(fieldName) => {
                        updateRule(index, { ...rule, field: fieldName })
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select a date field" />
                      </SelectTrigger>
                      <SelectContent>
                        {dateFields.map((field) => (
                          <SelectItem key={field.id} value={field.name}>
                            {field.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={rule.granularity}
                      onValueChange={(granularity: 'year' | 'month') => {
                        updateRule(index, { ...rule, granularity })
                      }}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="year">Year</SelectItem>
                        <SelectItem value="month">Month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => moveRule(index, 'up')}
                  disabled={index === 0}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => moveRule(index, 'down')}
                  disabled={index === rules.length - 1}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-600 hover:text-red-700"
                  onClick={() => removeRule(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-center">
        <Button
          variant="outline"
          size="sm"
          onClick={addRule}
          className="flex items-center gap-2"
          disabled={groupableFields.length === 0 || rules.length >= 2}
        >
          <Plus className="h-4 w-4" />
          Add Grouping Rule
        </Button>
        {rules.length >= 2 && (
          <p className="text-xs text-gray-500">
            Maximum 2 grouping levels (like Airtable)
          </p>
        )}
      </div>
    </div>
  )
}
