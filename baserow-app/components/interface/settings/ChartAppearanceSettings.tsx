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

interface ChartAppearanceSettingsProps {
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig['appearance']>) => void
}

export default function ChartAppearanceSettings({
  config,
  onUpdate,
}: ChartAppearanceSettingsProps) {
  const appearance = config.appearance || {}

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Show Legend</Label>
          <p className="text-xs text-gray-500 mt-1">
            Display chart legend
          </p>
        </div>
        <Switch
          checked={appearance.show_legend !== false}
          onCheckedChange={(checked) => onUpdate({ show_legend: checked })}
        />
      </div>

      {/* Legend Position */}
      {appearance.show_legend !== false && (
        <div className="space-y-2">
          <Label>Legend Position</Label>
          <Select
            value={appearance.legend_position || "bottom"}
            onValueChange={(value) => onUpdate({ legend_position: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top">Top</SelectItem>
              <SelectItem value="bottom">Bottom</SelectItem>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Color Scheme */}
      <div className="space-y-2">
        <Label>Color Scheme</Label>
        <Select
          value={appearance.color_scheme || "default"}
          onValueChange={(value) => onUpdate({ color_scheme: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default</SelectItem>
            <SelectItem value="blue">Blue</SelectItem>
            <SelectItem value="green">Green</SelectItem>
            <SelectItem value="purple">Purple</SelectItem>
            <SelectItem value="orange">Orange</SelectItem>
            <SelectItem value="red">Red</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid Lines */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Show Grid Lines</Label>
          <p className="text-xs text-gray-500 mt-1">
            Display chart grid lines
          </p>
        </div>
        <Switch
          checked={appearance.show_grid !== false}
          onCheckedChange={(checked) => onUpdate({ show_grid: checked })}
        />
      </div>
    </div>
  )
}

