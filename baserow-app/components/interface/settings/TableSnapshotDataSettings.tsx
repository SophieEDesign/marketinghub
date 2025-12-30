"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { BlockConfig } from "@/lib/interface/types"
import type { Table, View } from "@/types/database"

interface TableSnapshotDataSettingsProps {
  config: BlockConfig
  tables: Table[]
  views: View[]
  fields: any[]
  onUpdate: (updates: Partial<BlockConfig>) => void
  onTableChange: (tableId: string) => Promise<void>
}

export default function TableSnapshotDataSettings({
  config,
  tables,
  views,
  onUpdate,
  onTableChange,
}: TableSnapshotDataSettingsProps) {
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

      {/* Saved View (required) */}
      {config.table_id && (
        <div className="space-y-2">
          <Label>Saved View *</Label>
          <Select
            value={config.view_id || ""}
            onValueChange={(value) => onUpdate({ view_id: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a view" />
            </SelectTrigger>
            <SelectContent>
              {views.filter(v => v.table_id === config.table_id).map((view) => (
                <SelectItem key={view.id} value={view.id}>
                  {view.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">
            Select a saved view to display
          </p>
        </div>
      )}

      {/* Row Limit */}
      <div className="space-y-2">
        <Label>Row Limit</Label>
        <Input
          type="number"
          min="1"
          max="100"
          value={config.row_limit || 10}
          onChange={(e) => onUpdate({ row_limit: parseInt(e.target.value) || 10 })}
        />
        <p className="text-xs text-gray-500">
          Maximum number of rows to display
        </p>
      </div>
    </div>
  )
}

