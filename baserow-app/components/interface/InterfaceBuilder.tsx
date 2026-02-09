"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useUndoRedo } from "@/hooks/useUndoRedo"
import { Save, Eye, Edit2, Plus, Trash2, Settings, MoreVertical, Undo2, Redo2 } from "lucide-react"
import { useBranding } from "@/contexts/BrandingContext"
import { useBlockEditMode } from "@/contexts/EditModeContext"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import { FilterStateProvider } from "@/lib/interface/filter-state"
import Canvas from "./Canvas"
import FloatingBlockPicker from "./FloatingBlockPicker"
import SettingsPanel from "./SettingsPanel"
import PageSettingsDrawer from "./PageSettingsDrawer"
import HorizontalGroupedCanvasModal from "./blocks/HorizontalGroupedCanvasModal"
import type { PageBlock, LayoutItem, Page, RecordContext } from "@/lib/interface/types"
import { BLOCK_REGISTRY } from "@/lib/interface/registry"
import type { BlockType } from "@/lib/interface/types"
import { useToast } from "@/components/ui/use-toast"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatDateTimeUK } from "@/lib/utils"
import {
  registerMount,
  guardAgainstMountSave,
  guardAgainstAutoSave,
  markUserInteraction,
} from "@/lib/interface/editor-safety"
import { usePageAggregates } from "@/lib/dashboard/usePageAggregates"
import { useFilterState } from "@/lib/interface/filter-state"
import SaveStatusIndicator from "@/components/save-status/SaveStatusIndicator"
import { createClient } from "@/lib/supabase/client"
import type { FilterConfig } from "@/lib/interface/filters"
import type { FilterTree } from "@/lib/filters/canonical-model"

function isBlockEligibleForFullPage(block: PageBlock): boolean {
  if (!block.config?.is_full_page) return false
  if (block.type === 'record_context') {
    return Boolean(block.config?.table_id)
  }
  return true
}

interface InterfaceBuilderProps {
  page: Page
  initialBlocks: PageBlock[]
  isViewer?: boolean
  onSave?: () => void
  onEditModeChange?: (isEditing: boolean) => void
  hideHeader?: boolean
  pageTableId?: string | null // Table ID from the page
  recordId?: string | null // Record ID for record review pages
  recordTableId?: string | null // Table ID of the record in context (content pages with Record Context Block)
  mode?: 'view' | 'edit' | 'review' // Record review mode: view (no editing), edit (full editing), review (content editing without layout)
  onRecordClick?: (recordId: string) => void // Callback for record clicks (for RecordReview integration)
  onRecordContextChange?: (context: RecordContext) => void // Content pages: set/clear page-level record context
  pageEditable?: boolean // Page-level editability (for field blocks)
  editableFieldNames?: string[] // Field-level editable list (for field blocks)
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
  recordTableId = null,
  mode = 'view', // Default to view mode
  onRecordClick,
  onRecordContextChange,
  pageEditable,
  editableFieldNames = [],
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
  
  // Interface mode: single source of truth for edit state (Airtable-style)
  // When interface is in edit mode, all record modals must open in edit mode
  const interfaceMode: 'view' | 'edit' = effectiveIsEditing ? 'edit' : 'view'
  
  // CRITICAL: Sync interfaceMode with RecordPanelContext so RecordPanel inherits edit mode
  const { setInterfaceMode } = useRecordPanel()
  useEffect(() => {
    setInterfaceMode(interfaceMode)
  }, [interfaceMode, setInterfaceMode])
  
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
  
  // Ref: have we resolved multiple full-page blocks for this page (invariant: at most one is_full_page)
  const resolvedFullPageRef = useRef<string | null>(null)

