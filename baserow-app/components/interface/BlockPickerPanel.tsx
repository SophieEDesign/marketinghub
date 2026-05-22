"use client"

import { useMemo, useState } from "react"
import {
  Grid,
  FileText,
  BarChart3,
  TrendingUp,
  Type,
  Code,
  Image,
  Images,
  Minus,
  Zap,
  ExternalLink,
  Filter,
  Square,
  Calendar,
  Columns,
  GitBranch,
  List,
  Hash,
  Lightbulb,
  LayoutGrid,
  GanttChart,
  FolderOpen,
  CalendarClock,
  CalendarDays,
  CheckSquare,
} from "lucide-react"
import { BLOCK_REGISTRY } from "@/lib/interface/registry"
import type { BlockType } from "@/lib/interface/types"
import {
  BLOCK_CATEGORY_LABELS,
  filterBlockTypesBySearch,
  groupBlockTypes,
} from "@/lib/interface/blockPickerModel"
import { Input } from "@/components/ui/input"

export const blockPickerIconMap: Record<BlockType, React.ElementType> = {
  grid: Grid,
  form: FileText,
  record: FileText,
  record_context: List,
  chart: BarChart3,
  kpi: TrendingUp,
  kpi_summary: LayoutGrid,
  text: Type,
  html: Code,
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
  horizontal_grouped: Columns,
  content_theme: Lightbulb,
  content_timeline: GanttChart,
  internal_resource_hub: FolderOpen,
  upcoming_summary: CalendarClock,
  things_to_do: CheckSquare,
  event_calendar: CalendarDays,
}

interface BlockPickerPanelProps {
  onSelectBlock: (type: BlockType) => void
  /** Tighter rows for popover */
  compact?: boolean
}

export default function BlockPickerPanel({ onSelectBlock, compact = false }: BlockPickerPanelProps) {
  const [query, setQuery] = useState("")
  const grouped = useMemo(() => {
    const filtered = filterBlockTypesBySearch(query)
    return groupBlockTypes(filtered)
  }, [query])

  const rowClass = compact
    ? "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-gray-100 transition-colors text-left"
    : "w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors text-left"

  return (
    <div className="flex flex-col gap-2 min-h-0">
      <Input
        type="search"
        placeholder="Search blocks…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-8 text-sm"
        aria-label="Search block types"
      />
      <div className={compact ? "space-y-2 max-h-80 overflow-y-auto pr-0.5" : "space-y-3 max-h-[min(24rem,calc(100vh-12rem))] overflow-y-auto pr-0.5"}>
        {grouped.map(({ category, types }) => (
          <div key={category}>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-1 mb-1">
              {BLOCK_CATEGORY_LABELS[category]}
            </div>
            <div className="space-y-0.5">
              {types.map((type) => {
                const Icon = blockPickerIconMap[type]
                const def = BLOCK_REGISTRY[type]
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => onSelectBlock(type)}
                    className={rowClass}
                  >
                    <Icon className="h-5 w-5 text-gray-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{def.label}</div>
                      <div className="text-xs text-gray-500">
                        {type === "divider"
                          ? "Spacing between sections"
                          : `${def.defaultWidth}×${def.defaultHeight}`}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        {grouped.length === 0 && (
          <p className="text-sm text-gray-500 px-1 py-4 text-center">No blocks match your search.</p>
        )}
      </div>
    </div>
  )
}
