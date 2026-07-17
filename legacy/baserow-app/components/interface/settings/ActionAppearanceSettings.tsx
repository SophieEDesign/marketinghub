"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { BlockConfig } from "@/lib/interface/types"

interface ActionAppearanceSettingsProps {
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig['appearance']>) => void
  onConfigUpdate?: (updates: Partial<BlockConfig>) => void // For non-appearance properties like icon
}

export default function ActionAppearanceSettings({
  config,
  onUpdate,
  onConfigUpdate,
}: ActionAppearanceSettingsProps) {
  const appearance = config.appearance || {}

  return (
    <div className="space-y-4">
      {/* Style */}
      <div className="space-y-2">
        <Label>Button Style</Label>
        <Select
          value={appearance.button_style || "primary"}
          onValueChange={(value) => onUpdate({ button_style: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="primary">Primary</SelectItem>
            <SelectItem value="secondary">Secondary</SelectItem>
            <SelectItem value="outline">Outline</SelectItem>
            <SelectItem value="ghost">Ghost</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Icon - This is a config property, not appearance */}
      {onConfigUpdate && (
        <div className="space-y-2">
          <Label>Icon</Label>
          <Select
            value={config.icon || "arrow-right"}
            onValueChange={(value) => onConfigUpdate({ icon: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="arrow-right">Arrow Right</SelectItem>
              <SelectItem value="plus">Plus</SelectItem>
              <SelectItem value="external">External Link</SelectItem>
              <SelectItem value="none">None</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}

