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

interface FormAppearanceSettingsProps {
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig>) => void
}

export default function FormAppearanceSettings({
  config,
  onUpdate,
}: FormAppearanceSettingsProps) {
  const appearance = config.appearance || {}

  return (
    <div className="space-y-4">
      {/* Layout */}
      <div className="space-y-2">
        <Label>Layout</Label>
        <Select
          value={appearance.form_layout || 'single'}
          onValueChange={(value) =>
            onUpdate({
              appearance: { ...appearance, form_layout: value },
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single">Single Column</SelectItem>
            <SelectItem value="two">Two Columns</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Label Position */}
      <div className="space-y-2">
        <Label>Label Position</Label>
        <Select
          value={appearance.label_position || 'top'}
          onValueChange={(value) =>
            onUpdate({
              appearance: { ...appearance, label_position: value },
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="top">Top</SelectItem>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="inline">Inline</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Field Spacing */}
      <div className="space-y-2">
        <Label>Field Spacing</Label>
        <Input
          type="number"
          min="0"
          max="32"
          value={appearance.field_spacing ?? 16}
          onChange={(e) =>
            onUpdate({
              appearance: {
                ...appearance,
                field_spacing: parseInt(e.target.value) || 16,
              },
            })
          }
        />
        <p className="text-xs text-gray-500">Spacing between fields in pixels</p>
      </div>

      {/* Button Alignment */}
      <div className="space-y-2">
        <Label>Submit Button Alignment</Label>
        <Select
          value={appearance.button_alignment || 'left'}
          onValueChange={(value) =>
            onUpdate({
              appearance: { ...appearance, button_alignment: value },
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right</SelectItem>
            <SelectItem value="full">Full Width</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

