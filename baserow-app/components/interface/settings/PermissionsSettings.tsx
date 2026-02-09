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

  // Record action permissions (create/delete)
  const recordActions = ((config as any).record_actions || {}) as {
    create?: 'admin' | 'both'
    delete?: 'admin' | 'both'
  }
  const recordCreatePermission: 'admin' | 'both' = recordActions.create || 'both'
  const recordDeletePermission: 'admin' | 'both' = recordActions.delete || 'admin'

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

  const handleRecordCreateChange = (value: 'admin' | 'both') => {
    onUpdate({
      record_actions: {
        ...recordActions,
        create: value,
      } as any,
    })
  }

  const handleRecordDeleteChange = (value: 'admin' | 'both') => {
    onUpdate({
      record_actions: {
        ...recordActions,
        delete: value,
      } as any,
    })
  }

  // Record opening: stored in appearance for backward compatibility
  const appearance = config.appearance || {}
  const enableRecordOpen = appearance.enable_record_open !== false
  const recordOpenStyle = appearance.record_open_style || 'side_panel'

  const handleEnableRecordOpenChange = (checked: boolean) => {
    onUpdate({
      appearance: {
        ...appearance,
        enable_record_open: checked,
      },
    } as any)
  }

  const handleRecordOpenStyleChange = (value: 'side_panel' | 'modal') => {
    onUpdate({
      appearance: {
        ...appearance,
        record_open_style: value,
      },
    } as any)
  }

  return (
    <div className="space-y-6">
      {/* Page Permissions */}
      <div>
        <h3 className="text-sm font-semibold mb-1">Page Permissions</h3>
        <p className="text-xs text-gray-500 mb-4">
          Page-level permissions act as a ceiling. Block permissions cannot exceed page permissions.
        </p>
        <div className="flex items-center justify-between">
          <Label htmlFor="access-mode" className="text-sm text-gray-700">Permissions</Label>
          <Select
            value={mode}
            onValueChange={(value) => handleModeChange(value as 'view' | 'edit')}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="view">View-only</SelectItem>
              <SelectItem value="edit">Editable</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Record Actions */}
      <div className="space-y-4 border-t pt-4">
        <div>
          <h3 className="text-sm font-semibold mb-1">Record actions</h3>
          <p className="text-xs text-gray-500 mb-4">
            Control who can create and delete records from this Record View page UI.
          </p>
        </div>
        
        {/* Create Records */}
        <div className="flex items-center justify-between">
          <Label htmlFor="create-records" className="text-sm text-gray-700">
            Create records (+)
          </Label>
          <Select
            value={recordCreatePermission}
            onValueChange={(value) => handleRecordCreateChange(value as 'admin' | 'both')}
            disabled={isViewOnly}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin only</SelectItem>
              <SelectItem value="both">Admins + members</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Delete Records */}
        <div className="flex items-center justify-between">
          <Label htmlFor="delete-records" className="text-sm text-gray-700">
            Delete records (-)
          </Label>
          <Select
            value={recordDeletePermission}
            onValueChange={(value) => handleRecordDeleteChange(value as 'admin' | 'both')}
            disabled={isViewOnly}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin only</SelectItem>
              <SelectItem value="both">Admins + members</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isViewOnly && (
          <p className="text-xs text-gray-400 italic">
            Disabled in view-only mode
          </p>
        )}
      </div>

      {/* Allow open record details */}
      <div className="space-y-4 border-t pt-4">
        <div>
          <h3 className="text-sm font-semibold mb-1">Record details</h3>
          <p className="text-xs text-gray-500 mb-4">
            Allow users to open records in a panel or modal to view and edit details.
          </p>
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="allow-open-record" className="text-sm text-gray-700">
            Allow open record details
          </Label>
          <Switch
            id="allow-open-record"
            checked={enableRecordOpen}
            onCheckedChange={handleEnableRecordOpenChange}
            disabled={isViewOnly}
          />
        </div>
        {enableRecordOpen && !isViewOnly && (
          <div className="space-y-2">
            <Label>Open style</Label>
            <Select
              value={recordOpenStyle}
              onValueChange={(value) => handleRecordOpenStyleChange(value as 'side_panel' | 'modal')}
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
              {recordOpenStyle === 'modal'
                ? 'Records open in a full-screen modal overlay.'
                : 'Records open in a side panel (desktop) or modal (mobile).'}
            </p>
          </div>
        )}
      </div>

      {/* Additional Info */}
      <div className="border-t pt-4">
        <p className="text-xs text-gray-400 italic">
          Field-level editability settings are configured in the Data tab. Individual fields can be set to view-only even if the page is editable.
        </p>
      </div>
    </div>
  )
}
