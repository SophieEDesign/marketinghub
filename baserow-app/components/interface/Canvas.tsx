"use client"

/**
 * CANVAS CONTRACT (Non-Negotiable Rules)
 * 
 * A) No Autofit
 *    - Block heights are NEVER automatically set based on content
 *    - Height only changes via: user manual resize (persistent) or ephemeral expansion (runtime)
 * 
 * B) Resizing is User-Controlled
 *    - Manual resize changes saved layout (x,y,w,h) and persists
 *    - No code may override user-set h
 *    - No snap-back after resize
 * 
 * C) Stack Behaviour for Collapsible Expansion
 *    - Opening pushes blocks below down immediately
 *    - Closing pulls blocks below up immediately
 *    - No gaps left after collapse
 *    - Expansion is ephemeral (runtime only), not saved
 * 
 * D) No Phantom Gaps
 *    - After any collapse/close, layout compacts vertically
 *    - Only intentional spacing: divider blocks or user drag positioning
 * 
 * E) Blocks Fit Together
 *    - Snapping supports: left/right, top/bottom, corner alignment
 *    - Generous threshold (3+ grid units)
 *    - Snapping never alters heights, only x/y alignment
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import { Responsive, WidthProvider, Layout } from "react-grid-layout"
import "react-grid-layout/css/styles.css"
import "react-resizable/css/styles.css"
import BlockRenderer from "./BlockRenderer"
import BlockAppearanceWrapper from "./BlockAppearanceWrapper"
import { ErrorBoundary } from "./ErrorBoundary"
import type { PageBlock, LayoutItem, BlockType } from "@/lib/interface/types"
import { useFilterState } from "@/lib/interface/filter-state"
import type { FilterTree } from "@/lib/filters/canonical-model"
import { dbBlockToPageBlock } from "@/lib/interface/layout-mapping"
import { debugLog, debugWarn, isDebugEnabled } from "@/lib/interface/debug-flags"
import { usePageAggregates } from "@/lib/dashboard/usePageAggregates"

const ResponsiveGridLayout = WidthProvider(Responsive)

interface CanvasProps {
  blocks: PageBlock[]
  isEditing: boolean
  onLayoutChange?: (layout: LayoutItem[]) => void
  onBlockUpdate?: (blockId: string, config: Partial<PageBlock["config"]>) => void
  onBlockClick?: (blockId: string) => void
  onBlockSettingsClick?: (blockId: string) => void
  onBlockDelete?: (blockId: string) => void
  onBlockDuplicate?: (blockId: string) => void
  onBlockMoveToTop?: (blockId: string) => void
  onBlockMoveToBottom?: (blockId: string) => void
  onAddBlock?: (type: BlockType) => void | Promise<void>
  selectedBlockId?: string | null
  selectedBlockIds?: Set<string> // Multi-select support
  onBlockSelect?: (blockId: string, addToSelection?: boolean) => void
  layoutSettings?: {
    cols?: number
    rowHeight?: number
    margin?: [number, number]
  }
  primaryTableId?: string | null
  layoutTemplate?: string | null
  interfaceDescription?: string | null
  pageTableId?: string | null // Table ID from the page
  pageId?: string | null // Page ID
  recordId?: string | null // Record ID for record review pages
  mode?: 'view' | 'edit' | 'review' // Record review mode: view (no editing), edit (full editing), review (content editing without layout)
  onRecordClick?: (recordId: string) => void // Callback for record clicks (for RecordReview integration)
  pageShowAddRecord?: boolean // Page-level default for showing "Add record" buttons in data blocks
  pageEditable?: boolean // Page-level editability (for field blocks)
  editableFieldNames?: string[] // Field-level editable list (for field blocks)
}

export default function Canvas({
  blocks,
  isEditing,
  onLayoutChange,
  onBlockUpdate,
  onBlockClick,
  onBlockSettingsClick,
  onBlockDelete,
  onBlockDuplicate,
  onBlockMoveToTop,
  onBlockMoveToBottom,
  onAddBlock,
  selectedBlockId,
  selectedBlockIds,
  onBlockSelect,
  layoutSettings = { cols: 12, rowHeight: 30, margin: [10, 10] },
  primaryTableId,
  layoutTemplate,
  interfaceDescription,
  pageTableId = null,
  pageId = null,
  recordId = null,
  mode = 'view', // Default to view mode
  onRecordClick,
  pageShowAddRecord = false,
  pageEditable,
  editableFieldNames = [],
}: CanvasProps) {
  // Get filters from filter blocks for this block
  const { getFiltersForBlock, getFilterTreeForBlock } = useFilterState()
  
  // CRITICAL: Fetch aggregate data at page level (inside FilterStateProvider)
  // This eliminates duplicate requests - SWR handles deduplication automatically
  // Fetch all aggregates for KPI blocks using per-block page filters.
  // This ensures a Filter block only affects the KPI blocks it targets.
  const aggregateData = usePageAggregates(blocks, (blockId) => getFiltersForBlock(blockId))
  
  // Identify top two field blocks (by y position) for inline editing without Edit button
  // Only consider field blocks in the right column (x >= 4) for record view pages
  const topTwoFieldBlockIds = useMemo(() => {
    const fieldBlocks = blocks
      .filter(block => {
        // Only field blocks
        if (block.type !== 'field') return false
        // For record view pages, only consider blocks in right column (x >= 4)
        // For other pages, consider all field blocks
        const blockX = block.x ?? 0
        if (mode === 'view' && recordId) {
          return blockX >= 4
        }
        return true
      })
      .sort((a, b) => {
        // Sort by y position, then by x position
        const aY = a.y ?? 0
        const bY = b.y ?? 0
        if (aY !== bY) return aY - bY
        return (a.x ?? 0) - (b.x ?? 0)
      })
      .slice(0, 2) // Get top two
      .map(block => block.id)
    
    return new Set(fieldBlocks)
  }, [blocks, mode, recordId])
  
  // Persistent layout state (saved to DB)
  const [layout, setLayout] = useState<Layout[]>([])
  
  // Ephemeral expansion deltas (runtime only, not saved)
  // Maps blockId -> deltaH (additional height in grid units from collapsible expansion)
  const [ephemeralDeltas, setEphemeralDeltas] = useState<Map<string, number>>(new Map())
  
  // Layout version for preventing stale sync overwrites
  const layoutVersionRef = useRef<number>(0)
  
  // Basic refs for tracking state
  const previousBlockIdsRef = useRef<string>("")
  const prevPageIdRef = useRef<string | null>(pageId || null)
  const isFirstLayoutChangeRef = useRef(true)
  
  // Track drag state for snap detection
  const dragStartPositionRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const dragLastPositionRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const currentlyDraggingBlockIdRef = useRef<string | null>(null)
  const currentlyResizingBlockIdRef = useRef<string | null>(null)
  
  // CRITICAL: Convert pixels to grid units (React Grid Layout height includes margins)
  // This ensures height values from content measurement are correctly converted
  const toGridH = useCallback((px: number): number => {
    const rowHeight = layoutSettings?.rowHeight || 30
    const marginY = (layoutSettings?.margin || [10, 10])[1]
    // RGL height includes margins between rows. This is the practical conversion:
    return Math.max(2, Math.ceil((px + marginY) / (rowHeight + marginY)))
  }, [layoutSettings?.rowHeight, layoutSettings?.margin])
  
  // Helper to notify parent of layout changes (user actions only)
  const notifyLayoutChange = useCallback((layoutItems: LayoutItem[]) => {
    if (!onLayoutChange) return
    onLayoutChange(layoutItems)
  }, [onLayoutChange])
  
  // ============================================================================
  // CORE LAYOUT FUNCTIONS (Clean Architecture)
  // ============================================================================
  
  /**
   * Applies user layout change (drag/resize end) - persists to DB
   */
  const applyUserLayoutChange = useCallback((newLayout: Layout[]) => {
    // Increment layout version to prevent stale sync overwrites
    layoutVersionRef.current += 1
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[Canvas] User layout change persisted', {
        version: layoutVersionRef.current,
        blockCount: newLayout.length,
      })
    }
    
    // Update local state
    setLayout(newLayout)
    
    // Persist to DB (only persistent h, not ephemeral deltas)
    const layoutItems: LayoutItem[] = newLayout.map((item) => ({
      i: item.i,
      x: item.x || 0,
      y: item.y || 0,
      w: item.w || 4,
      h: item.h || 4, // Only persistent h, ephemeral deltas never saved
    }))
    notifyLayoutChange(layoutItems)
  }, [notifyLayoutChange])
  
  /**
   * Applies ephemeral height delta (collapsible expansion) - runtime only
   * Note: pushBlocksDown and compactLayoutVertically are defined later but are stable useCallbacks
   */
  const applyEphemeralHeightDelta = useCallback((blockId: string, deltaPx: number) => {
    const deltaH = toGridH(deltaPx) // Convert to grid units
    
    // Update ephemeral deltas and get previous delta in one operation
    let previousDelta = 0
    setEphemeralDeltas(prev => {
      previousDelta = prev.get(blockId) || 0
      const newDeltas = new Map(prev)
      if (Math.abs(deltaH) < 0.01) {
        newDeltas.delete(blockId) // Remove if zero
      } else {
        newDeltas.set(blockId, deltaH)
      }
      return newDeltas
    })
    
    const isExpanding = deltaH > previousDelta
    const isCollapsing = deltaH < previousDelta
    const deltaChange = deltaH - previousDelta
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[Canvas] Ephemeral height delta', {
        blockId,
        deltaPx,
        deltaH,
        previousDelta,
        deltaChange,
        isExpanding,
        isCollapsing,
      })
    }
    
    // Apply reflow immediately using current layout state
    // Note: pushBlocksDown and compactLayoutVertically are defined later but are stable useCallbacks
    // They will be available when setLayout's callback executes (after render completes)
    setLayout(currentLayout => {
      if (isExpanding && deltaChange > 0) {
        // Block expanding - push blocks below down using the change in delta
        const updatedLayout = pushBlocksDown(currentLayout, blockId, deltaChange)
        if (process.env.NODE_ENV === 'development') {
          console.log('[Canvas] Pushed blocks down after ephemeral expand', { blockId, deltaChange })
        }
        return updatedLayout
      } else if (isCollapsing) {
        // Block collapsing - compact vertically
        const compactedLayout = compactLayoutVertically(currentLayout, blocks)
        if (process.env.NODE_ENV === 'development') {
          console.log('[Canvas] Compacted layout after ephemeral collapse', { blockId, deltaH })
        }
        return compactedLayout
      }
      return currentLayout
    })
  }, [toGridH, blocks])
  
  /**
   * Handler for ephemeral height delta callback from blocks
   */
  const handleEphemeralHeightDelta = useCallback((blockId: string, deltaPx: number) => {
    // Ignore if user is manually resizing or dragging
    if (currentlyResizingBlockIdRef.current === blockId) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Canvas] Ignored ephemeral delta - user resizing', { blockId })
      }
      return
    }
    if (currentlyDraggingBlockIdRef.current === blockId) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Canvas] Ignored ephemeral delta - user dragging', { blockId })
      }
      return
    }
    
    applyEphemeralHeightDelta(blockId, deltaPx)
  }, [applyEphemeralHeightDelta])
  
  // PHASE 4.1: Dev utility to reset layout heights (one-time use)
  // Exposes a function to reset all block heights, keeping x/y/w
  // Usage: In browser console, call window.resetCanvasHeights()
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      // @ts-expect-error - Dev utility
      window.resetCanvasHeights = async () => {
        console.log('[Canvas] PHASE 4: Resetting layout heights for all blocks...')
        
        if (!pageId) {
          console.error('[Canvas] Cannot reset heights: pageId is required')
          return
        }
        
        try {
          // Call API to reset heights
          const response = await fetch(`/api/pages/${pageId}/blocks/reset-heights`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          })
          
          if (!response.ok) {
            const error = await response.text()
            throw new Error(`Failed to reset heights: ${error}`)
          }
          
          const result = await response.json()
          console.log('[Canvas] Heights reset complete:', result)
          console.log('[Canvas] Refreshing page to see changes...')
          
          // Reload page to see the reset take effect
          window.location.reload()
        } catch (error) {
          console.error('[Canvas] Error resetting heights:', error)
          console.log('[Canvas] Falling back to manual reset via layout update...')
          
          // Fallback: Update layout with default heights (4) and let content re-measure
          if (onLayoutChange) {
            const resetLayout: LayoutItem[] = blocks.map((block) => ({
              i: block.id,
              x: block.x || 0,
              y: block.y || 0,
              w: block.w || 4,
              h: 4, // Default height - content will re-measure via onHeightChange
            }))
            
            onLayoutChange(resetLayout)
            console.log('[Canvas] Layout updated with default heights. Content will re-measure.')
          }
        }
      }
      
      return () => {
        // Cleanup: Remove dev utility on unmount
        if (typeof window !== 'undefined') {
          // @ts-expect-error - Dev utility function added dynamically
          delete window.resetCanvasHeights
        }
      }
    }
  }, [pageId, blocks, onLayoutChange])

  // Track active snap targets for visual feedback during drag
  const [activeSnapTargets, setActiveSnapTargets] = useState<{
    vertical?: { x: number; blockId: string }
    horizontal?: { y: number; blockId: string }
    highlightedBlocks?: string[] // Block IDs to highlight
  } | null>(null)
  
  // Track keyboard movement for visual feedback
  const [keyboardMoveHighlight, setKeyboardMoveHighlight] = useState<string | null>(null)
  
  // Grid overlay toggle
  const [showGridOverlay, setShowGridOverlay] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('canvas-grid-overlay') === 'true'
    }
    return false
  })
  
  // Drag ghost/preview state
  const [dragGhost, setDragGhost] = useState<{
    blockId: string
    x: number
    y: number
    w: number
    h: number
  } | null>(null)
  
  // Reset state when page changes
  useEffect(() => {
    if (prevPageIdRef.current !== pageId && pageId) {
      const oldPageId = prevPageIdRef.current
      prevPageIdRef.current = pageId
      previousBlockIdsRef.current = ""
      layoutVersionRef.current = 0
      isFirstLayoutChangeRef.current = true
      setLayout([])
      setEphemeralDeltas(new Map())
      debugLog('LAYOUT', '[Canvas] Page changed - resetting state', {
        oldPageId,
        newPageId: pageId,
      })
    }
  }, [pageId])
  
  // Lifecycle logging
  useEffect(() => {
    debugLog('LAYOUT', `Canvas MOUNT: pageId=${pageId}, blocks=${blocks.length}, recordId=${recordId}`)
    return () => {
      debugLog('LAYOUT', `Canvas UNMOUNT: pageId=${pageId}, recordId=${recordId}`)
    }
  }, [])

  /**
   * Syncs layout state from blocks prop - simplified with version tracking
   * 
   * Only syncs when:
   * 1. First load (layout empty)
   * 2. Block IDs changed (add/remove)
   * 3. Blocks prop has newer data (version check)
   * 
   * Never syncs during user interaction (tracked by layoutVersion)
   * Ephemeral expansion doesn't affect persistent layout, so no sync needed
   */
  useEffect(() => {
    // Don't sync if no blocks
    if (blocks.length === 0) {
      if (previousBlockIdsRef.current !== "") {
        previousBlockIdsRef.current = ""
        layoutVersionRef.current = 0
        setLayout([])
        setEphemeralDeltas(new Map())
      }
      return
    }

    const currentBlockIds = blocks.map(b => b.id).sort().join(",")
    const previousBlockIds = previousBlockIdsRef.current
    const blockIdsChanged = previousBlockIds === "" || currentBlockIds !== previousBlockIds
    const layoutIsEmpty = layout.length === 0 && blocks.length > 0
    
    // Only sync if block IDs changed or layout is empty (first load)
    // Version tracking prevents stale overwrites (handled by layoutVersionRef in applyUserLayoutChange)
    const shouldSync = blockIdsChanged || layoutIsEmpty
    
    if (process.env.NODE_ENV === 'development') {
      debugLog('LAYOUT', '[Canvas] Layout sync check', {
        pageId,
        blocksCount: blocks.length,
        blockIdsChanged,
        layoutIsEmpty,
        shouldSync,
        layoutVersion: layoutVersionRef.current,
      })
    }
    
    if (shouldSync) {
      // Hydrate from blocks prop - always use persistent h from DB
      const newLayout: Layout[] = blocks.map((block) => {
        const layout = dbBlockToPageBlock({
          id: block.id,
          position_x: block.x,
          position_y: block.y,
          width: block.w,
          height: block.h,
        })
        
        if (!layout) {
          // New block - apply defaults
          return {
            i: block.id,
            x: 0,
            y: 0,
            w: 4,
            h: 4,
            minW: 2,
            minH: 2,
          }
        }
        
        // Existing block - use DB values (always use persistent h, no autofit)
        return {
          i: block.id,
          x: layout.x,
          y: layout.y,
          w: layout.w,
          h: layout.h || 4, // Always use persistent h from DB
          minW: 2,
          minH: 2,
        }
      })
      
      setLayout(newLayout)
      previousBlockIdsRef.current = currentBlockIds
      
      if (process.env.NODE_ENV === 'development') {
        debugLog('LAYOUT', '[Canvas] Layout synced from blocks', {
          blockCount: blocks.length,
          isFirstLoad: previousBlockIds === "",
        })
      }
    }
  }, [blocks, pageId])

  /**
   * Detects nearby blocks for snapping on all sides (top, bottom, left, right)
   * Returns snap candidates with their distances and target positions
   */
  const detectSnapTargets = useCallback((
    draggedBlock: Layout,
    allLayout: Layout[],
    snapThreshold?: number // Grid units - will be calculated if not provided
  ): {
    left?: { block: Layout; distance: number; targetX: number }
    right?: { block: Layout; distance: number; targetX: number }
    top?: { block: Layout; distance: number; targetY: number }
    bottom?: { block: Layout; distance: number; targetY: number }
  } => {
    // Calculate adaptive snap threshold - keep it small to prevent jumping
    // Only snap when blocks are very close (within ~1 grid unit)
    const margin = layoutSettings?.margin || [10, 10]
    const rowHeight = layoutSettings?.rowHeight || 30
    // Convert margin from pixels to grid units
    const marginInGridUnits = Math.max(margin[0], margin[1]) / rowHeight
    // Use a small threshold (1-1.5 grid units) to only snap when blocks are truly close
    // This prevents jumping while still allowing blocks to snap together
    // The margin is handled by react-grid-layout as CSS, so blocks can be adjacent in grid coords
    const baseThreshold = Math.ceil(marginInGridUnits * 1.5)
    // CRITICAL: Snap threshold must be generous and predictable (at least 3 grid units)
    // Previous max(1, min(2, ...)) was too restrictive and prevented snapping from triggering
    const calculatedThreshold = snapThreshold ?? 3
    
    const draggedX = draggedBlock.x || 0
    const draggedY = draggedBlock.y || 0
    const draggedW = draggedBlock.w || 4
    const draggedH = draggedBlock.h || 4
    const draggedRight = draggedX + draggedW
    const draggedBottom = draggedY + draggedH
    
    const snapTargets: {
      left?: { block: Layout; distance: number; targetX: number }
      right?: { block: Layout; distance: number; targetX: number }
      top?: { block: Layout; distance: number; targetY: number }
      bottom?: { block: Layout; distance: number; targetY: number }
    } = {}
    
    allLayout.forEach(otherBlock => {
      if (otherBlock.i === draggedBlock.i) return // Skip self
      
      const otherX = otherBlock.x || 0
      const otherY = otherBlock.y || 0
      const otherW = otherBlock.w || 4
      const otherH = otherBlock.h || 4
      const otherRight = otherX + otherW
      const otherBottom = otherY + otherH
      
      // Check horizontal proximity (left/right snapping)
      // Blocks are horizontally adjacent if their Y ranges overlap
      const yOverlap = !(draggedBottom <= otherY || draggedY >= otherBottom)
      
      if (yOverlap) {
        // Check left edge snap (dragged block to the right of other block)
        // Distance is the gap between the dragged block's left edge and the other block's right edge
        const distanceToLeft = Math.abs(draggedX - otherRight)
        if (distanceToLeft <= calculatedThreshold && (!snapTargets.left || distanceToLeft < snapTargets.left.distance)) {
          snapTargets.left = {
            block: otherBlock,
            distance: distanceToLeft,
            targetX: otherRight, // Snap to right edge of other block (close the gap)
          }
        }
        
        // Check right edge snap (dragged block to the left of other block)
        // Distance is the gap between the dragged block's right edge and the other block's left edge
        const distanceToRight = Math.abs(draggedRight - otherX)
        if (distanceToRight <= calculatedThreshold && (!snapTargets.right || distanceToRight < snapTargets.right.distance)) {
          snapTargets.right = {
            block: otherBlock,
            distance: distanceToRight,
            targetX: otherX - draggedW, // Snap to left edge of other block (close the gap)
          }
        }
      }
      
      // Check vertical proximity (top/bottom snapping)
      // Blocks are vertically adjacent if their X ranges overlap
      const xOverlap = !(draggedRight <= otherX || draggedX >= otherRight)
      
      if (xOverlap) {
        // Check top edge snap (dragged block below other block)
        // Distance is the gap between the dragged block's top edge and the other block's bottom edge
        const distanceToTop = Math.abs(draggedY - otherBottom)
        // Only snap if very close (within threshold) and not already overlapping
        if (distanceToTop > 0 && distanceToTop <= calculatedThreshold && (!snapTargets.top || distanceToTop < snapTargets.top.distance)) {
          snapTargets.top = {
            block: otherBlock,
            distance: distanceToTop,
            targetY: otherBottom, // Snap directly adjacent - no gap in grid coordinates
          }
        }
        
        // Check bottom edge snap (dragged block above other block)
        // Distance is the gap between the dragged block's bottom edge and the other block's top edge
        const distanceToBottom = Math.abs(draggedBottom - otherY)
        // Only snap if very close (within threshold) and not already overlapping
        if (distanceToBottom > 0 && distanceToBottom <= calculatedThreshold && (!snapTargets.bottom || distanceToBottom < snapTargets.bottom.distance)) {
          snapTargets.bottom = {
            block: otherBlock,
            distance: distanceToBottom,
            targetY: otherY - draggedH, // Snap directly adjacent - no gap in grid coordinates
          }
        }
      }
    })
    
    // Check if block is near the top of the canvas (y=0)
    // This allows snapping to the top even when there are no other blocks above
    const distanceToCanvasTop = draggedY
    if (distanceToCanvasTop <= calculatedThreshold && (!snapTargets.top || distanceToCanvasTop < snapTargets.top.distance)) {
      snapTargets.top = {
        block: draggedBlock, // Use dragged block as placeholder (not used for actual block reference)
        distance: distanceToCanvasTop,
        targetY: 0, // Snap to top of canvas
      }
    }
    
    // Check for corner snap (simultaneous X and Y snap)
    // This happens when a block can snap to both horizontal and vertical edges
    if (snapTargets.left || snapTargets.right) {
      if (snapTargets.top || snapTargets.bottom) {
        // Corner snap detected - mark it in the return value
        // The caller can use this to apply both snaps simultaneously
        return {
          ...snapTargets,
          corner: true,
        } as typeof snapTargets & { corner?: boolean }
      }
    }
    
    return snapTargets
  }, [layoutSettings?.margin, layoutSettings?.rowHeight])
  
  /**
   * Applies horizontal snap to a dragged block if valid snap targets exist
   * Returns the snapped position or null if no valid snap
   */
  const applyHorizontalSnap = useCallback((
    draggedBlock: Layout,
    allLayout: Layout[],
    dragVector: { dx: number; dy: number } | null,
    cols: number
  ): Layout | null => {
    const snapTargets = detectSnapTargets(draggedBlock, allLayout)
    
    // Determine dominant snap direction based on:
    // 1. Drag vector (user intent)
    // 2. Smallest distance (proximity)
    
    let bestSnap: 'left' | 'right' | null = null
    let bestDistance = Infinity
    
    // Prefer horizontal snap if drag vector indicates horizontal movement
    if (dragVector && Math.abs(dragVector.dx) > Math.abs(dragVector.dy)) {
      // User is dragging horizontally - prefer horizontal snap
      if (snapTargets.left && snapTargets.left.distance < bestDistance) {
        bestSnap = 'left'
        bestDistance = snapTargets.left.distance
      }
      if (snapTargets.right && snapTargets.right.distance < bestDistance) {
        bestSnap = 'right'
        bestDistance = snapTargets.right.distance
      }
    } else {
      // No strong horizontal intent, use proximity
      if (snapTargets.left && snapTargets.left.distance < bestDistance) {
        bestSnap = 'left'
        bestDistance = snapTargets.left.distance
      }
      if (snapTargets.right && snapTargets.right.distance < bestDistance) {
        bestSnap = 'right'
        bestDistance = snapTargets.right.distance
      }
    }
    
    if (!bestSnap) return null
    
    const snapTarget = bestSnap === 'left' ? snapTargets.left! : snapTargets.right!
    const snappedX = snapTarget.targetX
    
    // Ensure snapped position respects grid boundaries
    const clampedX = Math.max(0, Math.min(snappedX, cols - (draggedBlock.w || 4)))
    
    // Check if snapped position would cause overlap
    const draggedW = draggedBlock.w || 4
    const draggedH = draggedBlock.h || 4
    const draggedY = draggedBlock.y || 0
    
    let wouldOverlap = false
    allLayout.forEach(otherBlock => {
      if (otherBlock.i === draggedBlock.i) return
      
      const otherX = otherBlock.x || 0
      const otherY = otherBlock.y || 0
      const otherW = otherBlock.w || 4
      const otherH = otherBlock.h || 4
      
      // Check if blocks would overlap
      // Two blocks overlap if their ranges intersect (not just touch)
      // Range [a1, a2] and [b1, b2] overlap if: a2 > b1 && a1 < b2
      const xOverlap = (clampedX + draggedW > otherX) && (clampedX < otherX + otherW)
      const yOverlap = (draggedY + draggedH > otherY) && (draggedY < otherY + otherH)
      
      if (xOverlap && yOverlap) {
        wouldOverlap = true
      }
    })
    
    if (wouldOverlap) return null
    
    // Valid horizontal snap
    return {
      ...draggedBlock,
      x: clampedX,
    }
  }, [detectSnapTargets])
  
  /**
   * Applies vertical snap to a dragged block if valid snap targets exist
   * Returns the snapped position or null if no valid snap
   */
  const applyVerticalSnap = useCallback((
    draggedBlock: Layout,
    allLayout: Layout[]
  ): Layout | null => {
    const snapTargets = detectSnapTargets(draggedBlock, allLayout)
    
    // Determine best vertical snap based on proximity
    let bestSnap: 'top' | 'bottom' | null = null
    let bestDistance = Infinity
    
    if (snapTargets.top && snapTargets.top.distance < bestDistance) {
      bestSnap = 'top'
      bestDistance = snapTargets.top.distance
    }
    if (snapTargets.bottom && snapTargets.bottom.distance < bestDistance) {
      bestSnap = 'bottom'
      bestDistance = snapTargets.bottom.distance
    }
    
    if (!bestSnap) return null
    
    const snapTarget = bestSnap === 'top' ? snapTargets.top! : snapTargets.bottom!
    const snappedY = snapTarget.targetY
    
    // Ensure snapped position is non-negative
    const clampedY = Math.max(0, snappedY)
    
    // Check if snapped position would cause overlap
    const draggedW = draggedBlock.w || 4
    const draggedH = draggedBlock.h || 4
    const draggedX = draggedBlock.x || 0
    
    let wouldOverlap = false
    allLayout.forEach(otherBlock => {
      if (otherBlock.i === draggedBlock.i) return
      
      const otherX = otherBlock.x || 0
      const otherY = otherBlock.y || 0
      const otherW = otherBlock.w || 4
      const otherH = otherBlock.h || 4
      
      // Check if blocks would overlap
      // Two blocks overlap if their ranges intersect (not just touch)
      // Range [a1, a2] and [b1, b2] overlap if: a2 > b1 && a1 < b2
      const xOverlap = (draggedX + draggedW > otherX) && (draggedX < otherX + otherW)
      const yOverlap = (clampedY + draggedH > otherY) && (clampedY < otherY + otherH)
      
      if (xOverlap && yOverlap) {
        wouldOverlap = true
      }
    })
    
    if (wouldOverlap) return null
    
    // Valid vertical snap
    return {
      ...draggedBlock,
      y: clampedY,
    }
  }, [detectSnapTargets])
  
  /**
   * Applies smart snapping with priority based on drag direction
   * If dragging primarily vertically, prioritize vertical snap
   * If dragging primarily horizontally, prioritize horizontal snap
   * This respects user intent by matching snap direction to drag direction
   */
  /**
   * Applies corner snap (simultaneous X and Y snap) if both are available
   */
  const applyCornerSnap = useCallback((
    draggedBlock: Layout,
    allLayout: Layout[],
    dragVector: { dx: number; dy: number } | null,
    cols: number
  ): Layout | null => {
    const snapTargets = detectSnapTargets(draggedBlock, allLayout) as ReturnType<typeof detectSnapTargets> & { corner?: boolean }
    
    // Check if we have both horizontal and vertical snap targets (corner snap)
    const hasHorizontal = !!(snapTargets.left || snapTargets.right)
    const hasVertical = !!(snapTargets.top || snapTargets.bottom)
    
    if (!hasHorizontal || !hasVertical) return null
    
    // Determine best horizontal snap
    let bestHorizontal: { targetX: number } | null = null
    if (snapTargets.left && (!snapTargets.right || snapTargets.left.distance < snapTargets.right.distance)) {
      bestHorizontal = { targetX: snapTargets.left.targetX }
    } else if (snapTargets.right) {
      bestHorizontal = { targetX: snapTargets.right.targetX }
    }
    
    // Determine best vertical snap
    let bestVertical: { targetY: number } | null = null
    if (snapTargets.top && (!snapTargets.bottom || snapTargets.top.distance < snapTargets.bottom.distance)) {
      bestVertical = { targetY: snapTargets.top.targetY }
    } else if (snapTargets.bottom) {
      bestVertical = { targetY: snapTargets.bottom.targetY }
    }
    
    if (!bestHorizontal || !bestVertical) return null
    
    const snappedX = Math.max(0, Math.min(bestHorizontal.targetX, cols - (draggedBlock.w || 4)))
    const snappedY = Math.max(0, bestVertical.targetY)
    
    // Check for overlap
    const draggedW = draggedBlock.w || 4
    const draggedH = draggedBlock.h || 4
    
    let wouldOverlap = false
    allLayout.forEach(otherBlock => {
      if (otherBlock.i === draggedBlock.i) return
      
      const otherX = otherBlock.x || 0
      const otherY = otherBlock.y || 0
      const otherW = otherBlock.w || 4
      const otherH = otherBlock.h || 4
      
      const xOverlap = (snappedX + draggedW > otherX) && (snappedX < otherX + otherW)
      const yOverlap = (snappedY + draggedH > otherY) && (snappedY < otherY + otherH)
      
      if (xOverlap && yOverlap) {
        wouldOverlap = true
      }
    })
    
    if (wouldOverlap) return null
    
    return {
      ...draggedBlock,
      x: snappedX,
      y: snappedY,
    }
  }, [detectSnapTargets])
  
  const applySmartSnap = useCallback((
    draggedBlock: Layout,
    allLayout: Layout[],
    dragVector: { dx: number; dy: number } | null,
    cols: number
  ): Layout => {
    // First, try corner snap (simultaneous X and Y)
    const cornerSnapped = applyCornerSnap(draggedBlock, allLayout, dragVector, cols)
    if (cornerSnapped) {
      debugLog('LAYOUT', `[Canvas] Applied corner snap to block ${draggedBlock.i}`, {
        originalX: draggedBlock.x,
        originalY: draggedBlock.y,
        snappedX: cornerSnapped.x,
        snappedY: cornerSnapped.y,
      })
      return cornerSnapped
    }
    
    // Determine primary drag direction
    const isVerticalDrag = dragVector && Math.abs(dragVector.dy) > Math.abs(dragVector.dx)
    const isHorizontalDrag = dragVector && Math.abs(dragVector.dx) > Math.abs(dragVector.dy)
    
    // If dragging primarily vertically, try vertical snap first
    if (isVerticalDrag) {
      const verticalSnapped = applyVerticalSnap(draggedBlock, allLayout)
      if (verticalSnapped) {
        debugLog('LAYOUT', `[Canvas] Applied vertical snap to block ${draggedBlock.i}`, {
          originalY: draggedBlock.y,
          snappedY: verticalSnapped.y,
          direction: draggedBlock.y! > verticalSnapped.y ? 'top' : 'bottom',
        })
        return verticalSnapped
      }
      
      // If vertical snap didn't work, try horizontal as fallback
      const horizontalSnapped = applyHorizontalSnap(draggedBlock, allLayout, dragVector, cols)
      if (horizontalSnapped) {
        debugLog('LAYOUT', `[Canvas] Applied horizontal snap to block ${draggedBlock.i} (fallback)`, {
          originalX: draggedBlock.x,
          snappedX: horizontalSnapped.x,
          direction: draggedBlock.x! > horizontalSnapped.x ? 'left' : 'right',
        })
        return horizontalSnapped
      }
    } else {
      // Default: try horizontal snap first (for horizontal drags or no clear direction)
      const horizontalSnapped = applyHorizontalSnap(draggedBlock, allLayout, dragVector, cols)
      if (horizontalSnapped) {
        debugLog('LAYOUT', `[Canvas] Applied horizontal snap to block ${draggedBlock.i}`, {
          originalX: draggedBlock.x,
          snappedX: horizontalSnapped.x,
          direction: draggedBlock.x! > horizontalSnapped.x ? 'left' : 'right',
        })
        return horizontalSnapped
      }
      
      // Try vertical snap as second priority
      const verticalSnapped = applyVerticalSnap(draggedBlock, allLayout)
      if (verticalSnapped) {
        debugLog('LAYOUT', `[Canvas] Applied vertical snap to block ${draggedBlock.i}`, {
          originalY: draggedBlock.y,
          snappedY: verticalSnapped.y,
          direction: draggedBlock.y! > verticalSnapped.y ? 'top' : 'bottom',
        })
        return verticalSnapped
      }
    }
    
    // No snap available - return original position
    // Vertical compaction will be applied separately if needed
    return draggedBlock
  }, [applyHorizontalSnap, applyVerticalSnap, applyCornerSnap])
  
  /**
   * Pushes blocks below a growing block down to prevent overlap
   * This preserves block order - blocks are pushed down, not reordered
   * 
   * Algorithm:
   * 1. Find the resized/expanded block and calculate its new bottom edge (h + deltaH)
   * 2. Sort all blocks by y position (top to bottom)
   * 3. For each block, check if it overlaps with blocks above it (including resized block)
   * 4. Push block down to the first available position below all overlapping blocks
   * 5. Process blocks in order to handle cascading pushes correctly
   * 
   * @param currentLayout - Current layout state
   * @param expandedBlockId - Block that grew (resize or ephemeral expansion)
   * @param deltaH - Additional height from ephemeral expansion (default: 0 for manual resize)
   */
  const pushBlocksDown = useCallback((currentLayout: Layout[], expandedBlockId: string, deltaH: number = 0): Layout[] => {
    const expandedBlock = currentLayout.find(l => l.i === expandedBlockId)
    if (!expandedBlock) return currentLayout
    
    const expandedX = expandedBlock.x || 0
    const expandedW = expandedBlock.w || 4
    const expandedY = expandedBlock.y || 0
    const expandedH = expandedBlock.h || 4
    // Use effective height (persistent h + ephemeral deltaH)
    const effectiveH = expandedH + deltaH
    const expandedBottom = expandedY + effectiveH
    
    // Sort all blocks by y position (top to bottom), then by x (left to right)
    // This ensures we process blocks in order and handle cascading pushes correctly
    const sortedLayout = [...currentLayout].sort((a, b) => {
      const aY = a.y || 0
      const bY = b.y || 0
      if (aY !== bY) return aY - bY
      return (a.x || 0) - (b.x || 0)
    })
    
    // Track new positions as we process blocks
    const newPositions = new Map<string, number>()
    
    sortedLayout.forEach(block => {
      const blockX = block.x || 0
      const blockW = block.w || 4
      const blockY = block.y || 0
      const blockH = block.h || 4
      
      // Start with the block's current Y position
      let minY = blockY
      
      // Check overlap with the expanded block
      if (block.i !== expandedBlockId) {
        const xOverlap = !(expandedX + expandedW <= blockX || expandedX >= blockX + blockW)
        if (xOverlap) {
          // Block overlaps horizontally with expanded block
          // If block is at or below the expanded block's top, ensure it's below the expanded block's bottom
          if (blockY >= expandedY) {
            minY = Math.max(minY, expandedBottom)
          }
        }
      }
      
      // Check overlap with all blocks that have already been processed (including pushed blocks)
      sortedLayout.forEach(otherBlock => {
        if (otherBlock.i === block.i) return
        
        const otherX = otherBlock.x || 0
        const otherW = otherBlock.w || 4
        // Use new position if available, otherwise use original position
        const otherY = newPositions.get(otherBlock.i) ?? (otherBlock.y || 0)
        const otherH = otherBlock.h || 4
        const otherBottom = otherY + otherH
        
        // Check if blocks overlap horizontally
        const xOverlap = !(blockX + blockW <= otherX || blockX >= otherX + otherW)
        
        // If overlapping and other block is above this block, push this block down
        if (xOverlap && otherBottom > minY && otherY < minY + blockH) {
          minY = otherBottom
        }
      })
      
      // Store the new position
      newPositions.set(block.i, minY)
    })
    
    // Apply new positions
    return currentLayout.map(block => {
      const newY = newPositions.get(block.i)
      if (newY !== undefined && Math.abs(newY - (block.y || 0)) > 0.01) {
        return {
          ...block,
          y: newY,
        }
      }
      return block
    })
  }, [])
  
  /**
   * Detects gaps in the layout (empty spaces between blocks)
   * Returns array of gap positions that could be filled
   */
  const detectGaps = useCallback((currentLayout: Layout[], cols: number): Array<{ x: number; y: number; w: number; h: number }> => {
    const gaps: Array<{ x: number; y: number; w: number; h: number }> = []
    const maxY = currentLayout.length > 0 
      ? Math.max(...currentLayout.map(l => (l.y || 0) + (l.h || 4)))
      : 0
    
    // Create a map of occupied cells
    const occupied = new Map<string, string>()
    currentLayout.forEach(item => {
      const x = item.x || 0
      const y = item.y || 0
      const w = item.w || 4
      const h = item.h || 4
      
      for (let cellX = x; cellX < x + w && cellX < cols; cellX++) {
        for (let cellY = y; cellY < y + h; cellY++) {
          occupied.set(`${cellX},${cellY}`, item.i)
        }
      }
    })
    
    // Scan for gaps (unoccupied cells)
    for (let y = 0; y <= maxY; y++) {
      for (let x = 0; x < cols; x++) {
        const key = `${x},${y}`
        if (!occupied.has(key)) {
          // Found a gap - find its extent
          let gapW = 1
          let gapH = 1
          
          // Find width (how many consecutive empty cells to the right)
          while (x + gapW < cols && !occupied.has(`${x + gapW},${y}`)) {
            gapW++
          }
          
          // Find height (how many consecutive empty rows)
          let canExtendDown = true
          while (canExtendDown) {
            let rowEmpty = true
            for (let checkX = x; checkX < x + gapW; checkX++) {
              if (occupied.has(`${checkX},${y + gapH}`)) {
                rowEmpty = false
                break
              }
            }
            if (rowEmpty && y + gapH <= maxY) {
              gapH++
            } else {
              canExtendDown = false
            }
          }
          
          // Mark this gap area as processed
          for (let markX = x; markX < x + gapW; markX++) {
            for (let markY = y; markY < y + gapH; markY++) {
              occupied.set(`${markX},${markY}`, 'gap')
            }
          }
          
          gaps.push({ x, y, w: gapW, h: gapH })
        }
      }
    }
    
    return gaps
  }, [])
  
  /**
   * Vertically compact layout by shifting blocks upward to fill gaps
   * This ensures that when a block shrinks, moves, or is deleted, blocks below shift up
   * 
   * Algorithm:
   * 1. Sort all blocks by y position (top to bottom), then by x (left to right)
   * 2. For each block, find the lowest y position where it fits without overlapping blocks above
   * 3. Shift block to that position (allows upward movement to fill gaps)
   * 
   * Divider blocks are treated as intentional spacing and maintain their height
   */
  const compactLayoutVertically = useCallback((currentLayout: Layout[], currentBlocks: PageBlock[]): Layout[] => {
    // Create a map of block types for quick lookup
    const blockTypeMap = new Map<string, BlockType>()
    currentBlocks.forEach(block => {
      blockTypeMap.set(block.id, block.type)
    })
    
    // Sort blocks by y position (top to bottom), then by x (left to right)
    // This ensures we process blocks from top to bottom
    const sortedLayout = [...currentLayout].sort((a, b) => {
      const aY = a.y || 0
      const bY = b.y || 0
      if (aY !== bY) return aY - bY
      return (a.x || 0) - (b.x || 0)
    })
    
    // Track occupied grid cells: Map<`x,y`, blockId>
    // This prevents overlapping blocks
    const occupied = new Map<string, string>()
    
    const compacted: Layout[] = []
    
    sortedLayout.forEach(item => {
      const w = item.w || 4
      const h = item.h || 4
      const x = item.x || 0
      
      // Find the lowest y position where this block fits without overlapping
      let bestY = 0
      
      // Start from y=0 and work upward until we find a valid position
      // This allows blocks to shift UP to fill gaps
      while (true) {
        let canFit = true
        
        // Check all grid cells this block would occupy at this y position
        for (let cellX = x; cellX < x + w; cellX++) {
          for (let cellY = bestY; cellY < bestY + h; cellY++) {
            const key = `${cellX},${cellY}`
            const occupyingBlockId = occupied.get(key)
            
            // If cell is occupied by a different block, can't fit here
            if (occupyingBlockId && occupyingBlockId !== item.i) {
              canFit = false
              break
            }
          }
          if (!canFit) break
        }
        
        if (canFit) {
          // Found a valid position
          break
        } else {
          // Try next y position
          bestY++
        }
      }
      
      // Mark all cells as occupied by this block
      for (let cellX = x; cellX < x + w; cellX++) {
        for (let cellY = bestY; cellY < bestY + h; cellY++) {
          occupied.set(`${cellX},${cellY}`, item.i)
        }
      }
      
      // Add block with new y position
      compacted.push({
        ...item,
        y: bestY,
      })
    })
    
    return compacted
  }, [])


  /**
   * Handles layout changes during drag/resize (intermediate updates)
   * Final persistence happens in onResizeStop/onDragStop
   */
  const handleLayoutChange = useCallback(
    (newLayout: Layout[]) => {
      // Ignore when not in edit mode
      if (!isEditing) {
        if (isFirstLayoutChangeRef.current) {
          debugLog('LAYOUT', '[Canvas] Ignoring layout change - not in edit mode')
        }
        isFirstLayoutChangeRef.current = false
        return
      }
      
      // Ignore first layout change after mount (grid normalization)
      if (isFirstLayoutChangeRef.current) {
        debugLog('LAYOUT', '[Canvas] Ignoring first layout change (grid normalization)')
        isFirstLayoutChangeRef.current = false
        return
      }

      // Only update if user is actively dragging or resizing
      if (!currentlyDraggingBlockIdRef.current && !currentlyResizingBlockIdRef.current) {
        debugWarn('LAYOUT', '[Canvas] Ignoring layout change (no user interaction)')
        return
      }
      
      // Update local layout state immediately for responsive UI
      // Final persistence happens in onResizeStop/onDragStop via applyUserLayoutChange
      setLayout(newLayout)
    },
    [isEditing]
  )
  
  // Reset first layout change flag when entering edit mode
  useEffect(() => {
    if (isEditing) {
      isFirstLayoutChangeRef.current = true
    }
  }, [isEditing])

  // Trigger compaction when blocks are deleted (block count decreases)
  const previousBlockCountRef = useRef<number>(blocks.length)
  useEffect(() => {
    const blockCountDecreased = blocks.length < previousBlockCountRef.current
    
    if (blockCountDecreased && isEditing && layout.length > 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Canvas] Block deleted - compacting layout', {
          previousCount: previousBlockCountRef.current,
          currentCount: blocks.length,
        })
      }
      
      // Apply compaction immediately
      setLayout(currentLayout => {
        // Filter out deleted blocks
        const validLayout = currentLayout.filter(item => 
          blocks.some(block => block.id === item.i)
        )
        
        // Compact vertically
        const compactedLayout = compactLayoutVertically(validLayout, blocks)
        
        // Check if compaction changed anything
        const layoutChanged = compactedLayout.some((item) => {
          const original = validLayout.find(l => l.i === item.i)
          if (!original) return true
          return (
            Math.abs((item.x || 0) - (original.x || 0)) > 0.01 ||
            Math.abs((item.y || 0) - (original.y || 0)) > 0.01 ||
            Math.abs((item.w || 4) - (original.w || 4)) > 0.01 ||
            Math.abs((item.h || 4) - (original.h || 4)) > 0.01
          )
        })
        
        if (layoutChanged) {
          // Persist compacted layout
          applyUserLayoutChange(compactedLayout)
          return compactedLayout
        }
        
        return validLayout
      })
    }
    
    previousBlockCountRef.current = blocks.length
  }, [blocks.length, layout.length, isEditing, compactLayoutVertically, applyUserLayoutChange])

  
  // Grid overlay toggle keyboard shortcut (Cmd+G)
  useEffect(() => {
    if (!isEditing) return
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      const target = e.target as HTMLElement
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return
      }
      
      // Toggle grid overlay: Cmd+G
      if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
        e.preventDefault()
        setShowGridOverlay(prev => {
          const newValue = !prev
          if (typeof window !== 'undefined') {
            localStorage.setItem('canvas-grid-overlay', String(newValue))
          }
          return newValue
        })
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isEditing])
  
  // Arrow key navigation for selected block
  useEffect(() => {
    if (!isEditing || !selectedBlockId) return
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      const target = e.target as HTMLElement
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return
      }
      
      // Only handle arrow keys
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        return
      }
      
      // Prevent default scrolling
      e.preventDefault()
      
      const selectedBlock = layout.find(l => l.i === selectedBlockId)
      if (!selectedBlock) return
      
      const cols = layoutSettings?.cols || 12
      const moveDistance = e.shiftKey ? 5 : 1 // Shift+Arrow moves 5 units
      
      let newX = selectedBlock.x || 0
      let newY = selectedBlock.y || 0
      
      switch (e.key) {
        case 'ArrowUp':
          newY = Math.max(0, newY - moveDistance)
          break
        case 'ArrowDown':
          newY = newY + moveDistance
          break
        case 'ArrowLeft':
          newX = Math.max(0, newX - moveDistance)
          break
        case 'ArrowRight':
          newX = Math.min(cols - (selectedBlock.w || 4), newX + moveDistance)
          break
      }
      
      // Check for overlap
      const wouldOverlap = layout.some(otherBlock => {
        if (otherBlock.i === selectedBlockId) return false
        
        const otherX = otherBlock.x || 0
        const otherY = otherBlock.y || 0
        const otherW = otherBlock.w || 4
        const otherH = otherBlock.h || 4
        const blockW = selectedBlock.w || 4
        const blockH = selectedBlock.h || 4
        
        const xOverlap = (newX + blockW > otherX) && (newX < otherX + otherW)
        const yOverlap = (newY + blockH > otherY) && (newY < otherY + otherH)
        
        return xOverlap && yOverlap
      })
      
      if (wouldOverlap) return
      
      // Apply snap if near other blocks
      const movedBlock: Layout = {
        ...selectedBlock,
        x: newX,
        y: newY,
      }
      
      const dragVector = {
        dx: newX - (selectedBlock.x || 0),
        dy: newY - (selectedBlock.y || 0),
      }
      
      // PHASE 3.2: Re-enable smart snap for keyboard moves (runs after layout is stable)
      const snappedBlock = applySmartSnap(movedBlock, layout, dragVector, cols)
      
      // Update layout
      const newLayout = layout.map(item => 
        item.i === selectedBlockId ? snappedBlock : item
      )
      
      setLayout(newLayout)
      
      // Show visual feedback
      setKeyboardMoveHighlight(selectedBlockId)
      setTimeout(() => setKeyboardMoveHighlight(null), 200)
      
      // Notify parent
      const layoutItems: LayoutItem[] = newLayout.map((item) => ({
        i: item.i,
        x: item.x || 0,
        y: item.y || 0,
        w: item.w || 4,
        h: item.h || 4,
      }))
      notifyLayoutChange(layoutItems)
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isEditing, selectedBlockId, layout, layoutSettings?.cols, applySmartSnap, notifyLayoutChange])

  // CRITICAL: Grid configuration must be IDENTICAL for edit and public view
  // isEditing ONLY controls interactivity (isDraggable, isResizable)
  // All layout-affecting props (cols, rowHeight, margin, compactType, etc.) must be identical
  // This ensures identical grid math → identical layout → edit === public
  // CRITICAL: This is a CONSTANT - never depends on props that could differ between edit/public
  // CRITICAL: This hook MUST be called before any early returns (React Hooks rules)
  const GRID_CONFIG = useMemo(() => {
    // Use layoutSettings if provided, otherwise use defaults
    // CRITICAL: These defaults must be the same in edit and public view
    const cols = layoutSettings?.cols || 12
    const rowHeight = layoutSettings?.rowHeight || 30
    const margin = layoutSettings?.margin || [10, 10]
    
    return {
      cols: { lg: cols, md: 10, sm: 6, xs: 4, xxs: 2 },
      rowHeight,
      margin,
      // CRITICAL: Disable compaction - we store absolute positions in DB
      // compactType="vertical" causes React-Grid-Layout to reflow blocks on mount
      // This makes saved positions "snap back" even though DB is correct
      // Airtable, Notion, Linear, Retool all disable compaction for DB-authoritative layouts
      compactType: null, // Disabled - use explicit coordinates from DB
      isBounded: false, // Disabled - don't push items back inside bounds
      preventCollision: false, // Disabled - allow blocks to adjust into grid during drag/resize
      allowOverlap: false, // Still prevent final overlap
      containerPadding: [0, 0] as [number, number],
      useCSSTransforms: true,
    }
  }, [layoutSettings?.cols, layoutSettings?.rowHeight, layoutSettings?.margin])
  
  // Add CSS for smooth block animations
  // CRITICAL: Height transitions are disabled - they delay reflow on collapse
  // Only animate transform (position) and width, never height
  // Airtable prioritises correctness over animation
  useEffect(() => {
    if (!isEditing) return
    
    const style = document.createElement('style')
    style.textContent = `
      .react-grid-item {
        /* CRITICAL: Do NOT transition height - it delays reflow on collapse */
        /* Height changes must be immediate for proper layout reflow */
        transition: transform 200ms ease, width 200ms ease !important;
      }
      .react-grid-item.cssTransforms {
        transition: transform 200ms ease !important;
      }
      .react-grid-item.resizing {
        transition: none !important;
      }
      .react-grid-item.dragging {
        transition: none !important;
        z-index: 1000 !important;
      }
    `
    document.head.appendChild(style)
    
    return () => {
      document.head.removeChild(style)
    }
  }, [isEditing])
  // CRITICAL: isEditing, pageId, layout, blocks.length, isViewer, mode are NOT in dependencies
  // Grid config must be identical regardless of edit mode

  // Empty state: Show template-specific guidance
  // Log blocks received by Canvas
  useEffect(() => {
    debugLog('LAYOUT', `[Canvas] blocks prop changed: pageId=${pageId}, blocksCount=${blocks.length}`, {
      blockIds: blocks.map(b => b.id),
      blockTypes: blocks.map(b => b.type),
      isEditing,
    })
  }, [blocks.length, pageId]) // Removed isEditing - mode changes don't affect block rendering

  // Log container width for debugging
  // CRITICAL: Must be declared before any early returns (Rules of Hooks)
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (containerRef.current) {
      const width = containerRef.current.offsetWidth
      debugLog('LAYOUT', `[Canvas] Container width: ${width}px (pageId=${pageId}, isEditing=${isEditing})`)
    }
  }, [pageId, isEditing, layout.length])

  // GUARDRAIL LOG: Log grid signature to verify grid config is identical in edit/public
  // CRITICAL: Use useState + useEffect to prevent hydration mismatch - localStorage access must happen after mount
  // CRITICAL: Hooks must be called before any early returns (React rules of hooks)
  const [shouldLogLayout, setShouldLogLayout] = useState(false)
  
  useEffect(() => {
    setShouldLogLayout(isDebugEnabled('LAYOUT'))
  }, [])
  
  useEffect(() => {
    if (shouldLogLayout) {
      try {
        const layoutSignature = (layout || []).map(item => ({
          id: item.i,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
        })).sort((a, b) => a.id.localeCompare(b.id))
        
        // Sanity log: layout BEFORE grid (to verify DB positions match what we're passing to grid)
        debugLog('LAYOUT', `[Canvas] layout BEFORE grid: pageId=${pageId}`, 
          layout.map(l => `${l.i}:${l.x},${l.y}`).join(' | ')
        )
        
        debugLog('LAYOUT', `[Canvas] Grid Layout Signature: pageId=${pageId}, isEditing=${isEditing}`, {
          // Grid configuration (MUST be identical - if these differ, layout will diverge)
          cols: JSON.stringify(GRID_CONFIG.cols),
          rowHeight: GRID_CONFIG.rowHeight,
          margin: JSON.stringify(GRID_CONFIG.margin),
          compactType: GRID_CONFIG.compactType, // CRITICAL: Should be null (disabled)
          isBounded: GRID_CONFIG.isBounded, // CRITICAL: Should be false (disabled)
          preventCollision: GRID_CONFIG.preventCollision, // CRITICAL: Set to false to allow blocks to adjust into grid
          allowOverlap: GRID_CONFIG.allowOverlap,
          containerPadding: JSON.stringify(GRID_CONFIG.containerPadding),
          useCSSTransforms: GRID_CONFIG.useCSSTransforms,
          // Layout state (must be identical)
          layoutLength: layout.length,
          blocksCount: blocks.length,
          layoutSignature: JSON.stringify(layoutSignature),
          // Interactivity (can differ - this is OK, only affects drag/resize)
          isDraggable: isEditing,
          isResizable: isEditing,
        })
      } catch (error) {
        // If log fails, at least log that it failed
        debugWarn('LAYOUT', '[Canvas] Grid Layout Signature log failed:', error)
      }
    }
  }, [shouldLogLayout, layout, blocks.length, pageId, isEditing])

  return (
    <ErrorBoundary>
      {/* CRITICAL: Canvas wrapper must have min-width: 0 to prevent flex collapse */}
      {/* This ensures the grid gets the full available width, not constrained by parent flex containers */}
      {/* CRITICAL: Parent stack uses normal document flow - reflows immediately when child heights change */}
      {/* No cached heights, no min-height persistence, no delayed updates */}
      {/* Add padding-bottom to ensure bottom blocks aren't cut off by taskbar */}
      <div ref={containerRef} className="w-full h-full min-w-0 relative" style={{ paddingBottom: isEditing ? '80px' : '80px' }}>
        {/* Grid overlay */}
        {isEditing && showGridOverlay && containerRef.current && (() => {
          const cols = layoutSettings?.cols || 12
          const rowHeight = layoutSettings?.rowHeight || 30
          const margin = layoutSettings?.margin || [10, 10]
          const containerWidth = containerRef.current?.offsetWidth || 0
          const colWidth = (containerWidth - (margin[0] * (cols + 1))) / cols
          const maxRows = 50 // Show grid for first 50 rows
          
          return (
            <div className="absolute inset-0 pointer-events-none z-10 opacity-20">
              {/* Vertical grid lines */}
              {Array.from({ length: cols + 1 }).map((_, i) => {
                const xPosition = i * colWidth + i * margin[0] + margin[0]
                return (
                  <div
                    key={`v-${i}`}
                    className="absolute top-0 bottom-0 w-px bg-gray-400"
                    style={{ left: `${xPosition}px` }}
                  />
                )
              })}
              {/* Horizontal grid lines */}
              {Array.from({ length: maxRows + 1 }).map((_, i) => {
                const yPosition = i * rowHeight + i * margin[1] + margin[1]
                return (
                  <div
                    key={`h-${i}`}
                    className="absolute left-0 right-0 h-px bg-gray-400"
                    style={{ top: `${yPosition}px` }}
                  />
                )
              })}
            </div>
          )
        })()}
        
        {/* Drag ghost/preview */}
        {isEditing && dragGhost && containerRef.current && (() => {
          const cols = layoutSettings?.cols || 12
          const rowHeight = layoutSettings?.rowHeight || 30
          const margin = layoutSettings?.margin || [10, 10]
          const containerWidth = containerRef.current?.offsetWidth || 0
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
        })()}
        
        {/* Alignment helpers - show alignment guides for all blocks when dragging */}
        {isEditing && activeSnapTargets && containerRef.current && (() => {
          const draggedBlockId = currentlyDraggingBlockIdRef.current
          if (!draggedBlockId) return null
          
          const draggedBlock = layout.find(l => l.i === draggedBlockId)
          if (!draggedBlock) return null
          
          const cols = layoutSettings?.cols || 12
          const rowHeight = layoutSettings?.rowHeight || 30
          const margin = layoutSettings?.margin || [10, 10]
          const containerWidth = containerRef.current?.offsetWidth || 0
          const colWidth = (containerWidth - (margin[0] * (cols + 1))) / cols
          
          // Find blocks that align with the dragged block
          const alignedBlocks: Array<{ blockId: string; x?: number; y?: number; type: 'vertical' | 'horizontal' }> = []
          
          layout.forEach(otherBlock => {
            if (otherBlock.i === draggedBlockId) return
            
            const draggedX = draggedBlock.x || 0
            const draggedY = draggedBlock.y || 0
            const otherX = otherBlock.x || 0
            const otherY = otherBlock.y || 0
            
            // Check vertical alignment (same X or aligned edges)
            if (Math.abs(draggedX - otherX) < 0.5 || 
                Math.abs((draggedX + (draggedBlock.w || 4)) - (otherX + (otherBlock.w || 4))) < 0.5) {
              alignedBlocks.push({ blockId: otherBlock.i, x: otherX, type: 'vertical' })
            }
            
            // Check horizontal alignment (same Y or aligned edges)
            if (Math.abs(draggedY - otherY) < 0.5 ||
                Math.abs((draggedY + (draggedBlock.h || 4)) - (otherY + (otherBlock.h || 4))) < 0.5) {
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
                      style={{
                        left: `${xPosition}px`,
                      }}
                    />
                  )
                } else if (aligned.type === 'horizontal' && aligned.y !== undefined) {
                  const yPosition = aligned.y * rowHeight + aligned.y * margin[1] + margin[1]
                  return (
                    <div
                      key={`align-h-${aligned.blockId}-${idx}`}
                      className="absolute left-0 right-0 h-px bg-green-400 opacity-40"
                      style={{
                        top: `${yPosition}px`,
                      }}
                    />
                  )
                }
                return null
              })}
            </div>
          )
        })()}
        
        {/* Guide lines overlay for snap feedback during drag */}
        {isEditing && activeSnapTargets && containerRef.current && (
          <div className="absolute inset-0 pointer-events-none z-50">
            {activeSnapTargets.vertical && (() => {
              const cols = layoutSettings?.cols || 12
              const margin = layoutSettings?.margin || [10, 10]
              const containerWidth = containerRef.current?.offsetWidth || 0
              const colWidth = (containerWidth - (margin[0] * (cols + 1))) / cols
              const xPosition = (activeSnapTargets.vertical.x || 0) * colWidth + (activeSnapTargets.vertical.x || 0) * margin[0] + margin[0]
              return (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-blue-500 opacity-60 transition-opacity duration-150"
                  style={{
                    left: `${xPosition}px`,
                    transform: 'translateX(-50%)',
                  }}
                />
              )
            })()}
            {activeSnapTargets.horizontal && (() => {
              const rowHeight = layoutSettings?.rowHeight || 30
              const margin = layoutSettings?.margin || [10, 10]
              const yPosition = (activeSnapTargets.horizontal.y || 0) * rowHeight + (activeSnapTargets.horizontal.y || 0) * margin[1] + margin[1]
              return (
                <div
                  className="absolute left-0 right-0 h-0.5 bg-blue-500 opacity-60 transition-opacity duration-150"
                  style={{
                    top: `${yPosition}px`,
                  }}
                />
              )
            })()}
          </div>
        )}
        <ResponsiveGridLayout
          className="layout" // CRITICAL: No conditional classes - identical in edit and public
          layouts={{ lg: layout.map(item => {
            // Use effective height (persistent h + ephemeral deltaH) for positioning
            const deltaH = ephemeralDeltas.get(item.i) || 0
            const effectiveH = (item.h || 4) + deltaH
            return {
              ...item,
              h: effectiveH, // React Grid Layout uses effectiveH for positioning
            }
          }) }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          // CRITICAL: All layout-affecting props come from GRID_CONFIG constant
          // isEditing MUST NOT appear in any of these props
          cols={GRID_CONFIG.cols}
          rowHeight={GRID_CONFIG.rowHeight}
          margin={GRID_CONFIG.margin}
          compactType={GRID_CONFIG.compactType}
          isBounded={GRID_CONFIG.isBounded}
          preventCollision={GRID_CONFIG.preventCollision}
          allowOverlap={GRID_CONFIG.allowOverlap}
          containerPadding={GRID_CONFIG.containerPadding}
          useCSSTransforms={GRID_CONFIG.useCSSTransforms}
          // CRITICAL: isEditing ONLY controls interactivity (never layout geometry)
          isDraggable={isEditing}
          isResizable={isEditing}
          onLayoutChange={handleLayoutChange}
          onResizeStart={(layout, oldItem, newItem, placeholder, e, element) => {
            const blockId = oldItem.i
            currentlyResizingBlockIdRef.current = blockId
            debugLog('LAYOUT', `[Canvas] Resize started for block ${blockId}`, {
              initialHeight: oldItem.h || 4,
            })
          }}
          onResizeStop={(layout, oldItem, newItem, placeholder, e, element) => {
            const blockId = oldItem.i
            const previousHeight = oldItem.h || 4
            const newHeight = newItem.h || 4
            
            if (process.env.NODE_ENV === 'development') {
              console.log('[Canvas] Resize stopped - persisting user layout change', {
                blockId,
                previousHeight,
                newHeight,
              })
            }
            
            // Use layout parameter (has current resized position)
            const resizedBlock = layout.find(l => l.i === blockId)
            if (!resizedBlock) {
              currentlyResizingBlockIdRef.current = null
              return
            }
            
            // Check if height changed and apply reflow
            const heightIncreased = newHeight > previousHeight
            const heightDecreased = newHeight < previousHeight
            
            let finalLayout = layout
            
            if (heightIncreased) {
              // Block grew - push blocks below down
              finalLayout = pushBlocksDown(layout, blockId, 0) // No ephemeral delta for manual resize
              if (process.env.NODE_ENV === 'development') {
                console.log('[Canvas] Pushed blocks down after resize grow', { blockId, newHeight })
              }
            } else if (heightDecreased) {
              // Block shrunk - compact vertically
              finalLayout = compactLayoutVertically(layout, blocks)
              if (process.env.NODE_ENV === 'development') {
                console.log('[Canvas] Compacted layout after resize shrink', { blockId, newHeight })
              }
            }
            
            // Persist final layout (user resize always persists)
            applyUserLayoutChange(finalLayout)
            
            // Clear resize tracking
            currentlyResizingBlockIdRef.current = null
          }}
          onDragStart={(layout, oldItem, newItem, placeholder, e, element) => {
            // Track drag start position for snap detection
            const blockId = oldItem.i
            currentlyDraggingBlockIdRef.current = blockId
            dragStartPositionRef.current.set(blockId, {
              x: oldItem.x || 0,
              y: oldItem.y || 0,
            })
            dragLastPositionRef.current.set(blockId, {
              x: oldItem.x || 0,
              y: oldItem.y || 0,
            })
            
            // Show drag ghost
            setDragGhost({
              blockId,
              x: oldItem.x || 0,
              y: oldItem.y || 0,
              w: oldItem.w || 4,
              h: oldItem.h || 4,
            })
            
            debugLog('LAYOUT', `[Canvas] Drag started for block ${blockId}`, {
              startX: oldItem.x,
              startY: oldItem.y,
            })
          }}
          onDrag={(layout, oldItem, newItem, placeholder, e, element) => {
            // Update last position during drag (for drag vector calculation)
            const blockId = oldItem.i
            dragLastPositionRef.current.set(blockId, {
              x: newItem.x || 0,
              y: newItem.y || 0,
            })
            
            // Update drag ghost position
            if (dragGhost && dragGhost.blockId === blockId) {
              setDragGhost({
                ...dragGhost,
                x: newItem.x || 0,
                y: newItem.y || 0,
              })
            }
            
            // Real-time snap preview during drag
            if (isEditing) {
              const dragStart = dragStartPositionRef.current.get(blockId)
              const dragLast = dragLastPositionRef.current.get(blockId)
              
              let dragVector: { dx: number; dy: number } | null = null
              if (dragStart && dragLast) {
                dragVector = {
                  dx: dragLast.x - dragStart.x,
                  dy: dragLast.y - dragStart.y,
                }
              }
              
              // Apply smart snap for preview (don't modify layout, just show visual feedback)
              const cols = layoutSettings?.cols || 12
              const snapTargets = detectSnapTargets(newItem, layout)
              
              // Determine which snap targets to show based on drag direction
              const isVerticalDrag = dragVector && Math.abs(dragVector.dy) > Math.abs(dragVector.dx)
              const isHorizontalDrag = dragVector && Math.abs(dragVector.dx) > Math.abs(dragVector.dy)
              
              let guideLine: { 
                vertical?: { x: number; blockId: string }
                horizontal?: { y: number; blockId: string }
                highlightedBlocks?: string[]
              } | null = null
              const highlightedBlocks: string[] = []
              
              if (isVerticalDrag) {
                // Prefer vertical snap
                if (snapTargets.top && (!snapTargets.bottom || snapTargets.top.distance < snapTargets.bottom.distance)) {
                  guideLine = {
                    horizontal: {
                      y: snapTargets.top.targetY,
                      blockId: snapTargets.top.block.i,
                    },
                    highlightedBlocks: [snapTargets.top.block.i],
                  }
                } else if (snapTargets.bottom) {
                  guideLine = {
                    horizontal: {
                      y: snapTargets.bottom.targetY,
                      blockId: snapTargets.bottom.block.i,
                    },
                    highlightedBlocks: [snapTargets.bottom.block.i],
                  }
                }
              } else if (isHorizontalDrag) {
                // Prefer horizontal snap
                if (snapTargets.left && (!snapTargets.right || snapTargets.left.distance < snapTargets.right.distance)) {
                  guideLine = {
                    vertical: {
                      x: snapTargets.left.targetX,
                      blockId: snapTargets.left.block.i,
                    },
                    highlightedBlocks: [snapTargets.left.block.i],
                  }
                } else if (snapTargets.right) {
                  guideLine = {
                    vertical: {
                      x: snapTargets.right.targetX,
                      blockId: snapTargets.right.block.i,
                    },
                    highlightedBlocks: [snapTargets.right.block.i],
                  }
                }
              } else {
                // No clear direction - show closest snap
                let bestSnap: { type: 'vertical' | 'horizontal'; x?: number; y?: number; blockId: string; distance: number } | null = null
                
                if (snapTargets.left) {
                  if (bestSnap === null) {
                    bestSnap = { type: 'vertical', x: snapTargets.left.targetX, blockId: snapTargets.left.block.i, distance: snapTargets.left.distance }
                  } else {
                    const currentDistance = (bestSnap as { type: 'vertical' | 'horizontal'; x?: number; y?: number; blockId: string; distance: number }).distance
                    if (snapTargets.left.distance < currentDistance) {
                      bestSnap = { type: 'vertical', x: snapTargets.left.targetX, blockId: snapTargets.left.block.i, distance: snapTargets.left.distance }
                    }
                  }
                }
                if (snapTargets.right) {
                  if (bestSnap === null) {
                    bestSnap = { type: 'vertical', x: snapTargets.right.targetX, blockId: snapTargets.right.block.i, distance: snapTargets.right.distance }
                  } else {
                    const currentDistance = (bestSnap as { type: 'vertical' | 'horizontal'; x?: number; y?: number; blockId: string; distance: number }).distance
                    if (snapTargets.right.distance < currentDistance) {
                      bestSnap = { type: 'vertical', x: snapTargets.right.targetX, blockId: snapTargets.right.block.i, distance: snapTargets.right.distance }
                    }
                  }
                }
                if (snapTargets.top) {
                  if (bestSnap === null) {
                    bestSnap = { type: 'horizontal', y: snapTargets.top.targetY, blockId: snapTargets.top.block.i, distance: snapTargets.top.distance }
                  } else {
                    const currentDistance = (bestSnap as { type: 'vertical' | 'horizontal'; x?: number; y?: number; blockId: string; distance: number }).distance
                    if (snapTargets.top.distance < currentDistance) {
                      bestSnap = { type: 'horizontal', y: snapTargets.top.targetY, blockId: snapTargets.top.block.i, distance: snapTargets.top.distance }
                    }
                  }
                }
                if (snapTargets.bottom) {
                  if (bestSnap === null) {
                    bestSnap = { type: 'horizontal', y: snapTargets.bottom.targetY, blockId: snapTargets.bottom.block.i, distance: snapTargets.bottom.distance }
                  } else {
                    const currentDistance = (bestSnap as { type: 'vertical' | 'horizontal'; x?: number; y?: number; blockId: string; distance: number }).distance
                    if (snapTargets.bottom.distance < currentDistance) {
                      bestSnap = { type: 'horizontal', y: snapTargets.bottom.targetY, blockId: snapTargets.bottom.block.i, distance: snapTargets.bottom.distance }
                    }
                  }
                }
                
                if (bestSnap) {
                  if (bestSnap.type === 'vertical') {
                    guideLine = { 
                      vertical: { x: bestSnap.x!, blockId: bestSnap.blockId },
                      highlightedBlocks: [bestSnap.blockId],
                    }
                  } else {
                    guideLine = { 
                      horizontal: { y: bestSnap.y!, blockId: bestSnap.blockId },
                      highlightedBlocks: [bestSnap.blockId],
                    }
                  }
                }
              }
              
              setActiveSnapTargets(guideLine)
            }
          }}
          onDragStop={(layout, oldItem, newItem, placeholder, e, element) => {
            const blockId = oldItem.i
            dragLastPositionRef.current.set(blockId, {
              x: newItem.x || 0,
              y: newItem.y || 0,
            })
            
            // Clear snap guide lines and drag ghost
            setActiveSnapTargets(null)
            setDragGhost(null)
            
            // Use layout parameter (has current dragged position)
            const draggedBlock = layout.find(l => l.i === blockId)
            if (!draggedBlock) {
              dragStartPositionRef.current.delete(blockId)
              dragLastPositionRef.current.delete(blockId)
              currentlyDraggingBlockIdRef.current = null
              return
            }
            
            // Calculate drag vector for snap detection
            const dragStart = dragStartPositionRef.current.get(blockId)
            const dragLast = dragLastPositionRef.current.get(blockId)
            let dragVector: { dx: number; dy: number } | null = null
            if (dragStart && dragLast) {
              dragVector = {
                dx: dragLast.x - dragStart.x,
                dy: dragLast.y - dragStart.y,
              }
            }
            
            // Apply snapping
            const cols = layoutSettings?.cols || 12
            const snappedBlock = applySmartSnap(draggedBlock, layout, dragVector, cols)
            
            // Check if snap changed position
            const positionChanged = 
              Math.abs((snappedBlock.x || 0) - (draggedBlock.x || 0)) > 0.01 ||
              Math.abs((snappedBlock.y || 0) - (draggedBlock.y || 0)) > 0.01
            
            if (positionChanged) {
              const snappedLayout = layout.map(item => 
                item.i === blockId ? snappedBlock : item
              )
              
              if (process.env.NODE_ENV === 'development') {
                console.log('[Canvas] Snapping applied after drag', {
                  blockId,
                  originalPos: { x: draggedBlock.x, y: draggedBlock.y },
                  snappedPos: { x: snappedBlock.x, y: snappedBlock.y },
                })
              }
              
              // Persist snapped layout
              applyUserLayoutChange(snappedLayout)
            } else {
              // No snap, just persist current position
              applyUserLayoutChange(layout)
            }
            
            // Clear drag tracking
            dragStartPositionRef.current.delete(blockId)
            dragLastPositionRef.current.delete(blockId)
            currentlyDraggingBlockIdRef.current = null
          }}
          draggableHandle=".drag-handle"
          resizeHandles={['se', 'sw', 'ne', 'nw', 'e', 'w', 's', 'n']}
        >
          {blocks.map((block) => {
            // Log each block being rendered
            debugLog('LAYOUT', `[Canvas] Rendering block: pageId=${pageId}, blockId=${block.id}, type=${block.type}`, {
              block,
              layoutItem: layout.find(l => l.i === block.id),
            })
            return (
              <div
                key={block.id}
                className={`relative transition-all duration-200 ${
                  isEditing
                    ? `group bg-white border-2 border-dashed border-gray-200 hover:border-gray-300 rounded-lg shadow-sm hover:shadow-md ${
                        selectedBlockId === block.id
                          ? "ring-2 ring-blue-500 border-blue-500 shadow-lg"
                          : ""
                      } ${
                        activeSnapTargets?.highlightedBlocks?.includes(block.id)
                          ? "ring-2 ring-blue-400 border-blue-400 shadow-md"
                          : ""
                      } ${
                        keyboardMoveHighlight === block.id
                          ? "ring-2 ring-green-400 border-green-400 shadow-lg animate-pulse"
                          : ""
                      }`
                    : "bg-transparent border-0 shadow-none"
                }`}
                onClick={(e) => {
                  // Only allow selection in edit mode, and not if clicking:
                  // - buttons
                  // - inside editor content (quill, textarea, input)
                  // - inside any interactive element
                  // - inside text block editor (prevent settings panel from opening while typing)
                  // CRITICAL: Settings panel should ONLY open when clicking the settings icon, not on block selection
                  if (isEditing) {
                    const target = e.target as HTMLElement
                    const isEditorContent = target.closest('.ql-editor') || 
                                           target.closest('textarea') || 
                                           target.closest('input') ||
                                           target.closest('[contenteditable="true"]') ||
                                           target.closest('button') ||
                                           target.closest('.ql-toolbar') ||
                                           target.closest('[role="textbox"]') ||
                                           target.closest('.ql-container') ||
                                           target.closest('.ql-snow')
                    
                    // Only select block if not clicking editor content
                    // This prevents settings panel from opening when clicking inside text blocks
                    if (!isEditorContent) {
                      // Support multi-select with Cmd/Ctrl or Shift
                      if (onBlockSelect) {
                        const addToSelection = e.metaKey || e.ctrlKey || e.shiftKey
                        onBlockSelect(block.id, addToSelection)
                      } else {
                        onBlockClick?.(block.id)
                      }
                    }
                  }
                }}
              >
            {/* Edit Mode Controls - Only visible in edit mode */}
            {isEditing && (
              <>
                {/* Drag Handle - Only visible on hover, hidden when block is editing (via CSS) */}
                <div
                  className={`absolute top-2 left-2 z-20 drag-handle transition-all duration-200 ${
                    (selectedBlockId === block.id || (selectedBlockIds && selectedBlockIds.has(block.id))) ? "opacity-100 scale-100" : "opacity-30 group-hover:opacity-100 scale-95 group-hover:scale-100"
                  }`}
                >
                  <button
                    type="button"
                    className="cursor-grab active:cursor-grabbing p-2 bg-white/95 backdrop-blur-sm border border-gray-300 rounded-md shadow-sm hover:bg-white hover:border-blue-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 touch-none transition-all duration-150 min-w-[32px] min-h-[32px] flex items-center justify-center"
                    title="Drag to move (or use arrow keys)"
                    aria-label="Drag to move block"
                    onMouseDown={(e) => {
                      // Prevent dragging if TextBlock is editing
                      const blockContent = e.currentTarget
                        .closest(".react-grid-item")
                        ?.querySelector('[data-block-editing="true"]')
                      if (blockContent) {
                        e.preventDefault()
                        e.stopPropagation()
                        return false
                      }
                    }}
                  >
                    {/* 6-dot grip icon (reads as "drag handle" vs menu) */}
                    <svg className="h-4 w-4 text-gray-700 group-hover:text-blue-600 transition-colors" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <circle cx="7" cy="6" r="1.2" />
                      <circle cx="13" cy="6" r="1.2" />
                      <circle cx="7" cy="10" r="1.2" />
                      <circle cx="13" cy="10" r="1.2" />
                      <circle cx="7" cy="14" r="1.2" />
                      <circle cx="13" cy="14" r="1.2" />
                    </svg>
                  </button>
                </div>

                {/* Block Toolbar - Only visible on hover */}
                <div className={`absolute top-2 right-2 z-20 flex items-center gap-1.5 transition-all duration-200 ${
                  (selectedBlockId === block.id || (selectedBlockIds && selectedBlockIds.has(block.id))) ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      onBlockClick?.(block.id)
                      onBlockSettingsClick?.(block.id)
                    }}
                    className={`p-1.5 rounded-md shadow-sm transition-all duration-150 ${
                      (selectedBlockId === block.id || (selectedBlockIds && selectedBlockIds.has(block.id)))
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                    }`}
                    title="Configure block"
                    aria-label="Configure block"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  {onBlockDelete && (
                    <>
                      {onBlockDuplicate && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            onBlockDuplicate(block.id)
                          }}
                          className="p-1.5 rounded-md shadow-sm bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all duration-150"
                          title="Duplicate block (Cmd+D)"
                          aria-label="Duplicate block"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          onBlockDelete(block.id)
                        }}
                        className="p-1.5 rounded-md shadow-sm bg-white text-red-600 border border-red-300 hover:bg-red-50 hover:border-red-400 transition-all duration-150"
                        title="Delete block (Del)"
                        aria-label="Delete block"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </>
            )}

            {/* Lock Indicator - Only show in edit mode */}
            {isEditing && block.config?.locked && (
              <div className="absolute top-10 left-2 z-10 flex items-center gap-1 px-2 py-1 bg-yellow-100 border border-yellow-300 rounded text-xs text-yellow-800">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                View Only
              </div>
            )}
            
            {/* Block Content */}
            {/* CRITICAL: No min-height - height must be DERIVED from content */}
            {/* min-h-0 allows flex children to shrink below content size */}
            <div 
              className={`h-full w-full min-h-0 overflow-hidden rounded-lg ${block.config?.locked ? 'pointer-events-none opacity-75' : ''}`}
              data-block-id={block.id}
              style={{
                // CRITICAL: Do NOT set minHeight - height must be DERIVED from content
                // minHeight causes gaps when blocks collapse - it persists after collapse
                // Height must come from content and current expansion state only
                // CRITICAL: No height transitions - they delay reflow on collapse
                // Airtable prioritises correctness over animation
                // Only animate non-layout properties (transform, opacity) if needed
                willChange: keyboardMoveHighlight === block.id ? 'transform' : 'auto',
                // Removed height from transition - height changes must be immediate
                transitionProperty: 'transform, opacity',
              }}
            >
              <BlockAppearanceWrapper 
                block={block}
                className={isEditing ? "pointer-events-auto" : ""}
              >
                <div className="h-full w-full">
                  <BlockRenderer
                    block={block}
                    isEditing={isEditing && !block.config?.locked}
                    onUpdate={onBlockUpdate}
                    isLocked={block.config?.locked || false}
                    pageTableId={pageTableId}
                    pageId={pageId}
                    recordId={recordId}
                    mode={mode}
                    filters={getFiltersForBlock(block.id)}
                    filterTree={getFilterTreeForBlock(block.id) as FilterTree}
                    onRecordClick={onRecordClick}
                    aggregateData={aggregateData[block.id]}
                    pageShowAddRecord={pageShowAddRecord}
                    pageEditable={pageEditable}
                    editableFieldNames={editableFieldNames}
                    hideEditButton={topTwoFieldBlockIds.has(block.id)}
                    allBlocks={blocks}
                    onEphemeralHeightDelta={(blockId: string, deltaPx: number) => handleEphemeralHeightDelta(blockId, deltaPx)}
                    rowHeight={Number(layoutSettings?.rowHeight) || 30}
                  />
                </div>
              </BlockAppearanceWrapper>
            </div>
          </div>
            )
          })}
        </ResponsiveGridLayout>
      </div>
    </ErrorBoundary>
  )
}
