"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import type { BlockConfig } from "@/lib/interface/types"
import type { Table, View, TableField } from "@/types/database"
import BlockFilterEditor from "./BlockFilterEditor"

interface ChartDataSettingsProps {
  config: BlockConfig
  tables: Table[]
  views: View[]
  fields: TableField[]
  onUpdate: (updates: Partial<BlockConfig>) => void
  onTableChange: (tableId: string) => Promise<void>
}

export default function ChartDataSettings({
  config,
  tables,
  views,
  fields,
  onUpdate,
  onTableChange,
}: ChartDataSettingsProps) {
  // Numeric fields for metric aggregation
  const numericFields = fields.filter(f => 
    ['number', 'currency', 'percent', 'rating'].includes(f.type)
  )
  
  // Fields suitable for grouping (select, multi-select, date, linked)
  const groupByFields = fields.filter(f => 
    ['single_select', 'multi_select', 'date', 'link_row'].includes(f.type)
  )

  const metricType = config.chart_aggregate || "count"
  const metricField = config.metric_field
  const groupBy = config.group_by_field
  const chartType = config.chart_type || "bar"

  // Determine if X-Axis field should be shown
  // Hide X-Axis when Group By is selected (X-axis is inferred from Group By)
  // Note: Count charts may still need an X-axis (e.g. count by date/status), so don't hide it just because metricType is count.
  const showXAxis = !groupBy && chartType !== "pie"

  // Clear metric field when switching to count
  const handleMetricTypeChange = (value: string) => {
    const updates: Partial<BlockConfig> = { chart_aggregate: value as any }
    if (value === "count") {
      // Clear metric field when switching to count
      updates.metric_field = undefined
      updates.chart_y_axis = undefined
    }
    onUpdate(updates)
  }

  return (
    <div className="space-y-4">
      {/* Table */}
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

      {/* View (optional) */}
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

      {/* Metric Type */}
      <div className="space-y-2">
        <Label>Metric Type *</Label>
        <Select
          value={metricType}
          onValueChange={handleMetricTypeChange}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="count">Count records</SelectItem>
            <SelectItem value="sum">Sum of field</SelectItem>
            <SelectItem value="avg">Average of field</SelectItem>
            <SelectItem value="min">Minimum of field</SelectItem>
            <SelectItem value="max">Maximum of field</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">
          Choose how you want to measure your data
        </p>
      </div>

      {/* Metric Field (required for non-count metrics) */}
      {metricType !== "count" && (
        <div className="space-y-2">
          <Label>Field *</Label>
          {config.table_id && numericFields.length === 0 ? (
            <div className="text-sm text-gray-500 p-2 border border-gray-200 rounded-md bg-gray-50">
              No numeric fields found in this table. Add a number, currency, percent, or rating field.
            </div>
          ) : (
            <Select
              value={metricField || ""}
              onValueChange={(value) => onUpdate({ 
                metric_field: value, 
                chart_y_axis: value 
              })}
              disabled={!config.table_id || numericFields.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={config.table_id ? "Select a numeric field" : "Select a table first"} />
              </SelectTrigger>
              <SelectContent>
                {numericFields.map((field) => (
                  <SelectItem key={field.id} value={field.name}>
                    {field.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Group By */}
      <div className="space-y-2">
        <Label>Group By (optional)</Label>
        <Select
          value={groupBy || "__none__"}
          onValueChange={(value) => {
            const updates: Partial<BlockConfig> = { 
              group_by_field: value === "__none__" ? undefined : value 
            }
            // Clear X-axis when Group By is selected (X-axis is inferred from Group By)
            if (value !== "__none__") {
              updates.chart_x_axis = undefined
            }
            onUpdate(updates)
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="No grouping" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No grouping</SelectItem>
            {groupByFields.map((field) => (
              <SelectItem key={field.id} value={field.name}>
                {field.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">
          Group data by category (e.g., count by status, count by month)
        </p>
      </div>

      {/* Chart Type */}
      <div className="space-y-2">
        <Label>Chart Type *</Label>
        <Select
          value={chartType}
          onValueChange={(value) => onUpdate({ chart_type: value as any })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bar">Bar</SelectItem>
            <SelectItem value="line">Line</SelectItem>
            <SelectItem value="pie">Pie</SelectItem>
            <SelectItem value="stacked_bar">Stacked Bar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* X-Axis Field (conditional - only show when needed) */}
      {showXAxis && (
        <div className="space-y-2">
          <Label>X-Axis Field *</Label>
          <Select
            value={config.chart_x_axis || ""}
            onValueChange={(value) => onUpdate({ chart_x_axis: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select field" />
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

      {/* Sort */}
      <div className="space-y-2">
        <Label>Sort By (optional)</Label>
        <Select
          value={config.sort_field || "__none__"}
          onValueChange={(value) => onUpdate({ sort_field: value === "__none__" ? undefined : value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="No sorting" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No sorting</SelectItem>
            {fields.map((field) => (
              <SelectItem key={field.id} value={field.name}>
                {field.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Limit */}
      <div className="space-y-2">
        <Label>Row Limit (optional)</Label>
        <Input
          type="number"
          min="1"
          max="1000"
          value={config.row_limit || 100}
          onChange={(e) => onUpdate({ row_limit: parseInt(e.target.value) || 100 })}
        />
        <p className="text-xs text-gray-500">
          Maximum number of data points to display (default: 100)
        </p>
      </div>

      {/* Filters */}
      {config.table_id && (
        <div className="space-y-2 border-t pt-4">
          <BlockFilterEditor
            filters={config.filters || []}
            tableFields={fields}
            onChange={(filters) => onUpdate({ filters })}
          />
        </div>
      )}
    </div>
  )
}

