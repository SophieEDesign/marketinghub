"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Plus, Trash2, Edit2, X } from "lucide-react"
import type { HighlightRule } from "@/lib/interface/types"
import type { TableField } from "@/types/fields"
import FilterValueInput from "@/components/filters/FilterValueInput"
import { getManualChoiceLabels } from "@/lib/fields/select-options"

interface ConditionalFormattingEditorProps {
  rules: HighlightRule[]
  fields: TableField[]
  onRulesChange: (rules: HighlightRule[]) => void
}

/**
 * Get available operators for a field type
 */
function getOperatorsForFieldType(fieldType: string): HighlightRule['operator'][] {
  switch (fieldType) {
    case 'text':
    case 'long_text':
    case 'url':
    case 'email':
      return ['eq', 'neq', 'contains', 'is_empty', 'is_not_empty']
    
    case 'number':
    case 'percent':
    case 'currency':
      return ['eq', 'neq', 'gt', 'lt', 'is_empty', 'is_not_empty']
    
    case 'date':
      return ['date_before', 'date_after', 'date_today', 'date_overdue', 'is_empty', 'is_not_empty']
    
    case 'single_select':
    case 'multi_select':
      return ['eq', 'neq', 'is_empty', 'is_not_empty']
    
    case 'checkbox':
      return ['eq', 'neq']
    
    default:
      return ['eq', 'neq', 'is_empty', 'is_not_empty']
  }
}

/**
 * Check if operator needs a value
 */
function operatorNeedsValue(operator: HighlightRule['operator']): boolean {
  return !['is_empty', 'is_not_empty', 'date_today', 'date_overdue'].includes(operator)
}

