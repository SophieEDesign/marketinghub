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
import { Grid, Columns, Calendar, Image as ImageIcon, GitBranch } from "lucide-react"
import type { BlockConfig, ViewType } from "@/lib/interface/types"
import type { Table, View, TableField } from "@/types/database"
import type { FieldType } from "@/types/fields"
import { createClient } from "@/lib/supabase/client"

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

const VIEW_TYPE_OPTIONS: ViewTypeOption[] = [
  {
    type: 'grid',
    label: 'Grid',
    icon: Grid,
    description: 'Spreadsheet-style table view',
    requiredFields: [],
  },
  {
    type: 'kanban',
    label: 'Kanban',
    icon: Columns,
    description: 'Board view with columns',
    requiredFields: [], // Needs a grouping field but not required at config time
  },
  {
    type: 'calendar',
    label: 'Calendar',
    icon: Calendar,
    description: 'Month/week calendar view',
    requiredFields: ['date'] as FieldType[],
  },
  {
    type: 'gallery',
    label: 'Gallery',
    icon: ImageIcon,
    description: 'Card-based visual layout',
    requiredFields: [],
  },
  {
    type: 'timeline',
    label: 'Timeline',
    icon: GitBranch,
    description: 'Chronological timeline view',
    requiredFields: ['date'] as FieldType[],
  },
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
        {compatibleTypes.length < VIEW_TYPE_OPTIONS.length && (
          <p className="text-xs text-gray-500">
            Some view types require date fields. Add date fields to enable them.
          </p>
        )}
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

      {/* Filters (optional) */}
      {config.table_id && fields.length > 0 && (
        <div className="space-y-2">
          <Label>Filters (optional)</Label>
          <p className="text-xs text-gray-500">
            Configure filters in the grid view after adding the block.
          </p>
        </div>
      )}

      {/* Sorts (optional) */}
      {config.table_id && fields.length > 0 && (
        <div className="space-y-2">
          <Label>Sorts (optional)</Label>
          <p className="text-xs text-gray-500">
            Configure sorting in the grid view after adding the block.
          </p>
        </div>
      )}

      {/* Group By (for Kanban) */}
      {currentViewType === 'kanban' && config.table_id && (
        <div className="space-y-2">
          <Label>Group By Field</Label>
          <Select
            value={config.group_by || "__none__"}
            onValueChange={(value) => onUpdate({ group_by: value === "__none__" ? undefined : value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a field" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
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
  )
}

