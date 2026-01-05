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

interface TabsAppearanceSettingsProps {
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig>) => void
}

export default function TabsAppearanceSettings({
  config,
  onUpdate,
}: TabsAppearanceSettingsProps) {
  const appearance = config.appearance || {}

  return (
    <div className="space-y-4">
      {/* Tab Style */}
      <div className="space-y-2">
        <Label>Tab Style</Label>
        <Select
          value={appearance.tab_style || 'default'}
          onValueChange={(value) =>
            onUpdate({
              appearance: { ...appearance, tab_style: value },
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default</SelectItem>
            <SelectItem value="pills">Pills</SelectItem>
            <SelectItem value="underline">Underline</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tab Position */}
      <div className="space-y-2">
        <Label>Tab Position</Label>
        <Select
          value={appearance.tab_position || 'top'}
          onValueChange={(value) =>
            onUpdate({
              appearance: { ...appearance, tab_position: value },
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="top">Top</SelectItem>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tab Background Color */}
      <div className="space-y-2">
        <Label>Tab Background Color</Label>
        <Input
          type="color"
          value={appearance.tab_background || '#f3f4f6'}
          onChange={(e) =>
            onUpdate({
              appearance: { ...appearance, tab_background: e.target.value },
            })
          }
        />
      </div>

      {/* Active Tab Color */}
      <div className="space-y-2">
        <Label>Active Tab Color</Label>
        <Input
          type="color"
          value={appearance.active_tab_color || '#3b82f6'}
          onChange={(e) =>
            onUpdate({
              appearance: { ...appearance, active_tab_color: e.target.value },
            })
          }
        />
      </div>

      {/* Content Padding */}
      <div className="space-y-2">
        <Label>Content Padding</Label>
        <Input
          type="number"
          min="0"
          max="32"
          value={appearance.content_padding ?? 16}
          onChange={(e) =>
            onUpdate({
              appearance: {
                ...appearance,
                content_padding: parseInt(e.target.value) || 16,
              },
            })
          }
        />
        <p className="text-xs text-gray-500">Padding in pixels</p>
      </div>
    </div>
  )
}

