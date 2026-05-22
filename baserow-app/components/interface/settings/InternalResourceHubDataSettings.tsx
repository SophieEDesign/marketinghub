"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { BlockConfig } from "@/lib/interface/types"
import { HUB_CATEGORY_OPTIONS } from "@/components/interface/blocks/internal-resource-hub/types"

interface InternalResourceHubDataSettingsProps {
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig>) => void
}

export default function InternalResourceHubDataSettings({
  config,
  onUpdate,
}: InternalResourceHubDataSettingsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="resource-hub-title">Block title</Label>
        <Input
          id="resource-hub-title"
          value={config.title || ""}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Brand & Media Resources"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="resource-hub-subtitle">Subtitle</Label>
        <Input
          id="resource-hub-subtitle"
          value={config.resource_hub_subtitle || ""}
          onChange={(e) => onUpdate({ resource_hub_subtitle: e.target.value })}
          placeholder="Access official logos, brand assets, images and documents for internal use."
        />
      </div>

      <div className="space-y-2">
        <Label>Default category</Label>
        <Select
          value={config.resource_hub_default_category || "all"}
          onValueChange={(v) => onUpdate({ resource_hub_default_category: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HUB_CATEGORY_OPTIONS.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Layout mode</Label>
        <Select
          value={config.resource_hub_layout_mode || "gallery"}
          onValueChange={(v) =>
            onUpdate({ resource_hub_layout_mode: v as BlockConfig["resource_hub_layout_mode"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gallery">Gallery</SelectItem>
            <SelectItem value="preview">Preview</SelectItem>
            <SelectItem value="list">List (dashboard)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="resource-hub-notice">Internal notice text</Label>
        <Textarea
          id="resource-hub-notice"
          value={config.resource_hub_internal_notice || ""}
          onChange={(e) => onUpdate({ resource_hub_internal_notice: e.target.value })}
          rows={3}
          placeholder="For internal use only..."
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="resource-hub-search" className="font-normal">
          Show search
        </Label>
        <Switch
          id="resource-hub-search"
          checked={config.resource_hub_show_search !== false}
          onCheckedChange={(v) => onUpdate({ resource_hub_show_search: v })}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="resource-hub-recent" className="font-normal">
          Show recent resources
        </Label>
        <Switch
          id="resource-hub-recent"
          checked={config.resource_hub_show_recent !== false}
          onCheckedChange={(v) => onUpdate({ resource_hub_show_recent: v })}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="resource-hub-upload" className="font-normal">
          Show upload area (edit mode)
        </Label>
        <Switch
          id="resource-hub-upload"
          checked={config.resource_hub_show_upload !== false}
          onCheckedChange={(v) => onUpdate({ resource_hub_show_upload: v })}
        />
      </div>
    </div>
  )
}
