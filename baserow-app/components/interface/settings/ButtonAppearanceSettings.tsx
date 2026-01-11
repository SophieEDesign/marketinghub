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

interface ButtonAppearanceSettingsProps {
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig["appearance"]>) => void
}

export default function ButtonAppearanceSettings({
  config,
  onUpdate,
}: ButtonAppearanceSettingsProps) {
  const appearance = config.appearance || {}

  return (
    <div className="space-y-4">
      {/* Button Style */}
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
            <SelectItem value="destructive">Destructive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Button Background Color */}
      <div className="space-y-2">
        <Label>Background Color</Label>
        <Input
          type="color"
          value={appearance.button_background || "#2563eb"}
          onChange={(e) => onUpdate({ button_background: e.target.value })}
          className="h-10 w-full"
        />
      </div>

      {/* Button Text Color */}
      <div className="space-y-2">
        <Label>Text Color</Label>
        <Input
          type="color"
          value={appearance.button_text_color || "#ffffff"}
          onChange={(e) => onUpdate({ button_text_color: e.target.value })}
          className="h-10 w-full"
        />
      </div>
    </div>
  )
}