  // Reset initialization flag and hydration state ONLY when pageId changes (navigation to different page)
  useEffect(() => {
    if (prevPageIdRef.current !== page.id) {
      prevPageIdRef.current = page.id
      hasInitializedRef.current = false
      latestLayoutRef.current = null // Reset layout ref on page change
      lastSavedLayoutRef.current = null // Reset saved layout hash on page change
      setHasHydrated(false) // Reset hydration lock on page change
      resolvedFullPageRef.current = null // Allow full-page resolution to run for new page
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
  
  // CRITICAL FIX: Stabilize async initialBlocks check - use proper dependencies instead of running on every render
  // This prevents the effect from running unnecessarily and causing re-renders
  // Track the last initialBlocks length to detect when it actually changes
  const prevInitialBlocksLengthForAsyncRef = useRef<number | null>(null)
  
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[InterfaceBuilder] Async initialization effect RUN: pageId=${page.id}, hasInitialized=${hasInitializedRef.current}, initialBlocksLength=${initialBlocks?.length ?? 'undefined'}`)
    }
    
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
    
    // CRITICAL: Only initialize if initialBlocks length actually changed
    // This prevents re-running when initialBlocks reference changes but content is the same
    if (prevInitialBlocksLengthForAsyncRef.current === currentLength) {
      return
    }
    
    prevInitialBlocksLengthForAsyncRef.current = currentLength
    
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
  }, [page.id, initialBlocks?.length]) // CRITICAL FIX: Add dependencies to prevent running on every render
  // Only run when pageId changes or initialBlocks length changes (not on every render)

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(new Set())
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false)
  // Track which block should open a record in edit mode: { blockId, recordId, tableId }
  const [openRecordInEditModeForBlock, setOpenRecordInEditModeForBlock] = useState<{
    blockId: string
    recordId: string
    tableId: string
  } | null>(null)

  // Callback to open a record in edit mode for layout editing
  const handleOpenRecordForLayoutEdit = useCallback(async (tableId: string): Promise<string | null> => {
    if (!selectedBlockId) return null
    try {
      const supabase = createClient()
      // Get table name
      const { data: table } = await supabase
        .from("tables")
        .select("supabase_table")
        .eq("id", tableId)
        .single()

      if (!table?.supabase_table) {
        return null
      }

      // Get first record (or create one if none exist)
      const { data: records } = await supabase
        .from(table.supabase_table)
        .select("id")
        .limit(1)
        .order("created_at", { ascending: false })

      let recordId: string | null = null
      if (records && records.length > 0) {
        recordId = records[0].id
      } else {
        // Create a temporary record
        const { data: newRecord } = await supabase
          .from(table.supabase_table)
          .insert([{}])
          .select("id")
          .single()
        if (newRecord) {
          recordId = newRecord.id
        }
      }

      if (recordId) {
        setOpenRecordInEditModeForBlock({ blockId: selectedBlockId, recordId, tableId })
        return recordId
      }
      return null
    } catch (error) {
      console.error("Error opening record for layout edit:", error)
      return null
    }
  }, [selectedBlockId])
  const [isSaving, setIsSaving] = useState(false)
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState<Page>(page)
  // Track which block's internal canvas is being edited (for Tabs blocks)
  const [editingBlockCanvasId, setEditingBlockCanvasId] = useState<string | null>(null)
  // Track modal state for Tabs block canvas editing
  const [canvasModalOpen, setCanvasModalOpen] = useState(false)
  const [canvasModalBlock, setCanvasModalBlock] = useState<PageBlock | null>(null)
  const [canvasModalData, setCanvasModalData] = useState<{
    tableId: string
    tableName: string
    tableFields: any[]
  } | null>(null)
  // CRITICAL: Store latest grid layout in ref (source of truth during editing)
  // The grid library (react-grid-layout) has the authoritative layout
  // Blocks state is derived and may lag behind grid interactions
  // Never reconstruct layout from blocks - always use this ref
  const latestLayoutRef = useRef<LayoutItem[] | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const componentIdRef = useRef(`interface-builder-${page.id}`)
  const canvasScrollContainerRef = useRef<HTMLDivElement | null>(null)
  
  // Undo/Redo for layout changes
  const initialLayoutState = useMemo(() => {
    return blocks.map((block) => ({
      i: block.id,
      x: block.x || 0,
      y: block.y || 0,
      w: block.w || 4,
      h: block.h || 4,
    }))
  }, [])
  
  const {
    state: undoRedoLayoutState,
    setState: setUndoRedoLayoutState,
    undo: undoLayout,
    redo: redoLayout,
    canUndo,
    canRedo,
  } = useUndoRedo<LayoutItem[]>(initialLayoutState, {
    maxHistory: 50,
    debounceMs: 300,
  })

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
      if (!effectiveIsEditing) return false

      // Pre-deployment guard: Prevent saves during mount
      if (guardAgainstMountSave(componentIdRef.current, 'saveLayout')) {
        return false
      }

      // Pre-deployment guard: Prevent saves without user interaction
      if (guardAgainstAutoSave('saveLayout', hasUserInteraction || layoutModifiedByUserRef.current)) {
        return false
      }

      // CRITICAL: Never save layout unless user actually modified it
      // This prevents regressions from automatic saves on mount/hydration
      if (!layoutModifiedByUserRef.current) {
        if (process.env.NODE_ENV === 'development') {
          console.debug("[Layout] Save blocked: no user modification")
        }
        return false
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
        return false
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
          // Only log in dev mode to reduce console noise
          if (process.env.NODE_ENV === 'development') {
            console.log('🔥 saveLayout COMPLETE – not reloading (blocks already correct)')
          }
          
          // Show success feedback briefly, then reset to idle
          setTimeout(() => setSaveStatus("idle"), 2000)
          return true
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
        return false
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
      // #region agent log
      if (process.env.NODE_ENV === 'development') {
        console.log('[InterfaceBuilder] handleLayoutChange called', { layoutLen: layout?.length })
      }
      // #endregion
      // Only save in edit mode - view mode never mutates layout
      if (!effectiveIsEditing) return
      
      // Add to undo/redo history
      setUndoRedoLayoutState(layout, false)

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
        const ok = await saveLayout(layoutToSave, true)
        if (!ok) {
          // `saveLayout` already toasts on error.
          setSaveStatus("error")
          return
        }
        
        if (process.env.NODE_ENV === 'development') {
          console.log('[Layout] Layout saved successfully')
        }
        
        setSaveStatus("saved")
        toast({
          variant: "default",
          title: exitAfterSave ? "Finished editing" : "Saved",
          description: exitAfterSave ? "All changes have been saved." : "All changes have been saved",
        })
        
        // Reset status after 2 seconds (only if not exiting)
        if (!exitAfterSave) {
          setTimeout(() => setSaveStatus("idle"), 2000)
        }
      } catch (error) {
        console.error("Failed to save layout:", error)
        setSaveStatus("error")
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
        void saveLayout(layoutToSave, true).then((ok) => {
          if (ok) {
            toast({
              title: "Finished editing",
              description: "All changes have been saved.",
            })
          }
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
      // #region agent log
      if (process.env.NODE_ENV === 'development') {
        console.log('[InterfaceBuilder] handleBlockUpdate called', { blockId, keys: Object.keys(configPatch || {}) })
      }
      // #endregion
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

  // Helper function to find next available position without overlapping.
  // If preferredY is provided (e.g. from current scroll position), tries to place near that row first.
  const findNextAvailablePosition = useCallback((
    newWidth: number,
    newHeight: number,
    existingBlocks: PageBlock[],
    preferredY?: number
  ): { x: number; y: number } => {
    const GRID_COLS = 12
    
    // If no blocks exist, start at top-left or at preferredY
    if (existingBlocks.length === 0) {
      const y = preferredY != null && preferredY >= 0 ? Math.round(preferredY) : 0
      return { x: 0, y }
    }

    // Create a set of occupied cells for fast collision detection
    const occupied = new Set<string>()
    existingBlocks.forEach(block => {
      const x = block.x ?? 0
      const y = block.y ?? 0
      const w = block.w ?? 4
      const h = block.h ?? 4
      
      for (let cellX = x; cellX < x + w && cellX < GRID_COLS; cellX++) {
        for (let cellY = y; cellY < y + h; cellY++) {
          occupied.add(`${cellX},${cellY}`)
        }
      }
    })

    const maxY = existingBlocks.length > 0 
      ? Math.max(...existingBlocks.map((b) => (b.y ?? 0) + (b.h ?? 4)))
      : 0

    // If preferredY is set (current viewport), try that region first: from preferredY-1 to preferredY+newHeight+2
    if (preferredY != null && preferredY >= 0) {
      const startYMin = Math.max(0, Math.floor(preferredY) - 1)
      const startYMax = Math.min(maxY + newHeight, Math.ceil(preferredY) + newHeight + 2)
      for (let startY = startYMin; startY <= startYMax; startY++) {
        for (let startX = 0; startX <= GRID_COLS - newWidth; startX++) {
          let canFit = true
          for (let cellX = startX; cellX < startX + newWidth; cellX++) {
            for (let cellY = startY; cellY < startY + newHeight; cellY++) {
              if (occupied.has(`${cellX},${cellY}`)) {
                canFit = false
                break
              }
            }
            if (!canFit) break
          }
          if (canFit) return { x: startX, y: startY }
        }
      }
    }

    // Fill gaps from top
    for (let startY = 0; startY <= maxY; startY++) {
      for (let startX = 0; startX <= GRID_COLS - newWidth; startX++) {
        let canFit = true
        for (let cellX = startX; cellX < startX + newWidth; cellX++) {
          for (let cellY = startY; cellY < startY + newHeight; cellY++) {
            if (occupied.has(`${cellX},${cellY}`)) {
              canFit = false
              break
            }
          }
          if (!canFit) break
        }
        if (canFit) return { x: startX, y: startY }
      }
    }

    return { x: 0, y: maxY }
  }, [])

  const handleAddBlock = useCallback(
    async (type: BlockType) => {
      const def = BLOCK_REGISTRY[type]

      // If page already has an eligible full-page block, prevent adding a second block
      const currentFullPageBlock = blocks.find(
        (b) => b.config?.is_full_page === true && isBlockEligibleForFullPage(b)
      )
      if (currentFullPageBlock && blocks.length >= 1) {
        toast({
          variant: "default",
          title: "Full-page mode is on",
          description: "Turn off full-page mode for the current block in block settings to add more blocks.",
        })
        return
      }

      // Prefer position in current viewport so user doesn't have to scroll to find the new block
      const rowHeight = page.settings?.layout?.rowHeight ?? 30
      const marginY = (page.settings?.layout?.margin && Array.isArray(page.settings.layout.margin))
        ? page.settings.layout.margin[1]
        : 10
      const rowPx = rowHeight + marginY
      const scrollTop = canvasScrollContainerRef.current?.scrollTop ?? 0
      const preferredY = rowPx > 0 ? scrollTop / rowPx : undefined

      const position = findNextAvailablePosition(def.defaultWidth, def.defaultHeight, blocks, preferredY)
      const wasEmpty = blocks.length === 0

      try {
        // Use createBlockWithDefaults to get proper defaults
        const { createBlockWithDefaults } = await import('@/lib/core-data/block-defaults')
        const defaultConfig = createBlockWithDefaults(type)

        const response = await fetch(`/api/pages/${page.id}/blocks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            x: position.x,
            y: position.y,
            w: def.defaultWidth,
            h: def.defaultHeight,
            config: defaultConfig, // Use standardized defaults
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

        // When adding the first block and type supports full-page, prompt to use as full-page view only if block is eligible (e.g. record_context needs table_id)
        if (wasEmpty && def.supportsFullPage && isBlockEligibleForFullPage(block)) {
          const defaultYes = def.defaultFullPage === true
          const message = defaultYes
            ? "Use this block as a full-page view? (You can change this in block settings.)"
            : "Use this block as a full-page view?"
          const useFullPage = window.confirm(message)
          if (useFullPage) {
            await handleBlockUpdate(block.id, { ...(block.config || {}), is_full_page: true })
          }
        }
      } catch (error: any) {
        console.error("Failed to create block:", error)
        toast({
          variant: "destructive",
          title: "Failed to create block",
          description: error.message || "Please try again",
        })
      }
    },
    [page.id, page.settings, blocks, toast, findNextAvailablePosition, handleBlockUpdate]
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

      const moveH = layoutItemToMove.h ?? 4
      // Place moved block at top (y=0); shift all other blocks down by its height to avoid overlap
      const newY = 0

      try {
        const newLayout: LayoutItem[] = currentLayout.map((item) => ({
          i: item.i,
          x: item.x,
          y: item.i === blockId ? newY : (item.y ?? 0) + moveH,
          w: item.w,
          h: item.h,
        }))

        // CRITICAL: Update latestLayoutRef before saving (ref → ref comparison)
        latestLayoutRef.current = newLayout
        // Explicit user action: treat as user-initiated layout change
        markUserInteraction()
        layoutModifiedByUserRef.current = true

        await saveLayout(newLayout, true)
        
        // Update local state so Canvas syncs and shows new positions
        setBlocks((prev) =>
          prev.map((b) => {
            const item = newLayout.find((l) => l.i === b.id)
            return item ? { ...b, y: item.y, x: item.x } : b
          })
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
        // Explicit user action: treat as user-initiated layout change
        markUserInteraction()
        layoutModifiedByUserRef.current = true

        await saveLayout(newLayout, true)
        
        // Update local state so Canvas syncs and shows new positions
        setBlocks((prev) =>
          prev.map((b) => {
            const item = newLayout.find((l) => l.i === b.id)
            return item ? { ...b, y: item.y, x: item.x } : b
          })
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
      // CRITICAL: Ensure edit mode stays active after saving
      // User may need to edit other blocks, so explicitly keep edit mode active
      // Only if not in viewer mode
      if (!isViewer && !isEditing) {
        enterBlockEdit()
      }
    },
    [handleBlockUpdate, isViewer, isEditing, enterBlockEdit]
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

  // Apply undo/redo layout changes
  useEffect(() => {
    if (undoRedoLayoutState && undoRedoLayoutState.length > 0 && latestLayoutRef.current) {
      // Only apply if different from current layout
      const currentHash = JSON.stringify(
        latestLayoutRef.current.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })).sort((a, b) => a.i.localeCompare(b.i))
      )
      const newHash = JSON.stringify(
        undoRedoLayoutState.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })).sort((a, b) => a.i.localeCompare(b.i))
      )
      
