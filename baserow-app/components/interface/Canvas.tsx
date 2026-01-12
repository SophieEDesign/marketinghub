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
import type { FilterConfig } from "@/lib/interface/filters"
import { dbBlockToPageBlock } from "@/lib/interface/layout-mapping"
import { debugLog, debugWarn } from "@/lib/interface/debug-flags"
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
}: CanvasProps) {
  // Get filters from filter blocks for this block
  const { getFiltersForBlock } = useFilterState()
  
  // CRITICAL: Fetch aggregate data at page level (inside FilterStateProvider)
  // This eliminates duplicate requests - SWR handles deduplication automatically
  // Collect page-level filters from all filter blocks
  const pageFilters = useMemo(() => {
    const filters: FilterConfig[] = []
    blocks.forEach(block => {
      if (block.type === 'filter') {
        const blockFilters = getFiltersForBlock(block.id)
        filters.push(...blockFilters)
      }
    })
    return filters
  }, [blocks, getFiltersForBlock])
  
  // Fetch all aggregates for KPI blocks
  const aggregateData = usePageAggregates(blocks, pageFilters)
  
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
  
  // Track if this is the first layout change after mount (to ignore grid's initial "normalization")
  const isFirstLayoutChangeRef = useRef(true)
  
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
      isFirstLayoutChangeRef.current = true // Reset first layout change flag on page change
      setLayout([]) // Clear layout when page changes
      if (process.env.NODE_ENV === 'development') {
        console.log('[Canvas] Page changed - resetting hydration state', {
          oldPageId,
          newPageId: pageId,
        })
      }
    }
  }, [pageId])
  
  // Lifecycle logging
  useEffect(() => {
    console.log(`[Lifecycle] Canvas MOUNT: pageId=${pageId}, blocks=${blocks.length}, recordId=${recordId}`)
    return () => {
      console.log(`[Lifecycle] Canvas UNMOUNT: pageId=${pageId}, recordId=${recordId}`)
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
      if (process.env.NODE_ENV === 'development') {
        console.log('[Canvas] Sync skipped - not hydrated yet, blocks.length=0')
      }
      return
    }
    
    // Don't reset layout if user is currently resizing/dragging
    if (isResizingRef.current) {
      return
    }
    
    // Don't sync if blocks were just updated from user interaction (drag/resize)
    // This prevents overwriting user changes when InterfaceBuilder updates blocks to match layout
    if (blocksUpdatedFromUserRef.current) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Canvas] Sync skipped - blocks updated from user interaction')
      }
      return
    }

    // Don't hydrate if no blocks - but reset refs to allow hydration when blocks load
    if (blocks.length === 0) {
      // Reset refs when blocks are cleared (page change, etc.) to allow rehydration when blocks load
      if (previousBlockIdsRef.current !== "") {
        previousBlockIdsRef.current = ""
        previousBlockPositionsRef.current.clear()
        layoutHydratedRef.current = false
        if (process.env.NODE_ENV === 'development') {
          console.log('[Canvas] Blocks cleared - resetting hydration state', {
            pageId,
            previousBlockIds: previousBlockIdsRef.current,
          })
        }
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
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[Canvas] Layout sync check', {
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
    }
    
    // Sync layout from blocks
    if (shouldSync) {
      // PHASE 2 - Layout rehydration audit: Log before hydration
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Canvas] BEFORE HYDRATION`, {
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
      }

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
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Layout Rehydration] AFTER HYDRATION`, {
          newLayout: newLayout.map(item => ({
            id: item.i,
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
          })),
        })
      }
      
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
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[Canvas] Layout synced from blocks', {
          isFirstLoad: previousBlockIds === "",
          blockIdsChanged,
          blockPositionsChanged,
          blocksCount: blocks.length,
        })
      }
    }
    // CRITICAL: Mode changes must NEVER trigger layout syncs
    // isEditing is only used to control drag/resize capabilities, not state
    // Update ref separately without triggering effect
    previousIsEditingRef.current = isEditing
  }, [blocks]) // Removed isEditing - mode changes don't trigger syncs

  const handleLayoutChange = useCallback(
    (newLayout: Layout[]) => {
      // CRITICAL: Ignore layout changes when not in edit mode
      // React-Grid-Layout may call onLayoutChange on mount even with compactType: null
      // We only want to handle user-initiated drag/resize, not grid's internal normalization
      if (!isEditing) {
        if (process.env.NODE_ENV === 'development' && isFirstLayoutChangeRef.current) {
          console.log('[Canvas] Ignoring layout change - not in edit mode (grid normalization)')
        }
        isFirstLayoutChangeRef.current = false
        return
      }
      
      // Ignore first layout change after mount (grid normalization)
      // Even with compactType: null, RGL may call onLayoutChange once on mount
      if (isFirstLayoutChangeRef.current) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[Canvas] Ignoring first layout change (grid normalization on mount)', {
            pageId,
            layoutCount: newLayout.length,
            isEditing,
          })
        }
        isFirstLayoutChangeRef.current = false
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
        isResizingRef.current = false
        // Reset user update flag after a delay to allow blocks to update
        // This gives InterfaceBuilder time to update blocks to match layout
        setTimeout(() => {
          blocksUpdatedFromUserRef.current = false
        }, 100)
        resizeTimeoutRef.current = null
      }, 300)
    },
    [onLayoutChange, isEditing, pageId]
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
      // Reset resize flag when exiting edit mode
      isResizingRef.current = false
    }
  }, [isEditing])

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
    console.log(`[Canvas] blocks prop changed: pageId=${pageId}, blocksCount=${blocks.length}`, {
      blockIds: blocks.map(b => b.id),
      blockTypes: blocks.map(b => b.type),
      isEditing,
    })
  }, [blocks.length, pageId]) // Removed isEditing - mode changes don't affect block rendering

  // Log container width for debugging (temporary)
  // CRITICAL: Must be declared before any early returns (Rules of Hooks)
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (containerRef.current && process.env.NODE_ENV === 'development') {
      const width = containerRef.current.offsetWidth
      console.log(`[Canvas] Container width: ${width}px (pageId=${pageId}, isEditing=${isEditing})`)
    }
  }, [pageId, isEditing, layout.length])

  if (blocks.length === 0) {
    return (
      <div className="w-full h-full" />
    )
  }

  // GUARDRAIL LOG: Log grid signature RIGHT BEFORE rendering grid
  // This MUST fire on every render to verify grid config is identical in edit/public
  // CRITICAL: Always log (not just in dev) to catch production issues
  try {
    const layoutSignature = (layout || []).map(item => ({
      id: item.i,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    })).sort((a, b) => a.id.localeCompare(b.id))
    
    // Sanity log: layout BEFORE grid (to verify DB positions match what we're passing to grid)
    console.log(`[Canvas] layout BEFORE grid: pageId=${pageId}`, 
      layout.map(l => `${l.i}:${l.x},${l.y}`).join(' | ')
    )
    
    console.log(`[Canvas] Grid Layout Signature: pageId=${pageId}, isEditing=${isEditing}`, {
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
    console.error('[Canvas] Grid Layout Signature log failed:', error)
  }

  return (
    <ErrorBoundary>
      {/* CRITICAL: Canvas wrapper must have min-width: 0 to prevent flex collapse */}
      {/* This ensures the grid gets the full available width, not constrained by parent flex containers */}
      <div ref={containerRef} className="w-full h-full min-w-0">
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
          draggableHandle=".drag-handle"
          resizeHandles={['se', 'sw', 'ne', 'nw', 'e', 'w', 's', 'n']}
        >
          {blocks.map((block) => {
            // Log each block being rendered
            if (process.env.NODE_ENV === 'development') {
              console.log(`[Canvas] Rendering block: pageId=${pageId}, blockId=${block.id}, type=${block.type}`, {
                block,
                layoutItem: layout.find(l => l.i === block.id),
              })
            }
            return (
              <div
                key={block.id}
                className={`relative ${
                  isEditing
                    ? `group bg-white border-2 border-dashed border-transparent hover:border-gray-300 rounded-lg ${
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
                <div className="absolute top-2 left-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity drag-handle">
                  <div
                    className="cursor-grab active:cursor-grabbing p-1.5 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
                    title="Drag to reorder"
                    onMouseDown={(e) => {
                      // Prevent dragging if TextBlock is editing
                      const blockContent = e.currentTarget.closest('.react-grid-item')?.querySelector('[data-block-editing="true"]')
                      if (blockContent) {
                        e.preventDefault()
                        e.stopPropagation()
                        return false
                      }
                    }}
                  >
                    <svg className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 12h16M4 16h16" />
                    </svg>
                  </div>
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
                          if (confirm("Are you sure you want to delete this block?")) {
                            onBlockDelete(block.id)
                          }
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
              <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-1 bg-yellow-100 border border-yellow-300 rounded text-xs text-yellow-800">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                View Only
              </div>
            )}

            {/* Block Content */}
            <div 
              className={`h-full w-full min-h-0 overflow-hidden rounded-lg ${block.config?.locked ? 'pointer-events-none opacity-75' : ''}`}
              data-block-id={block.id}
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
                    onRecordClick={onRecordClick}
                    aggregateData={aggregateData[block.id]}
                    pageEditable={pageEditable}
                    editableFieldNames={editableFieldNames}
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
