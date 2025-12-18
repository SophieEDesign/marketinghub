"use client"

import { useState, useCallback, useEffect } from "react"
import { Responsive, WidthProvider, Layout } from "react-grid-layout"
import "react-grid-layout/css/styles.css"
import "react-resizable/css/styles.css"
import BlockRenderer from "./BlockRenderer"
import type { PageBlock, LayoutItem } from "@/lib/interface/types"

const ResponsiveGridLayout = WidthProvider(Responsive)

interface CanvasProps {
  blocks: PageBlock[]
  isEditing: boolean
  onLayoutChange?: (layout: LayoutItem[]) => void
  onBlockUpdate?: (blockId: string, config: Partial<PageBlock["config"]>) => void
  onBlockClick?: (blockId: string) => void
  selectedBlockId?: string | null
  layoutSettings?: {
    cols?: number
    rowHeight?: number
    margin?: [number, number]
  }
}

export default function Canvas({
  blocks,
  isEditing,
  onLayoutChange,
  onBlockUpdate,
  onBlockClick,
  selectedBlockId,
  layoutSettings = { cols: 12, rowHeight: 30, margin: [10, 10] },
}: CanvasProps) {
  const [layout, setLayout] = useState<Layout[]>([])

  useEffect(() => {
    // Convert blocks to layout format
    const newLayout: Layout[] = blocks.map((block) => ({
      i: block.id,
      x: block.x,
      y: block.y,
      w: block.w,
      h: block.h,
      minW: 2,
      minH: 2,
    }))
    setLayout(newLayout)
  }, [blocks])

  const handleLayoutChange = useCallback(
    (newLayout: Layout[]) => {
      setLayout(newLayout)
      if (onLayoutChange) {
        const layoutItems: LayoutItem[] = newLayout.map((item) => ({
          i: item.i,
          x: item.x || 0,
          y: item.y || 0,
          w: item.w || 4,
          h: item.h || 4,
        }))
        onLayoutChange(layoutItems)
      }
    },
    [onLayoutChange]
  )

  return (
    <div className="w-full h-full">
      <ResponsiveGridLayout
        className="layout"
        layouts={{ lg: layout }}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: layoutSettings.cols || 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={layoutSettings.rowHeight || 30}
        margin={layoutSettings.margin || [10, 10]}
        isDraggable={isEditing}
        isResizable={isEditing}
        isBounded={true}
        preventCollision={true}
        onLayoutChange={handleLayoutChange}
        compactType="vertical"
      >
        {blocks.map((block) => (
          <div
            key={block.id}
            className={`bg-white border rounded-lg shadow-sm overflow-hidden ${
              selectedBlockId === block.id
                ? "ring-2 ring-blue-500 border-blue-500"
                : "border-gray-200 hover:border-gray-300"
            } ${isEditing ? "cursor-move" : ""}`}
            onClick={() => onBlockClick?.(block.id)}
          >
            <div className="h-full w-full">
              <BlockRenderer
                block={block}
                isEditing={isEditing}
                onUpdate={onBlockUpdate}
              />
            </div>
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  )
}
