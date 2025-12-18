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
            className={`bg-white border rounded-lg shadow-sm overflow-hidden relative ${
              selectedBlockId === block.id
                ? "ring-2 ring-blue-500 border-blue-500"
                : "border-gray-200 hover:border-gray-300"
            } ${isEditing ? "cursor-move" : ""}`}
            onClick={(e) => {
              // Click to select block (but not if clicking the settings button)
              if (isEditing && !(e.target as HTMLElement).closest('button')) {
                onBlockClick?.(block.id)
              }
            }}
          >
            {isEditing && (
              <div className="absolute top-2 right-2 z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    onBlockClick?.(block.id)
                  }}
                  className={`p-1.5 rounded-md shadow-sm transition-all ${
                    selectedBlockId === block.id
                      ? "bg-blue-600 text-white opacity-100"
                      : "bg-white text-gray-600 opacity-0 group-hover:opacity-100 border border-gray-300 hover:bg-gray-50"
                  }`}
                  title="Configure block"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>
            )}
            <div className="h-full w-full group">
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
