"use client"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { PageBlock } from "@/lib/interface/types"
import type { BlockConfig } from "@/lib/interface/types"

interface FullPageLayoutSettingsProps {
  block: PageBlock
  allBlocks: PageBlock[]
  onUpdate: (updates: Partial<BlockConfig>) => void
}

/**
 * Full-page mode toggle for blocks that support it (record_context, grid, list, kanban, calendar, timeline).
 * When ON: this block is the only block and fills the canvas (no grid). When OFF: normal grid layout.
 * Turning ON is only allowed when this is the only block.
 */
export default function FullPageLayoutSettings({
  block,
  allBlocks,
  onUpdate,
}: FullPageLayoutSettingsProps) {
  const isFullPage = block.config?.is_full_page === true
  const otherBlocksCount = allBlocks.filter((b) => b.id !== block.id).length
  const canTurnOnFullPage = otherBlocksCount === 0
  const isValidForFullPage =
    block.type !== 'record_context' || Boolean(block.config?.table_id)

  const handleToggle = (checked: boolean) => {
    if (checked && !canTurnOnFullPage) return
    if (checked && !isValidForFullPage) return
    onUpdate({ is_full_page: checked })
  }

  return (
    <div className="space-y-2 pt-4 border-t border-gray-200">
      <div className="flex items-center justify-between">
        <Label htmlFor="full-page-mode" className="text-sm font-medium">
          Full-page mode
        </Label>
        <Switch
          id="full-page-mode"
          checked={isFullPage}
          onCheckedChange={handleToggle}
          disabled={(!isFullPage && !canTurnOnFullPage) || !isValidForFullPage}
        />
      </div>
      {isFullPage ? (
        <p className="text-xs text-muted-foreground">
          This block fills the entire page. Turn off to use the grid and add more blocks.
        </p>
      ) : !isValidForFullPage ? (
        <p className="text-xs text-muted-foreground">
          Select a table to enable full-page mode.
        </p>
      ) : !canTurnOnFullPage ? (
        <p className="text-xs text-amber-700">
          Remove other blocks first to use this block as a full-page view.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Use this block as the only content, filling the entire page (no grid layout).
        </p>
      )}
    </div>
  )
}
