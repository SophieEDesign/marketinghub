"use client"

import { Grid, FileText, BarChart3, TrendingUp, Type, Image, Minus, Zap, Layout, Table2, ExternalLink, Filter } from "lucide-react"
import { BLOCK_REGISTRY, getAllBlockTypes } from "@/lib/interface/registry"
import type { BlockType } from "@/lib/interface/types"

interface BlockPickerProps {
  onSelectBlock: (type: BlockType) => void
  isCollapsed?: boolean
}

const iconMap: Record<BlockType, React.ElementType> = {
  grid: Grid,
  form: FileText,
  record: FileText,
  chart: BarChart3,
  kpi: TrendingUp,
  text: Type,
  image: Image,
  divider: Minus,
  button: Zap,
  tabs: Layout,
  table_snapshot: Table2,
  action: Zap,
  link_preview: ExternalLink,
  filter: Filter,
}

export default function BlockPicker({ onSelectBlock, isCollapsed = false }: BlockPickerProps) {
  const blockTypes = getAllBlockTypes()

  if (isCollapsed) {
    return (
      <div className="w-16 bg-white border-r border-gray-200 p-2 space-y-2">
        {blockTypes.map((type) => {
          const Icon = iconMap[type]
          const def = BLOCK_REGISTRY[type]
          return (
            <button
              key={type}
              onClick={() => onSelectBlock(type)}
              className="w-full p-2 rounded-md hover:bg-gray-100 transition-colors"
              title={def.label}
            >
              <Icon className="h-5 w-5 text-gray-600 mx-auto" />
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="w-64 bg-white border-r border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Add Block</h3>
      <div className="space-y-1">
        {blockTypes.map((type) => {
          const Icon = iconMap[type]
          const def = BLOCK_REGISTRY[type]
          return (
            <button
              key={type}
              onClick={() => onSelectBlock(type)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors text-left"
            >
              <Icon className="h-5 w-5 text-gray-600" />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">{def.label}</div>
                <div className="text-xs text-gray-500">
                  {def.defaultWidth}×{def.defaultHeight}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
