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
import { Switch } from "@/components/ui/switch"
import type { BlockConfig } from "@/lib/interface/types"
import type { Table, View, TableField } from "@/types/database"
import TableSelector from "./shared/TableSelector"

interface RecordContextDataSettingsProps {
  config: BlockConfig
  tables: Table[]
  views: View[]
  fields: TableField[]
  onUpdate: (updates: Partial<BlockConfig>) => void
  onTableChange: (tableId: string) => Promise<void>
}

type DisplayMode = "list" | "grid" | "compact"

export default function RecordContextDataSettings({
  config,
  tables,
  onUpdate,
  onTableChange,
}: RecordContextDataSettingsProps) {
  const [selectedTableId, setSelectedTableId] = useState<string>(config.table_id || "")

  useEffect(() => {
    setSelectedTableId(config.table_id || "")
  }, [config.table_id])

  const displayMode = (config.displayMode ?? (config as any).display_mode ?? "list") as DisplayMode
  const allowClear = config.allowClear ?? (config as any).allow_clear ?? true

  const handleTableChange = async (tableId: string) => {
    setSelectedTableId(tableId)
    await onTableChange(tableId)
    onUpdate({ table_id: tableId })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Table</Label>
        <TableSelector
          tables={tables}
          value={selectedTableId}
          onValueChange={handleTableChange}
          placeholder="Select a table"
        />
      </div>

      <div className="space-y-2">
        <Label>Display mode</Label>
        <Select
          value={displayMode}
          onValueChange={(value: DisplayMode) =>
            onUpdate({ displayMode: value, display_mode: value })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="List" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="list">List</SelectItem>
            <SelectItem value="grid">Grid</SelectItem>
            <SelectItem value="compact">Compact</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="record-context-allow-clear" className="flex-1">
          Allow clear selection
        </Label>
        <Switch
          id="record-context-allow-clear"
          checked={allowClear}
          onCheckedChange={(checked) =>
            onUpdate({ allowClear: checked, allow_clear: checked })
          }
        />
      </div>
    </div>
  )
}