export default function ConditionalFormattingEditor({
  rules = [],
  fields,
  onRulesChange,
}: ConditionalFormattingEditorProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  
  // Default rule for new rules
  const defaultRule: HighlightRule = {
    field: fields[0]?.name || '',
    operator: 'eq',
    value: '',
    background_color: '#fee2e2',
    text_color: '#991b1b',
    scope: 'row',
  }
  
  const [currentRule, setCurrentRule] = useState<HighlightRule>(defaultRule)
  
  const selectedField = fields.find(f => f.name === currentRule.field || f.id === currentRule.field)
  const availableOperators = selectedField ? getOperatorsForFieldType(selectedField.type) : ['eq', 'neq']
  
  // Ensure current operator is valid for selected field
  if (selectedField && !availableOperators.includes(currentRule.operator)) {
    setCurrentRule({ ...currentRule, operator: availableOperators[0] })
  }
  
  function handleAddRule() {
    setCurrentRule(defaultRule)
    setEditingIndex(null)
    setIsDialogOpen(true)
  }
  
  function handleEditRule(index: number) {
    setCurrentRule({ ...rules[index] })
    setEditingIndex(index)
    setIsDialogOpen(true)
  }
  
  function handleDeleteRule(index: number) {
    const newRules = rules.filter((_, i) => i !== index)
    onRulesChange(newRules)
  }
  
  function handleSaveRule() {
    if (!currentRule.field) return
    
    const newRules = [...rules]
    if (editingIndex !== null) {
      newRules[editingIndex] = currentRule
    } else {
      newRules.push(currentRule)
    }
    onRulesChange(newRules)
    setIsDialogOpen(false)
    setEditingIndex(null)
  }
  
  function handleCancel() {
    setIsDialogOpen(false)
    setEditingIndex(null)
    setCurrentRule(defaultRule)
  }
  
  // Convert HighlightRule operator to FilterOperator for FilterValueInput
  const filterOperator = currentRule.operator === 'date_before' ? 'date_before' :
    currentRule.operator === 'date_after' ? 'date_after' :
    currentRule.operator === 'date_today' ? 'date_today' :
    currentRule.operator === 'is_empty' ? 'is_empty' :
    currentRule.operator === 'is_not_empty' ? 'is_not_empty' :
    currentRule.operator === 'contains' ? 'contains' :
    currentRule.operator === 'gt' ? 'greater_than' :
    currentRule.operator === 'lt' ? 'less_than' :
    currentRule.operator === 'neq' ? 'not_equal' :
    'equal'
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label>Conditional Formatting</Label>
          <p className="text-xs text-gray-500 mt-1">
            Color cells, rows, or groups based on field conditions
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleAddRule}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Rule
        </Button>
      </div>
      
      {rules.length === 0 ? (
        <div className="text-sm text-gray-500 py-4 text-center border border-dashed rounded-md">
          No formatting rules. Click "Add Rule" to create one.
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule, index) => {
            const ruleField = fields.find(f => f.name === rule.field || f.id === rule.field)
            const fieldName = ruleField?.name || rule.field
            const scopeLabel = rule.scope === 'cell' ? 'Cell' : rule.scope === 'group' ? 'Group' : 'Row'
            
            return (
              <div
                key={index}
                className="flex items-center justify-between p-3 border rounded-md bg-gray-50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{fieldName}</span>
                    <span className="text-xs text-gray-500">{rule.operator}</span>
                    {rule.value !== undefined && rule.value !== null && rule.value !== '' && (
                      <span className="text-xs text-gray-500">{String(rule.value)}</span>
                    )}
                    <span className="text-xs text-gray-500">→ {scopeLabel}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {rule.background_color && (
                      <div
                        className="w-4 h-4 rounded border border-gray-300"
                        style={{ backgroundColor: rule.background_color }}
                        title={`Background: ${rule.background_color}`}
                      />
                    )}
                    {rule.text_color && (
                      <div
                        className="w-4 h-4 rounded border border-gray-300"
                        style={{ backgroundColor: rule.text_color }}
                        title={`Text: ${rule.text_color}`}
                      />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEditRule(index)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteRule(index)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingIndex !== null ? 'Edit Formatting Rule' : 'Add Formatting Rule'}
            </DialogTitle>
            <DialogDescription>
              Configure when and how to apply conditional formatting
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Field Selector */}
            <div className="space-y-2">
              <Label>Field</Label>
              <Select
                value={currentRule.field}
                onValueChange={(value) => {
                  const field = fields.find(f => f.name === value || f.id === value)
                  const operators = field ? getOperatorsForFieldType(field.type) : ['eq', 'neq']
                  setCurrentRule({
                    ...currentRule,
                    field: value,
                    operator: operators.includes(currentRule.operator) ? currentRule.operator : operators[0],
                    value: undefined, // Reset value when field changes
                  })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select field..." />
                </SelectTrigger>
                <SelectContent>
                  {fields.map((field) => (
                    <SelectItem key={field.id} value={field.name}>
                      {field.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Operator Selector */}
            {selectedField && (
              <div className="space-y-2">
                <Label>Condition</Label>
                <Select
                  value={currentRule.operator}
                  onValueChange={(value) => {
                    setCurrentRule({
                      ...currentRule,
                      operator: value as HighlightRule['operator'],
                      value: operatorNeedsValue(value as HighlightRule['operator']) ? currentRule.value : undefined,
                    })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableOperators.map((op) => (
                      <SelectItem key={op} value={op}>
                        {op === 'eq' ? 'Equals' :
                         op === 'neq' ? 'Not equals' :
                         op === 'gt' ? 'Greater than' :
                         op === 'lt' ? 'Less than' :
                         op === 'contains' ? 'Contains' :
                         op === 'date_before' ? 'Date is before' :
                         op === 'date_after' ? 'Date is after' :
                         op === 'date_today' ? 'Date is today' :
                         op === 'date_overdue' ? 'Date is overdue' :
                         op === 'is_empty' ? 'Is empty' :
                         op === 'is_not_empty' ? 'Is not empty' :
                         op}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Value Input */}
            {selectedField && operatorNeedsValue(currentRule.operator) && (
              <div className="space-y-2">
                <Label>Value</Label>
                <FilterValueInput
                  field={selectedField}
                  operator={filterOperator}
                  value={currentRule.value}
                  onChange={(value) => {
                    setCurrentRule({ ...currentRule, value })
                  }}
                />
              </div>
            )}
            
            {/* Scope Selector */}
            <div className="space-y-2">
              <Label>Apply to</Label>
              <Select
                value={currentRule.scope || 'row'}
                onValueChange={(value) => {
                  setCurrentRule({
                    ...currentRule,
                    scope: value as 'cell' | 'row' | 'group',
                  })
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="row">Entire row</SelectItem>
                  <SelectItem value="cell">Specific cell</SelectItem>
                  <SelectItem value="group">Group header</SelectItem>
                </SelectContent>
              </Select>
              {currentRule.scope === 'cell' && (
                <div className="space-y-2 mt-2">
                  <Label>Target field (for cell formatting)</Label>
                  <Select
                    value={currentRule.target_field || ''}
                    onValueChange={(value) => {
                      setCurrentRule({
                        ...currentRule,
                        target_field: value || undefined,
                      })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field to format..." />
                    </SelectTrigger>
                    <SelectContent>
                      {fields.map((field) => (
                        <SelectItem key={field.id} value={field.name}>
                          {field.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            
            {/* Color Pickers */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Background Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={currentRule.background_color || ''}
                    onChange={(e) => {
                      setCurrentRule({
                        ...currentRule,
                        background_color: e.target.value,
                      })
                    }}
                    placeholder="#fee2e2"
                  />
                  <input
                    type="color"
                    value={currentRule.background_color || '#fee2e2'}
                    onChange={(e) => {
                      setCurrentRule({
                        ...currentRule,
                        background_color: e.target.value,
                      })
                    }}
                    className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Text Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={currentRule.text_color || ''}
                    onChange={(e) => {
                      setCurrentRule({
                        ...currentRule,
                        text_color: e.target.value,
                      })
                    }}
                    placeholder="#991b1b"
                  />
                  <input
                    type="color"
                    value={currentRule.text_color || '#991b1b'}
                    onChange={(e) => {
                      setCurrentRule({
                        ...currentRule,
                        text_color: e.target.value,
                      })
                    }}
                    className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveRule}
              disabled={!currentRule.field}
            >
              {editingIndex !== null ? 'Save Changes' : 'Add Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
