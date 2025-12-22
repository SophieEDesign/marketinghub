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
  onBlockDelete?: (blockId: string) => void
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
  onBlockDelete,
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

  // Empty state: Show friendly message when no blocks exist
  if (blocks.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">📄</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            This interface is empty
          </h3>
          <p className="text-sm text-gray-500">
            {isEditing
              ? "Click the 'Add block' button to get started building your interface."
              : "Edit this interface to add blocks and customize it."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full">
      <ResponsiveGridLayout
        className={`layout ${isEditing ? "" : "view-mode"}`}
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
        draggableHandle=".drag-handle"
      >
        {blocks.map((block) => (
          <div
            key={block.id}
            className={`relative group ${
              isEditing
                ? `bg-white border-2 border-dashed border-transparent hover:border-gray-300 rounded-lg overflow-hidden ${
                    selectedBlockId === block.id
                      ? "ring-2 ring-blue-500 border-blue-500"
                      : ""
                  }`
                : "bg-transparent border-0 shadow-none"
            }`}
            onClick={(e) => {
              // Only allow selection in edit mode, and not if clicking buttons
              if (isEditing && !(e.target as HTMLElement).closest('button')) {
                onBlockClick?.(block.id)
              }
            }}
          >
            {/* Drag Handle - Only visible in edit mode on hover */}
            {isEditing && (
              <div className="absolute top-2 left-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity drag-handle">
                <div
                  className="cursor-grab active:cursor-grabbing p-1.5 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
                  title="Drag to reorder"
                >
                  <svg className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 12h16M4 16h16" />
                  </svg>
                </div>
              </div>
            )}

            {/* Settings and Delete Buttons - Only visible in edit mode on hover */}
            {isEditing && (
              <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    onBlockClick?.(block.id)
                  }}
                  className={`p-1.5 rounded-md shadow-sm transition-all ${
                    selectedBlockId === block.id
                      ? "bg-blue-600 text-white opacity-100"
                      : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
                  }`}
                  title="Configure block"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                {onBlockDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      if (confirm("Are you sure you want to delete this block?")) {
                        onBlockDelete(block.id)
                      }
                    }}
                    className="p-1.5 rounded-md shadow-sm bg-white text-red-600 border border-red-300 hover:bg-red-50 transition-all"
                    title="Delete block"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Block Content */}
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
