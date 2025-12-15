"use client"

import { Responsive, WidthProvider } from "react-grid-layout"
import "react-grid-layout/css/styles.css"
import "react-grid-layout/css/resizable.css"
import TextBlock from "./TextBlock"
import ImageBlock from "./ImageBlock"
import ChartBlock from "./ChartBlock"
import KpiBlock from "./KpiBlock"
import HtmlBlock from "./HtmlBlock"
import EmbedBlock from "./EmbedBlock"
import TableBlock from "./TableBlock"
import AutomationBlock from "./AutomationBlock"
import type { ViewBlock } from "@/types/database"

const ResponsiveGridLayout = WidthProvider(Responsive)

interface BlockRendererProps {
  blocks: ViewBlock[]
  onLayoutChange?: (layout: any) => void
}

export default function BlockRenderer({ blocks, onLayoutChange }: BlockRendererProps) {
  const layouts = {
    lg: blocks.map((block) => ({
      i: block.id,
      x: block.position_x,
      y: block.position_y,
      w: block.width,
      h: block.height,
    })),
  }

  function renderBlock(block: ViewBlock) {
    switch (block.type) {
      case "text":
        return <TextBlock block={block} />
      case "image":
        return <ImageBlock block={block} />
      case "chart":
        return <ChartBlock block={block} />
      case "kpi":
        return <KpiBlock block={block} />
      case "html":
        return <HtmlBlock block={block} />
      case "embed":
        return <EmbedBlock block={block} />
      case "table":
        return <TableBlock block={block} />
      case "automation":
        return <AutomationBlock block={block} />
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
      onLayoutChange={onLayoutChange}
    >
      {blocks.map((block) => (
        <div key={block.id} className="bg-card border rounded-lg p-4">
          {renderBlock(block)}
        </div>
      ))}
    </ResponsiveGridLayout>
  )
}
