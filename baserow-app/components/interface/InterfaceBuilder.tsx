"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Save, Eye, Edit2, Plus, Trash2, Settings } from "lucide-react"
import { useBranding } from "@/contexts/BrandingContext"
import { useBlockEditMode } from "@/contexts/EditModeContext"
import { FilterStateProvider } from "@/lib/interface/filter-state"
import Canvas from "./Canvas"
import FloatingBlockPicker from "./FloatingBlockPicker"
import SettingsPanel from "./SettingsPanel"
import PageSettingsDrawer from "./PageSettingsDrawer"
import type { PageBlock, LayoutItem, Page } from "@/lib/interface/types"
import { BLOCK_REGISTRY } from "@/lib/interface/registry"
import type { BlockType } from "@/lib/interface/types"
import { useToast } from "@/components/ui/use-toast"
import {
  registerMount,
  guardAgainstMountSave,
  guardAgainstAutoSave,
  markUserInteraction,
} from "@/lib/interface/editor-safety"
import { usePageAggregates } from "@/lib/dashboard/usePageAggregates"
import { useFilterState } from "@/lib/interface/filter-state"

interface InterfaceBuilderProps {
  page: Page
  initialBlocks: PageBlock[]
  isViewer?: boolean
  onSave?: () => void
  onEditModeChange?: (isEditing: boolean) => void
  hideHeader?: boolean
  pageTableId?: string | null // Table ID from the page
  recordId?: string | null // Record ID for record review pages
  onRecordClick?: (recordId: string) => void // Callback for record clicks (for RecordReview integration)
}

