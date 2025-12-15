/**
 * Grid Layout Utilities
 * Helper functions for react-grid-layout style reflow
 */

import type { Layout } from 'vue-grid-layout'

/**
 * Smart reflow algorithm - pushes blocks down to avoid overlaps
 * Similar to Airtable's block reflow behavior
 */
export function handleSmartReflow(layout: Layout[]): Layout[] {
  // Clone layout
  const newLayout = [...layout]

  // Sort blocks by y position (top to bottom), then by x
  newLayout.sort((a, b) => {
    if (a.y === b.y) {
      return a.x - b.x
    }
    return a.y - b.y
  })

  // Reflow algorithm
  for (let i = 1; i < newLayout.length; i++) {
    const prev = newLayout[i - 1]
    const curr = newLayout[i]

    // If current block overlaps or touches previous block vertically, push it down
    if (curr.y < prev.y + prev.h) {
      curr.y = prev.y + prev.h
    }
  }

  return newLayout
}

/**
 * Calculate next available position for a new block
 */
export function getNextPosition(layout: Layout[], defaultSize: { w: number; h: number }): { x: number; y: number } {
  if (layout.length === 0) {
    return { x: 0, y: 0 }
  }

  // Find the bottom-most block
  const bottomBlock = layout.reduce((prev, curr) => {
    return curr.y + curr.h > prev.y + prev.h ? curr : prev
  })

  // Place new block below the bottom-most block
  return {
    x: 0,
    y: bottomBlock.y + bottomBlock.h,
  }
}
