"use client"

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

interface KPIAppearanceSettingsProps {
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig['appearance']>) => void
}

export default function KPIAppearanceSettings({
  config,
  onUpdate,
}: KPIAppearanceSettingsProps) {
  const appearance = config.appearance || {}

  return (
    <div className="space-y-4">
      {/* Number Format */}
      <div className="space-y-2">
        <Label>Number Format</Label>
        <Select
          value={appearance.number_format || "standard"}
          onValueChange={(value) => onUpdate({ number_format: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="standard">Standard (1,234)</SelectItem>
            <SelectItem value="compact">Compact (1.2K)</SelectItem>
            <SelectItem value="decimal">Decimal (1234.56)</SelectItem>
            <SelectItem value="percent">Percent (12.34%)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Trend Indicator */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Show Trend Indicator</Label>
          <p className="text-xs text-gray-500 mt-1">
            Display up/down arrows for comparisons
          </p>
        </div>
        <Switch
          checked={appearance.show_trend !== false}
          onCheckedChange={(checked) => onUpdate({ show_trend: checked })}
        />
      </div>

      {/* Alignment */}
      <div className="space-y-2">
        <Label>Alignment</Label>
        <Select
          value={appearance.alignment || "center"}
          onValueChange={(value) => onUpdate({ alignment: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Size */}
      <div className="space-y-2">
        <Label>Value Size</Label>
        <Select
          value={appearance.value_size || "large"}
          onValueChange={(value) => onUpdate({ value_size: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="small">Small</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="large">Large</SelectItem>
            <SelectItem value="xlarge">Extra Large</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

