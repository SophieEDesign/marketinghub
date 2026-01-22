"use client"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { ArrowUp, ArrowDown, Lock, Unlock } from "lucide-react"
import type { PageBlock, BlockConfig } from "@/lib/interface/types"
import PermissionsSettings from "./PermissionsSettings"

interface AdvancedSettingsProps {
  block: PageBlock
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig>) => void
  onMoveToTop?: (blockId: string) => void
  onMoveToBottom?: (blockId: string) => void
  onLock?: (blockId: string, locked: boolean) => void
}

export default function AdvancedSettings({
  block,
  config,
  onUpdate,
  onMoveToTop,
  onMoveToBottom,
  onLock,
}: AdvancedSettingsProps) {
  const isLocked = config.locked || false

  // Show permissions for all data blocks that support records
  const dataBlockTypes = [
    'grid',
    'list',
    'gallery',
    'timeline',
    'calendar',
    'kanban',
    'chart',
    'kpi',
    'form',
    'record',
  ]
  const showPermissions = dataBlockTypes.includes(block.type)

  return (
    <div className="space-y-6">
      {/* Permissions - Only for data blocks */}
      {showPermissions && (
        <div className="border-b pb-6">
          <PermissionsSettings config={config} onUpdate={onUpdate} />
        </div>
      )}

      {/* Block Locking */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label>Lock Block</Label>
            <p className="text-xs text-gray-500 mt-1">
              Prevent editing in view mode
            </p>
          </div>
          <Switch
            checked={isLocked}
            onCheckedChange={(checked) => {
              onUpdate({ locked: checked })
              if (onLock) {
                onLock(block.id, checked)
              }
            }}
          />
        </div>
      </div>

      {/* Visibility Rules - Hidden until implemented */}

      {/* Block Actions */}
      {(onMoveToTop || onMoveToBottom) && (
        <div className="space-y-4 border-t pt-4">
          <Label>Block Actions</Label>
          <div className="flex flex-col gap-2">
            {onMoveToTop && (
              <Button
                variant="outline"
                onClick={() => onMoveToTop(block.id)}
                className="w-full justify-start"
              >
                <ArrowUp className="h-4 w-4 mr-2" />
                Move to Top
              </Button>
            )}
            {onMoveToBottom && (
              <Button
                variant="outline"
                onClick={() => onMoveToBottom(block.id)}
                className="w-full justify-start"
              >
                <ArrowDown className="h-4 w-4 mr-2" />
                Move to Bottom
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

