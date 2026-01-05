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

interface ImageAppearanceSettingsProps {
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig>) => void
}

export default function ImageAppearanceSettings({
  config,
  onUpdate,
}: ImageAppearanceSettingsProps) {
  const appearance = config.appearance || {}

  return (
    <div className="space-y-4">
      {/* Size */}
      <div className="space-y-2">
        <Label>Image Size</Label>
        <Select
          value={appearance.image_size || 'auto'}
          onValueChange={(value) =>
            onUpdate({
              appearance: { ...appearance, image_size: value },
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto</SelectItem>
            <SelectItem value="contain">Contain</SelectItem>
            <SelectItem value="cover">Cover</SelectItem>
            <SelectItem value="small">Small</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="large">Large</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alignment */}
      <div className="space-y-2">
        <Label>Alignment</Label>
        <Select
          value={appearance.image_align || 'center'}
          onValueChange={(value) =>
            onUpdate({
              appearance: { ...appearance, image_align: value },
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
          </SelectContent>
        </Select>
      </div>

      {/* Aspect Ratio */}
      <div className="space-y-2">
        <Label>Aspect Ratio</Label>
        <Select
          value={appearance.aspect_ratio || 'auto'}
          onValueChange={(value) =>
            onUpdate({
              appearance: { ...appearance, aspect_ratio: value },
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto</SelectItem>
            <SelectItem value="1:1">Square (1:1)</SelectItem>
            <SelectItem value="16:9">Widescreen (16:9)</SelectItem>
            <SelectItem value="4:3">Standard (4:3)</SelectItem>
            <SelectItem value="3:2">Photo (3:2)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Max Width */}
      <div className="space-y-2">
        <Label>Max Width (px)</Label>
        <Input
          type="number"
          min="0"
          max="2000"
          value={appearance.max_width || ""}
          onChange={(e) =>
            onUpdate({
              appearance: {
                ...appearance,
                max_width: e.target.value ? parseInt(e.target.value) : undefined,
              },
            })
          }
          placeholder="No limit"
        />
      </div>
    </div>
  )
}

