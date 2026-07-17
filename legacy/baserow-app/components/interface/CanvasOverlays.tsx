"use client"

import type { LayoutItem } from "@/lib/interface/types"

export function CanvasDragGhostOverlay({
  dragGhost,
  layoutSettings,
  containerWidth,
}: {
  dragGhost: { x: number; y: number; w: number; h: number }
  layoutSettings?: { cols?: number; rowHeight?: number; margin?: [number, number] }
  containerWidth: number
}) {
  const cols = layoutSettings?.cols || 12
  const rowHeight = layoutSettings?.rowHeight || 30
  const margin = layoutSettings?.margin || [10, 10]
  const colWidth = (containerWidth - (margin[0] * (cols + 1))) / cols
  const xPosition = dragGhost.x * colWidth + dragGhost.x * margin[0] + margin[0]
  const yPosition = dragGhost.y * rowHeight + dragGhost.y * margin[1] + margin[1]
  const width = dragGhost.w * colWidth + (dragGhost.w - 1) * margin[0]
  const height = dragGhost.h * rowHeight + (dragGhost.h - 1) * margin[1]
  return (
    <div
      className="absolute pointer-events-none z-40 border-2 border-blue-400 bg-blue-50/30 rounded-lg transition-all duration-150"
      style={{
        left: `${xPosition}px`,
        top: `${yPosition}px`,
        width: `${width}px`,
        height: `${height}px`,
      }}
    />
  )
}

export function CanvasAlignmentOverlay({
  layout,
  layoutSettings,
  draggedBlockId,
  containerWidth,
}: {
  layout: LayoutItem[]
  layoutSettings?: { cols?: number; rowHeight?: number; margin?: [number, number] }
  draggedBlockId: string | null
  containerWidth: number
}) {
  if (!draggedBlockId) return null
  const draggedBlock = layout.find((l) => l.i === draggedBlockId)
  if (!draggedBlock) return null

  const cols = layoutSettings?.cols || 12
  const rowHeight = layoutSettings?.rowHeight || 30
  const margin = layoutSettings?.margin || [10, 10]
  const colWidth = (containerWidth - (margin[0] * (cols + 1))) / cols

  const alignedBlocks: Array<{ blockId: string; x?: number; y?: number; type: 'vertical' | 'horizontal' }> = []
  layout.forEach((otherBlock) => {
    if (otherBlock.i === draggedBlockId) return
    const draggedX = draggedBlock.x || 0
    const draggedY = draggedBlock.y || 0
    const otherX = otherBlock.x || 0
    const otherY = otherBlock.y || 0
    if (
      Math.abs(draggedX - otherX) < 0.5 ||
      Math.abs((draggedX + (draggedBlock.w || 4)) - (otherX + (otherBlock.w || 4))) < 0.5
    ) {
      alignedBlocks.push({ blockId: otherBlock.i, x: otherX, type: 'vertical' })
    }
    if (
      Math.abs(draggedY - otherY) < 0.5 ||
      Math.abs((draggedY + (draggedBlock.h || 4)) - (otherY + (otherBlock.h || 4))) < 0.5
    ) {
      alignedBlocks.push({ blockId: otherBlock.i, y: otherY, type: 'horizontal' })
    }
  })

  return (
    <div className="absolute inset-0 pointer-events-none z-40">
      {alignedBlocks.map((aligned, idx) => {
        if (aligned.type === 'vertical' && aligned.x !== undefined) {
          const xPosition = aligned.x * colWidth + aligned.x * margin[0] + margin[0]
          return (
            <div
              key={`align-v-${aligned.blockId}-${idx}`}
              className="absolute top-0 bottom-0 w-px bg-green-400 opacity-40"
              style={{ left: `${xPosition}px` }}
            />
          )
        }
        if (aligned.type === 'horizontal' && aligned.y !== undefined) {
          const yPosition = aligned.y * rowHeight + aligned.y * margin[1] + margin[1]
          return (
            <div
              key={`align-h-${aligned.blockId}-${idx}`}
              className="absolute left-0 right-0 h-px bg-green-400 opacity-40"
              style={{ top: `${yPosition}px` }}
            />
          )
        }
        return null
      })}
    </div>
  )
}

export function CanvasSnapGuideOverlay({
  activeSnapTargets,
  layoutSettings,
  containerWidth,
}: {
  activeSnapTargets: { vertical?: { x: number }; horizontal?: { y: number } }
  layoutSettings?: { cols?: number; rowHeight?: number; margin?: [number, number] }
  containerWidth: number
}) {
  const cols = layoutSettings?.cols || 12
  const rowHeight = layoutSettings?.rowHeight || 30
  const margin = layoutSettings?.margin || [10, 10]
  const colWidth = (containerWidth - (margin[0] * (cols + 1))) / cols
  return (
    <div className="absolute inset-0 pointer-events-none z-50">
      {activeSnapTargets.vertical && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-blue-500 opacity-60 transition-opacity duration-150"
          style={{
            left: `${(activeSnapTargets.vertical.x || 0) * colWidth + (activeSnapTargets.vertical.x || 0) * margin[0] + margin[0]}px`,
            transform: 'translateX(-50%)',
          }}
        />
      )}
      {activeSnapTargets.horizontal && (
        <div
          className="absolute left-0 right-0 h-0.5 bg-blue-500 opacity-60 transition-opacity duration-150"
          style={{
            top: `${(activeSnapTargets.horizontal.y || 0) * rowHeight + (activeSnapTargets.horizontal.y || 0) * margin[1] + margin[1]}px`,
          }}
        />
      )}
    </div>
  )
}
