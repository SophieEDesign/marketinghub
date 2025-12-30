"use client"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { BlockConfig } from "@/lib/interface/types"

interface LinkPreviewAppearanceSettingsProps {
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig['appearance']>) => void
}

export default function LinkPreviewAppearanceSettings({
  config,
  onUpdate,
}: LinkPreviewAppearanceSettingsProps) {
  const appearance = config.appearance || {}

  return (
    <div className="space-y-4">
      {/* Display Mode */}
      <div className="space-y-2">
        <Label>Display Mode</Label>
        <Select
          value={appearance.display_mode || "card"}
          onValueChange={(value) => onUpdate({ display_mode: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="compact">Compact</SelectItem>
            <SelectItem value="card">Card</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Provider Badge */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Show Provider Badge</Label>
          <p className="text-xs text-gray-500 mt-1">
            Display provider name (OneDrive, Google Drive, etc.)
          </p>
        </div>
        <Switch
          checked={appearance.show_provider !== false}
          onCheckedChange={(checked) => onUpdate({ show_provider: checked })}
        />
      </div>

      {/* Thumbnail */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Show Thumbnail</Label>
          <p className="text-xs text-gray-500 mt-1">
            Display file thumbnail preview
          </p>
        </div>
        <Switch
          checked={appearance.show_thumbnail !== false}
          onCheckedChange={(checked) => onUpdate({ show_thumbnail: checked })}
        />
      </div>
    </div>
  )
}

