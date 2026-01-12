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

interface FieldAppearanceSettingsProps {
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig>) => void
}

/**
 * Field Block Appearance Settings
 * 
 * Controls ONLY block-level presentation:
 * - Layout (width, alignment)
 * - Visibility
 * - Label display (show/hide)
 * - Inline editing permissions (block-level behavior)
 * 
 * Does NOT control:
 * - Field data behavior (name, type, options, colors) - these are in Field Settings
 * - Validation rules
 * - Field relationships
 */
export default function FieldAppearanceSettings({
  config,
  onUpdate,
}: FieldAppearanceSettingsProps) {
  const allowInlineEdit = config.allow_inline_edit || false
  const editPermission = config.inline_edit_permission || 'both'
  const appearance = config.appearance || {}
  const showLabel = appearance.showTitle !== false // Default to true

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-gray-900">Block Layout</h3>
        <p className="text-xs text-gray-500">
          Control how this field block appears. Field settings (name, type, options) are configured in the Data tab.
        </p>
      </div>

      {/* Label Display */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="showLabel">Show Field Label</Label>
            <p className="text-xs text-gray-500">
              Display the field name above the value
            </p>
          </div>
          <Switch
            id="showLabel"
            checked={showLabel}
            onCheckedChange={(checked) => {
              onUpdate({
                appearance: {
                  ...appearance,
                  showTitle: checked,
                },
              })
            }}
          />
        </div>
      </div>

      {/* Inline Editing Toggle */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="allowInlineEdit">Allow Inline Editing</Label>
            <p className="text-xs text-gray-500">
              Enable users to edit field values directly in this block
            </p>
          </div>
          <Switch
            id="allowInlineEdit"
            checked={allowInlineEdit}
            onCheckedChange={(checked) => {
              onUpdate({ 
                allow_inline_edit: checked,
                // Reset permission to 'both' when enabling if not set
                inline_edit_permission: checked && !config.inline_edit_permission ? 'both' : config.inline_edit_permission
              })
            }}
          />
        </div>
      </div>

      {/* Edit Permission Selector */}
      {allowInlineEdit && (
        <div className="space-y-2">
          <Label htmlFor="editPermission">Who Can Edit</Label>
          <Select
            value={editPermission}
            onValueChange={(value: 'admin' | 'member' | 'both') => {
              onUpdate({ inline_edit_permission: value })
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="both">Both Admin and Members</SelectItem>
              <SelectItem value="admin">Admin Only</SelectItem>
              <SelectItem value="member">Members Only</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">
            {editPermission === 'both' && "Both admins and members can edit this field"}
            {editPermission === 'admin' && "Only admins can edit this field inline"}
            {editPermission === 'member' && "Only members can edit this field inline"}
          </p>
        </div>
      )}
    </div>
  )
}