      if (currentHash !== newHash) {
        // Update blocks to match undo/redo state
        setBlocks((prevBlocks) => {
          return prevBlocks.map((block) => {
            const layoutItem = undoRedoLayoutState.find((item) => item.i === block.id)
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
        
        // Update latest layout ref
        latestLayoutRef.current = undoRedoLayoutState
        
        // Mark as user interaction and save to database
        layoutModifiedByUserRef.current = true
        saveLayout(undoRedoLayoutState, true)
      }
    }
  }, [undoRedoLayoutState, saveLayout])

  // Corrective pass: clear is_full_page on invalid record_context (no table_id) so page never locks on invalid config.
  useEffect(() => {
    blocks.forEach((block) => {
      if (
        block.type === 'record_context' &&
        block.config?.is_full_page === true &&
        !block.config?.table_id
      ) {
        handleBlockUpdate(block.id, { ...block.config, is_full_page: false })
      }
    })
  }, [blocks, handleBlockUpdate])

  // Full-page invariant: at most one block may have config.is_full_page === true (among eligible blocks).
  // If multiple do (e.g. legacy data or bug), resolve to the most recently edited and clear the others.
  useEffect(() => {
    const fullPageBlocks = blocks.filter(
      (b) => b.config?.is_full_page === true && isBlockEligibleForFullPage(b)
    )
    if (fullPageBlocks.length <= 1) return
    if (resolvedFullPageRef.current === page.id) return
    resolvedFullPageRef.current = page.id
    const sorted = [...fullPageBlocks].sort((a, b) => {
      const aAt = a.updated_at || a.created_at || ''
      const bAt = b.updated_at || b.created_at || ''
      return bAt.localeCompare(aAt)
    })
    const others = sorted.slice(1)
    void (async () => {
      for (const b of others) {
        try {
          await handleBlockUpdate(b.id, { ...(b.config ?? {}), is_full_page: false })
        } catch (e) {
          console.error('[InterfaceBuilder] Failed to clear is_full_page on block', b.id, e)
        }
      }
    })()
  }, [blocks, page.id, handleBlockUpdate])

  // Derive full-page block for canvas: only when exactly one block and it has is_full_page and is eligible.
  const fullPageBlockId = useMemo(() => {
    const eligibleFullPageBlocks = blocks.filter(
      (b) => b.config?.is_full_page === true && isBlockEligibleForFullPage(b)
    )
    return eligibleFullPageBlocks.length === 1 && blocks.length === 1
      ? eligibleFullPageBlocks[0].id
      : null
  }, [blocks])
  
  // Keyboard shortcuts
  useEffect(() => {
    if (!effectiveIsEditing) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input/textarea
      const target = e.target as HTMLElement
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return
      }

      // Undo: Cmd/Ctrl + Z
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault()
        if (canUndo) {
          undoLayout()
        }
        return
      }
      
      // Redo: Cmd/Ctrl + Shift + Z
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault()
        if (canRedo) {
          redoLayout()
        }
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
  }, [effectiveIsEditing, selectedBlockId, handleDeleteBlock, handleDuplicateBlock, handleExitEditMode, canUndo, canRedo, undoLayout, redoLayout, layoutModifiedByUserRef])

  return (
    <div className="flex h-full w-full min-h-0 bg-gray-50 min-w-0">
      {/* Main Canvas - Full width when not editing */}
      {/* CRITICAL: min-h-0 so full-page content doesn't force scroll */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0 w-full">
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
                  {/* Undo/Redo buttons */}
                  <div className="flex items-center gap-1 border-r border-gray-300 pr-2 mr-1">
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        if (canUndo) {
                          undoLayout()
                        }
                      }}
                      disabled={!canUndo}
                      className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Undo (Cmd+Z)"
                      aria-label="Undo"
                    >
                      <Undo2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        if (canRedo) {
                          redoLayout()
                        }
                      }}
                      disabled={!canRedo}
                      className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Redo (Cmd+Shift+Z)"
                      aria-label="Redo"
                    >
                      <Redo2 className="h-4 w-4" />
                    </button>
                  </div>
                  <SaveStatusIndicator status={saveStatus} />
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                    aria-label="Page actions"
                    title="Actions"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => enterBlockEdit()}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit interface
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setPageSettingsOpen(true)}>
                    <Settings className="h-4 w-4 mr-2" />
                    Page settings
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            </div>
          </div>
        </div>
        )}

        {/* Canvas */}
        {/* CRITICAL: Canvas container must have min-width: 0 to prevent flex collapse */}
        {/* Full-page: no scroll, no padding (single scroll context inside block). Normal: overflow-auto p-4. */}
        <div
          ref={canvasScrollContainerRef}
          className={`flex-1 min-w-0 w-full min-h-0 ${fullPageBlockId ? "overflow-hidden p-0" : "overflow-auto p-4"}`}
        >
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
              interfaceMode={interfaceMode}
              onLayoutChange={handleLayoutChange}
              onBlockUpdate={handleBlockUpdate}
              onBlockClick={setSelectedBlockId}
              onBlockSelect={(blockId, addToSelection) => {
                if (addToSelection) {
                  setSelectedBlockIds(prev => {
                    const next = new Set(prev)
                    if (next.has(blockId)) {
                      next.delete(blockId)
                      // If removing the last selected, clear single selection too
                      if (next.size === 0) {
                        setSelectedBlockId(null)
                      }
                    } else {
                      next.add(blockId)
                      setSelectedBlockId(blockId) // Update primary selection
                    }
                    return next
                  })
                } else {
                  setSelectedBlockIds(new Set([blockId]))
                  setSelectedBlockId(blockId)
                }
              }}
              selectedBlockIds={selectedBlockIds}
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
              recordTableId={recordTableId}
              mode={mode}
              onRecordClick={onRecordClick}
              onRecordContextChange={onRecordContextChange}
              pageShowAddRecord={
                (page.settings?.show_add_record ?? (page.settings as any)?.showAddRecord) === true
              }
              pageEditable={pageEditable}
              editableFieldNames={editableFieldNames}
              pageShowFieldNames={(page as any).config?.show_field_names !== false}
              editingBlockCanvasId={editingBlockCanvasId}
              fullPageBlockId={fullPageBlockId}
            />
            )}
          </FilterStateProvider>
          {/* Footer spacer to ensure bottom content is visible (accounts for taskbar) */}
          <div className="h-48 w-full" />
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
            // Exit block canvas editing when closing settings
            if (editingBlockCanvasId) {
              setEditingBlockCanvasId(null)
            }
          }}
          onSave={handleSaveSettings}
          onMoveToTop={handleMoveBlockToTop}
          onMoveToBottom={handleMoveBlockToBottom}
          pageTableId={pageTableId}
          allBlocks={blocks}
          onLock={handleLockBlock}
          editingBlockCanvasId={editingBlockCanvasId}
          onOpenRecordForLayoutEdit={handleOpenRecordForLayoutEdit}
          onEditBlockCanvas={async (blockId) => {
            // For Tabs blocks, open modal instead of inline editing
            const block = blocks.find(b => b.id === blockId)
            if (block?.type === 'horizontal_grouped') {
              const tableId = block.config?.table_id || pageTableId
              if (!tableId) {
                toast({
                  variant: "destructive",
                  title: "Table not configured",
                  description: "Please configure a table in block settings first.",
                })
                return
              }
              
              // Load table data for modal
              try {
                const supabase = createClient()
                const { data: tableData } = await supabase
                  .from("tables")
                  .select("supabase_table")
                  .eq("id", tableId)
                  .single()
                
                if (!tableData?.supabase_table) {
                  toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Could not load table information.",
                  })
                  return
                }
                
                // Load fields
                const response = await fetch(`/api/tables/${tableId}/fields`)
                const data = await response.json()
                
                setCanvasModalData({
                  tableId,
                  tableName: tableData.supabase_table,
                  tableFields: data.fields || [],
                })
                setCanvasModalBlock(block)
                setCanvasModalOpen(true)
              } catch (error) {
                console.error("Error loading table data for modal:", error)
                toast({
                  variant: "destructive",
                  title: "Error",
                  description: "Failed to load table data.",
                })
              }
            } else {
              // For other block types, use inline editing
              setEditingBlockCanvasId(blockId)
            }
          }}
          onExitBlockCanvas={() => {
            setEditingBlockCanvasId(null)
          }}
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

      {/* Tabs block canvas modal */}
      {canvasModalOpen && canvasModalBlock && canvasModalData && (
        <HorizontalGroupedCanvasModal
          open={canvasModalOpen}
          onOpenChange={setCanvasModalOpen}
          block={canvasModalBlock}
          tableId={canvasModalData.tableId}
          tableName={canvasModalData.tableName}
          tableFields={canvasModalData.tableFields}
          filters={[]}
          filterTree={null}
          groupBy={canvasModalBlock.config?.group_by_field}
          groupByRules={canvasModalBlock.config?.group_by_rules as any}
          recordFields={(canvasModalBlock.config?.record_fields as any) || []}
          storedLayout={(canvasModalBlock.config?.record_field_layout as any) || null}
          highlightRules={(canvasModalBlock.config?.highlight_rules as any) || []}
          onSave={async (blocks) => {
            // Save the layout to block config
            await handleBlockUpdate(canvasModalBlock.id, {
              record_field_layout: blocks,
            })
            // Update the block in local state
            setBlocks((prev) =>
              prev.map((b) =>
                b.id === canvasModalBlock.id
                  ? { ...b, config: { ...b.config, record_field_layout: blocks } }
                  : b
              )
            )
            // Update canvasModalBlock to reflect changes
            setCanvasModalBlock((prev) =>
              prev
                ? {
                    ...prev,
                    config: { ...prev.config, record_field_layout: blocks },
                  }
                : null
            )
            toast({
              variant: "default",
              title: "Canvas layout saved",
              description: "Changes have been saved successfully.",
            })
          }}
        />
      )}
    </div>
  )
}
