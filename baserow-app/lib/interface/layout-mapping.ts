/**
 * CRITICAL: Single source of truth for layout mapping
 * 
 * NO defaults
 * NO || 4
 * NO guessing
 * 
 * If layout is missing → return null, show SetupState
 */

import type { PageBlock, LayoutItem } from './types'

/**
 * Convert PageBlock (with position_x/position_y/width/height) to LayoutItem (x/y/w/h)
 * 
 * CRITICAL: If any layout value is null/undefined, return null (don't default)
 * This forces SetupState instead of silent defaults
 */
export function blockToLayoutItem(block: PageBlock): LayoutItem | null {
  // CRITICAL: If ANY layout value is missing, return null (invalid state)
  if (
    block.x == null ||
    block.y == null ||
    block.w == null ||
    block.h == null
  ) {
    return null
  }

  return {
    i: block.id,
    x: block.x,
    y: block.y,
    w: block.w,
    h: block.h,
    minW: 2,
    minH: 2,
  }
}

/**
 * Convert LayoutItem (x/y/w/h) to DB update format (position_x/position_y/width/height)
 * 
 * CRITICAL: No defaults - if value is missing, throw error
 */
export function layoutItemToDbUpdate(layoutItem: LayoutItem): {
  position_x: number
  position_y: number
  width: number
  height: number
} {
  // CRITICAL: Validate all values exist
  if (
    layoutItem.x == null ||
    layoutItem.y == null ||
    layoutItem.w == null ||
    layoutItem.h == null
  ) {
    throw new Error(`Invalid layout item: missing x/y/w/h values for block ${layoutItem.i}`)
  }

  return {
    position_x: layoutItem.x,
    position_y: layoutItem.y,
    width: layoutItem.w,
    height: layoutItem.h,
  }
}

/**
 * Convert DB block (position_x/position_y/width/height) to PageBlock format (x/y/w/h)
 * 
 * CRITICAL: If ALL values are null, return null (new block, needs setup)
 * If SOME values are null, throw error (corrupted state)
 */
export function dbBlockToPageBlock(block: {
  id: string
  position_x: number | null
  position_y: number | null
  width: number | null
  height: number | null
  [key: string]: any
}): { x: number; y: number; w: number; h: number } | null {
  const allNull =
    block.position_x == null &&
    block.position_y == null &&
    block.width == null &&
    block.height == null

  if (allNull) {
    // New block - no layout yet
    return null
  }

  // CRITICAL: If SOME values are null, this is corrupted state
  const someNull =
    block.position_x == null ||
    block.position_y == null ||
    block.width == null ||
    block.height == null

  if (someNull) {
    throw new Error(
      `Corrupted layout state for block ${block.id}: Some layout values are null. ` +
      `position_x=${block.position_x}, position_y=${block.position_y}, ` +
      `width=${block.width}, height=${block.height}`
    )
  }

  // All values exist - return mapped values
  return {
    x: block.position_x!,
    y: block.position_y!,
    w: block.width!,
    h: block.height!,
  }
}
