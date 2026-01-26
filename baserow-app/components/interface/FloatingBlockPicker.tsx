"use client"

import { useState } from "react"
import { Grid, FileText, BarChart3, TrendingUp, Type, Image, Images, Minus, Zap, Layout, Plus, X, ExternalLink, Filter, Square, Calendar, Columns, GitBranch, List, Hash } from "lucide-react"
import { BLOCK_REGISTRY, getAllBlockTypes } from "@/lib/interface/registry"
import type { BlockType } from "@/lib/interface/types"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const iconMap: Record<BlockType, React.ElementType> = {
  grid: Grid,
  form: FileText,
  record: FileText,
  chart: BarChart3,
  kpi: TrendingUp,
  text: Type,
  image: Image,
  gallery: Images,
  divider: Minus,
  button: Zap,
  action: Zap,
  link_preview: ExternalLink,
  filter: Filter,
  field: Square,
  field_section: Square,
  calendar: Calendar,
  multi_calendar: Calendar,
  kanban: Columns,
  timeline: GitBranch,
  multi_timeline: GitBranch,
  list: List,
  number: Hash,
}

interface FloatingBlockPickerProps {
  onSelectBlock: (type: BlockType) => void
}

export default function FloatingBlockPicker({ onSelectBlock }: FloatingBlockPickerProps) {
  const [open, setOpen] = useState(false)
  const blockTypes = getAllBlockTypes()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="fixed bottom-24 right-6 z-30 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
          title="Add block"
          style={{ zIndex: 30 }}
        >
          <Plus className="h-6 w-6" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end" side="top">
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Add Block</h3>
            <button
              onClick={() => setOpen(false)}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="h-4 w-4 text-gray-500" />
            </button>
          </div>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {blockTypes.map((type) => {
              const Icon = iconMap[type]
              const def = BLOCK_REGISTRY[type]
              return (
                <button
                  key={type}
                  onClick={() => {
                    onSelectBlock(type)
                    setOpen(false)
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors text-left"
                >
                  <Icon className="h-5 w-5 text-gray-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">{def.label}</div>
                    <div className="text-xs text-gray-500">
                      {type === 'divider' 
                        ? 'Create spacing between sections'
                        : `${def.defaultWidth}×${def.defaultHeight}`
                      }
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
