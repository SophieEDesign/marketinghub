"use client"

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
  
  const [layout, setLayout] = useState<Layout[]>([])
  const previousBlockIdsRef = useRef<string>("")
  const previousBlockPositionsRef = useRef<Map<string, { x: number; y: number; w: number; h: number }>>(new Map())
  const previousIsEditingRef = useRef<boolean>(isEditing)
  const isInitializedRef = useRef(false)
  const layoutHydratedRef = useRef(false)
  const isResizingRef = useRef(false)
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const prevPageIdRef = useRef<string | null>(pageId || null)
  // Track when blocks are updated from user interaction (drag/resize) vs database reload
  // This prevents sync effect from overwriting user changes
  const blocksUpdatedFromUserRef = useRef(false)
  // CRITICAL: Only treat layout changes as persistable when triggered by explicit user drag/resize.
  // Environmental changes (window resize, side panels, modals, container size changes, edit mode toggles)
  // must NEVER propagate as "user layout changes" to the parent.
  const userInteractionInProgressRef = useRef(false)
  
  // Track if this is the first layout change after mount (to ignore grid's initial "normalization")
  const isFirstLayoutChangeRef = useRef(true)
  
  // CRITICAL: Track block heights ONLY during active manual resize (user dragging resize handle)
  // This is NOT used for content-based expand/collapse - those must be handled by DOM flow
  // Height must be DERIVED from content, not remembered after collapse
  const blockHeightsBeforeResizeRef = useRef<Map<string, number>>(new Map())
  const currentlyResizingBlockIdRef = useRef<string | null>(null)
  
  // Track drag state for snap detection
  const dragStartPositionRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const dragLastPositionRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const currentlyDraggingBlockIdRef = useRef<string | null>(null)
  
  // Reset hydration state when page changes (Canvas remounts)
  // CRITICAL: This must run BEFORE the hydration effect to ensure refs are reset
  useEffect(() => {
    if (prevPageIdRef.current !== pageId && pageId) {
      const oldPageId = prevPageIdRef.current
      prevPageIdRef.current = pageId
      previousBlockIdsRef.current = ""
      previousBlockPositionsRef.current.clear()
      layoutHydratedRef.current = false
      isInitializedRef.current = false
      blocksUpdatedFromUserRef.current = false
      userInteractionInProgressRef.current = false
      isFirstLayoutChangeRef.current = true // Reset first layout change flag on page change
      setLayout([]) // Clear layout when page changes
      debugLog('LAYOUT', '[Canvas] Page changed - resetting hydration state', {
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
   * Syncs layout state from blocks prop - single source of truth
   * 
   * CRITICAL RULES:
   * 1. Blocks prop (from database) is the single source of truth for layout positions
   * 2. Layout state is derived from blocks, not stored separately
   * 3. Layout state only persists during active drag/resize operations
   * 4. After drag/resize completes, layout syncs back to blocks (via onLayoutChange)
   * 5. When blocks are reloaded from DB, layout syncs from blocks
   * 
   * Syncs layout from blocks when:
   * 1. First load (not yet initialized)
   * 2. Block IDs changed (block added or removed)
   * 3. Block positions changed (blocks reloaded with updated positions from DB)
   * 
   * Preserves layout during:
   * - Active drag/resize operations (isResizingRef.current = true)
   * 
   * This ensures layout always reflects the database state, except during user interactions.
   */
  useEffect(() => {
    // CRITICAL: Never sync before hydration is complete
    // This prevents Canvas from committing empty layout state before blocks arrive
    // InterfaceBuilder should prevent Canvas from rendering until hydrated, but this is a safety net
    if (!layoutHydratedRef.current && blocks.length === 0) {
      debugLog('LAYOUT', '[Canvas] Sync skipped - not hydrated yet, blocks.length=0')
      return
    }
    
    // Don't reset layout if user is currently resizing/dragging
    if (isResizingRef.current) {
      return
    }
    
    // Don't sync if blocks were just updated from user interaction (drag/resize)
    // This prevents overwriting user changes when InterfaceBuilder updates blocks to match layout
    if (blocksUpdatedFromUserRef.current) {
      debugLog('LAYOUT', '[Canvas] Sync skipped - blocks updated from user interaction')
      return
    }

    // Don't hydrate if no blocks - but reset refs to allow hydration when blocks load
    if (blocks.length === 0) {
      // Reset refs when blocks are cleared (page change, etc.) to allow rehydration when blocks load
      if (previousBlockIdsRef.current !== "") {
        previousBlockIdsRef.current = ""
        previousBlockPositionsRef.current.clear()
        layoutHydratedRef.current = false
        debugLog('LAYOUT', '[Canvas] Blocks cleared - resetting hydration state', {
          pageId,
          previousBlockIds: previousBlockIdsRef.current,
        })
      }
      setLayout([])
      return
    }

    const currentBlockIds = blocks.map(b => b.id).sort().join(",")
    const previousBlockIds = previousBlockIdsRef.current
    
    // Check if block IDs changed (blocks added/removed)
    const blockIdsChanged = previousBlockIds === "" || currentBlockIds !== previousBlockIds
    
    // Check if block positions changed (blocks reloaded with new positions from DB)
    // CRITICAL: Always compare blocks with CURRENT LAYOUT state (source of truth)
    // When returning to page, blocks have saved positions from DB, layout might be empty or stale
    // We need to sync if blocks differ from current layout OR if layout is empty (first load after navigation)
    
    // CRITICAL: If layout is empty but we have blocks, we MUST sync (first load or returning to page)
    // This handles the case when returning to a page - layout is empty, blocks have saved positions
    const layoutIsEmpty = layout.length === 0 && blocks.length > 0
    
    // Check if positions differ (only if layout is already hydrated)
    const blockPositionsChanged = layoutHydratedRef.current && !layoutIsEmpty && blocks.some((block) => {
      const currentLayoutItem = layout.find(l => l.i === block.id)
      if (!currentLayoutItem) {
        // Block not in layout - need to sync (new block or layout was cleared)
        return true
      }
      // Check if positions differ (allowing for small floating point differences)
      const positionsDiffer = 
        Math.abs((currentLayoutItem.x || 0) - (block.x || 0)) > 0.01 ||
        Math.abs((currentLayoutItem.y || 0) - (block.y || 0)) > 0.01 ||
        Math.abs((currentLayoutItem.w || 4) - (block.w || 4)) > 0.01 ||
        Math.abs((currentLayoutItem.h || 4) - (block.h || 4)) > 0.01
      
      if (!positionsDiffer) {
        // Positions match - update ref to track this state
        previousBlockPositionsRef.current.set(block.id, {
          x: block.x || 0,
          y: block.y || 0,
          w: block.w || 4,
          h: block.h || 4,
        })
      }
      
      return positionsDiffer
    })
    
    // Sync layout from blocks if:
    // 1. First load (blockIdsChanged and previousBlockIds is empty)
    // 2. Block IDs changed (blocks added/removed)
    // 3. Layout is empty but we have blocks (returning to page after navigation)
    // 4. Block positions changed (blocks reloaded with updated positions from DB)
    const shouldSync = blockIdsChanged || layoutIsEmpty || blockPositionsChanged
    
    debugLog('LAYOUT', '[Canvas] Layout sync check', {
      pageId,
      blocksCount: blocks.length,
      currentBlockIds,
      previousBlockIds,
      blockIdsChanged,
      layoutIsEmpty,
      blockPositionsChanged,
      shouldSync,
      layoutLength: layout.length,
      layoutHydrated: layoutHydratedRef.current,
    })
    
    // Sync layout from blocks
    if (shouldSync) {
      // PHASE 2 - Layout rehydration audit: Log before hydration
      debugLog('LAYOUT', `[Canvas] BEFORE HYDRATION`, {
        pageId,
        isFirstLoad: previousBlockIds === "",
        blockIdsChanged,
        previousBlockIds: previousBlockIdsRef.current,
        currentBlockIds,
        blocksCount: blocks.length,
        blocks: blocks.map(b => ({
          id: b.id,
          x: b.x,
          y: b.y,
          w: b.w,
          h: b.h,
        })),
      })

      // Convert blocks to layout format - use saved positions from Supabase
      // CRITICAL: Database values (position_x, position_y, width, height) are single source of truth
      // Only apply defaults when ALL position values are NULL (newly created block)
      const newLayout: Layout[] = blocks.map((block) => {
        // CRITICAL: Use unified mapping function - enforces single source of truth
        // Map DB values using unified function (throws if corrupted, returns null if new)
        // Note: API already maps position_x/position_y/width/height to x/y/w/h
        const layout = dbBlockToPageBlock({
          id: block.id,
          position_x: block.x, // API already maps position_x → x
          position_y: block.y,
          width: block.w,
          height: block.h,
        })
        
        let x: number, y: number, w: number, h: number
        
        if (!layout) {
          // New block (all null) - apply defaults
          x = 0
          y = 0
          w = 4
          h = 4
          
          // DEBUG_LAYOUT: Log default application
          debugLog('LAYOUT', `Block ${block.id}: DEFAULTS APPLIED (new block)`, {
            blockId: block.id,
            fromDB: { x: null, y: null, w: null, h: null },
            applied: { x, y, w, h },
          })
        } else {
          // Existing block - use mapped values (no defaults)
          x = layout.x
          y = layout.y
          w = layout.w
          h = layout.h
          
          // DEBUG_LAYOUT: Log DB values used
          debugLog('LAYOUT', `Block ${block.id}: FROM DB`, {
            blockId: block.id,
            fromDB: { x: block.x, y: block.y, w: block.w, h: block.h },
            applied: { x, y, w, h },
          })
        }
        
        return {
          i: block.id,
          x,
          y,
          w,
          h,
          minW: 2,
          minH: 2,
        }
      })
      
      // PHASE 2 - Layout rehydration audit: Log after hydration
      debugLog('LAYOUT', `[Layout Rehydration] AFTER HYDRATION`, {
        newLayout: newLayout.map(item => ({
          id: item.i,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
        })),
      })
      
      setLayout(newLayout)
      previousBlockIdsRef.current = currentBlockIds
      // CRITICAL: Update position tracking ref with LAYOUT positions (not block positions)
      // This ensures we only sync when blocks come from DB, not when blocks are updated locally
      // When user drags/resizes, layout changes, blocks are updated to match layout,
      // but previousBlockPositionsRef tracks layout positions, so sync won't detect a change
      previousBlockPositionsRef.current.clear()
      newLayout.forEach(layoutItem => {
        previousBlockPositionsRef.current.set(layoutItem.i, {
          x: layoutItem.x || 0,
          y: layoutItem.y || 0,
          w: layoutItem.w || 4,
          h: layoutItem.h || 4,
        })
      })
      layoutHydratedRef.current = true
      isInitializedRef.current = true
      
      debugLog('LAYOUT', '[Canvas] Layout synced from blocks', {
        isFirstLoad: previousBlockIds === "",
        blockIdsChanged,
        blockPositionsChanged,
        blocksCount: blocks.length,
      })
    }
    // CRITICAL: Mode changes must NEVER trigger layout syncs
    // isEditing is only used to control drag/resize capabilities, not state
    // Update ref separately without triggering effect
    previousIsEditingRef.current = isEditing
  }, [blocks]) // Removed isEditing - mode changes don't trigger syncs

  /**
   * Detects nearby blocks for snapping on all sides (top, bottom, left, right)
   * Returns snap candidates with their distances and target positions
   */
  const detectSnapTargets = useCallback((
    draggedBlock: Layout,
    allLayout: Layout[],
    snapThreshold: number = 1 // Grid units (approximately 30px for default rowHeight, scales with grid)
  ): {
    left?: { block: Layout; distance: number; targetX: number }
    right?: { block: Layout; distance: number; targetX: number }
    top?: { block: Layout; distance: number; targetY: number }
    bottom?: { block: Layout; distance: number; targetY: number }
  } => {
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
        const distanceToLeft = Math.abs(draggedX - otherRight)
        if (distanceToLeft <= snapThreshold && (!snapTargets.left || distanceToLeft < snapTargets.left.distance)) {
          snapTargets.left = {
            block: otherBlock,
            distance: distanceToLeft,
            targetX: otherRight, // Snap to right edge of other block
          }
        }
        
        // Check right edge snap (dragged block to the left of other block)
        const distanceToRight = Math.abs(draggedRight - otherX)
        if (distanceToRight <= snapThreshold && (!snapTargets.right || distanceToRight < snapTargets.right.distance)) {
          snapTargets.right = {
            block: otherBlock,
            distance: distanceToRight,
            targetX: otherX - draggedW, // Snap to left edge of other block (position dragged block's left edge)
          }
        }
      }
      
      // Check vertical proximity (top/bottom snapping)
      // Blocks are vertically adjacent if their X ranges overlap
      const xOverlap = !(draggedRight <= otherX || draggedX >= otherRight)
      
      if (xOverlap) {
        // Check top edge snap (dragged block below other block)
        const distanceToTop = Math.abs(draggedY - otherBottom)
        if (distanceToTop <= snapThreshold && (!snapTargets.top || distanceToTop < snapTargets.top.distance)) {
          snapTargets.top = {
            block: otherBlock,
            distance: distanceToTop,
            targetY: otherBottom, // Snap to bottom edge of other block
          }
        }
        
        // Check bottom edge snap (dragged block above other block)
        const distanceToBottom = Math.abs(draggedBottom - otherY)
        if (distanceToBottom <= snapThreshold && (!snapTargets.bottom || distanceToBottom < snapTargets.bottom.distance)) {
          snapTargets.bottom = {
            block: otherBlock,
            distance: distanceToBottom,
            targetY: otherY - draggedH, // Snap to top edge of other block (position dragged block's top edge)
          }
        }
      }
    })
    
    // Check if block is near the top of the canvas (y=0)
    // This allows snapping to the top even when there are no other blocks above
    const distanceToCanvasTop = draggedY
    if (distanceToCanvasTop <= snapThreshold && (!snapTargets.top || distanceToCanvasTop < snapTargets.top.distance)) {
      snapTargets.top = {
        block: draggedBlock, // Use dragged block as placeholder (not used for actual block reference)
        distance: distanceToCanvasTop,
        targetY: 0, // Snap to top of canvas
      }
    }
    
    return snapTargets
  }, [])
  
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
      const xOverlap = !(clampedX + draggedW <= otherX || clampedX >= otherX + otherW)
      const yOverlap = !(draggedY + draggedH <= otherY || draggedY >= otherY + otherH)
      
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
      const xOverlap = !(draggedX + draggedW <= otherX || draggedX >= otherX + otherW)
      const yOverlap = !(clampedY + draggedH <= otherY || clampedY >= otherY + otherH)
      
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
   * Applies smart snapping with priority: horizontal > vertical > compaction
   * This respects user intent by preferring horizontal adjacency when valid
   */
  const applySmartSnap = useCallback((
    draggedBlock: Layout,
    allLayout: Layout[],
    dragVector: { dx: number; dy: number } | null,
    cols: number
  ): Layout => {
    // Try horizontal snap first (respects spatial intent)
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
    
    // No snap available - return original position
    // Vertical compaction will be applied separately if needed
    return draggedBlock
  }, [applyHorizontalSnap, applyVerticalSnap])
  
  /**
   * Pushes blocks below a growing block down to prevent overlap
   * This preserves block order - blocks are pushed down, not reordered
   * 
   * Algorithm:
   * 1. Find the resized block and calculate its new bottom edge
   * 2. Sort all blocks by y position (top to bottom)
   * 3. For each block, check if it overlaps with blocks above it (including resized block)
   * 4. Push block down to the first available position below all overlapping blocks
   * 5. Process blocks in order to handle cascading pushes correctly
   */
  const pushBlocksDown = useCallback((currentLayout: Layout[], resizedBlockId: string): Layout[] => {
    const resizedBlock = currentLayout.find(l => l.i === resizedBlockId)
    if (!resizedBlock) return currentLayout
    
    const resizedX = resizedBlock.x || 0
    const resizedW = resizedBlock.w || 4
    const resizedY = resizedBlock.y || 0
    const resizedH = resizedBlock.h || 4
    const resizedBottom = resizedY + resizedH
    
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
      
      // Check overlap with the resized block
      if (block.i !== resizedBlockId) {
        const xOverlap = !(resizedX + resizedW <= blockX || resizedX >= blockX + blockW)
        if (xOverlap) {
          // Block overlaps horizontally with resized block
          // If block is at or below the resized block's top, ensure it's below the resized block's bottom
          if (blockY >= resizedY) {
            minY = Math.max(minY, resizedBottom)
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

  const handleLayoutChange = useCallback(
    (newLayout: Layout[]) => {
      // CRITICAL: Ignore layout changes when not in edit mode
      // React-Grid-Layout may call onLayoutChange on mount even with compactType: null
      // We only want to handle user-initiated drag/resize, not grid's internal normalization
      if (!isEditing) {
        if (isFirstLayoutChangeRef.current) {
          debugLog('LAYOUT', '[Canvas] Ignoring layout change - not in edit mode (grid normalization)')
        }
        isFirstLayoutChangeRef.current = false
        return
      }
      
      // Ignore first layout change after mount (grid normalization)
      // Even with compactType: null, RGL may call onLayoutChange once on mount
      if (isFirstLayoutChangeRef.current) {
        debugLog('LAYOUT', '[Canvas] Ignoring first layout change (grid normalization on mount)', {
          pageId,
          layoutCount: newLayout.length,
          isEditing,
        })
        isFirstLayoutChangeRef.current = false
        return
      }

      // CRITICAL: Ignore environment-driven layout recalculations.
      // RGL can emit onLayoutChange when container width/height changes (side panels, modals, window resizes),
      // or when breakpoints/cols change. Those must not be treated as user intent.
      if (!userInteractionInProgressRef.current) {
        debugWarn('LAYOUT', '[Canvas] Ignoring layout change (no user drag/resize in progress)', {
          pageId,
          isEditing,
          layoutCount: newLayout.length,
        })
        return
      }
      
      // Mark that we're resizing/dragging
      isResizingRef.current = true
      
      // Mark that blocks will be updated from user interaction (not database)
      // This prevents sync effect from overwriting user changes
      blocksUpdatedFromUserRef.current = true
      
      // Clear any existing timeout
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
      
      // CRITICAL: Track height changes during resize to detect shrinkage
      // Store initial height when resize starts (if not already stored)
      if (currentlyResizingBlockIdRef.current) {
        const resizingBlockId = currentlyResizingBlockIdRef.current
        const currentBlock = newLayout.find(l => l.i === resizingBlockId)
        if (currentBlock && !blockHeightsBeforeResizeRef.current.has(resizingBlockId)) {
          // Store the height before resize started
          const previousLayoutItem = layout.find(l => l.i === resizingBlockId)
          if (previousLayoutItem) {
            blockHeightsBeforeResizeRef.current.set(resizingBlockId, previousLayoutItem.h || 4)
          }
        }
      }
      
      // Update local layout state immediately for responsive UI
      setLayout(newLayout)
      
      // CRITICAL: Update position tracking ref with new layout positions
      // This ensures that when blocks are updated locally to match layout,
      // the sync effect won't detect a change and overwrite the layout
      newLayout.forEach(layoutItem => {
        previousBlockPositionsRef.current.set(layoutItem.i, {
          x: layoutItem.x || 0,
          y: layoutItem.y || 0,
          w: layoutItem.w || 4,
          h: layoutItem.h || 4,
        })
      })
      
      // Notify parent of layout change (for debounced save)
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
      
      // Reset resize flag after resize/drag completes (no more layout changes for 300ms)
      // This allows the layout to persist and prevents useEffect from resetting it during resize
      resizeTimeoutRef.current = setTimeout(() => {
        // CRITICAL: Use current layout state (from setLayout) to check for shrinkage/growth
        // We need to check the actual current state, not the closure value
        setLayout(currentLayout => {
          // CRITICAL: Check if any block grew or shrunk
          let needsPushDown = false
          let needsCompaction = false
          let resizedBlockId: string | null = null
          const heightsBeforeResize = new Map(blockHeightsBeforeResizeRef.current)
          
          heightsBeforeResize.forEach((previousHeight, blockId) => {
            const currentBlock = currentLayout.find(l => l.i === blockId)
            if (currentBlock) {
              const currentHeight = currentBlock.h || 4
              if (currentHeight > previousHeight) {
                // Block grew - push blocks down instead of reordering
                needsPushDown = true
                resizedBlockId = blockId
                debugLog('LAYOUT', `[Canvas] Block ${blockId} grew from ${previousHeight} to ${currentHeight} - pushing blocks down`)
              } else if (currentHeight < previousHeight) {
                // Block shrunk - compact layout vertically
                needsCompaction = true
                debugLog('LAYOUT', `[Canvas] Block ${blockId} shrunk from ${previousHeight} to ${currentHeight} - compacting layout`)
              }
            }
          })
          
          // Apply smart snapping to dragged blocks before push/compaction
          // Priority: horizontal snap > vertical snap > push down / compaction
          let snappedLayout = [...currentLayout]
          const cols = layoutSettings?.cols || 12
          
          // Find the block that was just dragged (if any)
          const draggedBlockId = currentlyDraggingBlockIdRef.current
          if (draggedBlockId) {
            const draggedBlock = snappedLayout.find(l => l.i === draggedBlockId)
            if (draggedBlock) {
              // Calculate drag vector from start to end position
              const dragStart = dragStartPositionRef.current.get(draggedBlockId)
              const dragLast = dragLastPositionRef.current.get(draggedBlockId)
              
              let dragVector: { dx: number; dy: number } | null = null
              if (dragStart && dragLast) {
                dragVector = {
                  dx: dragLast.x - dragStart.x,
                  dy: dragLast.y - dragStart.y,
                }
              }
              
              // Apply smart snap (horizontal > vertical > none)
              const snappedBlock = applySmartSnap(draggedBlock, snappedLayout, dragVector, cols)
              
              // Update the layout with snapped position
              snappedLayout = snappedLayout.map(item => 
                item.i === draggedBlockId ? snappedBlock : item
              )
              
              // Clear drag tracking
              dragStartPositionRef.current.delete(draggedBlockId)
              dragLastPositionRef.current.delete(draggedBlockId)
              currentlyDraggingBlockIdRef.current = null
            }
          }
          
          // Apply push down or compaction based on resize direction
          let finalLayout = snappedLayout
          if (needsPushDown && resizedBlockId) {
            // Block grew - push blocks below down (preserves order)
            finalLayout = pushBlocksDown(snappedLayout, resizedBlockId)
            debugLog('LAYOUT', '[Canvas] Applied push down after resize grow', {
              resizedBlockId,
            })
          } else if (needsCompaction) {
            // Block shrunk - compact layout vertically (removes gaps)
            finalLayout = compactLayoutVertically(snappedLayout, blocks)
            debugLog('LAYOUT', '[Canvas] Applied compaction after resize shrink')
          } else if (draggedBlockId && !needsPushDown && !needsCompaction) {
            // After dragging (not resizing), preserve the snapped layout
            // Snapping should align blocks, and compaction would break that alignment
            // Only compact when blocks are resized or deleted, not when dragging
            finalLayout = snappedLayout
            debugLog('LAYOUT', '[Canvas] Preserved snapped layout after drag', {
              draggedBlockId,
            })
          }
          
          // Check if layout changed (either from snapping, push down, or compaction)
          const layoutChanged = finalLayout.some((item, index) => {
            const original = currentLayout.find(l => l.i === item.i)
            if (!original) return true
            return (
              Math.abs((item.x || 0) - (original.x || 0)) > 0.01 ||
              Math.abs((item.y || 0) - (original.y || 0)) > 0.01
            )
          })
          
          if (layoutChanged) {
            debugLog('LAYOUT', '[Canvas] Applied snap/push/compaction after drag/resize end', {
              hadSnap: draggedBlockId !== null,
              hadPushDown: needsPushDown,
              hadCompaction: needsCompaction,
              draggedBlockId,
              resizedBlockId,
            })
            
            // Update position tracking ref
            finalLayout.forEach(layoutItem => {
              previousBlockPositionsRef.current.set(layoutItem.i, {
                x: layoutItem.x || 0,
                y: layoutItem.y || 0,
                w: layoutItem.w || 4,
                h: layoutItem.h || 4,
              })
            })
            
            // Notify parent of final layout asynchronously to avoid state update conflicts
            setTimeout(() => {
              if (onLayoutChange) {
                const layoutItems: LayoutItem[] = finalLayout.map((item) => ({
                  i: item.i,
                  x: item.x || 0,
                  y: item.y || 0,
                  w: item.w || 4,
                  h: item.h || 4,
                }))
                onLayoutChange(layoutItems)
              }
            }, 0)
            
            return finalLayout
          }
          
          return currentLayout
        })
        
        // CRITICAL: Clear all resize state immediately
        // Height must be DERIVED, not remembered - clear all cached heights
        isResizingRef.current = false
        userInteractionInProgressRef.current = false
        blockHeightsBeforeResizeRef.current.clear() // Clear ALL cached heights
        currentlyResizingBlockIdRef.current = null
        
        // Reset user update flag after a delay to allow blocks to update
        // This gives InterfaceBuilder time to update blocks to match layout
        setTimeout(() => {
          blocksUpdatedFromUserRef.current = false
        }, 100)
        resizeTimeoutRef.current = null
      }, 300)
    },
    [onLayoutChange, isEditing, pageId, compactLayoutVertically, pushBlocksDown, blocks, applySmartSnap, layoutSettings?.cols]
  )
  
  // Reset first layout change flag when entering edit mode
  useEffect(() => {
    if (isEditing) {
      isFirstLayoutChangeRef.current = true
    }
  }, [isEditing])

  // Reset resize flag when edit mode changes (user exits edit mode)
  useEffect(() => {
    if (!isEditing) {
      // Clear any pending resize timeout
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
        resizeTimeoutRef.current = null
      }
      // CRITICAL: Clear all resize state when exiting edit mode
      // This ensures no cached heights or resize state remains
      // Height must be DERIVED from content, not remembered
      isResizingRef.current = false
      blockHeightsBeforeResizeRef.current.clear() // Clear ALL cached heights
      currentlyResizingBlockIdRef.current = null
    }
  }, [isEditing])

  // Trigger compaction when blocks are deleted (block count decreases)
  // This ensures blocks below a deleted block shift up automatically
  const previousBlockCountRef = useRef<number>(blocks.length)
  useEffect(() => {
    // Only trigger compaction if:
    // 1. Block count decreased (deletion)
    // 2. Layout is hydrated (not initial load)
    // 3. Not currently resizing/dragging
    // 4. In edit mode (only compact during editing)
    const blockCountDecreased = blocks.length < previousBlockCountRef.current
    const wasHydrated = layoutHydratedRef.current && previousBlockCountRef.current > 0
    
    if (blockCountDecreased && wasHydrated && !isResizingRef.current && isEditing && layout.length > 0) {
      debugLog('LAYOUT', '[Canvas] Block deleted - triggering compaction', {
        previousCount: previousBlockCountRef.current,
        currentCount: blocks.length,
      })
      
      // Wait a brief moment for the layout to update, then compact
      setTimeout(() => {
        setLayout(currentLayout => {
          // Filter out any blocks that no longer exist
          const validLayout = currentLayout.filter(item => 
            blocks.some(block => block.id === item.i)
          )
          
          // Compact the layout
          const compactedLayout = compactLayoutVertically(validLayout, blocks)
          
          // Check if compaction changed anything
          const layoutChanged = compactedLayout.some((item) => {
            const original = validLayout.find(l => l.i === item.i)
            if (!original) return false
            return Math.abs((item.y || 0) - (original.y || 0)) > 0.01
          })
          
          if (layoutChanged) {
            // Update position tracking ref
            compactedLayout.forEach(layoutItem => {
              previousBlockPositionsRef.current.set(layoutItem.i, {
                x: layoutItem.x || 0,
                y: layoutItem.y || 0,
                w: layoutItem.w || 4,
                h: layoutItem.h || 4,
              })
            })
            
            // Notify parent of compacted layout
            if (onLayoutChange) {
              const layoutItems: LayoutItem[] = compactedLayout.map((item) => ({
                i: item.i,
                x: item.x || 0,
                y: item.y || 0,
                w: item.w || 4,
                h: item.h || 4,
              }))
              onLayoutChange(layoutItems)
            }
            
            return compactedLayout
          }
          
          return validLayout
        })
      }, 100)
    }
    
    previousBlockCountRef.current = blocks.length
  }, [blocks.length, layout.length, isEditing, compactLayoutVertically, onLayoutChange])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
    }
  }, [])

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
      <div ref={containerRef} className="w-full h-full min-w-0" style={{ paddingBottom: isEditing ? '80px' : '80px' }}>
        <ResponsiveGridLayout
          className="layout" // CRITICAL: No conditional classes - identical in edit and public
          layouts={{ lg: layout }}
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
            userInteractionInProgressRef.current = true
            // CRITICAL: Track which block is being resized and store its initial height
            // This allows us to detect shrinkage when resize ends
            const blockId = oldItem.i
            currentlyResizingBlockIdRef.current = blockId
            blockHeightsBeforeResizeRef.current.set(blockId, oldItem.h || 4)
            debugLog('LAYOUT', `[Canvas] Resize started for block ${blockId}, initial height: ${oldItem.h || 4}`)
          }}
          onResizeStop={(layout, oldItem, newItem, placeholder, e, element) => {
            // CRITICAL: Immediately clear ALL resize state when resize ends
            // This ensures no cached heights remain after manual resize completes
            // Height must be DERIVED from content, not remembered
            const blockId = oldItem.i
            const previousHeight = blockHeightsBeforeResizeRef.current.get(blockId)
            const newHeight = newItem.h || 4
            
            debugLog('LAYOUT', `[Canvas] Resize stopped for block ${blockId}, height: ${previousHeight} → ${newHeight}`)
            
            // CRITICAL: Clear cached height immediately - do NOT persist after resize
            // Old heights must never be cached after collapse
            blockHeightsBeforeResizeRef.current.delete(blockId)
            currentlyResizingBlockIdRef.current = null
            
            // Compaction will be handled by handleLayoutChange timeout
          }}
          onDragStart={(layout, oldItem, newItem, placeholder, e, element) => {
            userInteractionInProgressRef.current = true
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
          }}
          onDragStop={(layout, oldItem, newItem, placeholder, e, element) => {
            // Update final position for drag vector calculation
            const blockId = oldItem.i
            dragLastPositionRef.current.set(blockId, {
              x: newItem.x || 0,
              y: newItem.y || 0,
            })
            debugLog('LAYOUT', `[Canvas] Drag stopped for block ${blockId}`, {
              startX: dragStartPositionRef.current.get(blockId)?.x,
              startY: dragStartPositionRef.current.get(blockId)?.y,
              endX: newItem.x,
              endY: newItem.y,
            })
            
            // Use the same timeout mechanism as resize to ensure layout is stable
            // The handleLayoutChange will be called and will apply snap/compaction after timeout
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
                className={`relative ${
                  isEditing
                    ? `group bg-white border-2 border-dashed border-gray-200 hover:border-gray-300 rounded-lg ${
                        selectedBlockId === block.id
                          ? "ring-2 ring-blue-500 border-blue-500"
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
                      onBlockClick?.(block.id)
                    }
                  }
                }}
              >
            {/* Edit Mode Controls - Only visible in edit mode */}
            {isEditing && (
              <>
                {/* Drag Handle - Only visible on hover, hidden when block is editing (via CSS) */}
                <div
                  className={`absolute top-2 left-2 z-20 drag-handle transition-opacity ${
                    selectedBlockId === block.id ? "opacity-100" : "opacity-30 group-hover:opacity-100"
                  }`}
                >
                  <button
                    type="button"
                    className="cursor-grab active:cursor-grabbing p-2 bg-white/95 backdrop-blur border border-gray-300 rounded-md shadow-sm hover:bg-white hover:border-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 touch-none"
                    title="Drag to move"
                    aria-label="Drag to move"
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
                    <svg className="h-4 w-4 text-gray-700" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
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
                <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      onBlockClick?.(block.id)
                      onBlockSettingsClick?.(block.id)
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
                    <>
                      {onBlockDuplicate && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            onBlockDuplicate(block.id)
                          }}
                          className="p-1.5 rounded-md shadow-sm bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 transition-all"
                          title="Duplicate block (Cmd+D)"
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
                        className="p-1.5 rounded-md shadow-sm bg-white text-red-600 border border-red-300 hover:bg-red-50 transition-all"
                        title="Delete block (Del)"
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
