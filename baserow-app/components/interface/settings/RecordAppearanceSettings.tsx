"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { BlockConfig } from "@/lib/interface/types"

interface RecordAppearanceSettingsProps {
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig['appearance']>) => void
}

export default function RecordAppearanceSettings({
  config,
  onUpdate,
}: RecordAppearanceSettingsProps) {
  const appearance = config.appearance || {}

  return (
    <div className="space-y-4">
      {/* Display Style Section */}
      {config.table_id && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Display Style</h3>
            <p className="text-xs text-gray-500 mb-4">Configure how the record is displayed</p>
          </div>

          {/* Enable Modal Display */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enable-record-modal">Enable modal display</Label>
              <p className="text-xs text-gray-500 mt-1">
                Show record in a modal overlay instead of inline in the block.
              </p>
            </div>
            <Switch
              id="enable-record-modal"
              checked={appearance.enable_modal_display === true}
              onCheckedChange={(checked) => onUpdate({ enable_modal_display: checked })}
            />
          </div>

          {/* Modal Style - Only show if enabled */}
          {appearance.enable_modal_display === true && (
            <div className="space-y-2">
              <Label>Modal style</Label>
              <Select
                value={appearance.modal_style || "side_panel"}
                onValueChange={(value) => onUpdate({ modal_style: value as 'side_panel' | 'modal' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="side_panel">Side panel</SelectItem>
                  <SelectItem value="modal">Modal</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {appearance.modal_style === 'modal'
                  ? "Record opens in a full-screen modal overlay"
                  : "Record opens in a side panel (desktop) or modal (mobile)"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
