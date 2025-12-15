'use client'

import { Responsive, WidthProvider } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import TextBlock from './TextBlock'
import ImageBlock from './ImageBlock'
import ChartBlock from './ChartBlock'
import KpiBlock from './KpiBlock'
import HtmlBlock from './HtmlBlock'
import EmbedBlock from './EmbedBlock'
import TableBlock from './TableBlock'
import StatBlock from './StatBlock'
import DividerBlock from './DividerBlock'
import { Button } from '@/components/ui/button'
import { Settings } from 'lucide-react'
import type { ViewBlock } from '@/types/database'

const ResponsiveGridLayout = WidthProvider(Responsive)

interface BlockRendererProps {
  blocks: ViewBlock[]
  editing?: boolean
  onLayoutChange?: (layout: any) => void
  onBlockSettingsClick?: (block: ViewBlock) => void
}

export default function BlockRenderer({
  blocks,
  editing = false,
  onLayoutChange,
  onBlockSettingsClick,
}: BlockRendererProps) {
  const layouts = {
    lg: blocks.map((block) => ({
      i: block.id,
      x: block.position.x,
      y: block.position.y,
      w: block.position.w,
      h: block.position.h,
    })),
  }

  function renderBlock(block: ViewBlock) {
    switch (block.type) {
      case 'text':
        return <TextBlock block={block} />
      case 'image':
        return <ImageBlock block={block} />
      case 'chart':
        return <ChartBlock block={block} />
      case 'kpi':
        return <KpiBlock block={block} />
      case 'html':
        return <HtmlBlock block={block} />
      case 'embed':
        return <EmbedBlock block={block} />
      case 'table':
        return <TableBlock block={block} />
      case 'stat':
        return <StatBlock block={block} />
      case 'divider':
        return <DividerBlock block={block} />
      default:
        return <div>Unknown block type: {block.type}</div>
    }
  }

  return (
    <ResponsiveGridLayout
      className="layout"
      layouts={layouts}
      breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
      cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
      rowHeight={60}
      isDraggable={editing}
      isResizable={editing}
      onLayoutChange={onLayoutChange}
    >
      {blocks.map((block) => (
        <div key={block.id} className="bg-card border rounded-lg p-4 relative group">
          {editing && onBlockSettingsClick && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
              onClick={(e) => {
                e.stopPropagation()
                onBlockSettingsClick(block)
              }}
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
          {renderBlock(block)}
        </div>
      ))}
    </ResponsiveGridLayout>
  )
}
