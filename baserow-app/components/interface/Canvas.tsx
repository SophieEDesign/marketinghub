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
  onRecordClick?: (recordId: string) => void // Callback for record clicks (for RecordReview integration)
  aggregateData?: Record<string, { data: any; error: string | null; isLoading: boolean }> // Page-level aggregate data for blocks
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
  onRecordClick,
  aggregateData = {},
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
  const previousIsEditingRef = useRef<boolean>(isEditing)
  const isInitializedRef = useRef(false)
  const layoutHydratedRef = useRef(false)
  const isResizingRef = useRef(false)
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Lifecycle logging
  useEffect(() => {
    console.log(`[Lifecycle] Canvas MOUNT: pageId=${pageId}, blocks=${blocks.length}, recordId=${recordId}`)
    return () => {
      console.log(`[Lifecycle] Canvas UNMOUNT: pageId=${pageId}, recordId=${recordId}`)
    }
  }, [])

  /**
   * Hydrates react-grid-layout from Supabase on page load
   * 
   * CRITICAL RULES:
   * 1. Database values (position_x, position_y, width, height) are the single source of truth
   * 2. ALWAYS hydrate layout from database values
   * 3. NEVER regenerate layout if position_x/y/w/h exist
   * 4. Default layout generation is ONLY allowed when ALL of position_x, position_y, width, height are NULL
   * 5. This applies per block, not per page
   * 6. Edit/view transitions do NOT trigger layout writes
   * 
   * Only syncs from blocks prop when:
   * 1. First load (not yet initialized)
   * 2. Block IDs changed (block added or removed)
   * 
   * After hydration, layout state is managed locally and only updates via:
   * - User drag/resize (handleLayoutChange)
   * 
   * This prevents layout resets when:
   * - Parent component re-renders
   * - Block config updates (but positions unchanged)
   * - Edit/view mode transitions
   * - Other state changes in parent
   * - During active resize/drag operations
   */
  useEffect(() => {
    // Don't reset layout if user is currently resizing/dragging
    if (isResizingRef.current) {
      return
    }

    const currentBlockIds = blocks.map(b => b.id).sort().join(",")
    const previousBlockIds = previousBlockIdsRef.current
    
    // Only hydrate layout from blocks prop if:
    // 1. First load (not yet initialized)
    // 2. Block IDs changed (block added or removed)
    // CRITICAL: Do NOT rehydrate on edit mode entry - layout persists across mode changes
    const blockIdsChanged = previousBlockIds === "" || currentBlockIds !== previousBlockIds
    
    if (!layoutHydratedRef.current || blockIdsChanged) {
      // PHASE 2 - Layout rehydration audit: Log before hydration
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Layout Rehydration] BEFORE HYDRATION`, {
          isFirstLoad: !layoutHydratedRef.current,
          blockIdsChanged,
          previousBlockIds: previousBlockIdsRef.current,
          currentBlockIds,
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
      previousIsEditingRef.current = isEditing
      layoutHydratedRef.current = true
      isInitializedRef.current = true
    } else {
      // PHASE 2 - Layout rehydration audit: Log skipped hydration
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Layout Rehydration] SKIPPED (already hydrated, no block ID change)`, {
          layoutHydrated: layoutHydratedRef.current,
          blockIdsChanged,
        })
      }
      // Update edit mode ref without rehydrating
      previousIsEditingRef.current = isEditing
    }
    // If block IDs haven't changed and already hydrated, preserve current layout state
  }, [blocks, isEditing])

  const handleLayoutChange = useCallback(
    (newLayout: Layout[]) => {
      // Mark that we're resizing/dragging
      isResizingRef.current = true
      
      // Clear any existing timeout
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
      
      // Update local layout state immediately for responsive UI
      setLayout(newLayout)
      
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
        resizeTimeoutRef.current = null
      }, 300)
    },
    [onLayoutChange]
  )

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

  // Empty state: Show template-specific guidance
  if (blocks.length === 0) {
    // Template-specific empty state content
    const getEmptyStateContent = () => {
      switch (layoutTemplate) {
        case 'dashboard':
          return {
            icon: '📈',
            title: 'Build your dashboard',
            description: interfaceDescription || 'Add KPIs, charts, and data grids to create a comprehensive overview.',
            suggestedBlocks: [
              { type: 'kpi' as BlockType, label: 'KPI', icon: '📊', description: 'Show key metrics' },
              { type: 'chart' as BlockType, label: 'Chart', icon: '📈', description: 'Visualize trends' },
              { type: 'grid' as BlockType, label: 'Grid View', icon: '📊', description: 'Display data' },
            ],
          }
        case 'planning':
          return {
            icon: '📋',
            title: 'Set up your planning board',
            description: interfaceDescription || 'Organize your work with grids, KPIs, and progress tracking.',
            suggestedBlocks: [
              { type: 'grid' as BlockType, label: 'Grid View', icon: '📊', description: 'View all items' },
              { type: 'kpi' as BlockType, label: 'KPI', icon: '📊', description: 'Track progress' },
              { type: 'chart' as BlockType, label: 'Chart', icon: '📈', description: 'Visualize status' },
            ],
          }
        case 'form':
          return {
            icon: '📝',
            title: 'Create your form',
            description: interfaceDescription || 'Add a form block to collect data and text blocks for instructions.',
            suggestedBlocks: [
              { type: 'form' as BlockType, label: 'Form', icon: '📝', description: 'Collect data' },
              { type: 'text' as BlockType, label: 'Text', icon: '📄', description: 'Add instructions' },
            ],
          }
        case 'record-management':
          return {
            icon: '📄',
            title: 'Set up record management',
            description: interfaceDescription || 'Add a grid to browse records and a record panel to view details.',
            suggestedBlocks: [
              { type: 'grid' as BlockType, label: 'Grid View', icon: '📊', description: 'Browse records' },
              { type: 'record' as BlockType, label: 'Record Panel', icon: '📄', description: 'View details' },
            ],
          }
        case 'content':
          return {
            icon: '📄',
            title: 'This is a content page',
            description: interfaceDescription || 'Add blocks to build your page. Use text, headings, images, and links to create documentation and resources.',
            suggestedBlocks: [
              { type: 'text' as BlockType, label: 'Text', icon: '📝', description: 'Add content' },
              { type: 'image' as BlockType, label: 'Image', icon: '🖼️', description: 'Add images' },
              { type: 'divider' as BlockType, label: 'Divider', icon: '➖', description: 'Separate sections' },
              { type: 'html' as BlockType, label: 'HTML', icon: '🌐', description: 'Rich content' },
            ],
          }
        default:
          return {
            icon: '🎨',
            title: 'Build your interface',
            description: interfaceDescription || 'Get started by adding your first block.',
            suggestedBlocks: [
              { type: 'grid' as BlockType, label: 'Grid View', icon: '📊', description: 'Display data' },
              { type: 'form' as BlockType, label: 'Form', icon: '📝', description: 'Collect data' },
              { type: 'chart' as BlockType, label: 'Chart', icon: '📈', description: 'Visualize data' },
              { type: 'kpi' as BlockType, label: 'KPI', icon: '📊', description: 'Show metrics' },
            ],
          }
      }
    }

    const emptyState = getEmptyStateContent()

    return (
      <div className="w-full h-full flex items-center justify-center p-8">
        <div className="text-center max-w-2xl">
          <div className="text-6xl mb-4">{emptyState.icon}</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {emptyState.title}
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            {isEditing
              ? emptyState.description
              : "Edit this interface to add blocks and customize it."}
          </p>
          
          {isEditing && onAddBlock && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
              {emptyState.suggestedBlocks.map((block) => (
                <button
                  key={block.type}
                  onClick={() => onAddBlock(block.type)}
                  className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors group"
                >
                  <span className="text-2xl">{block.icon}</span>
                  <div className="text-sm font-medium text-gray-900 group-hover:text-blue-700">
                    {block.label}
                  </div>
                  <div className="text-xs text-gray-500">{block.description}</div>
                </button>
              ))}
            </div>
          )}
          
          {!isEditing && (
            <div className="mt-4">
              <p className="text-xs text-gray-400 mb-2">
                Switch to edit mode to add blocks
              </p>
              <button
                onClick={() => {
                  // Trigger edit mode via custom event
                  window.dispatchEvent(new CustomEvent('interface-edit-mode-toggle'))
                }}
                className="text-xs text-blue-600 hover:text-blue-700 underline"
              >
                Edit interface
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
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
          preventCollision={false}
          onLayoutChange={handleLayoutChange}
          compactType="vertical"
          draggableHandle=".drag-handle"
          allowOverlap={false}
          resizeHandles={['se', 'sw', 'ne', 'nw', 'e', 'w', 's', 'n']}
        >
          {blocks.map((block) => (
            <div
              key={block.id}
              className={`relative ${
                isEditing
                  ? `group bg-white border-2 border-dashed border-transparent hover:border-gray-300 rounded-lg overflow-hidden ${
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
              className={`h-full w-full min-h-0 ${block.config?.locked ? 'pointer-events-none opacity-75' : ''}`}
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
                    filters={getFiltersForBlock(block.id)}
                    onRecordClick={onRecordClick}
                    aggregateData={aggregateData[block.id]}
                  />
                </div>
              </BlockAppearanceWrapper>
            </div>
            </div>
          ))}
        </ResponsiveGridLayout>
      </div>
    </ErrorBoundary>
  )
}
