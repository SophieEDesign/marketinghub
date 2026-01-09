"use client"

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Edit2, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import dynamic from "next/dynamic"
import { createClient } from "@/lib/supabase/client"
import { formatDateUK } from "@/lib/utils"
import type { InterfacePage } from "@/lib/interface/page-types-only"
import { hasPageAnchor, getPageAnchor } from "@/lib/interface/page-utils"
import PageRenderer from "./PageRenderer"
import PageSetupState from "./PageSetupState"
import PageDisplaySettingsPanel from "./PageDisplaySettingsPanel"
import InterfacePageSettingsDrawer from "./InterfacePageSettingsDrawer"
import { getRequiredAnchorType } from "@/lib/interface/page-types"
import { usePageEditMode, useBlockEditMode } from "@/contexts/EditModeContext"

// Lazy load InterfaceBuilder for dashboard/overview pages
const InterfaceBuilder = dynamic(() => import("./InterfaceBuilder"), { ssr: false })
// Lazy load RecordReviewPage for record_review pages
const RecordReviewPage = dynamic(() => import("./RecordReviewPage"), { ssr: false })

interface InterfacePageClientProps {
  pageId: string
  initialPage?: InterfacePage
  initialData?: any[]
  isAdmin?: boolean
}

// Internal component that uses useSearchParams - must be wrapped in Suspense
function InterfacePageClientInternal({ 
  pageId, 
  initialPage,
  initialData = [],
  isAdmin = false
}: InterfacePageClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [page, setPage] = useState<InterfacePage | null>(initialPage || null)
  const [data, setData] = useState<any[]>(initialData)
  const [loading, setLoading] = useState(!initialPage)
  const [isGridMode, setIsGridMode] = useState(false)
  
  // CRITICAL: Store initial page/data in refs to prevent overwrites after initial load
  const initialPageRef = useRef<InterfacePage | null>(initialPage || null)
  const initialDataRef = useRef<any[]>(initialData)
  const pageLoadedRef = useRef<boolean>(!!initialPage)
  
  // Use unified editing context
  const { isEditing: isPageEditing, enter: enterPageEdit, exit: exitPageEdit } = usePageEditMode(pageId)
  const { isEditing: isBlockEditing, enter: enterBlockEdit, exit: exitBlockEdit } = useBlockEditMode(pageId)
  
  const [blocks, setBlocks] = useState<any[]>([])
  const [blocksLoading, setBlocksLoading] = useState(false)
  const [displaySettingsOpen, setDisplaySettingsOpen] = useState(false)
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false)
  const [dataLoading, setDataLoading] = useState(false)
  const [pageTableId, setPageTableId] = useState<string | null>(null)
  
  // Track previous pageId to reset blocks when page changes
  // CRITICAL: Use ref to track actual pageId changes, not effect dependencies
  const previousPageIdRef = useRef<string | null>(null)
  
  // CRITICAL: Track if blocks have been loaded to prevent overwrites
  // Track both the loaded state and the pageId to ensure we reset when page changes
  const blocksLoadedRef = useRef<{ pageId: string | null; loaded: boolean }>({ pageId: null, loaded: false })
  
  // CRITICAL: Reset blocks and edit mode state ONLY when pageId actually changes
  // This ensures previous page's edit mode doesn't leak to the new page
  // DO NOT clear blocks for: edit mode toggles, viewer mode, saveLayout reloads, block updates, forceReload
  // Only clear for actual navigation (pageId changes)
  useEffect(() => {
    const currentPageId = page?.id || null
    
    // Only clear blocks if pageId actually changed (navigation occurred)
    if (previousPageIdRef.current !== null && previousPageIdRef.current !== currentPageId) {
      // Page actually changed - mark as not loaded but DO NOT clear blocks
      // CRITICAL: Keep current blocks until new load completes to prevent flicker
      // Blocks will be replaced in one setState when new page loads
      console.log(`[loadBlocks] Page changed — keeping blocks until new load: oldPageId=${previousPageIdRef.current}, newPageId=${currentPageId}`, {
        previousBlocksCount: blocks.length,
        previousBlockIds: blocks.map(b => b.id),
      })
      // DO NOT call setBlocks([]) - this causes flicker
      blocksLoadedRef.current = { pageId: currentPageId || '', loaded: false }
      
      // CRITICAL: Exit edit modes when navigating to a different page
      // The EditModeContext should handle this, but we ensure it here as well
      // This prevents edit mode from leaking between pages
      exitPageEdit()
      exitBlockEdit()
    } else if (previousPageIdRef.current === null && currentPageId) {
      // First load - just set the ref, don't clear blocks
      if (process.env.NODE_ENV === 'development') {
        console.log(`[loadBlocks] First page load: pageId=${currentPageId}`)
      }
    } else if (previousPageIdRef.current === currentPageId && currentPageId) {
      // Same page - preserve blocks
      if (process.env.NODE_ENV === 'development' && blocks.length > 0) {
        console.log(`[loadBlocks] Same page — preserving blocks: pageId=${currentPageId}, blocksCount=${blocks.length}`)
      }
    }
    
    // Update ref after checking (only if pageId exists)
    if (currentPageId) {
      previousPageIdRef.current = currentPageId
    }
  }, [page?.id, exitPageEdit, exitBlockEdit])
  
  // Inline title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState("")
  const [titleError, setTitleError] = useState(false)
  const [isSavingTitle, setIsSavingTitle] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedTitleRef = useRef<string>("")
  
  // Track previous values to prevent unnecessary data reloads
  const prevSourceViewRef = useRef<string | null>(null)
  const prevSavedViewIdRef = useRef<string | null>(null)
  const prevPageTypeRef = useRef<string | null>(null)
  const prevBaseTableRef = useRef<string | null>(null)
  const dataLoadingRef = useRef<boolean>(false)
  
  // Track view's updated_at to detect when view is edited
  const savedViewUpdatedAtRef = useRef<string | null>(null)
  const viewCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Determine if we're in edit mode (page or block editing)
  const isEditing = isPageEditing || isBlockEditing

  // CRITICAL: Extract pageTableId from page - only update when page changes
  useEffect(() => {
    if (!page) {
      setPageTableId(null)
      return
    }
    
    // Resolve tableId from page using the same logic as PageRenderer
    const resolveTableId = async () => {
      const { getPageTableId } = await import('@/lib/interface/page-table-utils')
      const tableId = await getPageTableId(page)
      setPageTableId(tableId)
    }
    
    resolveTableId()
  }, [page?.id, page?.base_table, page?.saved_view_id])

  useEffect(() => {
    // CRITICAL: Only load if we don't have initial page and haven't loaded yet
    if (!initialPageRef.current && !pageLoadedRef.current && !loading) {
      loadPage()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId])

  // Listen for custom event to open settings panel
  useEffect(() => {
    const handleOpenSettings = () => {
      setDisplaySettingsOpen(true)
    }
    window.addEventListener('open-page-settings', handleOpenSettings)
    return () => {
      window.removeEventListener('open-page-settings', handleOpenSettings)
    }
  }, [])

  // Initialize title value when page loads
  useEffect(() => {
    if (page?.name) {
      setTitleValue(page.name)
      lastSavedTitleRef.current = page.name
    }
  }, [page?.name])

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [isEditingTitle])

  useEffect(() => {
    if (!page) return
    
    // CRITICAL: Only skip reload if we already have data AND inputs haven't changed
    // This prevents the race condition where guards fire before data is committed
    const hasData = Array.isArray(data) && data.length > 0
    
    const sourceView = page.source_view || null
    const savedViewId = page.saved_view_id || null
    const pageType = page.page_type || null
    const baseTable = page.base_table || null
    
    // Check if anything actually changed
    const sourceViewChanged = prevSourceViewRef.current !== sourceView
    const savedViewIdChanged = prevSavedViewIdRef.current !== savedViewId
    const pageTypeChanged = prevPageTypeRef.current !== pageType
    const baseTableChanged = prevBaseTableRef.current !== baseTable
    
    // Only skip reload if we have data AND nothing changed
    // If we don't have data, we MUST load regardless of refs matching
    if (hasData && !sourceViewChanged && !savedViewIdChanged && !pageTypeChanged && !baseTableChanged) {
      return
    }
    
    // Update refs
    prevSourceViewRef.current = sourceView
    prevSavedViewIdRef.current = savedViewId
    prevPageTypeRef.current = pageType
    prevBaseTableRef.current = baseTable
    
    // Prevent concurrent loads
    if (dataLoadingRef.current) return
    
    // UNIFIED: Blocks handle their own data loading
    // Pages don't need to load data - blocks define their own data sources
    if (sourceView) {
      loadSqlViewData()
    } else if (savedViewId) {
      // Load data for pages with saved_view_id
      loadListViewData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page?.source_view, page?.saved_view_id, page?.page_type, page?.config, page?.base_table])
  
  // CRITICAL: Watch for view updates when page uses saved_view_id
  // This ensures that when a view is edited, the interface page refreshes
  useEffect(() => {
    if (!page?.saved_view_id) {
      // Clear interval if no saved_view_id
      if (viewCheckIntervalRef.current) {
        clearInterval(viewCheckIntervalRef.current)
        viewCheckIntervalRef.current = null
      }
      return
    }
    
    // Check for view updates periodically
    // Only check when page is visible to avoid unnecessary requests
    const checkViewUpdates = async () => {
      // Skip check if page is hidden (tab in background)
      if (document.hidden) return
      
      try {
        const supabase = createClient()
        const { data: view, error } = await supabase
          .from('views')
          .select('updated_at')
          .eq('id', page.saved_view_id)
          .single()
        
        if (!error && view?.updated_at) {
          const currentUpdatedAt = view.updated_at
          const previousUpdatedAt = savedViewUpdatedAtRef.current
          
          // If view was updated, reload data AND blocks
          // This ensures that blocks using the view are refreshed immediately
          if (previousUpdatedAt && currentUpdatedAt !== previousUpdatedAt) {
            console.log(`[InterfacePageClient] View updated detected - reloading data and blocks: viewId=${page.saved_view_id}`)
            savedViewUpdatedAtRef.current = currentUpdatedAt
            // Reload both data and blocks to ensure everything reflects the saved view
            loadListViewData()
            // Force reload blocks to pick up any changes in view configuration
            if (page && blocksLoadedRef.current.pageId === page.id) {
              loadBlocks(true) // forceReload = true
            }
          } else if (!previousUpdatedAt) {
            // First check - just store the timestamp
            savedViewUpdatedAtRef.current = currentUpdatedAt
          }
        }
      } catch (error) {
        console.error('Error checking view updates:', error)
      }
    }
    
    // Initial check
    checkViewUpdates()
    
    // Set up interval to check every 5 seconds (less frequent to reduce load)
    viewCheckIntervalRef.current = setInterval(checkViewUpdates, 5000)
    
    // Also check when page becomes visible (user switches back to tab)
    const handleVisibilityChange = () => {
      if (!document.hidden && page?.saved_view_id) {
        checkViewUpdates()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Cleanup interval and event listener on unmount or when saved_view_id changes
    return () => {
      if (viewCheckIntervalRef.current) {
        clearInterval(viewCheckIntervalRef.current)
        viewCheckIntervalRef.current = null
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page?.saved_view_id])

  // CRITICAL: Load blocks for ALL pages - unified Canvas + Blocks architecture
  // All pages render Canvas, so all pages need blocks loaded
  // Blocks must load in BOTH edit and view mode so they render correctly
  useEffect(() => {
    if (!page) return
    
    // Reset loaded state when pageId changes
    if (blocksLoadedRef.current.pageId !== page.id) {
      blocksLoadedRef.current = { pageId: page.id, loaded: false }
    }
    
    // Only load if blocks haven't been loaded yet for this page
    if (!blocksLoading && (!blocksLoadedRef.current.loaded || blocks.length === 0)) {
      loadBlocks()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page?.id])

  // CRITICAL: Mode changes must NEVER trigger block reloads
  // Edit mode is a capability flag only - it controls drag/resize/settings, not block state
  // Blocks are already correct after save - no reload needed
  // Removing block reload on exit edit mode - this was causing flicker and layout resets

  async function loadPage() {
    // CRITICAL: Only load if not already loaded (prevent overwriting initial data)
    if (pageLoadedRef.current || loading) return
    
    setLoading(true)
    try {
      const res = await fetch(`/api/interface-pages/${pageId}`)
      if (!res.ok) {
        if (res.status === 404) {
          // Page not found - set page to null so UI shows "not found" message
          // DO NOT redirect - let the component render the error state
          setPage(null)
          pageLoadedRef.current = true
          return
        }
        throw new Error('Failed to load page')
      }
      
      const pageData = await res.json()
      // CRITICAL: Only update if page hasn't been loaded yet (preserve initial data)
      if (!pageLoadedRef.current) {
        setPage(pageData)
        pageLoadedRef.current = true
      }
    } catch (error) {
      console.error("Error loading page:", error)
      // Set page to null on error - component will show error UI
      // DO NOT redirect - always render UI
      setPage(null)
      pageLoadedRef.current = true
    } finally {
      setLoading(false)
    }
  }

  async function loadSqlViewData() {
    if (!page?.source_view) return
    
    // Prevent concurrent calls
    if (dataLoadingRef.current) return
    dataLoadingRef.current = true
    setDataLoading(true)

    try {
      const res = await fetch(`/api/sql-views/${encodeURIComponent(page.source_view)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: page.config?.default_filters || {},
        }),
      })

      if (!res.ok) throw new Error('Failed to load SQL view data')
      
      const viewData = await res.json()
      setData(viewData.data || [])
    } catch (error) {
      console.error("Error loading SQL view data:", error)
      setData([])
    } finally {
      dataLoadingRef.current = false
      setDataLoading(false)
    }
  }

  async function loadRecordReviewData() {
    if (!page) return
    
    // Prevent concurrent calls
    if (dataLoadingRef.current) return
    dataLoadingRef.current = true
    setDataLoading(true)

    try {
      const supabase = createClient()
      let tableId: string | null = null
      let supabaseTableName: string | null = null

      // First, try to get table ID from saved_view_id
      if (page.saved_view_id) {
        const { data: view, error: viewError } = await supabase
          .from('views')
          .select('table_id')
          .eq('id', page.saved_view_id)
          .single()

        if (!viewError && view?.table_id) {
          tableId = view.table_id
        }
      }

      // Fallback to base_table if no view
      if (!tableId && page.base_table) {
        // Check if base_table is a UUID (table ID) or needs lookup
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(page.base_table)) {
          tableId = page.base_table
        }
      }

      if (!tableId) {
        console.error("No table ID found for record review page")
        setData([])
        dataLoadingRef.current = false
        setDataLoading(false)
        return
      }

      // Get table name
      const { data: table, error: tableError } = await supabase
        .from('tables')
        .select('supabase_table')
        .eq('id', tableId)
        .single()

      if (tableError || !table?.supabase_table) {
        console.error("Error loading table:", tableError)
        setData([])
        dataLoadingRef.current = false
        setDataLoading(false)
        return
      }

      supabaseTableName = table.supabase_table

      // Ensure we have a valid table name before querying
      if (!supabaseTableName) {
        console.error("No table name found")
        setData([])
        dataLoadingRef.current = false
        setDataLoading(false)
        return
      }

      // Load data directly from the actual table
      const { data: tableData, error: tableDataError } = await supabase
        .from(supabaseTableName)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000)

      if (tableDataError) {
        console.error("Error loading table data:", tableDataError)
        setData([])
        dataLoadingRef.current = false
        setDataLoading(false)
        return
      }

      // Ensure each record has an id field
      const records = (tableData || []).map((record: any) => ({
        ...record,
        id: record.id || record.record_id || crypto.randomUUID(), // Ensure id exists
      }))

      setData(records)
    } catch (error) {
      console.error("Error loading record review data:", error)
      setData([])
    } finally {
      dataLoadingRef.current = false
      setDataLoading(false)
    }
  }

  async function loadListViewData() {
    if (!page?.saved_view_id) return
    
    // Prevent concurrent calls
    if (dataLoadingRef.current) return
    dataLoadingRef.current = true
    setDataLoading(true)

    try {
      const supabase = createClient()
      
      // Get view with table_id and updated_at to track view changes
      const { data: view, error: viewError } = await supabase
        .from('views')
        .select('table_id, updated_at')
        .eq('id', page.saved_view_id)
        .single()

      if (viewError || !view?.table_id) {
        console.error("Error loading view:", viewError)
        setData([])
        dataLoadingRef.current = false
        setDataLoading(false)
        return
      }
      
      // Track view's updated_at to detect changes
      savedViewUpdatedAtRef.current = view.updated_at || null

      // Get table name
      const { data: table, error: tableError } = await supabase
        .from('tables')
        .select('supabase_table')
        .eq('id', view.table_id)
        .single()

      if (tableError || !table?.supabase_table) {
        console.error("Error loading table:", tableError)
        setData([])
        dataLoadingRef.current = false
        setDataLoading(false)
        return
      }

      // Load view filters and sorts
      const [filtersRes, sortsRes] = await Promise.all([
        supabase
          .from('view_filters')
          .select('*')
          .eq('view_id', page.saved_view_id),
        supabase
          .from('view_sorts')
          .select('*')
          .eq('view_id', page.saved_view_id)
          .order('order_index', { ascending: true }),
      ])

      const filters = filtersRes.data || []
      const sorts = sortsRes.data || []

      // Build query - use 'any' type to avoid deep type inference issues
      let query: any = supabase
        .from(table.supabase_table)
        .select('*')
        .limit(1000)

      // Apply filters
      for (const filter of filters) {
        const fieldName = filter.field_name || filter.field_id
        if (!fieldName || !filter.operator) continue

        switch (filter.operator) {
          case 'equal':
            query = query.eq(fieldName, filter.value)
            break
          case 'not_equal':
            query = query.neq(fieldName, filter.value)
            break
          case 'contains':
            query = query.ilike(fieldName, `%${filter.value}%`)
            break
          case 'not_contains':
            query = query.not('ilike', fieldName, `%${filter.value}%`)
            break
          case 'is_empty':
            query = query.is(fieldName, null)
            break
          case 'is_not_empty':
            query = query.not('is', fieldName, null)
            break
          case 'greater_than':
            query = query.gt(fieldName, filter.value)
            break
          case 'less_than':
            query = query.lt(fieldName, filter.value)
            break
        }
      }

      // Apply sorts
      if (sorts.length > 0) {
        for (const sort of sorts) {
          const fieldName = sort.field_name || sort.field_id
          if (!fieldName) continue
          const ascending = sort.direction === 'asc' || sort.order_direction === 'asc'
          query = query.order(fieldName, { ascending })
        }
      } else {
        // Default sort by created_at descending
        query = query.order('created_at', { ascending: false })
      }

      const { data: tableData, error: tableDataError } = await query

      if (tableDataError) {
        console.error("Error loading table data:", tableDataError)
        setData([])
      } else {
        setData(tableData || [])
      }
    } catch (error) {
      console.error("Error loading list view data:", error)
      setData([])
    } finally {
      dataLoadingRef.current = false
      setDataLoading(false)
    }
  }

  async function loadBlocks(forceReload = false) {
    console.log('🔥 loadBlocks CALLED', { pageId: page?.id || 'NO_PAGE', forceReload, previousPageId: previousPageIdRef.current })
    if (!page) return
    
    // CRITICAL: Only reset loaded state if pageId actually changed (not just on every call)
    // DO NOT clear blocks here - that's handled by the page change effect above
    if (blocksLoadedRef.current.pageId !== page.id) {
      console.log(`[loadBlocks] PageId changed in loadBlocks: old=${blocksLoadedRef.current.pageId}, new=${page.id}`)
      blocksLoadedRef.current = { pageId: page.id, loaded: false }
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[loadBlocks] Same pageId — preserving blocks: pageId=${page.id}, forceReload=${forceReload}`)
      }
    }
    
    // CRITICAL: Only load blocks once per page visit (prevent remounts)
    // Unless forceReload is true (e.g., when exiting edit mode to refresh saved content)
    if (!forceReload && blocksLoadedRef.current.loaded && blocks.length > 0) {
      return
    }

    setBlocksLoading(true)
    try {
      const res = await fetch(`/api/pages/${page.id}/blocks`)
      if (!res.ok) {
        const errorText = await res.text()
        console.error(`[loadBlocks] API ERROR: pageId=${page.id}, page_type=${page.page_type}`, {
          status: res.status,
          statusText: res.statusText,
          errorText,
        })
        throw new Error(`Failed to load blocks: ${res.status} ${res.statusText}`)
      }
      
      const data = await res.json()
      
      // CRITICAL: Log API response for debugging - show full response structure
      console.log(`[loadBlocks] API returned: pageId=${page.id}, page_type=${page.page_type}`, {
        responseStatus: res.status,
        responseOk: res.ok,
        apiResponseRaw: data,
        apiResponseBlocksCount: data.blocks?.length || 0,
        apiResponseBlockIds: data.blocks?.map((b: any) => b.id) || [],
        apiResponseBlocks: data.blocks, // Full blocks array for inspection
        forceReload,
        currentBlocksCount: blocks.length,
        currentBlockIds: blocks.map(b => b.id),
      })
      
      // Convert view_blocks format to PageBlock format
      // CRITICAL: Preserve actual database values - API already maps position_x/position_y/width/height to x/y/w/h
      // Only default if values are explicitly null/undefined (new blocks)
      const pageBlocks = (data.blocks || []).map((block: any) => {
        // REGRESSION CHECK: Warn if existing block has null layout values
        if (process.env.NODE_ENV === 'development' && block.created_at) {
          const hasNullLayout = 
            (block.position_x == null && block.x == null) ||
            (block.position_y == null && block.y == null) ||
            (block.width == null && block.w == null) ||
            (block.height == null && block.h == null)
          
          if (hasNullLayout) {
            console.warn(`[Layout Load] Block ${block.id}: NULL layout values for existing block`, {
              blockId: block.id,
              position_x: block.position_x,
              position_y: block.position_y,
              width: block.width,
              height: block.height,
              x: block.x,
              y: block.y,
              w: block.w,
              h: block.h,
              created_at: block.created_at,
              warning: 'Existing block has null layout - this may cause layout reset'
            })
          }
        }
        
        return {
          id: block.id,
          page_id: block.page_id || page.id,
          type: block.type,
          // CRITICAL: Use API-mapped values (x/y/w/h) if available, otherwise use DB columns
          // API maps position_x -> x, position_y -> y, width -> w, height -> h
          x: block.x != null ? block.x : (block.position_x != null ? block.position_x : 0),
          y: block.y != null ? block.y : (block.position_y != null ? block.position_y : 0),
          w: block.w != null ? block.w : (block.width != null ? block.width : 4),
          h: block.h != null ? block.h : (block.height != null ? block.height : 4),
          config: block.config || {},
          order_index: block.order_index ?? 0,
          created_at: block.created_at,
          updated_at: block.updated_at,
        }
      })
      // CRITICAL: Database is source of truth - always replace state entirely when loading from DB
      // Preview state is only valid before save completes - after reload, DB state must be used
      // Exception: If reload returns empty blocks and we have existing blocks, preserve them
      // (prevents clearing blocks due to race conditions or temporary API issues)
      if (pageBlocks.length === 0 && blocks.length > 0 && !forceReload) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[Blocks] Reload returned empty blocks, preserving existing blocks', {
            prevBlocksCount: blocks.length,
            forceReload,
            pageId: page.id
          })
        }
        blocksLoadedRef.current = { pageId: page.id, loaded: true }
        return
      }
      
      // Replace state entirely - database is source of truth
      console.log(`[loadBlocks] setBlocks CALLED: pageId=${page.id}, page_type=${page.page_type}`, {
        forceReload,
        oldBlocksCount: blocks.length,
        newBlocksCount: pageBlocks.length,
        oldBlockIds: blocks.map((b: any) => b.id),
        newBlockIds: pageBlocks.map((b: any) => b.id),
        willReplace: true,
      })
      setBlocks(pageBlocks)
      blocksLoadedRef.current = { pageId: page.id, loaded: true }
    } catch (error) {
      console.error("Error loading blocks:", error)
      // CRITICAL: Never clear blocks on error - preserve existing blocks
      // This prevents remount storms when errors occur during reload
      // Only set loading to false so UI can show error state
    } finally {
      setBlocksLoading(false)
    }
  }

  // CRITICAL: Do NOT reload blocks when entering edit mode
  // Layout hydration should only happen on initial mount or when block IDs change
  // Reloading blocks on edit mode entry causes layout resets
  // Blocks are already loaded in the useEffect above based on page/page_type

  const handleGridToggle = () => {
    setIsGridMode(!isGridMode)
  }

  // UNIFIED: No grid toggle - all pages use Canvas with blocks
  const showGridToggle = false

  // Merge config with grid mode override
  const pageWithConfig = useMemo(() => {
    if (!page) {
      // CRITICAL: Return a placeholder object instead of null to prevent remounts
      // This ensures the component tree stays stable
      return {
        id: '',
        name: '',
        page_type: 'content' as const,
        config: {},
        source_view: null,
        base_table: null,
        group_id: null,
        order_index: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: null,
        is_admin_only: false,
        saved_view_id: null,
        dashboard_layout_id: null,
        form_config_id: null,
        record_config_id: null,
      } as InterfacePage
    }
    return {
      ...page,
      config: {
        ...page.config,
        visualisation: isGridMode ? 'grid' : (page.config?.visualisation || 'content'),
      },
    }
  }, [page, isGridMode])

  // CRITICAL: Memoize InterfaceBuilder page prop to prevent remounts
  // Creating new object on every render causes component remounts
  // UNIFIED: All pages use the same structure - no page-type-specific config
  // Map InterfacePage.config to Page.settings for RecordReviewPage
  // CRITICAL: Only depend on page.id and essential props - NOT page_type, NOT config changes
  // This ensures the page object reference is stable and doesn't cause remounts
  const interfaceBuilderPage = useMemo(() => {
    if (!page) return null
    const pageConfig = page.config || {}
    return {
      id: page.id,
      name: page.name,
      page_type: page.page_type, // Preserve page type for RecordReviewPage
      settings: {
        // CRITICAL: layout_template is informational only - it does NOT affect layout
        // Layout is determined by blocks only, not by page type or template
        layout_template: 'content' as const,
        // Map config to settings for RecordReviewPage
        // For record_view/record_review pages, tableId comes from base_table or config.tableId
        tableId: pageConfig.tableId || page.base_table || pageTableId || null,
        leftPanel: pageConfig.leftPanel || null,
        primary_table_id: page.base_table || pageTableId || null,
      }
    } as any
  }, [page?.id, page?.name, page?.base_table, pageTableId]) // CRITICAL: NOT page?.page_type, NOT page?.config

  // CRITICAL: Memoize blocks array to prevent remounts
  // Only create new reference if blocks actually changed
  // CRITICAL: Do NOT include page?.page_type in dependencies - it causes remounts when page type changes
  const memoizedBlocks = useMemo(() => {
    const result = blocks || []
    console.log(`[InterfacePageClient] memoizedBlocks: pageId=${page?.id}, page_type=${page?.page_type}`, {
      blocksCount: result.length,
      blockIds: result.map(b => b.id),
      rawBlocksCount: blocks.length,
    })
    return result
  }, [blocks, page?.id]) // ONLY page.id - NOT page_type, NOT mode, NOT isViewer
  

  // Save page title with debouncing - MUST be before early returns (React Hooks rule)
  const savePageTitle = useCallback(async (newTitle: string, immediate = false) => {
    if (!page || !isAdmin) return
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }

    const doSave = async () => {
      // Don't save if title hasn't changed
      if (newTitle.trim() === lastSavedTitleRef.current) {
        setIsSavingTitle(false)
        return
      }

      setIsSavingTitle(true)
      setTitleError(false)

      try {
        const res = await fetch(`/api/interface-pages/${page.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newTitle.trim() }),
        })

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to save page title')
        }

        // Update local state
        const updatedPage = await res.json()
        // API returns page directly (not wrapped in { page: ... })
        setPage(updatedPage)
        lastSavedTitleRef.current = newTitle.trim()
        setTitleValue(newTitle.trim())
        setTitleError(false)
        
        // Trigger sidebar refresh to update navigation
        window.dispatchEvent(new CustomEvent('pages-updated'))
      } catch (error: any) {
        console.error('Error saving page title:', error)
        setTitleError(true)
        // Revert to last saved title
        setTitleValue(lastSavedTitleRef.current)
        // Show error to user
        alert(error.message || 'Failed to save page title. Please try again.')
        // Clear error state after a moment
        setTimeout(() => setTitleError(false), 3000)
      } finally {
        setIsSavingTitle(false)
      }
    }

    if (immediate) {
      await doSave()
    } else {
      // Debounce: wait 1000ms (within 800-1200ms range) before saving
      saveTimeoutRef.current = setTimeout(doSave, 1000)
    }
  }, [page, isAdmin])

  // Cleanup timeout on unmount - MUST be before early returns (React Hooks rule)
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // ALWAYS render UI - never return null or redirect
  if (loading && !page) {
    return <div className="h-screen flex items-center justify-center">Loading interface page...</div>
  }

  if (!page || !pageWithConfig) {
    return <div className="h-screen flex items-center justify-center">Page not found</div>
  }

  const isViewer = searchParams?.get("view") === "true"
  const isRecordView = page?.page_type === 'record_view'
  const isRecordReview = page?.page_type === 'record_review'
  
  // Both record_view and record_review use the RecordReviewPage layout
  // record_view is legacy, record_review is the new corrected model
  const useRecordReviewLayout = isRecordReview || isRecordView
  
  // Check if page has a valid anchor
  const pageHasAnchor = page ? hasPageAnchor(page) : false
  const pageAnchor = page ? getPageAnchor(page) : null
  const requiredAnchor = page ? getRequiredAnchorType(page.page_type) : null

  // Edit page behavior - UNIFIED: Always enter block editing mode
  const handleEditClick = () => {
    if (!page) return
    
    // UNIFIED: All pages use block editing mode
    enterBlockEdit()
  }
  
  // Handler to open page settings drawer
  const handleOpenPageSettings = () => {
    // For record_view and record_review pages, use InterfacePageSettingsDrawer (has left panel settings)
    // For other pages, use PageDisplaySettingsPanel
    if (page?.page_type === 'record_view' || page?.page_type === 'record_review') {
      setPageSettingsOpen(true)
    } else {
      setDisplaySettingsOpen(true)
    }
  }

  async function handlePageUpdate() {
    // CRITICAL: Reset loaded flags to allow reload after settings update
    // This is intentional - user explicitly updated settings
    pageLoadedRef.current = false
    if (page?.id) {
      blocksLoadedRef.current = { pageId: page.id, loaded: false }
    }
    // Reload page data after settings update
    // Parallelize independent requests
    await Promise.all([
      loadPage(),
      // UNIFIED: All pages support blocks
      loadBlocks(),
    ])
    // Load data after page is loaded (depends on page.source_view)
    if (page?.source_view) {
      await loadSqlViewData()
    }
  }

  const handleTitleChange = (value: string) => {
    setTitleValue(value)
    // Debounced save
    savePageTitle(value, false)
  }

  const handleTitleBlur = async () => {
    // Save immediately on blur - wait for save to complete
    if (titleValue.trim() !== lastSavedTitleRef.current) {
      await savePageTitle(titleValue.trim(), true)
    }
    setIsEditingTitle(false)
  }

  const handleTitleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      // Save immediately on Enter - wait for save to complete
      if (titleValue.trim() !== lastSavedTitleRef.current) {
        await savePageTitle(titleValue.trim(), true)
      }
      setIsEditingTitle(false)
      titleInputRef.current?.blur()
    } else if (e.key === 'Escape') {
      // Revert to last saved title
      setTitleValue(lastSavedTitleRef.current)
      setIsEditingTitle(false)
      setTitleError(false)
      titleInputRef.current?.blur()
    }
  }

  const handleStartEditTitle = () => {
    setIsEditingTitle(true)
    setTitleValue(page?.name || "")
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header with Edit Button - Admin Only */}
      {!isViewer && page && isAdmin && (
        <div className="border-b bg-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {isEditingTitle ? (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <input
                  ref={titleInputRef}
                  type="text"
                  value={titleValue}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  onBlur={handleTitleBlur}
                  onKeyDown={handleTitleKeyDown}
                  className={`flex-1 text-lg font-semibold border-none outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 ${
                    titleError ? 'bg-red-50 ring-2 ring-red-500' : ''
                  }`}
                  disabled={isSavingTitle}
                />
                {isSavingTitle && (
                  <span className="text-xs text-gray-400">Saving...</span>
                )}
              </div>
            ) : (
              <>
                <h1 
                  className="text-lg font-semibold cursor-text hover:text-blue-600 transition-colors flex-1 min-w-0 truncate"
                  onClick={handleStartEditTitle}
                  title="Click to edit page title"
                >
                  {page.name}
                </h1>
                {page.updated_at && (
                  <span className="text-xs text-gray-500 flex-shrink-0" suppressHydrationWarning>
                    Updated {formatDateUK(page.updated_at)}
                  </span>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isBlockEditing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => exitBlockEdit()}
              >
                Done Editing
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Enter block edit mode
                    enterBlockEdit()
                    // Blocks are already loaded (loaded in useEffect on mount)
                    // No need to await - edit mode doesn't require fresh data
                  }}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit interface
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenPageSettings}
                  title="Page Settings"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Header without Edit Button - Non-admin with View Only badge */}
      {!isViewer && page && !isAdmin && (
        <div className="border-b bg-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <h1 className="text-lg font-semibold flex-1 min-w-0 truncate">{page.name}</h1>
            <span 
              className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded flex-shrink-0"
              title="Ask an admin to edit this page"
            >
              View only
            </span>
            {page.updated_at && (
              <span className="text-xs text-gray-500 flex-shrink-0" suppressHydrationWarning>
                Updated {formatDateUK(page.updated_at)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {/* CRITICAL: Always render the same component tree to prevent remount storms */}
        {/* Show loading/error states as overlays, not separate trees */}
        {loading && !page ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-gray-500">Loading page...</div>
          </div>
        ) : !page ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Page not found</h2>
              <p className="text-sm text-gray-500">The page you&apos;re looking for doesn&apos;t exist.</p>
            </div>
          </div>
        ) : page ? (
          // CRITICAL: Never mount InterfaceBuilder with blocks=0
          // This prevents empty layout state from being committed before blocks arrive
          // Wait for blocks to load before rendering (hydration lock at component level)
          !blocksLoadedRef.current.loaded && blocks.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-gray-500">Loading blocks...</div>
            </div>
          ) : (
            // CRITICAL: Always render the same component tree to prevent remounts
            // Record Review pages use RecordReviewPage wrapper (fixed left + right canvas)
            // Content pages use InterfaceBuilder directly
            // But both must use stable keys based ONLY on page.id
            // Mode, isViewer, recordId must NEVER be in keys
            useRecordReviewLayout ? (
              <RecordReviewPage
                key={page.id} // CRITICAL: ONLY page.id - never include mode, isViewer, or recordId
                page={interfaceBuilderPage as any}
                initialBlocks={memoizedBlocks}
                isViewer={isViewer || !isBlockEditing}
                hideHeader={true}
              />
            ) : (
              // UNIFIED: All other pages render InterfaceBuilder (which wraps Canvas)
              // Use isViewer prop to control edit/view mode instead of switching components
              // This prevents remount storms when switching between edit and view modes
              interfaceBuilderPage ? (
                <InterfaceBuilder
                  key={page.id} // CRITICAL: ONLY page.id - never include mode, isViewer, or recordId
                  page={interfaceBuilderPage}
                  initialBlocks={memoizedBlocks}
                  // CRITICAL: Respect both URL-based viewer mode and edit mode state
                  // URL-based viewer mode takes precedence (force read-only)
                  // Otherwise, viewer mode = not in block editing mode
                  isViewer={isViewer || !isBlockEditing}
                  hideHeader={true}
                  pageTableId={pageTableId}
                  recordId={isRecordView ? (page.config?.record_id || null) : null}
                  mode={isRecordView ? (isBlockEditing ? 'edit' : 'view') : 'view'}
                />
              ) : null
            )
          )
        ) : null}
      </div>

      {/* Page Settings Drawer - For record_view and record_review pages (has left panel settings) */}
      {page && (page.page_type === 'record_view' || page.page_type === 'record_review') && (
        <InterfacePageSettingsDrawer
          pageId={page.id}
          isOpen={pageSettingsOpen}
          onClose={() => setPageSettingsOpen(false)}
          onUpdate={(updatedPage) => {
            setPage(updatedPage)
            handlePageUpdate()
          }}
        />
      )}

      {/* Page Display Settings Panel - For other page types */}
      {page && page.page_type !== 'record_view' && page.page_type !== 'record_review' && (
        <PageDisplaySettingsPanel
          page={page}
          isOpen={displaySettingsOpen}
          onClose={() => setDisplaySettingsOpen(false)}
          onUpdate={handlePageUpdate}
        />
      )}

    </div>
  )
}

// Export wrapper with Suspense boundary for useSearchParams
export default function InterfacePageClient(props: InterfacePageClientProps) {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center">Loading...</div>}>
      <InterfacePageClientInternal {...props} />
    </Suspense>
  )
}
