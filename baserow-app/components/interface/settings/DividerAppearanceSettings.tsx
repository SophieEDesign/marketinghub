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

interface DividerAppearanceSettingsProps {
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig>) => void
}

export default function DividerAppearanceSettings({
  config,
  onUpdate,
}: DividerAppearanceSettingsProps) {
  const appearance = config.appearance || {}

  return (
    <div className="space-y-4">
      {/* Thickness */}
      <div className="space-y-2">
        <Label>Thickness (px)</Label>
        <Input
          type="number"
          min="1"
          max="20"
          value={appearance.divider_thickness ?? 1}
          onChange={(e) =>
            onUpdate({
              appearance: {
                ...appearance,
                divider_thickness: parseInt(e.target.value) || 1,
              },
            })
          }
        />
      </div>

      {/* Color */}
      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={appearance.divider_color || "#e5e7eb"}
            onChange={(e) =>
              onUpdate({
                appearance: { ...appearance, divider_color: e.target.value },
              })
            }
            className="w-16 h-10"
          />
          <Input
            type="text"
            value={appearance.divider_color || "#e5e7eb"}
            onChange={(e) =>
              onUpdate({
                appearance: { ...appearance, divider_color: e.target.value },
              })
            }
            placeholder="#e5e7eb"
          />
        </div>
      </div>

      {/* Style */}
      <div className="space-y-2">
        <Label>Style</Label>
        <Select
          value={appearance.divider_style || 'solid'}
          onValueChange={(value) =>
            onUpdate({
              appearance: { 
                ...appearance, 
                divider_style: value as 'solid' | 'dashed' | 'dotted' 
              },
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="solid">Solid</SelectItem>
            <SelectItem value="dashed">Dashed</SelectItem>
            <SelectItem value="dotted">Dotted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Spacing */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Top Spacing (px)</Label>
          <Input
            type="number"
            min="0"
            max="100"
            value={appearance.divider_spacing_top ?? 16}
            onChange={(e) =>
              onUpdate({
                appearance: {
                  ...appearance,
                  divider_spacing_top: parseInt(e.target.value) || 0,
                },
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Bottom Spacing (px)</Label>
          <Input
            type="number"
            min="0"
            max="100"
            value={appearance.divider_spacing_bottom ?? 16}
            onChange={(e) =>
              onUpdate({
                appearance: {
                  ...appearance,
                  divider_spacing_bottom: parseInt(e.target.value) || 0,
                },
              })
            }
          />
        </div>
      </div>
    </div>
  )
}

