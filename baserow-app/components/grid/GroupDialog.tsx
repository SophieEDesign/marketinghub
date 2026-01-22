"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase/client"
import type { TableField } from "@/types/fields"
import { FIELD_TYPES } from "@/types/fields"
import { normalizeUuid } from "@/lib/utils/ids"
import type { GroupRule } from "@/lib/grouping/types"
import { GripVertical, X, Plus, ArrowUp, ArrowDown } from "lucide-react"

interface GroupDialogProps {
  isOpen: boolean
  onClose: () => void
  viewId: string
  tableFields: TableField[]
  groupBy?: string
  groupByRules?: GroupRule[]
  onGroupChange?: (fieldName: string | null) => void
  onGroupRulesChange?: (rules: GroupRule[] | null) => void
}

export default function GroupDialog({
  isOpen,
  onClose,
  viewId,
  tableFields,
  groupBy,
  groupByRules,
  onGroupChange,
  onGroupRulesChange,
}: GroupDialogProps) {
  // Initialize rules from props, or convert legacy groupBy to rules
  const [rules, setRules] = useState<GroupRule[]>(() => {
    if (groupByRules && groupByRules.length > 0) {
      return groupByRules
    }
    if (groupBy) {
      return [{ type: 'field', field: groupBy }]
    }
    return []
  })
  
  const viewUuid = useMemo(() => normalizeUuid(viewId), [viewId])

  useEffect(() => {
    if (groupByRules && groupByRules.length > 0) {
      setRules(groupByRules)
    } else if (groupBy) {
      setRules([{ type: 'field', field: groupBy }])
    } else {
      setRules([])
    }
  }, [groupBy, groupByRules, isOpen])

  // Filter fields that can be grouped (not formula, not lookup)
  const groupableFields = tableFields.filter(
    (f) => f.type !== "formula" && f.type !== "lookup"
  )

  // Get date fields for date grouping
  const dateFields = tableFields.filter(
    (f) => f.type === "date" || f.type === "datetime"
  )

  function addRule() {
    // Limit to 2 groups like Airtable
    if (rules.length >= 2) return
    if (groupableFields.length === 0) return
    setRules([...rules, { type: 'field', field: groupableFields[0].name }])
  }

  function removeRule(index: number) {
    setRules(rules.filter((_, i) => i !== index))
  }

  function updateRule(index: number, rule: GroupRule) {
    const newRules = [...rules]
    newRules[index] = rule
    setRules(newRules)
  }

  function moveRule(index: number, direction: 'up' | 'down') {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === rules.length - 1) return
    
    const newRules = [...rules]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    ;[newRules[index], newRules[targetIndex]] = [newRules[targetIndex], newRules[index]]
    setRules(newRules)
  }

  async function handleSave() {
    try {
      if (!viewUuid) {
        alert("This view is not linked to a valid view ID, so grouping can't be saved.")
        return
      }
      
      const groupByRulesValue = rules.length > 0 ? rules : null
      // For backward compatibility, also set group_by_field to the first rule's field
      const groupByFieldValue = rules.length > 0 && rules[0].type === 'field' ? rules[0].field : null
      
      // Check if settings exist
      const { data: existing } = await supabase
        .from("grid_view_settings")
        .select("id")
        .eq("view_id", viewUuid)
        .maybeSingle()

      const updateData: any = {
        group_by_rules: groupByRulesValue,
        group_by_field: groupByFieldValue, // Keep for backward compatibility
      }

      if (existing) {
        // Update existing settings
        await supabase
          .from("grid_view_settings")
          .update(updateData)
          .eq("view_id", viewUuid)
      } else {
        // Create new settings
        await supabase
          .from("grid_view_settings")
          .insert([
            {
              view_id: viewUuid,
              ...updateData,
              column_widths: {},
              column_order: [],
              column_wrap_text: {},
              row_height: 'medium',
              frozen_columns: 0,
            },
          ])
      }

      // Call callbacks for backward compatibility
      onGroupChange?.(groupByFieldValue)
      onGroupRulesChange?.(groupByRulesValue)
      onClose()
    } catch (error) {
      console.error("Error saving group:", error)
      alert("Failed to save group setting")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Group Records</DialogTitle>
          <DialogDescription>
            Add up to 2 grouping levels to create nested groups (like Airtable). Records will be grouped hierarchically by the selected fields.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {rules.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No grouping rules added yet.</p>
              <p className="text-sm mt-2">Click &quot;Add Grouping Rule&quot; to start grouping your records.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule, index) => (
                <div key={index} className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2 flex-1">
                    <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                    <span className="text-sm font-medium text-gray-600 w-8">
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

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={addRule}
              className="flex items-center gap-2"
              disabled={groupableFields.length === 0 || rules.length >= 2}
            >
              <Plus className="h-4 w-4" />
              Add Grouping Rule
            </Button>
            {rules.length >= 2 && (
              <p className="text-xs text-gray-500 flex items-center">
                Maximum 2 grouping levels (like Airtable)
              </p>
            )}
          </div>

          {rules.length > 0 && (
            <div className="text-xs text-gray-500 pt-2 border-t">
              <p>Groups will be nested in the order shown above. Each level creates a sub-group within the previous level.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Apply Grouping
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
