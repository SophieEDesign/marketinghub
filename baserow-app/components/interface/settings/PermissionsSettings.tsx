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

interface PermissionsSettingsProps {
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig>) => void
}

export default function PermissionsSettings({
  config,
  onUpdate,
}: PermissionsSettingsProps) {
  const permissions = config.permissions || {}
  const mode = permissions.mode || 'edit'
  const allowInlineCreate = permissions.allowInlineCreate ?? true
  const allowInlineDelete = permissions.allowInlineDelete ?? true
  const allowOpenRecord = permissions.allowOpenRecord ?? true

  // When mode is 'view', all other toggles are disabled
  const isViewOnly = mode === 'view'

  const handleModeChange = (newMode: 'view' | 'edit') => {
    onUpdate({
      permissions: {
        ...permissions,
        mode: newMode,
        // When switching to view-only, disable all other permissions
        ...(newMode === 'view' && {
          allowInlineCreate: false,
          allowInlineDelete: false,
        }),
      },
    })
  }

  const handleInlineCreateChange = (checked: boolean) => {
    onUpdate({
      permissions: {
        ...permissions,
        mode: 'edit', // Ensure mode is edit when enabling inline create
        allowInlineCreate: checked,
      },
    })
  }

  const handleInlineDeleteChange = (checked: boolean) => {
    onUpdate({
      permissions: {
        ...permissions,
        mode: 'edit', // Ensure mode is edit when enabling inline delete
        allowInlineDelete: checked,
      },
    })
  }

  const handleOpenRecordChange = (checked: boolean) => {
    onUpdate({
      permissions: {
        ...permissions,
        allowOpenRecord: checked,
      },
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-4">Permissions</h3>
        <p className="text-xs text-gray-500 mb-4">
          Control how users can interact with records inside this block.
        </p>
      </div>

      {/* Access Mode */}
      <div className="space-y-2">
        <Label htmlFor="access-mode">Access Mode</Label>
        <Select value={mode} onValueChange={handleModeChange}>
          <SelectTrigger id="access-mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="view">View-only</SelectItem>
            <SelectItem value="edit">Editable</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">
          {mode === 'view'
            ? 'Users cannot modify data in this block'
            : 'Users can modify data in this block'}
        </p>
      </div>

      {/* Inline Editing */}
      <div className="space-y-4 border-t pt-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <Label htmlFor="inline-editing">Inline Editing</Label>
            <p className="text-xs text-gray-500 mt-1">
              Allow users to add/delete records inline
            </p>
          </div>
          <Switch
            id="inline-editing"
            checked={allowInlineCreate && allowInlineDelete && !isViewOnly}
            disabled={isViewOnly}
            onCheckedChange={(checked) => {
              handleInlineCreateChange(checked)
              handleInlineDeleteChange(checked)
            }}
          />
        </div>
        {isViewOnly && (
          <p className="text-xs text-gray-400 italic">
            Disabled in view-only mode
          </p>
        )}
      </div>

      {/* Record Details Access */}
      <div className="space-y-4 border-t pt-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <Label htmlFor="record-details">Record Details Access</Label>
            <p className="text-xs text-gray-500 mt-1">
              Allow users to open record details
            </p>
          </div>
          <Switch
            id="record-details"
            checked={allowOpenRecord}
            onCheckedChange={handleOpenRecordChange}
          />
        </div>
      </div>
    </div>
  )
}
