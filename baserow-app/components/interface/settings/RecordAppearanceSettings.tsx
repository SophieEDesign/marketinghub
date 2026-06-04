"use client"

import type { BlockConfig } from "@/lib/interface/types"

interface RecordAppearanceSettingsProps {
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig['appearance']>) => void
}

/**
 * Record block appearance settings.
 * TODO: Wire appearance.enable_modal_display to RecordPanel when modal display is implemented.
 */
export default function RecordAppearanceSettings({
  config: _config,
  onUpdate: _onUpdate,
}: RecordAppearanceSettingsProps) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Modal display for Record blocks is not yet available. Records render inline in the block.
        Use a data view block with record open behaviour if you need a side panel or modal.
      </p>
    </div>
  )
}
