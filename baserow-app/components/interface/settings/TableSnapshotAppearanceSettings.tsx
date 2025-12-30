"use client"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { BlockConfig } from "@/lib/interface/types"

interface TableSnapshotAppearanceSettingsProps {
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig['appearance']>) => void
}

export default function TableSnapshotAppearanceSettings({
  config,
  onUpdate,
}: TableSnapshotAppearanceSettingsProps) {
  const appearance = config.appearance || {}

  return (
    <div className="space-y-4">
      {/* Row Height */}
      <div className="space-y-2">
        <Label>Row Height</Label>
        <Select
          value={appearance.row_height || "normal"}
          onValueChange={(value) => onUpdate({ row_height: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="compact">Compact</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="comfortable">Comfortable</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Show Headers */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Show Headers</Label>
          <p className="text-xs text-gray-500 mt-1">
            Display column headers
          </p>
        </div>
        <Switch
          checked={appearance.show_headers !== false}
          onCheckedChange={(checked) => onUpdate({ show_headers: checked })}
        />
      </div>

      {/* Highlight Rules */}
      <div className="space-y-2 border-t pt-4">
        <Label>Highlight Rules</Label>
        <p className="text-xs text-gray-500">
          Conditional formatting rules coming soon
        </p>
      </div>
    </div>
  )
}

