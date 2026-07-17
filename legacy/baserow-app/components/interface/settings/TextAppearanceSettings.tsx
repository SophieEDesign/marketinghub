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

interface TextAppearanceSettingsProps {
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig['appearance']>) => void
}

export default function TextAppearanceSettings({
  config,
  onUpdate,
}: TextAppearanceSettingsProps) {
  const appearance = config.appearance || {}

  return (
    <div className="space-y-4">
      {/* Text Color */}
      <div className="space-y-2">
        <Label>Text Color</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={appearance.text_color || "#000000"}
            onChange={(e) => onUpdate({ text_color: e.target.value })}
            className="w-16 h-10 cursor-pointer"
          />
          <Input
            type="text"
            value={appearance.text_color || "#000000"}
            onChange={(e) => onUpdate({ text_color: e.target.value })}
            placeholder="#000000"
            className="flex-1"
          />
        </div>
        <p className="text-xs text-gray-500">
          Set the default text color for this block
        </p>
      </div>

      {/* Text Size */}
      <div className="space-y-2">
        <Label>Text Size</Label>
        <Select
          value={appearance.text_size || "md"}
          onValueChange={(value) => onUpdate({ text_size: value as 'sm' | 'md' | 'lg' | 'xl' })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sm">Small</SelectItem>
            <SelectItem value="md">Medium</SelectItem>
            <SelectItem value="lg">Large</SelectItem>
            <SelectItem value="xl">Extra Large</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Font Weight */}
      <div className="space-y-2">
        <Label>Font Weight</Label>
        <Select
          value={appearance.font_weight || "normal"}
          onValueChange={(value) => onUpdate({ font_weight: value as 'normal' | 'medium' | 'semibold' | 'bold' })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="semibold">Semi Bold</SelectItem>
            <SelectItem value="bold">Bold</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alignment */}
      <div className="space-y-2">
        <Label>Alignment</Label>
        <Select
          value={appearance.text_align || "left"}
          onValueChange={(value) => onUpdate({ text_align: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right</SelectItem>
            <SelectItem value="justify">Justify</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