export default function InterfaceBuilder({
  page,
  initialBlocks,
  isViewer = false,
  onSave,
  onEditModeChange,
  hideHeader = false,
  pageTableId = null,
  recordId = null,
  onRecordClick,
}: InterfaceBuilderProps) {
  const { primaryColor } = useBranding()
  const { toast } = useToast()
  const [blocks, setBlocks] = useState<PageBlock[]>(initialBlocks)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  
  // Use unified editing context for block editing
  const { isEditing, enter: enterBlockEdit, exit: exitBlockEdit } = useBlockEditMode(page.id)
  
  // Override edit mode if viewer mode is forced
  const effectiveIsEditing = isViewer ? false : isEditing
  
  // Aggregate data fetching moved to Canvas (inside FilterStateProvider)
  // This allows access to dynamic filter block filters
  
  // Notify parent of edit mode changes
  useEffect(() => {
    onEditModeChange?.(effectiveIsEditing)
  }, [effectiveIsEditing, onEditModeChange])

  // Track previous initialBlocks to prevent unnecessary updates
  const prevInitialBlocksRef = useRef<string>('')
  
  // CRITICAL: Track if initial blocks have been applied to prevent overwrites
  const initialBlocksAppliedRef = useRef<boolean>(false)
  
  // Sync initialBlocks to blocks state when they change (important for async loading)
  // CRITICAL: Only apply initialBlocks once on mount, then merge updates
  useEffect(() => {
    // Create a stable key from initialBlocks to detect actual changes
    // CRITICAL: Include config in the key to detect content changes (e.g., content_json updates)
    const blocksArray = initialBlocks?.map(b => ({
      id: b.id,
      type: b.type,
      x: b.x,
      y: b.y,
      w: b.w,
      h: b.h,
      config: b.config // Include config to detect content changes
    })) || []
    const blocksKey = JSON.stringify(blocksArray)
    
    // Only update if blocks actually changed
    if (prevInitialBlocksRef.current === blocksKey) {
      return
    }
    
    prevInitialBlocksRef.current = blocksKey
    
    if (initialBlocks && initialBlocks.length > 0) {
      // CRITICAL: On first load, set blocks. After that, merge to preserve user state
      if (!initialBlocksAppliedRef.current) {
        setBlocks(initialBlocks)
        initialBlocksAppliedRef.current = true
      } else {
        // Merge: update existing blocks, add new ones
        // CRITICAL: Preserve layout columns (x, y, w, h) from current block state
        // Only set x/y/w/h from updated block IF explicitly provided (not undefined/null)
        // CRITICAL: In viewer mode, replace config entirely to get latest saved content
        // In edit mode, merge config to preserve user state
        setBlocks((prevBlocks) => {
          const existingIds = new Set(prevBlocks.map(b => b.id))
          const merged = prevBlocks.map(b => {
            const updated = initialBlocks.find(ib => ib.id === b.id)
            if (updated) {
              return {
                ...b,
                // Preserve layout from current state (x, y, w, h) - don't overwrite with undefined/null
                x: updated.x !== undefined && updated.x !== null ? updated.x : b.x,
                y: updated.y !== undefined && updated.y !== null ? updated.y : b.y,
                w: updated.w !== undefined && updated.w !== null ? updated.w : b.w,
                h: updated.h !== undefined && updated.h !== null ? updated.h : b.h,
                // CRITICAL: In viewer mode, replace config entirely to get latest saved content
                // In edit mode, merge config to preserve user state during editing
                config: isViewer ? updated.config : { ...b.config, ...updated.config },
                // Preserve other metadata
                updated_at: updated.updated_at ?? b.updated_at,
                order_index: updated.order_index ?? b.order_index,
              }
            }
            return b
          })
          // Add new blocks
          initialBlocks.forEach(ib => {
            if (!existingIds.has(ib.id)) {
              merged.push(ib)
            }
          })
          return merged
        })
      }
    } else if (initialBlocks && initialBlocks.length === 0 && blocks.length > 0 && !initialBlocksAppliedRef.current) {
      // Only clear blocks if initialBlocks is explicitly empty AND we haven't applied initial blocks yet
      setBlocks([])
      initialBlocksAppliedRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBlocks])

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState<Page>(page)
  const [pendingLayout, setPendingLayout] = useState<LayoutItem[] | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const componentIdRef = useRef(`interface-builder-${page.id}`)

  // Register mount time for editor safety guards
  useEffect(() => {
    registerMount(componentIdRef.current)
    console.log(`[Lifecycle] InterfaceBuilder MOUNT: pageId=${page.id}, blocks=${initialBlocks.length}`)
    return () => {
      console.log(`[Lifecycle] InterfaceBuilder UNMOUNT: pageId=${page.id}`)
    }
  }, [])

  /**
   * Saves block layout to Supabase
   * 
   * This function persists block positions (x, y, w, h) to the view_blocks table.
   * Layout is saved to: view_blocks.position_x, position_y, width, height
   * 
   * Called:
   * - After user stops dragging/resizing (debounced, 500ms delay)
   * - When user clicks "Done" to exit edit mode (immediate)
   * 
   * Only saves when isEditing is true - view mode never mutates layout.
   * 
   * IMPORTANT: Does NOT update blocks state to prevent layout resets.
   * Canvas manages its own layout state and only hydrates from blocks on mount.
   */
  const saveLayout = useCallback(
    async (layout: LayoutItem[], hasUserInteraction = false) => {
      // Only save in edit mode - view mode must never mutate layout
      if (!effectiveIsEditing) return

      // Pre-deployment guard: Prevent saves during mount
      if (guardAgainstMountSave(componentIdRef.current, 'saveLayout')) {
        return
      }

      // Pre-deployment guard: Prevent saves without user interaction
      if (guardAgainstAutoSave('saveLayout', hasUserInteraction || layoutModifiedByUserRef.current)) {
        return
      }

      // CRITICAL: Never save layout unless user actually modified it
      // This prevents regressions from automatic saves on mount/hydration
      if (!layoutModifiedByUserRef.current) {
        if (process.env.NODE_ENV === 'development') {
          console.debug("[Layout] Save blocked: no user modification")
        }
        return
      }

      // PHASE 1 - Layout write verification: Log before save (client)
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Layout Write] BEFORE SAVE (client)`, {
          pageId: page.id,
          layout,
          layoutItems: layout.map(item => ({
            id: item.i,
            position_x: item.x,
            position_y: item.y,
            width: item.w,
            height: item.h,
          })),
        })
      }

      setSaveStatus("saving")
      try {
        // PHASE 1 - Layout write verification: Log API payload
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Layout Write] API PAYLOAD`, {
            pageId: page.id,
            payload: { layout },
            layoutItems: layout.map(item => ({
              id: item.i,
              position_x: item.x,
              position_y: item.y,
              width: item.w,
              height: item.h,
            })),
          })
        }

        const response = await fetch(`/api/pages/${page.id}/blocks`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ layout }),
        })

        if (response.ok) {
          const responseData = await response.json()
          
          // PHASE 1 - Layout write verification: Log API response
          if (process.env.NODE_ENV === 'development') {
            console.log(`[Layout Write] API RESPONSE`, {
              pageId: page.id,
              responseData,
              success: response.ok,
            })
          }

          setSaveStatus("saved")
          setPendingLayout(null)
          // Show success feedback briefly, then reset to idle
          setTimeout(() => setSaveStatus("idle"), 2000)
        } else {
          const error = await response.text()
          throw new Error(error || "Failed to save layout")
        }
      } catch (error: any) {
        console.error("Failed to save layout:", error)
        setSaveStatus("error")
        toast({
          variant: "destructive",
          title: "Failed to save layout",
          description: error.message || "Please try again",
        })
        setTimeout(() => setSaveStatus("idle"), 3000)
      }
    },
    [page.id, effectiveIsEditing, toast]
  )

  // Track if layout has been modified by user (not just initialized)
  const layoutModifiedByUserRef = useRef(false)

  /**
   * Handles layout changes from react-grid-layout
   * 
   * Called when user drags or resizes blocks in edit mode.
   * Updates local state immediately for responsive UI, then debounces save to Supabase.
   * 
   * Debounce delay: 500ms - prevents hammering the API during rapid drag/resize operations.
   * 
   * CRITICAL: Only saves if layout was actually modified by user interaction.
   * Prevents saving on mount/hydration when layout is just being initialized from saved state.
   */
  const handleLayoutChange = useCallback(
    (layout: LayoutItem[]) => {
      // Only save in edit mode - view mode never mutates layout
      if (!effectiveIsEditing) return

      // Mark user interaction for editor safety guards
      markUserInteraction()

      // Mark that layout has been modified by user
      layoutModifiedByUserRef.current = true

      // Update local state immediately for responsive UI
      // This gives instant feedback while dragging/resizing
      setBlocks((prevBlocks) => {
        return prevBlocks.map((block) => {
          const layoutItem = layout.find((item) => item.i === block.id)
          if (layoutItem) {
            return {
              ...block,
              x: layoutItem.x,
              y: layoutItem.y,
              w: layoutItem.w,
              h: layoutItem.h,
            }
          }
          return block
        })
      })

      // Store pending layout for debounced save
      setPendingLayout(layout)

      // Clear existing timeout to reset debounce timer
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      // Debounce save: wait 500ms after last change before saving to Supabase
      // This prevents excessive API calls during rapid drag/resize
      saveTimeoutRef.current = setTimeout(() => {
        saveLayout(layout, true) // Pass hasUserInteraction=true since this is triggered by user drag/resize
      }, 500)
    },
    [effectiveIsEditing, saveLayout]
  )

  // Reset layout modified flag when entering edit mode (not exiting)
  // CRITICAL: Reset on ENTER, not EXIT, to allow saves when user actually modifies layout
  // This ensures layout persistence works correctly - we only prevent saves during mount/hydration
  useEffect(() => {
    if (effectiveIsEditing) {
      // Reset flag when entering edit mode - user hasn't modified layout yet
      layoutModifiedByUserRef.current = false
    }
  }, [effectiveIsEditing])

  // Save layout immediately when exiting edit mode
  const handleExitEditMode = useCallback(async () => {
    // Clear any pending debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }

    // Mark user interaction (exiting edit mode is a user action)
    markUserInteraction()

    // Get current layout from blocks state and save before exiting edit mode
    // This ensures any unsaved drag/resize changes are persisted
    // CRITICAL: Always save layout when exiting edit mode to ensure positions are persisted
    // Even if user didn't explicitly drag/resize, blocks might have been moved programmatically
    const currentLayout: LayoutItem[] = blocks.map((block) => ({
      i: block.id,
      x: block.x,
      y: block.y,
      w: block.w,
      h: block.h,
    }))

    // CRITICAL: Always save layout when exiting edit mode if we have blocks
    // This ensures block positions are persisted even if user didn't explicitly drag/resize
    if (currentLayout.length > 0) {
      setIsSaving(true)
      try {
        // Use pendingLayout if it exists (has the latest drag/resize changes)
        // Otherwise fall back to currentLayout from blocks state
        const layoutToSave = pendingLayout || currentLayout
        
        if (process.env.NODE_ENV === 'development') {
          console.log('[Layout] Saving layout on exit:', {
            pageId: page.id,
            layoutCount: layoutToSave.length,
            layoutItems: layoutToSave,
            hasPendingLayout: !!pendingLayout,
            layoutModifiedByUser: layoutModifiedByUserRef.current,
          })
        }
        
        // CRITICAL: Pass hasUserInteraction=true to bypass guards when exiting edit mode
        // This ensures layout is saved even if layoutModifiedByUserRef was reset
        // Also mark as modified to ensure save goes through
        layoutModifiedByUserRef.current = true
        await saveLayout(layoutToSave, true)
        
        if (process.env.NODE_ENV === 'development') {
          console.log('[Layout] Layout saved successfully on exit')
        }
        
        // Longer delay to ensure database transaction is fully committed before reload
        // This prevents race condition where blocks reload before save completes
        await new Promise(resolve => setTimeout(resolve, 300))
      } catch (error) {
        console.error("Failed to save layout on exit:", error)
        toast({
          variant: "destructive",
          title: "Failed to save layout",
          description: error instanceof Error ? error.message : "Please try again",
        })
        // Don't exit edit mode if save failed - user should see the error
        return
      } finally {
        setIsSaving(false)
      }
    }

    // Reset modification flag after save
    layoutModifiedByUserRef.current = false

    exitBlockEdit()
    setSelectedBlockId(null)
    setSettingsPanelOpen(false)
  }, [blocks, pendingLayout, saveLayout, exitBlockEdit, page.id, toast])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const handleBlockUpdate = useCallback(
    async (blockId: string, config: Partial<PageBlock["config"]>) => {
      try {
        // PHASE 1 - TextBlock write verification: Log API payload
        if (process.env.NODE_ENV === 'development' && (config as any).content_json) {
          console.log(`[TextBlock Write] Block ${blockId}: API PAYLOAD`, {
            blockId,
            payload: {
              id: blockId,
              config: {
                content_json: (config as any).content_json,
              }
            },
            contentJson: (config as any).content_json,
            contentJsonStr: JSON.stringify((config as any).content_json),
          })
        }

        const response = await fetch(`/api/pages/${page.id}/blocks`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blockUpdates: [{ id: blockId, config }],
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to update block")
        }

        const responseData = await response.json()

        // PHASE 1 - TextBlock write verification: Log API response
        if (process.env.NODE_ENV === 'development' && (config as any).content_json) {
          console.log(`[TextBlock Write] Block ${blockId}: API RESPONSE`, {
            blockId,
            responseData,
            returnedBlocks: responseData.blocks,
            hasContentJson: responseData.blocks?.find((b: PageBlock) => b.id === blockId)?.config?.content_json ? true : false,
          })
        }

        // CRITICAL: Use returned blocks if available (more efficient and ensures consistency)
        // The API now returns updated blocks with the latest config including content_json
        if (responseData.blocks && responseData.blocks.length > 0) {
          const updatedBlock = responseData.blocks.find((b: PageBlock) => b.id === blockId)
          if (updatedBlock) {
            // PHASE 1 - TextBlock write verification: Verify returned content_json matches sent
            if (process.env.NODE_ENV === 'development' && (config as any).content_json) {
              const sentContentStr = JSON.stringify((config as any).content_json)
              const returnedContentStr = JSON.stringify(updatedBlock.config?.content_json)
              const matches = sentContentStr === returnedContentStr
              
              console.log(`[TextBlock Write] Block ${blockId}: VERIFICATION`, {
                blockId,
                sentContentJson: (config as any).content_json,
                returnedContentJson: updatedBlock.config?.content_json,
                matches,
                sentStr: sentContentStr,
                returnedStr: returnedContentStr,
              })
              
              if (!matches) {
                console.error(`[TextBlock Write] Block ${blockId}: MISMATCH - API returned different content_json than sent!`)
              }
            }

            // CRITICAL: Merge config instead of replacing wholesale (preserve user state)
            // CRITICAL: Preserve layout columns (x, y, w, h) from current block state - don't overwrite with API response
            // Only set x/y/w/h from updatedBlock IF explicitly provided (not undefined/null)
            // The API response may have stale layout values if layout was updated separately
            setBlocks((prev) =>
              prev.map((b) => {
                if (b.id === blockId) {
                  return {
                    ...b,
                    // Preserve layout from current state (x, y, w, h) - don't overwrite with undefined/null
                    x: updatedBlock.x !== undefined && updatedBlock.x !== null ? updatedBlock.x : b.x,
                    y: updatedBlock.y !== undefined && updatedBlock.y !== null ? updatedBlock.y : b.y,
                    w: updatedBlock.w !== undefined && updatedBlock.w !== null ? updatedBlock.w : b.w,
                    h: updatedBlock.h !== undefined && updatedBlock.h !== null ? updatedBlock.h : b.h,
                    // Merge config shallowly (including content_json)
                    config: { ...b.config, ...updatedBlock.config },
                    // Preserve other metadata from updated block
                    updated_at: updatedBlock.updated_at ?? b.updated_at,
                    order_index: updatedBlock.order_index ?? b.order_index,
                  }
                }
                return b
              })
            )
            return // Success - no need to refetch
          }
        }

        // Fallback: Reload blocks from server if returned blocks not available
        // This ensures saved config is reflected correctly
        const blocksResponse = await fetch(`/api/pages/${page.id}/blocks`, {
          cache: 'no-store', // Ensure fresh data
        })
        if (blocksResponse.ok) {
          const blocksData = await blocksResponse.json()
          const pageBlocks: PageBlock[] = (blocksData.blocks || []).map((block: any) => ({
            id: block.id,
            page_id: block.page_id || page.id,
            type: block.type,
            x: block.x ?? block.position_x ?? 0,
            y: block.y ?? block.position_y ?? 0,
            w: block.w ?? block.width ?? 4,
            h: block.h ?? block.height ?? 4,
            config: block.config || {},
            order_index: block.order_index ?? 0,
            created_at: block.created_at,
            updated_at: block.updated_at,
          }))
          // CRITICAL: Merge instead of replacing (preserve layout state)
          // CRITICAL: Preserve layout columns (x, y, w, h) from current block state
          // Only set x/y/w/h from updated block IF explicitly provided (not undefined/null)
          setBlocks((prevBlocks) => {
            const existingIds = new Set(prevBlocks.map(b => b.id))
            const merged = prevBlocks.map(b => {
              const updated = pageBlocks.find((pb: PageBlock) => pb.id === b.id)
              if (updated) {
                return {
                  ...b,
                  // Preserve layout from current state (x, y, w, h) - don't overwrite with undefined/null
                  x: updated.x !== undefined && updated.x !== null ? updated.x : b.x,
                  y: updated.y !== undefined && updated.y !== null ? updated.y : b.y,
                  w: updated.w !== undefined && updated.w !== null ? updated.w : b.w,
                  h: updated.h !== undefined && updated.h !== null ? updated.h : b.h,
                  // Merge config shallowly (including content_json)
                  config: { ...b.config, ...updated.config },
                  // Preserve other metadata from updated block
                  updated_at: updated.updated_at ?? b.updated_at,
                  order_index: updated.order_index ?? b.order_index,
                }
              }
              return b
            })
            // Add new blocks (these can use layout from API since they're new)
            pageBlocks.forEach(pb => {
              if (!existingIds.has(pb.id)) {
                merged.push(pb)
              }
            })
            return merged
          })
        } else {
          // Fallback: update local state optimistically if reload fails
          setBlocks((prev) =>
            prev.map((b) => (b.id === blockId ? { ...b, config: { ...b.config, ...config } } : b))
          )
        }
      } catch (error: any) {
        console.error("Failed to update block:", error)
        // Fallback: update local state optimistically on error
        setBlocks((prev) =>
          prev.map((b) => (b.id === blockId ? { ...b, config: { ...b.config, ...config } } : b))
        )
        toast({
          variant: "destructive",
          title: "Failed to save changes",
          description: error.message || "Please try again",
        })
      }
    },
    [page.id, toast]
  )

  const handleAddBlock = useCallback(
    async (type: BlockType) => {
      const def = BLOCK_REGISTRY[type]
      const maxY = blocks.length > 0 ? Math.max(...blocks.map((b) => b.y + b.h)) : 0

      try {
        const response = await fetch(`/api/pages/${page.id}/blocks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            x: 0,
            y: maxY,
            w: def.defaultWidth,
            h: def.defaultHeight,
            config: def.defaultConfig,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to create block' }))
          throw new Error(errorData.error || 'Failed to create block')
        }

        const data = await response.json()
        const block = data.block

        if (!block || !block.id) {
          throw new Error('Invalid block data returned from server')
        }

        setBlocks((prev) => [...prev, block])
        setSelectedBlockId(block.id)
      } catch (error: any) {
        console.error("Failed to create block:", error)
        toast({
          variant: "destructive",
          title: "Failed to create block",
          description: error.message || "Please try again",
        })
      }
    },
    [page.id, blocks, toast]
  )

  const handleDeleteBlock = useCallback(
    async (blockId: string) => {
      if (!confirm("Are you sure you want to delete this block?")) return

      try {
        const response = await fetch(`/api/pages/${page.id}/blocks/${blockId}`, {
          method: "DELETE",
        })

        if (!response.ok) {
          throw new Error("Failed to delete block")
        }

        setBlocks((prev) => prev.filter((b) => b.id !== blockId))
        if (selectedBlockId === blockId) {
          setSelectedBlockId(null)
          setSettingsPanelOpen(false)
        }
        toast({
          variant: "success",
          title: "Block deleted",
          description: "The block has been removed",
        })
      } catch (error: any) {
        console.error("Failed to delete block:", error)
        toast({
          variant: "destructive",
          title: "Failed to delete block",
          description: error.message || "Please try again",
        })
      }
    },
    [page.id, selectedBlockId, toast]
  )

  const handleDuplicateBlock = useCallback(
    async (blockId: string) => {
      const blockToDuplicate = blocks.find((b) => b.id === blockId)
      if (!blockToDuplicate) return

      try {
        const response = await fetch(`/api/pages/${page.id}/blocks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: blockToDuplicate.type,
            x: blockToDuplicate.x,
            y: (blockToDuplicate.y || 0) + (blockToDuplicate.h || 4), // Place below original
            w: blockToDuplicate.w,
            h: blockToDuplicate.h,
            config: blockToDuplicate.config,
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to duplicate block")
        }

        const { block } = await response.json()
        setBlocks((prev) => [...prev, block])
        setSelectedBlockId(block.id)
        toast({
          variant: "success",
          title: "Block duplicated",
          description: "The block has been copied",
        })
      } catch (error: any) {
        console.error("Failed to duplicate block:", error)
        toast({
          variant: "destructive",
          title: "Failed to duplicate block",
          description: error.message || "Please try again",
        })
      }
    },
    [page.id, blocks, toast]
  )

  const handleMoveBlockToTop = useCallback(
    async (blockId: string) => {
      const blockToMove = blocks.find((b) => b.id === blockId)
      if (!blockToMove) return

      // Find minimum Y position
      const minY = Math.min(...blocks.map((b) => b.y || 0))
      
      // Move block to top (y = minY - 1 or 0)
      const newY = Math.max(0, minY - 1)

      try {
        const layout: LayoutItem[] = blocks.map((b) => ({
          i: b.id,
          x: b.id === blockId ? blockToMove.x : b.x,
          y: b.id === blockId ? newY : b.y,
          w: b.w,
          h: b.h,
        }))

        await saveLayout(layout)
        
        // Update local state
        setBlocks((prev) =>
          prev.map((b) => (b.id === blockId ? { ...b, y: newY } : b))
        )

        toast({
          variant: "success",
          title: "Block moved",
          description: "Block moved to top",
        })
      } catch (error: any) {
        console.error("Failed to move block:", error)
        toast({
          variant: "destructive",
          title: "Failed to move block",
          description: error.message || "Please try again",
        })
      }
    },
    [page.id, blocks, saveLayout, toast]
  )

  const handleMoveBlockToBottom = useCallback(
    async (blockId: string) => {
      const blockToMove = blocks.find((b) => b.id === blockId)
      if (!blockToMove) return

      // Find maximum Y position
      const maxY = Math.max(...blocks.map((b) => (b.y || 0) + (b.h || 4)))
      
      // Move block to bottom
      const newY = maxY

      try {
        const layout: LayoutItem[] = blocks.map((b) => ({
          i: b.id,
          x: b.id === blockId ? blockToMove.x : b.x,
          y: b.id === blockId ? newY : b.y,
          w: b.w,
          h: b.h,
        }))

        await saveLayout(layout)
        
        // Update local state
        setBlocks((prev) =>
          prev.map((b) => (b.id === blockId ? { ...b, y: newY } : b))
        )

        toast({
          variant: "success",
          title: "Block moved",
          description: "Block moved to bottom",
        })
      } catch (error: any) {
        console.error("Failed to move block:", error)
        toast({
          variant: "destructive",
          title: "Failed to move block",
          description: error.message || "Please try again",
        })
      }
    },
    [page.id, blocks, saveLayout, toast]
  )

  const handleLockBlock = useCallback(
    async (blockId: string, locked: boolean) => {
      try {
        await handleBlockUpdate(blockId, { locked })
        toast({
          variant: "success",
          title: locked ? "Block locked" : "Block unlocked",
          description: locked 
            ? "Block is now view-only" 
            : "Block can be edited",
        })
      } catch (error: any) {
        console.error("Failed to lock block:", error)
        toast({
          variant: "destructive",
          title: "Failed to update block",
          description: error.message || "Please try again",
        })
      }
    },
    [handleBlockUpdate, toast]
  )

  const handleSaveSettings = useCallback(
    async (blockId: string, config: Partial<PageBlock["config"]>) => {
      await handleBlockUpdate(blockId, config)
    },
    [handleBlockUpdate]
  )

  const handlePageUpdate = useCallback(async () => {
    // Reload page data
    try {
      const response = await fetch(`/api/pages/${page.id}`)
      if (response.ok) {
        const data = await response.json()
        setCurrentPage(data.page)
      }
    } catch (error) {
      console.error("Failed to reload page:", error)
    }
  }, [page.id])

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) || null

  // Keyboard shortcuts
  useEffect(() => {
    if (!effectiveIsEditing) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input/textarea
      const target = e.target as HTMLElement
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return
      }

      // Delete block: Del or Backspace
      if ((e.key === "Delete" || e.key === "Backspace") && selectedBlockId) {
        e.preventDefault()
        handleDeleteBlock(selectedBlockId)
      }
      
      // Duplicate block: Cmd/Ctrl + D
      if ((e.metaKey || e.ctrlKey) && e.key === "d" && selectedBlockId) {
        e.preventDefault()
        handleDuplicateBlock(selectedBlockId)
      }
      
      // Exit edit mode: Esc
      if (e.key === "Escape") {
        e.preventDefault()
        handleExitEditMode()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [effectiveIsEditing, selectedBlockId, handleDeleteBlock, handleDuplicateBlock, handleExitEditMode])

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Main Canvas - Full width when not editing */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar / Interface Header */}
        {!hideHeader && (
        <div className="h-auto min-h-[56px] bg-white border-b border-gray-200 flex flex-col px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Icon */}
              {currentPage.settings?.icon && (
                <span className="text-xl flex-shrink-0" title="Interface icon">
                  {currentPage.settings.icon}
                </span>
              )}
              {/* Title and Description */}
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-semibold text-gray-900 truncate">{currentPage.name}</h1>
                {currentPage.description && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{currentPage.description}</p>
                )}
                {currentPage.updated_at && !effectiveIsEditing && (
                  <p className="text-xs text-gray-400 mt-1" suppressHydrationWarning>
                    Last updated {new Date(currentPage.updated_at).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Settings button */}
              <button
                onClick={() => setPageSettingsOpen(true)}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2 transition-colors"
                title="Interface Settings"
              >
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </button>
              {effectiveIsEditing ? (
              <>
                {selectedBlock && (
                  <div className="px-3 py-1.5 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-md">
                    Selected: {selectedBlock.type} block
                  </div>
                )}
                {selectedBlockId && (
                  <button
                    onClick={() => handleDeleteBlock(selectedBlockId)}
                    className="px-3 py-1.5 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-md hover:bg-red-50 flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                )}
                <div className="flex items-center gap-2">
                  {saveStatus === "saving" && (
                    <span className="text-xs text-gray-500">Saving...</span>
                  )}
                  {saveStatus === "saved" && (
                    <span className="text-xs text-green-600">All changes saved</span>
                  )}
                  {saveStatus === "error" && (
                    <span className="text-xs text-red-600">Save failed</span>
                  )}
                  <button
                    onClick={handleExitEditMode}
                    disabled={isSaving}
                    className="px-3 py-1.5 text-sm font-medium text-white rounded-md flex items-center gap-2 disabled:opacity-50"
                    style={{ 
                      backgroundColor: primaryColor,
                      opacity: isSaving ? 0.5 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!isSaving) {
                        // Darken on hover (reduce lightness by 10%)
                        const hslMatch = primaryColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
                        if (hslMatch) {
                          const [, h, s, l] = hslMatch
                          const newL = Math.max(0, parseInt(l) - 10)
                          e.currentTarget.style.backgroundColor = `hsl(${h}, ${s}%, ${newL}%)`
                        }
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = primaryColor
                    }}
                  >
                    {isSaving ? "Saving..." : "Done"}
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => enterBlockEdit()}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2 transition-colors"
              >
                <Edit2 className="h-4 w-4" />
                <span className="hidden sm:inline">Edit interface</span>
                <span className="sm:hidden">Edit</span>
              </button>
            )}
            </div>
          </div>
        </div>
        )}

        {/* Canvas */}
        <div className="flex-1 overflow-auto p-4">
          <FilterStateProvider>
            <Canvas
              blocks={blocks}
              isEditing={effectiveIsEditing}
              onLayoutChange={handleLayoutChange}
              onBlockUpdate={handleBlockUpdate}
              onBlockClick={setSelectedBlockId}
              onBlockSettingsClick={(blockId) => {
                setSelectedBlockId(blockId)
                setSettingsPanelOpen(true)
              }}
              onBlockDelete={handleDeleteBlock}
              onBlockDuplicate={handleDuplicateBlock}
              onAddBlock={handleAddBlock}
              selectedBlockId={selectedBlockId}
              layoutSettings={page.settings?.layout}
              primaryTableId={page.settings?.primary_table_id || null}
              layoutTemplate={(page.settings as any)?.layout_template || null}
              interfaceDescription={page.description || null}
              pageTableId={pageTableId}
              pageId={page.id}
              recordId={recordId}
              onRecordClick={onRecordClick}
            />
          </FilterStateProvider>
        </div>
      </div>

      {/* Settings Panel - Only opens when explicitly clicked */}
      {effectiveIsEditing && (
        <SettingsPanel
          block={selectedBlock}
          isOpen={settingsPanelOpen && !!selectedBlock}
          onClose={() => {
            setSettingsPanelOpen(false)
            setSelectedBlockId(null)
          }}
          onSave={handleSaveSettings}
          onMoveToTop={handleMoveBlockToTop}
          onMoveToBottom={handleMoveBlockToBottom}
          onLock={handleLockBlock}
        />
      )}

      {/* Floating Block Picker - Only visible in edit mode */}
      {effectiveIsEditing && (
        <FloatingBlockPicker onSelectBlock={handleAddBlock} />
      )}

      {/* Page Settings Drawer */}
      <PageSettingsDrawer
        page={currentPage}
        open={pageSettingsOpen}
        onOpenChange={setPageSettingsOpen}
        onPageUpdate={handlePageUpdate}
      />
    </div>
  )
}
