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
import { formatDateTimeUK } from "@/lib/utils"
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
  mode?: 'view' | 'edit' | 'review' // Record review mode: view (no editing), edit (full editing), review (content editing without layout)
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
  mode = 'view', // Default to view mode
  onRecordClick,
}: InterfaceBuilderProps) {
  const { primaryColor } = useBranding()
  const { toast } = useToast()
  const [blocks, setBlocks] = useState<PageBlock[]>(initialBlocks)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  
  // CRITICAL: Hydration lock - prevent Canvas from rendering until blocks are loaded
  // This prevents Canvas from committing empty layout state before blocks arrive
  // There are three states: Loading (undefined), Hydrated (≥0 blocks), Editing (≥0 blocks)
  // Canvas must NOT run until hydration is complete
  const [hasHydrated, setHasHydrated] = useState<boolean>(false)
  
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

  // CRITICAL: One-way gate - blocks are set from initialBlocks ONCE per pageId, then never replaced
  // After first load, initialBlocks must NEVER overwrite live state
  // This prevents edit/view drift, layout resets, and state loss
  // 
  // Rules:
  // - Blocks set from initialBlocks ONLY on first load (hasInitializedRef.current === false)
  // - After initialization, blocks are managed by user actions only (drag, resize, config, add, remove)
  // - Hash comparisons, revalidation, navigation back to page - none of these replace blocks
  // - Only pageId change resets the gate (allows initialization for new page)
  const hasInitializedRef = useRef<boolean>(false)
  const prevPageIdRef = useRef<string>(page.id)
  
  // Reset initialization flag and hydration state ONLY when pageId changes (navigation to different page)
  useEffect(() => {
    if (prevPageIdRef.current !== page.id) {
      prevPageIdRef.current = page.id
      hasInitializedRef.current = false
      latestLayoutRef.current = null // Reset layout ref on page change
      lastSavedLayoutRef.current = null // Reset saved layout hash on page change
      setHasHydrated(false) // Reset hydration lock on page change
    }
  }, [page.id])
  
  // Also check if initialBlocks was already populated on mount (synchronous load)
  // This handles the case where blocks are available immediately
  // CRITICAL: Empty blocks is a valid state - we should hydrate even with 0 blocks
  // This allows users to add blocks to empty pages
  useEffect(() => {
    if (initialBlocks !== undefined && !hasHydrated) {
      setHasHydrated(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  
  // CRITICAL: One-way gate - initialize blocks ONCE per pageId, never replace after
  // This is the final fix to prevent edit/view drift
  // 
  // Pattern: Check if we have initialBlocks and haven't initialized yet
  // Only depends on pageId - initialBlocks is checked inside, not in dependencies
  // This ensures effect only runs on pageId change, not on initialBlocks prop changes
  const prevInitialBlocksLengthRef = useRef<number>(initialBlocks?.length || 0)
  
  // Reset ref when pageId changes (for new pages)
  useEffect(() => {
    if (prevPageIdRef.current !== page.id) {
      prevInitialBlocksLengthRef.current = initialBlocks?.length || 0
    }
  }, [page.id])
  
  // Check on mount and pageId change
  useEffect(() => {
    // CRITICAL: Empty blocks is a valid state - a page might have no blocks yet
    // We should still initialize (hydrate) even with empty blocks to allow adding blocks
    if (initialBlocks === undefined) {
      // initialBlocks not yet provided (still loading)
      return
    }
    
    // One-way gate: only set blocks if we haven't initialized for this pageId
    // After this, blocks are managed by user actions only, never replaced by initialBlocks
    if (!hasInitializedRef.current) {
      console.log(`[InterfaceBuilder] First-time initialization (one-way gate): pageId=${page.id}`, {
        initialBlocksCount: initialBlocks.length,
        initialBlockIds: initialBlocks.map(b => b.id),
        isEmpty: initialBlocks.length === 0,
      })
      setBlocks(initialBlocks)
      hasInitializedRef.current = true
      prevInitialBlocksLengthRef.current = initialBlocks.length
      // Initialize latestLayoutRef from initialBlocks (grid's source of truth)
      // Empty array is valid - means no blocks yet
      latestLayoutRef.current = initialBlocks.map((block) => ({
        i: block.id,
        x: block.x || 0,
        y: block.y || 0,
        w: block.w || 4,
        h: block.h || 4,
      }))
      // Mark as hydrated when blocks are set (even if empty - that's valid saved data)
      // This allows users to add blocks to empty pages
      setHasHydrated(true)
    }
    // CRITICAL: Do NOT update blocks if already initialized
    // Even if initialBlocks changes (navigation, revalidation, re-render, etc.)
    // Live state takes precedence after first load
    // This prevents the "edit vs publish" drift issue
  }, [page.id]) // ONLY pageId - NOT initialBlocks, NOT hash, NOT mode, NOT props
  
  // Also check when initialBlocks arrives asynchronously
  // This handles the case where blocks load after mount
  // Runs on every render to catch async initialBlocks without dependencies
  useEffect(() => {
    // Skip if already initialized
    if (hasInitializedRef.current) {
      return
    }
    
    // CRITICAL: Empty blocks is a valid state - we should hydrate even with 0 blocks
    // This allows users to add blocks to empty pages
    // Only skip if initialBlocks is undefined (still loading)
    if (initialBlocks === undefined) {
      return
    }
    
    const currentLength = initialBlocks.length
    
    // Initialize now (even if empty - that's a valid state)
    // This catches both immediate and async arrival, including empty blocks
    console.log(`[InterfaceBuilder] Async initialization (one-way gate): pageId=${page.id}`, {
      initialBlocksCount: currentLength,
      initialBlockIds: initialBlocks.map(b => b.id),
      isEmpty: currentLength === 0,
    })
    setBlocks(initialBlocks)
    hasInitializedRef.current = true
    prevInitialBlocksLengthRef.current = currentLength
    // Initialize latestLayoutRef from initialBlocks (grid's source of truth)
    // Empty array is valid - means no blocks yet
    latestLayoutRef.current = initialBlocks.map((block) => ({
      i: block.id,
      x: block.x || 0,
      y: block.y || 0,
      w: block.w || 4,
      h: block.h || 4,
    }))
    // Mark as hydrated when blocks arrive asynchronously (even if empty)
    // This allows users to add blocks to empty pages
    setHasHydrated(true)
  }) // No dependencies - runs on every render to catch async initialBlocks

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState<Page>(page)
  // CRITICAL: Store latest grid layout in ref (source of truth during editing)
  // The grid library (react-grid-layout) has the authoritative layout
  // Blocks state is derived and may lag behind grid interactions
  // Never reconstruct layout from blocks - always use this ref
  const latestLayoutRef = useRef<LayoutItem[] | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const componentIdRef = useRef(`interface-builder-${page.id}`)

  // Register mount time for editor safety guards
  useEffect(() => {
    registerMount(componentIdRef.current)
    console.log(`[Lifecycle] InterfaceBuilder MOUNT: pageId=${page.id}, blocks=${initialBlocks?.length || 0}, isViewer=${isViewer}, effectiveIsEditing=${effectiveIsEditing}`)
    return () => {
      console.log(`[Lifecycle] InterfaceBuilder UNMOUNT: pageId=${page.id}`)
    }
  }, [])
  
  // Debug: Log when blocks state changes
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[InterfaceBuilder] Blocks state changed: count=${blocks.length}, effectiveIsEditing=${effectiveIsEditing}`)
    }
  }, [blocks.length, effectiveIsEditing])

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
  // Track last saved layout hash to prevent duplicate saves
  const lastSavedLayoutRef = useRef<string | null>(null)

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

      // Diff check: Skip save if layout hasn't changed
      // Create a stable hash of layout positions (ignore order, only positions matter)
      const layoutHash = JSON.stringify(
        layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })).sort((a, b) => a.i.localeCompare(b.i))
      )

      if (layoutHash === lastSavedLayoutRef.current) {
        if (process.env.NODE_ENV === 'development') {
          console.debug("[Layout] Save skipped: no diff (layout unchanged)")
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
          
          // Update last saved layout hash to prevent duplicate saves
          lastSavedLayoutRef.current = layoutHash
          
          // CRITICAL: Do NOT reload blocks after save
          // Blocks are already correct locally - reloading causes flicker/resets
          // Only reload on explicit refresh, page change, or data change
          console.log('🔥 saveLayout COMPLETE – not reloading (blocks already correct)')
          
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
   * CRITICAL: The grid is the source of truth for layout at the moment of interaction.
   * Blocks state is derived, not authoritative, during editing.
   * Always store the latest grid layout in latestLayoutRef - never reconstruct from blocks.
   */
  const handleLayoutChange = useCallback(
    (layout: LayoutItem[]) => {
      // Only save in edit mode - view mode never mutates layout
      if (!effectiveIsEditing) return

      // Mark user interaction for editor safety guards
      markUserInteraction()

      // Mark that layout has been modified by user
      layoutModifiedByUserRef.current = true

      // CRITICAL: Store latest grid layout in ref (source of truth)
      // The grid library has the authoritative layout - blocks state may lag
      latestLayoutRef.current = layout

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

  // Save layout without exiting edit mode
  const handleSave = useCallback(async (exitAfterSave = false) => {
    // Clear any pending debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }

    // Mark user interaction (save is a user action)
    markUserInteraction()

    // CRITICAL: Always use latestLayoutRef (grid's authoritative layout)
    // Never reconstruct from blocks state - blocks may be stale
    // The grid is the source of truth during editing
    const layoutToSave = latestLayoutRef.current

    // Only save if we have a layout from the grid
    if (layoutToSave && layoutToSave.length > 0) {
      setIsSaving(true)
      try {
        if (process.env.NODE_ENV === 'development') {
          console.log('[Layout] Saving layout (from grid ref):', {
            pageId: page.id,
            layoutCount: layoutToSave.length,
            layoutItems: layoutToSave,
            layoutModifiedByUser: layoutModifiedByUserRef.current,
            exitAfterSave,
          })
        }
        
        // CRITICAL: Pass hasUserInteraction=true to bypass guards
        // This ensures layout is saved even if layoutModifiedByUserRef was reset
        // Also mark as modified to ensure save goes through
        layoutModifiedByUserRef.current = true
        await saveLayout(layoutToSave, true)
        
        if (process.env.NODE_ENV === 'development') {
          console.log('[Layout] Layout saved successfully')
        }
        
        setSaveStatus("saved")
        toast({
          variant: "default",
          title: "Saved",
          description: "All changes have been saved",
        })
        
        // Reset status after 2 seconds (only if not exiting)
        if (!exitAfterSave) {
          setTimeout(() => setSaveStatus("idle"), 2000)
        }
      } catch (error) {
        console.error("Failed to save layout:", error)
        setSaveStatus("error")
        toast({
          variant: "destructive",
          title: "Failed to save",
          description: error instanceof Error ? error.message : "Please try again",
        })
        // Don't exit if save failed
        return
      } finally {
        setIsSaving(false)
      }
    } else if (process.env.NODE_ENV === 'development') {
      console.log('[Layout] No layout to save (grid ref is empty)')
    }

    // Exit edit mode if requested
    if (exitAfterSave) {
      exitBlockEdit()
      setSelectedBlockId(null)
      setSettingsPanelOpen(false)
    }
  }, [saveLayout, page.id, toast, exitBlockEdit])

  // Save layout and exit edit mode
  const handleExitEditMode = useCallback(async () => {
    await handleSave(true)
  }, [handleSave])

  // CRITICAL: Save layout when exiting edit mode (even if exitBlockEdit is called from parent)
  // This ensures layout is saved regardless of where "Done Editing" is clicked
  // Must be after saveLayout and latestLayoutRef are declared
  const prevIsEditingRef = useRef(effectiveIsEditing)
  useEffect(() => {
    // Detect when exiting edit mode (isEditing changes from true to false)
    if (prevIsEditingRef.current && !effectiveIsEditing) {
      // User just exited edit mode - save layout immediately
      // This handles the case where exitBlockEdit() is called from InterfacePageClient
      // We need to save layout even though handleExitEditMode wasn't called
      
      // CRITICAL: Always use latestLayoutRef (grid's authoritative layout)
      // Never reconstruct from blocks state - blocks may be stale
      const layoutToSave = latestLayoutRef.current
      
      if (layoutToSave && layoutToSave.length > 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[InterfaceBuilder] Auto-saving layout on edit mode exit (from grid ref):', {
            pageId: page.id,
            layoutCount: layoutToSave.length,
            layoutItems: layoutToSave.map(item => ({
              id: item.i,
              x: item.x,
              y: item.y,
              w: item.w,
              h: item.h,
            })),
          })
        }
        
        // CRITICAL: Mark as modified and save immediately (bypass guards since this is user-initiated exit)
        // Clear any pending debounced save since we're saving now
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current)
          saveTimeoutRef.current = null
        }
        
        layoutModifiedByUserRef.current = true
        saveLayout(layoutToSave, true).catch((error: any) => {
          console.error("Failed to auto-save layout on exit:", error)
          toast({
            variant: "destructive",
            title: "Failed to save layout",
            description: error instanceof Error ? error.message : "Please try again",
          })
        })
      } else if (process.env.NODE_ENV === 'development') {
        console.log('[InterfaceBuilder] No layout to auto-save on exit (grid ref is empty)')
      }
    }
    prevIsEditingRef.current = effectiveIsEditing
  }, [effectiveIsEditing, saveLayout, page.id, toast])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const handleBlockUpdate = useCallback(
    async (blockId: string, configPatch: Partial<PageBlock["config"]>) => {
      // 1) Optimistic in-place update (does not remount TipTap)
      // This preserves the same array length, same objects for other blocks,
      // and the same TextBlock instance - TipTap keeps focus + cursor
      setBlocks((prev) =>
        prev.map((b) =>
          b.id === blockId
            ? { ...b, config: { ...(b.config ?? {}), ...configPatch } }
            : b
        )
      )

      // PHASE 1 - TextBlock write verification: Log API payload
      if (process.env.NODE_ENV === 'development' && (configPatch as any).content_json) {
        console.log(`[TextBlock Write] Block ${blockId}: API PAYLOAD`, {
          blockId,
          payload: {
            id: blockId,
            config: {
              content_json: (configPatch as any).content_json,
            }
          },
          contentJson: (configPatch as any).content_json,
          contentJsonStr: JSON.stringify((configPatch as any).content_json),
        })
      }

      // 2) Persist to API
      const res = await fetch(`/api/pages/${page.id}/blocks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockUpdates: [{ id: blockId, config: configPatch }],
        }),
      })

      // 3) Only recover/reload on error
      if (!res.ok) {
        // Re-sync from server if save failed
        console.error(`[InterfaceBuilder] Block update failed, reloading from server: blockId=${blockId}`)
        const blocksResponse = await fetch(`/api/pages/${page.id}/blocks`, {
          cache: "no-store",
        })
        
        if (blocksResponse.ok) {
          const blocksData = await blocksResponse.json()
          const reloadedBlocks: PageBlock[] = (blocksData.blocks || blocksData || []).map((block: any) => ({
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
          setBlocks(reloadedBlocks)
        }
        
        toast({
          variant: "destructive",
          title: "Failed to save changes",
          description: `Failed to update block ${blockId}. State has been synced with server.`,
        })
        
        throw new Error(`Failed to update block ${blockId}`)
      }

      // PHASE 1 - TextBlock write verification: Log API response
      if (process.env.NODE_ENV === 'development' && (configPatch as any).content_json) {
        const responseData = await res.json().catch(() => ({}))
        console.log(`[TextBlock Write] Block ${blockId}: API RESPONSE`, {
          blockId,
          responseData,
          returnedBlocks: responseData.blocks,
          hasContentJson: responseData.blocks?.find((b: PageBlock) => b.id === blockId)?.config?.content_json ? true : false,
        })
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(`[InterfaceBuilder] Block updated successfully (optimistic): blockId=${blockId}`, {
          pageId: page.id,
          updatedConfig: configPatch,
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
      // CRITICAL: Use latestLayoutRef as source of truth, fallback to blocks if ref is empty
      const currentLayout = latestLayoutRef.current || blocks.map((b) => ({
        i: b.id,
        x: b.x || 0,
        y: b.y || 0,
        w: b.w || 4,
        h: b.h || 4,
      }))
      
      const layoutItemToMove = currentLayout.find((item) => item.i === blockId)
      if (!layoutItemToMove) return

      // Find minimum Y position from current layout
      const minY = Math.min(...currentLayout.map((item) => item.y || 0))
      
      // Move block to top (y = minY - 1 or 0)
      const newY = Math.max(0, minY - 1)

      try {
        // Create new layout with moved block
        const newLayout: LayoutItem[] = currentLayout.map((item) => ({
          i: item.i,
          x: item.x,
          y: item.i === blockId ? newY : item.y,
          w: item.w,
          h: item.h,
        }))

        // CRITICAL: Update latestLayoutRef before saving (ref → ref comparison)
        latestLayoutRef.current = newLayout

        await saveLayout(newLayout)
        
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
      // CRITICAL: Use latestLayoutRef as source of truth, fallback to blocks if ref is empty
      const currentLayout = latestLayoutRef.current || blocks.map((b) => ({
        i: b.id,
        x: b.x || 0,
        y: b.y || 0,
        w: b.w || 4,
        h: b.h || 4,
      }))
      
      const layoutItemToMove = currentLayout.find((item) => item.i === blockId)
      if (!layoutItemToMove) return

      // Find maximum Y position from current layout
      const maxY = Math.max(...currentLayout.map((item) => (item.y || 0) + (item.h || 4)))
      
      // Move block to bottom
      const newY = maxY

      try {
        // Create new layout with moved block
        const newLayout: LayoutItem[] = currentLayout.map((item) => ({
          i: item.i,
          x: item.x,
          y: item.i === blockId ? newY : item.y,
          w: item.w,
          h: item.h,
        }))

        // CRITICAL: Update latestLayoutRef before saving (ref → ref comparison)
        latestLayoutRef.current = newLayout

        await saveLayout(newLayout)
        
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
    <div className="flex h-full w-full bg-gray-50 min-w-0">
      {/* Main Canvas - Full width when not editing */}
      {/* CRITICAL: Container must have min-width: 0 to prevent flex collapse */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 w-full">
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
                    Last updated {formatDateTimeUK(currentPage.updated_at)}
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
                    onClick={() => handleSave()}
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
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={handleExitEditMode}
                    disabled={isSaving}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                  >
                    Done
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
        {/* CRITICAL: Canvas container must have min-width: 0 to prevent flex collapse */}
        {/* Without min-width: 0, flex children can overflow and cause grid width issues */}
        <div className="flex-1 overflow-auto p-4 min-w-0 w-full">
          <FilterStateProvider>
            {/* CRITICAL: Hydration lock - never render Canvas until blocks are loaded */}
            {/* This prevents Canvas from committing empty layout state before blocks arrive */}
            {!hasHydrated ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-gray-500">Loading blocks...</div>
              </div>
            ) : (
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
              mode={mode}
              onRecordClick={onRecordClick}
            />
            )}
          </FilterStateProvider>
          {/* Footer spacer to ensure bottom content is visible */}
          <div className="h-32 w-full" />
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
          pageTableId={pageTableId}
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
