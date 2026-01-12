"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Grid, Columns, Calendar, Image as ImageIcon, GitBranch, X, Plus } from "lucide-react"
import type { BlockConfig, ViewType, BlockFilter } from "@/lib/interface/types"
import type { Table, View, TableField } from "@/types/database"
import type { FieldType } from "@/types/fields"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface GridDataSettingsProps {
  config: BlockConfig
  tables: Table[]
  views: View[]
  fields: TableField[]
  onUpdate: (updates: Partial<BlockConfig>) => void
  onTableChange: (tableId: string) => Promise<void>
}

interface ViewTypeOption {
  type: ViewType
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  requiredFields: FieldType[] // Field types required for this view
}

// Show Table, Calendar, Kanban, and Timeline view types
const VIEW_TYPE_OPTIONS: ViewTypeOption[] = [
  {
    type: 'grid',
    label: 'Table',
    icon: Grid,
    description: 'Spreadsheet-style table view',
    requiredFields: [],
  },
  {
    type: 'calendar',
    label: 'Calendar',
    icon: Calendar,
    description: 'Month/week calendar view',
    requiredFields: ['date'] as FieldType[],
  },
  {
    type: 'kanban',
    label: 'Kanban',
    icon: Columns,
    description: 'Board view with columns',
    requiredFields: [],
  },
  {
    type: 'timeline',
    label: 'Timeline',
    icon: GitBranch,
    description: 'Chronological timeline view',
    requiredFields: ['date'] as FieldType[],
  },
  // TODO: Gallery - not yet implemented
  // {
  //   type: 'gallery',
  //   label: 'Gallery',
  //   icon: ImageIcon,
  //   description: 'Card-based visual layout',
  //   requiredFields: [],
  // },
]

