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
  const numericFields = fields.filter(f => 
    ['number', 'currency', 'percent', 'rating'].includes(f.type)
  )

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

      {/* Chart Type */}
      <div className="space-y-2">
        <Label>Chart Type *</Label>
        <Select
          value={config.chart_type || "bar"}
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

      {/* Group By */}
      <div className="space-y-2">
        <Label>Group By</Label>
        <Select
          value={config.group_by_field || "__none__"}
          onValueChange={(value) => onUpdate({ group_by_field: value === "__none__" ? undefined : value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="No grouping" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No grouping</SelectItem>
            {fields.map((field) => (
              <SelectItem key={field.id} value={field.name}>
                {field.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* X-Axis */}
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

      {/* Metric Field */}
      <div className="space-y-2">
        <Label>Metric Field *</Label>
        <Select
          value={config.metric_field || config.chart_y_axis || ""}
          onValueChange={(value) => onUpdate({ metric_field: value, chart_y_axis: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select numeric field" />
          </SelectTrigger>
          <SelectContent>
            {numericFields.map((field) => (
              <SelectItem key={field.id} value={field.name}>
                {field.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Time Field (for time series) */}
      {config.chart_type === "line" && (
        <div className="space-y-2">
          <Label>Time Field</Label>
          <Select
            value={config.time_field || "__none__"}
            onValueChange={(value) => onUpdate({ time_field: value === "__none__" ? undefined : value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="No time field" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No time field</SelectItem>
              {fields.filter(f => f.type === 'date').map((field) => (
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
        <Label>Sort By</Label>
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
        <Label>Row Limit</Label>
        <Input
          type="number"
          min="1"
          max="1000"
          value={config.row_limit || 100}
          onChange={(e) => onUpdate({ row_limit: parseInt(e.target.value) || 100 })}
        />
        <p className="text-xs text-gray-500">
          Maximum number of data points to display
        </p>
      </div>
    </div>
  )
}

