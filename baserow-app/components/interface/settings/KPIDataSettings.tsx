"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { BlockConfig } from "@/lib/interface/types"
import type { Table, View, TableField } from "@/types/database"
import BlockFilterEditor from "./BlockFilterEditor"
import TableSelector from "./shared/TableSelector"
import ViewSelector from "./shared/ViewSelector"

interface KPIDataSettingsProps {
  config: BlockConfig
  tables: Table[]
  views: View[]
  fields: TableField[]
  onUpdate: (updates: Partial<BlockConfig>) => void
  onTableChange: (tableId: string) => Promise<void>
}

export default function KPIDataSettings({
  config,
  tables,
  views,
  fields,
  onUpdate,
  onTableChange,
}: KPIDataSettingsProps) {
  const [showComparison, setShowComparison] = useState(!!config.comparison)
  const [showTarget, setShowTarget] = useState(config.target_value !== undefined)

  // Include numeric field types and formula fields (formulas can return numbers)
  const numericFields = fields.filter(f => 
    ['number', 'currency', 'percent'].includes(f.type) || f.type === 'formula'
  )

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

      {/* Metric */}
      <div className="space-y-2">
        <Label>Metric *</Label>
        <Select
          value={config.kpi_aggregate || "count"}
          onValueChange={(value) => onUpdate({ kpi_aggregate: value as any })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="count">Count</SelectItem>
            <SelectItem value="sum">Sum</SelectItem>
            <SelectItem value="avg">Average</SelectItem>
            <SelectItem value="min">Minimum</SelectItem>
            <SelectItem value="max">Maximum</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Field (required for non-count metrics) */}
      {config.kpi_aggregate !== "count" && (
        <div className="space-y-2">
          <Label>Field *</Label>
          <Select
            value={config.kpi_field || ""}
            onValueChange={(value) => onUpdate({ kpi_field: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a numeric field" />
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
      )}

      {/* Label */}
      <div className="space-y-2">
        <Label>Label</Label>
        <Input
          value={config.kpi_label || ""}
          onChange={(e) => onUpdate({ kpi_label: e.target.value })}
          placeholder="KPI label"
        />
      </div>

      {/* Comparison */}
      <div className="space-y-2 border-t pt-4">
        <div className="flex items-center justify-between">
          <Label>Comparison</Label>
          <Switch
            checked={showComparison}
            onCheckedChange={(checked) => {
              setShowComparison(checked)
              if (!checked) {
                onUpdate({ comparison: undefined })
              } else {
                onUpdate({
                  comparison: {
                    date_field: "",
                    current_start: "",
                    current_end: "",
                    previous_start: "",
                    previous_end: "",
                  }
                })
              }
            }}
          />
        </div>
        {showComparison && config.comparison && (
          <div className="space-y-3 mt-3 pl-4 border-l-2">
            <div className="space-y-2">
              <Label>Date Field</Label>
              <Select
                value={config.comparison.date_field || ""}
                onValueChange={(value) => onUpdate({
                  comparison: { ...config.comparison!, date_field: value }
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select date field" />
                </SelectTrigger>
                <SelectContent>
                  {fields.filter(f => f.type === 'date').map((field) => (
                    <SelectItem key={field.id} value={field.name}>
                      {field.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label className="text-xs">Current Start</Label>
                <Input
                  type="date"
                  value={config.comparison.current_start || ""}
                  onChange={(e) => onUpdate({
                    comparison: { ...config.comparison!, current_start: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Current End</Label>
                <Input
                  type="date"
                  value={config.comparison.current_end || ""}
                  onChange={(e) => onUpdate({
                    comparison: { ...config.comparison!, current_end: e.target.value }
                  })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label className="text-xs">Previous Start</Label>
                <Input
                  type="date"
                  value={config.comparison.previous_start || ""}
                  onChange={(e) => onUpdate({
                    comparison: { ...config.comparison!, previous_start: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Previous End</Label>
                <Input
                  type="date"
                  value={config.comparison.previous_end || ""}
                  onChange={(e) => onUpdate({
                    comparison: { ...config.comparison!, previous_end: e.target.value }
                  })}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Target */}
      <div className="space-y-2 border-t pt-4">
        <div className="flex items-center justify-between">
          <Label>Target Value</Label>
          <Switch
            checked={showTarget}
            onCheckedChange={(checked) => {
              setShowTarget(checked)
              if (!checked) {
                onUpdate({ target_value: undefined })
              }
            }}
          />
        </div>
        {showTarget && (
          <Input
            type="number"
            value={config.target_value || ""}
            onChange={(e) => onUpdate({ target_value: parseFloat(e.target.value) || undefined })}
            placeholder="Target value"
            className="mt-2"
          />
        )}
      </div>

      {/* Filters */}
      {config.table_id && (
        <div className="space-y-2 border-t pt-4">
          <BlockFilterEditor
            filters={config.filters || []}
            tableFields={fields}
            config={config}
            onChange={(filters) => onUpdate({ filters })}
            onConfigUpdate={(updates) => onUpdate(updates)}
          />
        </div>
      )}

      {/* Click-through */}
      {config.table_id && (
        <div className="space-y-2 border-t pt-4">
          <Label>Click-through View (optional)</Label>
          <Select
            value={config.click_through?.view_id || "__none__"}
            onValueChange={(value) => onUpdate({
              click_through: value === "__none__" ? undefined : { view_id: value }
            })}
          >
            <SelectTrigger>
              <SelectValue placeholder="No click-through" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No click-through</SelectItem>
              {views.map((view) => (
                <SelectItem key={view.id} value={view.id}>
                  {view.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}

