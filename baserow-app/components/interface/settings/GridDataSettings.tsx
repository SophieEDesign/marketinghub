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

// Only show Grid and Calendar - others are not yet functional
const VIEW_TYPE_OPTIONS: ViewTypeOption[] = [
  {
    type: 'grid',
    label: 'Grid',
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
  // TODO: Kanban, Timeline, Gallery - not yet implemented
  // {
  //   type: 'kanban',
  //   label: 'Kanban',
  //   icon: Columns,
  //   description: 'Board view with columns',
  //   requiredFields: [],
  // },
  // {
  //   type: 'gallery',
  //   label: 'Gallery',
  //   icon: ImageIcon,
  //   description: 'Card-based visual layout',
  //   requiredFields: [],
  // },
  // {
  //   type: 'timeline',
  //   label: 'Timeline',
  //   icon: GitBranch,
  //   description: 'Chronological timeline view',
  //   requiredFields: ['date'] as FieldType[],
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
          Grid blocks require a table connection. Select a table to configure visible fields.
        </p>
      </div>

      {/* View Selection (optional) */}
      {config.table_id && views.length > 0 && (
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
          Grid is fully supported. Calendar support is in progress.
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
            Select which fields to display in the grid. At least one field must be selected.
          </p>
        </div>
      )}

      {/* Filters (optional) - Only for Grid view */}
      {currentViewType === 'grid' && config.table_id && fields.length > 0 && (
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
                  <SelectTrigger className="h-8 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equal">Equals</SelectItem>
                    <SelectItem value="contains">Contains</SelectItem>
                  </SelectContent>
                </Select>
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
            Filter rows by field values. Supports equals and contains operators.
          </p>
        </div>
      )}

      {/* Sorts (optional) - Only for Grid view */}
      {currentViewType === 'grid' && config.table_id && fields.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Sort (optional)</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const currentSorts = config.sorts || []
                // Only allow one sort for now
                if (currentSorts.length === 0) {
                  onUpdate({
                    sorts: [{ field: fields[0]?.name || '', direction: 'asc' }]
                  })
                }
              }}
              disabled={(config.sorts || []).length > 0}
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Sort
            </Button>
          </div>
          <div className="space-y-2">
            {(config.sorts || []).slice(0, 1).map((sort: any, index: number) => (
              <div key={index} className="flex gap-2 items-center p-2 border rounded-md">
                <Select
                  value={sort.field || ''}
                  onValueChange={(value) => {
                    const currentSorts = config.sorts || []
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
                    const currentSorts = config.sorts || []
                    const updated = [...currentSorts]
                    updated[index] = { ...updated[index], direction: value }
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
            {(!config.sorts || config.sorts.length === 0) && (
              <p className="text-xs text-gray-400 italic">No sort configured</p>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Sort rows by a single field in ascending or descending order.
          </p>
        </div>
      )}

      {/* Date Field (for Calendar) */}
      {currentViewType === 'calendar' && config.table_id && fields.length > 0 && (
        <div className="space-y-2">
          <Label>Date Field *</Label>
          <Select
            value={config.calendar_date_field || config.start_date_field || ""}
            onValueChange={(value) => onUpdate({ calendar_date_field: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a date field" />
            </SelectTrigger>
            <SelectContent>
              {fields
                .filter(field => field.type === 'date' || field.type === 'datetime' || field.type === 'timestamp')
                .map((field) => (
                  <SelectItem key={field.id} value={field.name}>
                    {field.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {fields.filter(f => f.type === 'date' || f.type === 'datetime' || f.type === 'timestamp').length === 0 && (
            <p className="text-xs text-amber-600">
              No date fields found. Please add a date field to the table.
            </p>
          )}
          <p className="text-xs text-gray-500">
            Select the date field to display events on the calendar.
          </p>
        </div>
      )}
    </div>
  )
}

