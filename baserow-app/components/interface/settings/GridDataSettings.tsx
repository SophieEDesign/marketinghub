"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
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
  const [sqlViews, setSqlViews] = useState<Array<{ name: string; schema: string }>>([])
  const [loadingSqlViews, setLoadingSqlViews] = useState(false)

  useEffect(() => {
    loadSqlViews()
  }, [])

  async function loadSqlViews() {
    setLoadingSqlViews(true)
    try {
      // Try to get available SQL views
      // Note: This requires a database function or we query information_schema
      // For now, we'll use a placeholder - in production this would query actual SQL views
      const response = await fetch('/api/sql-views')
      if (response.ok) {
        const data = await response.json()
        setSqlViews(data.views || [])
      }
    } catch (error) {
      console.error('Error loading SQL views:', error)
    } finally {
      setLoadingSqlViews(false)
    }
  }

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
      {/* Source Selection: SQL View or Table */}
      <div className="space-y-2">
        <Label>Data Source</Label>
        <Select
          value={config.source_type || 'table'}
          onValueChange={(value) => onUpdate({ source_type: value as 'table' | 'sql_view' })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="table">Table</SelectItem>
            <SelectItem value="sql_view">SQL View</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* SQL View Selection */}
      {config.source_type === 'sql_view' && (
        <div className="space-y-2">
          <Label>SQL View *</Label>
          {loadingSqlViews ? (
            <div className="text-sm text-gray-500">Loading SQL views...</div>
          ) : (
            <Select
              value={config.source_view || ""}
              onValueChange={(value) => onUpdate({ source_view: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a SQL view" />
              </SelectTrigger>
              <SelectContent>
                {sqlViews.length === 0 ? (
                  <SelectItem value="" disabled>
                    No SQL views available
                  </SelectItem>
                ) : (
                  sqlViews.map((view) => (
                    <SelectItem key={view.name} value={view.name}>
                      {view.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
          <p className="text-xs text-gray-500">
            SQL views contain pre-filtered and aggregated data
          </p>
        </div>
      )}

      {/* Table Selection (if not using SQL view) */}
      {config.source_type !== 'sql_view' && (
        <>
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
          </div>

          {/* View Selection (optional) */}
          {config.table_id && views.length > 0 && (
            <div className="space-y-2">
              <Label>View (optional)</Label>
              <Select
                value={config.view_id || ""}
                onValueChange={(value) => onUpdate({ view_id: value || undefined })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All records" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All records</SelectItem>
                  {views.map((view) => (
                    <SelectItem key={view.id} value={view.id}>
                      {view.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </>
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

      {/* Group By (for Kanban) */}
      {currentViewType === 'kanban' && config.table_id && (
        <div className="space-y-2">
          <Label>Group By Field</Label>
          <Select
            value={config.group_by || ""}
            onValueChange={(value) => onUpdate({ group_by: value || undefined })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a field" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
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

