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
import { Switch } from "@/components/ui/switch"
import type { BlockConfig } from "@/lib/interface/types"

interface FormAppearanceSettingsProps {
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig['appearance']>) => void
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
            onUpdate({ form_layout: value as 'single' | 'two' })
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
            onUpdate({ label_position: value as 'top' | 'left' | 'inline' })
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
            onUpdate({ field_spacing: parseInt(e.target.value) || 16 })
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
            onUpdate({ button_alignment: value as 'left' | 'center' | 'right' | 'full' })
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

      {/* Display Style Section */}
      {config.table_id && (
        <div className="space-y-4 pt-4 border-t">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Display Style</h3>
            <p className="text-xs text-gray-500 mb-4">Configure how the form is displayed</p>
          </div>

          {/* Enable Modal Display */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enable-form-modal">Enable modal display</Label>
              <p className="text-xs text-gray-500 mt-1">
                Show form in a modal overlay instead of inline in the block.
              </p>
            </div>
            <Switch
              id="enable-form-modal"
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
                  ? "Form opens in a full-screen modal overlay"
                  : "Form opens in a side panel (desktop) or modal (mobile)"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

