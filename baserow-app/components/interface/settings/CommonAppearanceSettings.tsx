"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import type { BlockConfig } from "@/lib/interface/types"

interface CommonAppearanceSettingsProps {
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig['appearance']>) => void
}

export default function CommonAppearanceSettings({
  config,
  onUpdate,
}: CommonAppearanceSettingsProps) {
  const appearance = config.appearance || {}

  return (
    <>
      <div className="space-y-2">
        <Label>Title</Label>
        <Input
          value={appearance.title || config.title || ""}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Block title"
        />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="show-title">Show title</Label>
        <Switch
          id="show-title"
          checked={appearance.show_title !== false}
          onCheckedChange={(checked) => onUpdate({ show_title: checked })}
        />
      </div>

      <div className="space-y-2">
        <Label>Title Color</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={appearance.title_color || "#000000"}
            onChange={(e) => onUpdate({ title_color: e.target.value })}
            className="w-16 h-10"
          />
          <Input
            type="text"
            value={appearance.title_color || "#000000"}
            onChange={(e) => onUpdate({ title_color: e.target.value })}
            placeholder="#000000"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Background Color</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={appearance.background_color || "#ffffff"}
            onChange={(e) => onUpdate({ background_color: e.target.value })}
            className="w-16 h-10"
          />
          <Input
            type="text"
            value={appearance.background_color || "#ffffff"}
            onChange={(e) => onUpdate({ background_color: e.target.value })}
            placeholder="#ffffff"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Border Color</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={appearance.border_color || "#e5e7eb"}
            onChange={(e) => onUpdate({ border_color: e.target.value })}
            className="w-16 h-10"
          />
          <Input
            type="text"
            value={appearance.border_color || "#e5e7eb"}
            onChange={(e) => onUpdate({ border_color: e.target.value })}
            placeholder="#e5e7eb"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Border Width (px)</Label>
          <Input
            type="number"
            min="0"
            max="10"
            value={appearance.border_width ?? 1}
            onChange={(e) => onUpdate({ border_width: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-2">
          <Label>Border Radius (px)</Label>
          <Input
            type="number"
            min="0"
            max="20"
            value={appearance.border_radius ?? 8}
            onChange={(e) => onUpdate({ border_radius: parseInt(e.target.value) || 0 })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Padding (px)</Label>
        <Input
          type="number"
          min="0"
          max="50"
          value={appearance.padding ?? 16}
          onChange={(e) => onUpdate({ padding: parseInt(e.target.value) || 0 })}
        />
      </div>

      <div className="space-y-2">
        <Label>Header Background</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={appearance.header_background || "#f9fafb"}
            onChange={(e) => onUpdate({ header_background: e.target.value })}
            className="w-16 h-10"
          />
          <Input
            type="text"
            value={appearance.header_background || "#f9fafb"}
            onChange={(e) => onUpdate({ header_background: e.target.value })}
            placeholder="#f9fafb"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Header Text Color</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={appearance.header_text_color || "#111827"}
            onChange={(e) => onUpdate({ header_text_color: e.target.value })}
            className="w-16 h-10"
          />
          <Input
            type="text"
            value={appearance.header_text_color || "#111827"}
            onChange={(e) => onUpdate({ header_text_color: e.target.value })}
            placeholder="#111827"
          />
        </div>
      </div>
    </>
  )
}