export default function GridDataSettings({
  config,
  tables,
  views,
  fields,
  onUpdate,
  onTableChange,
}: GridDataSettingsProps) {
  // Removed SQL view loading - users select tables, not SQL views
  // SQL views are internal and must never be selected by users

  // Determine compatible view types based on available fields
  const getCompatibleViewTypes = (): ViewType[] => {
    const fieldTypes = new Set<FieldType>(fields.map(f => f.type as FieldType))
    
    return VIEW_TYPE_OPTIONS.filter(option => {
      if (option.requiredFields.length === 0) return true
      return option.requiredFields.some(type => fieldTypes.has(type as FieldType))
    }).map(option => option.type)
  }

  const compatibleTypes = getCompatibleViewTypes()
  const currentViewType: ViewType = config?.view_type || 'grid'

  return (
    <div className="space-y-4">
      {/* Table Selection - Users select tables, not SQL views */}
      <div className="space-y-2">
        <Label>Table *</Label>
        <Select
          value={config.table_id || ""}
          onValueChange={onTableChange}
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
          Table blocks require a table connection. Select a table to configure visible fields.
        </p>
      </div>

      {/* View Selection (optional) - Only for Table view, not Calendar */}
      {currentViewType === 'grid' && config.table_id && views.length > 0 && (
        <div className="space-y-2">
          <Label>View (optional)</Label>
          <Select
            value={config.view_id || "__all__"}
            onValueChange={(value) => onUpdate({ view_id: value === "__all__" ? undefined : value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All records" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All records</SelectItem>
              {views.map((view) => (
                <SelectItem key={view.id} value={view.id}>
                  {view.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* View Type Selection - Card Style */}
      <div className="space-y-2">
        <Label>View Type *</Label>
        <div className="grid grid-cols-2 gap-2">
          {VIEW_TYPE_OPTIONS.map((option) => {
            const Icon = option.icon
            const isCompatible = compatibleTypes.includes(option.type)
            const isSelected = currentViewType === option.type

            return (
              <button
                key={option.type}
                type="button"
                onClick={() => isCompatible && onUpdate({ view_type: option.type })}
                disabled={!isCompatible}
                className={`
                  p-3 border rounded-lg text-left transition-all
                  ${isSelected 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                  }
                  ${!isCompatible 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'cursor-pointer hover:bg-gray-50'
                  }
                `}
              >
                <div className="flex items-start gap-2">
                  <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{option.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {option.description}
                    </div>
                    {!isCompatible && (
                      <div className="text-xs text-amber-600 mt-1">
                        Requires date fields
                      </div>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
        <p className="text-xs text-gray-500">
          Table, Calendar, Kanban, and Timeline views are supported.
        </p>
      </div>

      {/* Visible Fields - Required */}
      {config.table_id && fields.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Visible Fields *</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  // Select all fields
                  const allFieldNames = fields.map(f => f.name)
                  onUpdate({ visible_fields: allFieldNames })
                }}
                className="text-xs text-blue-600 hover:text-blue-700 underline"
              >
                Select All
              </button>
              <span className="text-xs text-gray-300">|</span>
              <button
                type="button"
                onClick={() => {
                  // Select none
                  onUpdate({ visible_fields: [] })
                }}
                className="text-xs text-blue-600 hover:text-blue-700 underline"
              >
                Select None
              </button>
            </div>
          </div>
          <div className="border rounded-md p-3 max-h-[200px] overflow-y-auto space-y-2">
            {fields.map((field) => {
              const visibleFields = config.visible_fields || []
              const isVisible = visibleFields.includes(field.name) || visibleFields.includes(field.id)
              return (
                <label
                  key={field.id}
                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                >
                  <Checkbox
                    checked={isVisible}
                    onCheckedChange={(checked) => {
                      const currentFields = config.visible_fields || []
                      if (checked) {
                        // Add field if not already present
                        if (!currentFields.includes(field.name) && !currentFields.includes(field.id)) {
                          onUpdate({ visible_fields: [...currentFields, field.name] })
                        }
                      } else {
                        // Remove field
                        onUpdate({
                          visible_fields: currentFields.filter(
                            (f: string) => f !== field.name && f !== field.id
                          ),
                        })
                      }
                    }}
                  />
                  <span className="text-sm">{field.name}</span>
                  <span className="text-xs text-gray-400 ml-auto">{field.type}</span>
                </label>
              )
            })}
          </div>
          <p className="text-xs text-gray-500">
            Select which fields to display in the table. At least one field must be selected.
          </p>
        </div>
      )}

      {/* Filters (optional) - For Table, Calendar, Kanban, and Timeline views */}
      {(currentViewType === 'grid' || currentViewType === 'calendar' || currentViewType === 'kanban' || currentViewType === 'timeline') && config.table_id && fields.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Filters (optional)</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const currentFilters = config.filters || []
                onUpdate({
                  filters: [
                    ...currentFilters,
                    { field: fields[0]?.name || '', operator: 'equal', value: '' }
                  ]
                })
              }}
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Filter
            </Button>
          </div>
          <div className="space-y-2">
            {(config.filters || []).map((filter: any, index: number) => (
              <div key={index} className="flex gap-2 items-start p-2 border rounded-md">
                <Select
                  value={filter.field || ''}
                  onValueChange={(value) => {
                    const currentFilters = config.filters || []
                    const updated = [...currentFilters]
                    updated[index] = { ...updated[index], field: value }
                    onUpdate({ filters: updated })
                  }}
                >
                  <SelectTrigger className="h-8 flex-1">
                    <SelectValue placeholder="Field" />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map((field) => (
                      <SelectItem key={field.id} value={field.name}>
                        {field.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={filter.operator || 'equal'}
                  onValueChange={(value) => {
                    const currentFilters = config.filters || []
                    const updated = [...currentFilters]
                    // Type assertion: value is guaranteed to be one of the valid operators from SelectItem
                    updated[index] = { ...updated[index], operator: value as BlockFilter['operator'] }
                    onUpdate({ filters: updated })
                  }}
                >
                  <SelectTrigger className="h-8 w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equal">Equals</SelectItem>
                    <SelectItem value="not_equal">Not equals</SelectItem>
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="greater_than">Greater than</SelectItem>
                    <SelectItem value="less_than">Less than</SelectItem>
                    <SelectItem value="is_empty">Is empty</SelectItem>
                    <SelectItem value="is_not_empty">Is not empty</SelectItem>
                  </SelectContent>
                </Select>
                {filter.operator !== 'is_empty' && filter.operator !== 'is_not_empty' && (() => {
                  // Find the selected field
                  const selectedField = fields.find(f => f.name === filter.field)
                  const fieldType = selectedField?.type
                  
                  // For single_select or multi_select fields, show dropdown with choices
                  if (fieldType === 'single_select' || fieldType === 'multi_select') {
                    const choices = selectedField?.options?.choices || []
                    return (
                      <Select
                        value={filter.value || ''}
                        onValueChange={(value) => {
                          const currentFilters = config.filters || []
                          const updated = [...currentFilters]
                          updated[index] = { ...updated[index], value }
                          onUpdate({ filters: updated })
                        }}
                      >
                        <SelectTrigger className="h-8 flex-1">
                          <SelectValue placeholder="Select value" />
                        </SelectTrigger>
                        <SelectContent>
                          {choices.length > 0 ? (
                            choices.map((choice: string) => (
                              <SelectItem key={choice} value={choice}>
                                {choice}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="px-2 py-1.5 text-sm text-gray-500">No options available</div>
                          )}
                        </SelectContent>
                      </Select>
                    )
                  }
                  
                  // For date fields, show date input with quick options
                  if (fieldType === 'date') {
                    const getDateValue = (option: string): string => {
                      const today = new Date()
                      today.setHours(0, 0, 0, 0)
                      
                      switch (option) {
                        case 'today':
                          return today.toISOString().split('T')[0]
                        case 'tomorrow':
                          const tomorrow = new Date(today)
                          tomorrow.setDate(tomorrow.getDate() + 1)
                          return tomorrow.toISOString().split('T')[0]
                        case 'yesterday':
                          const yesterday = new Date(today)
                          yesterday.setDate(yesterday.getDate() - 1)
                          return yesterday.toISOString().split('T')[0]
                        case 'this_week_start':
                          const weekStart = new Date(today)
                          weekStart.setDate(today.getDate() - today.getDay())
                          return weekStart.toISOString().split('T')[0]
                        case 'this_week_end':
                          const weekEnd = new Date(today)
                          weekEnd.setDate(today.getDate() - today.getDay() + 6)
                          return weekEnd.toISOString().split('T')[0]
                        case 'this_month_start':
                          return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
                        case 'this_month_end':
                          return new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]
                        default:
                          return option
                      }
                    }
                    
                    return (
                      <div className="flex gap-2 flex-1">
                        <Input
                          type="date"
                          value={filter.value || ''}
                          onChange={(e) => {
                            const currentFilters = config.filters || []
                            const updated = [...currentFilters]
                            updated[index] = { ...updated[index], value: e.target.value }
                            onUpdate({ filters: updated })
                          }}
                          className="h-8 flex-1"
                        />
                        <Select
                          value=""
                          onValueChange={(value) => {
                            if (value) {
                              const dateValue = getDateValue(value)
                              const currentFilters = config.filters || []
                              const updated = [...currentFilters]
                              updated[index] = { ...updated[index], value: dateValue }
                              onUpdate({ filters: updated })
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 w-32">
                            <SelectValue placeholder="Quick..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="today">Today</SelectItem>
                            <SelectItem value="tomorrow">Tomorrow</SelectItem>
                            <SelectItem value="yesterday">Yesterday</SelectItem>
                            <SelectItem value="this_week_start">This week start</SelectItem>
                            <SelectItem value="this_week_end">This week end</SelectItem>
                            <SelectItem value="this_month_start">This month start</SelectItem>
                            <SelectItem value="this_month_end">This month end</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )
                  }
                  
                  // For other field types, show regular text input
                  return (
                    <Input
                      value={filter.value || ''}
                      onChange={(e) => {
                        const currentFilters = config.filters || []
                        const updated = [...currentFilters]
                        updated[index] = { ...updated[index], value: e.target.value }
                        onUpdate({ filters: updated })
                      }}
                      placeholder="Value"
                      className="h-8 flex-1"
                    />
                  )
                })()}
                {(filter.operator === 'is_empty' || filter.operator === 'is_not_empty') && (
                  <div className="h-8 flex-1 flex items-center text-xs text-gray-500 px-2">
                    No value needed
                  </div>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const currentFilters = config.filters || []
                    onUpdate({ filters: currentFilters.filter((_: any, i: number) => i !== index) })
                  }}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {(!config.filters || config.filters.length === 0) && (
              <p className="text-xs text-gray-400 italic">No filters configured</p>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Filter rows by field values. Supports equals, contains, comparison, and empty checks.
          </p>
        </div>
      )}

      {/* Sorts (optional) - Only for Table view */}
      {currentViewType === 'grid' && config.table_id && fields.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Sort (optional)</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const currentSorts = Array.isArray(config.sorts) ? config.sorts : []
                // Only allow one sort for now
                if (currentSorts.length === 0) {
                  onUpdate({
                    sorts: [{ field: fields[0]?.name || '', direction: 'asc' }]
                  })
                }
              }}
              disabled={(Array.isArray(config.sorts) ? config.sorts : []).length > 0}
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Sort
            </Button>
          </div>
          <div className="space-y-2">
            {(Array.isArray(config.sorts) ? config.sorts : []).slice(0, 1).map((sort: any, index: number) => (
              <div key={index} className="flex gap-2 items-center p-2 border rounded-md">
                <Select
                  value={sort.field || ''}
                  onValueChange={(value) => {
                    const currentSorts = Array.isArray(config.sorts) ? config.sorts : []
                    const updated = [...currentSorts]
                    updated[index] = { ...updated[index], field: value }
                    onUpdate({ sorts: updated })
                  }}
                >
                  <SelectTrigger className="h-8 flex-1">
                    <SelectValue placeholder="Field" />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map((field) => (
                      <SelectItem key={field.id} value={field.name}>
                        {field.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={sort.direction || 'asc'}
                  onValueChange={(value) => {
                    const currentSorts = Array.isArray(config.sorts) ? config.sorts : []
                    const updated = [...currentSorts]
                    updated[index] = { ...updated[index], direction: value as 'asc' | 'desc' }
                    onUpdate({ sorts: updated })
                  }}
                >
                  <SelectTrigger className="h-8 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Ascending</SelectItem>
                    <SelectItem value="desc">Descending</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onUpdate({ sorts: [] })
                  }}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {(!Array.isArray(config.sorts) || config.sorts.length === 0) && (
              <p className="text-xs text-gray-400 italic">No sort configured</p>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Sort rows by a single field in ascending or descending order.
          </p>
        </div>
      )}

      {/* Calendar-Specific Settings - Airtable Style */}
      {currentViewType === 'calendar' && config.table_id && fields.length > 0 && (
        <>
          {/* Options Section - Airtable Style */}
          <div className="space-y-3 pt-2 border-t border-gray-200">
            <Label className="text-sm font-semibold">Options</Label>
            
            {/* Date Settings */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">Date settings</Label>
              <Select
                value={config.start_date_field || config.calendar_date_field || config.from_date_field || ""}
                onValueChange={(value) => onUpdate({ start_date_field: value, from_date_field: value, calendar_date_field: value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select a date field" />
                </SelectTrigger>
                <SelectContent>
                  {fields
                    .filter(field => field.type === 'date')
                    .map((field) => (
                      <SelectItem key={field.id} value={field.name}>
                        {field.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {fields.filter(f => f.type === 'date').length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  No date fields found. Please add a date field to the table.
                </p>
              )}
            </div>

            {/* End Date Field (optional) */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">End date (optional)</Label>
              <Select
                value={config.end_date_field || config.to_date_field || "__none__"}
                onValueChange={(value) => onUpdate({ end_date_field: value === "__none__" ? undefined : value, to_date_field: value === "__none__" ? undefined : value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select end date field (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None (single date events)</SelectItem>
                  {fields
                    .filter(field => field.type === 'date')
                    .map((field) => (
                      <SelectItem key={field.id} value={field.name}>
                        {field.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">Sort</Label>
              <Select
                value={(Array.isArray(config.sorts) && config.sorts.length > 0) ? config.sorts[0].field + ':' + config.sorts[0].direction : "__none__"}
                onValueChange={(value) => {
                  if (value === "__none__") {
                    onUpdate({ sorts: [] })
                  } else {
                    const [field, direction] = value.split(':')
                    onUpdate({ sorts: [{ field, direction: direction as 'asc' | 'desc' }] })
                  }
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {fields.flatMap((field) => [
                  <SelectItem key={`${field.id}-asc`} value={`${field.name}:asc`}>
                    {field.name} (Ascending)
                  </SelectItem>,
                  <SelectItem key={`${field.id}-desc`} value={`${field.name}:desc`}>
                    {field.name} (Descending)
                  </SelectItem>
                ])}
              </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fields Section - Airtable Style */}
          <div className="space-y-3 pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Fields</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allFieldNames = fields.map(f => f.name)
                    onUpdate({ visible_fields: allFieldNames })
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 underline"
                >
                  Select All
                </button>
                <span className="text-xs text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => {
                    onUpdate({ visible_fields: [] })
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 underline"
                >
                  Select None
                </button>
              </div>
            </div>
            <div className="border rounded-md p-3 max-h-[200px] overflow-y-auto space-y-2 bg-gray-50">
              {fields.map((field) => {
                const visibleFields = config.visible_fields || []
                const isVisible = visibleFields.includes(field.name) || visibleFields.includes(field.id)
                return (
                  <label
                    key={field.id}
                    className="flex items-center gap-2 cursor-pointer hover:bg-white p-2 rounded transition-colors"
                  >
                    <Checkbox
                      checked={isVisible}
                      onCheckedChange={(checked) => {
                        const currentFields = config.visible_fields || []
                        if (checked) {
                          if (!currentFields.includes(field.name) && !currentFields.includes(field.id)) {
                            onUpdate({ visible_fields: [...currentFields, field.name] })
                          }
                        } else {
                          onUpdate({
                            visible_fields: currentFields.filter(
                              (f: string) => f !== field.name && f !== field.id
                            ),
                          })
                        }
                      }}
                    />
                    <span className="text-sm flex-1">{field.name}</span>
                    <span className="text-xs text-gray-400 capitalize">{field.type.replace('_', ' ')}</span>
                  </label>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Kanban-Specific Settings - Airtable Style */}
      {currentViewType === 'kanban' && config.table_id && fields.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-gray-200">
          <Label className="text-sm font-semibold">Options</Label>
          
          {/* Grouping Field Settings */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-700">Group by *</Label>
            <Select
              value={config.group_by_field || config.group_by || config.kanban_group_field || ""}
              onValueChange={(value) => onUpdate({ group_by_field: value, group_by: value, kanban_group_field: value })}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select a select field" />
              </SelectTrigger>
              <SelectContent>
                {fields
                  .filter(field => field.type === 'single_select' || field.type === 'multi_select')
                  .map((field) => (
                    <SelectItem key={field.id} value={field.name}>
                      {field.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {fields.filter(f => f.type === 'single_select' || f.type === 'multi_select').length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                No select fields found. Please add a single-select or multi-select field to the table.
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Select a single-select or multi-select field to group cards into columns.
            </p>
          </div>
        </div>
      )}

      {/* Timeline-Specific Settings - Airtable Style */}
      {currentViewType === 'timeline' && config.table_id && fields.length > 0 && (
        <>
          {/* Options Section - Airtable Style */}
          <div className="space-y-3 pt-2 border-t border-gray-200">
            <Label className="text-sm font-semibold">Options</Label>
            
            {/* Date Settings */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">Date settings</Label>
              <Select
                value={config.start_date_field || config.date_from || config.from_date_field || config.timeline_date_field || ""}
                onValueChange={(value) => onUpdate({ 
                  start_date_field: value, 
                  date_from: value, 
                  from_date_field: value,
                  timeline_date_field: value 
                })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select a date field" />
                </SelectTrigger>
                <SelectContent>
                  {fields
                    .filter(field => field.type === 'date')
                    .map((field) => (
                      <SelectItem key={field.id} value={field.name}>
                        {field.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {fields.filter(f => f.type === 'date').length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  No date fields found. Please add a date field to the table.
                </p>
              )}
            </div>

            {/* End Date Field (optional) */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">End date (optional)</Label>
              <Select
                value={config.end_date_field || config.date_to || config.to_date_field || "__none__"}
                onValueChange={(value) => onUpdate({ 
                  end_date_field: value === "__none__" ? undefined : value, 
                  date_to: value === "__none__" ? undefined : value,
                  to_date_field: value === "__none__" ? undefined : value 
                })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select end date field (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None (single date events)</SelectItem>
                  {fields
                    .filter(field => field.type === 'date')
                    .map((field) => (
                      <SelectItem key={field.id} value={field.name}>
                        {field.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Use start + end fields for date range events, or leave as "None" for single date events.
              </p>
            </div>
          </div>

          {/* Fields Section - Airtable Style */}
          <div className="space-y-3 pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Fields</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allFieldNames = fields.map(f => f.name)
                    onUpdate({ visible_fields: allFieldNames })
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 underline"
                >
                  Select All
                </button>
                <span className="text-xs text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => {
                    onUpdate({ visible_fields: [] })
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 underline"
                >
                  Select None
                </button>
              </div>
            </div>
            <div className="border rounded-md p-3 max-h-[200px] overflow-y-auto space-y-2 bg-gray-50">
              {fields.map((field) => {
                const visibleFields = config.visible_fields || []
                const isVisible = visibleFields.includes(field.name) || visibleFields.includes(field.id)
                return (
                  <label
                    key={field.id}
                    className="flex items-center gap-2 cursor-pointer hover:bg-white p-2 rounded transition-colors"
                  >
                    <Checkbox
                      checked={isVisible}
                      onCheckedChange={(checked) => {
                        const currentFields = config.visible_fields || []
                        if (checked) {
                          if (!currentFields.includes(field.name) && !currentFields.includes(field.id)) {
                            onUpdate({ visible_fields: [...currentFields, field.name] })
                          }
                        } else {
                          onUpdate({
                            visible_fields: currentFields.filter(
                              (f: string) => f !== field.name && f !== field.id
                            ),
                          })
                        }
                      }}
                    />
                    <span className="text-sm flex-1">{field.name}</span>
                    <span className="text-xs text-gray-400 capitalize">{field.type.replace('_', ' ')}</span>
                  </label>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

