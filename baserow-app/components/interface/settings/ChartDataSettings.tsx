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
import TableSelector from "./shared/TableSelector"
import ViewSelector from "./shared/ViewSelector"
import GroupBySelector from "./shared/GroupBySelector"
import SortSelector from "./shared/SortSelector"

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
      <TableSelector
        value={config.table_id || ""}
        onChange={onTableChange}
        tables={tables}
        required={true}
      />

      {/* View Selection (optional) */}
      {config.table_id && (
        <ViewSelector
          value={config.view_id}
          onChange={(viewId) => onUpdate({ view_id: viewId })}
          views={views}
          tableId={config.table_id}
        />
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
      {config.table_id && fields.length > 0 && (
        <GroupBySelector
          value={groupBy}
          onChange={(value) => {
            const updates: Partial<BlockConfig> = { 
              group_by_field: value
            }
            // Clear X-axis when Group By is selected (X-axis is inferred from Group By)
            if (value) {
              updates.chart_x_axis = undefined
            }
            onUpdate(updates)
          }}
          fields={fields}
          filterGroupableFields={false}
          description="Group data by category (e.g., count by status, count by month)"
        />
      )}

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
      <SortSelector
        value={config.sort_field}
        onChange={(value) => onUpdate({ sort_field: value as string | undefined })}
        fields={fields}
        mode="string"
        label="Sort By (optional)"
      />

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

