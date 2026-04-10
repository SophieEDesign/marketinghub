"use client"

import { BLOCK_REGISTRY, getAllBlockTypes } from "@/lib/interface/registry"
import type { BlockType } from "@/lib/interface/types"
import BlockPickerPanel, { blockPickerIconMap } from "@/components/interface/BlockPickerPanel"

interface BlockPickerProps {
  onSelectBlock: (type: BlockType) => void
  isCollapsed?: boolean
}

export default function BlockPicker({ onSelectBlock, isCollapsed = false }: BlockPickerProps) {
  const blockTypes = getAllBlockTypes()

  if (isCollapsed) {
    return (
      <div className="w-16 bg-white border-r border-gray-200 p-2 space-y-2">
        {blockTypes.map((type) => {
          const Icon = blockPickerIconMap[type]
          const def = BLOCK_REGISTRY[type]
          const label = def?.label ?? type
          return (
            <button
              key={type}
              onClick={() => onSelectBlock(type)}
              className="w-full p-2 rounded-md hover:bg-gray-100 transition-colors"
              title={label}
            >
              <Icon className="h-5 w-5 text-gray-600 mx-auto" />
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="w-64 bg-white border-r border-gray-200 p-4 flex flex-col min-h-0">
      <h3 className="text-sm font-semibold text-gray-700 mb-3 shrink-0">Add Block</h3>
      <div className="min-h-0 flex-1 overflow-hidden">
        <BlockPickerPanel onSelectBlock={onSelectBlock} />
      </div>
    </div>
  )
}
