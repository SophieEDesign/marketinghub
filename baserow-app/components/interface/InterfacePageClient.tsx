"use client"

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import dynamic from "next/dynamic"
import { createClient } from "@/lib/supabase/client"
import { formatDateUK } from "@/lib/utils"
import type { InterfacePage } from "@/lib/interface/page-types-only"
import type { RecordContext } from "@/lib/interface/types"
import type { FieldLayoutItem } from "@/lib/interface/field-layout-utils"
import { hasPageAnchor, getPageAnchor } from "@/lib/interface/page-utils"
import PageRenderer from "./PageRenderer"
import PageSetupState from "./PageSetupState"
import { useRightSettingsPanelData } from "@/contexts/RightSettingsPanelDataContext"
import { getRequiredAnchorType } from "@/lib/interface/page-types"
import { usePageEditMode, useBlockEditMode } from "@/contexts/EditModeContext"
import { useUIMode } from "@/contexts/UIModeContext"
import { useMainScroll } from "@/contexts/MainScrollContext"
import { useSelectionContext } from "@/contexts/SelectionContext"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import { VIEWS_ENABLED } from "@/lib/featureFlags"
import { toPostgrestColumn } from "@/lib/supabase/postgrest"
import { normalizeUuid } from "@/lib/utils/ids"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import { isAbortError } from "@/lib/api/error-handling"
import PageActionsRegistrar from "./PageActionsRegistrar"
import { debugLog, debugWarn, debugError } from "@/lib/debug"
// Lazy load InterfaceBuilder for dashboard/overview pages
const InterfaceBuilder = dynamic(() => import("./InterfaceBuilder"), { ssr: false })
// Lazy load RecordReviewPage for record_review pages
const RecordReviewPage = dynamic(() => import("./RecordReviewPage"), { ssr: false })

// PostgREST expects unquoted identifiers in order clauses; see `lib/supabase/postgrest`.

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
  const { toast } = useToast()

  const [page, setPage] = useState<InterfacePage | null>(initialPage || null)
  const [data, setData] = useState<any[]>(initialData)
  const [loading, setLoading] = useState(!initialPage)
  const [isGridMode, setIsGridMode] = useState(false)
  
  // CRITICAL: Store initial page/data in refs to prevent overwrites after initial load
  const initialPageRef = useRef<InterfacePage | null>(initialPage || null)
  const initialDataRef = useRef<any[]>(initialData)
  const pageLoadedRef = useRef<boolean>(!!initialPage)
  
  // Use unified editing context (block scope kept in sync with UIMode editPages)
  const { isEditing: isPageEditing, enter: enterPageEdit, exit: exitPageEdit } = usePageEditMode(pageId)
  const { isEditing: isBlockEditing, enter: enterBlockEdit, exit: exitBlockEdit } = useBlockEditMode(pageId)
  const { exitEditPages } = useUIMode()
  const { selectedContext, setSelectedContext } = useSelectionContext()
  const { setData: setRightPanelData } = useRightSettingsPanelData()
  const { state: recordPanelState } = useRecordPanel()
  const isRecordViewOpen = recordPanelState.isOpen

  const [blocks, setBlocks] = useState<any[]>([])
  const [blocksLoading, setBlocksLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(false)
  const [pageTableId, setPageTableId] = useState<string | null>(null)

  // Content pages only: ephemeral record context (never persisted). Not used for record_review/record_view.
  const [recordContext, setRecordContext] = useState<RecordContext>(null)
  
  // Track previous pageId to reset blocks when page changes
  // CRITICAL: Use ref to track actual pageId changes, not effect dependencies
  const previousPageIdRef = useRef<string | null>(null)
  // Track route pageId so we can reset and refetch when user navigates to a different page
  const previousRoutePageIdRef = useRef<string | null>(null)
  
  // CRITICAL: Track if blocks have been loaded to prevent overwrites
  // Track both the loaded state and the pageId to ensure we reset when page changes
  const blocksLoadedRef = useRef<{ pageId: string | null; loaded: boolean }>({ pageId: null, loaded: false })
  
  // CRITICAL: Track if loadBlocks is currently executing to prevent concurrent calls
  const blocksLoadingRef = useRef<boolean>(false)
  
  // Restore block edit mode from localStorage when navigating to a page (persists across refresh/navigation)
  useEffect(() => {
    if (!pageId || typeof window === "undefined") return
    const saved = localStorage.getItem(`block-edit-mode-${pageId}`)
    if (saved === "true") {
      enterBlockEdit()
    }
  }, [pageId, enterBlockEdit])

  // CRITICAL: Edit state is NOT reset on navigation - only when user explicitly exits
  // Do NOT add effects that depend on blocks, page, or edit mode - they cause remount loops
  
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

  // CRITICAL: When route pageId changes (navigation), reset page state so we refetch and remount.
  // Do NOT call exitPageEdit/exitBlockEdit - edit state persists across navigation.
  // Only change edit state when user explicitly calls enter/exit via UI.
  useEffect(() => {
    if (previousRoutePageIdRef.current !== null && previousRoutePageIdRef.current !== pageId) {
      if (process.env.NODE_ENV === "development") {
        debugLog("[Nav] Route pageId changed:", { from: previousRoutePageIdRef.current, to: pageId })
      }
      setPage(null)
      setBlocks([])
      setLoading(false)
      pageLoadedRef.current = false
      initialPageRef.current = null // so loadPage() runs for the new page
      blocksLoadedRef.current = { pageId: null, loaded: false }
      previousPageIdRef.current = null
      setSelectedContext(null)
    }
    previousRoutePageIdRef.current = pageId
  }, [pageId, setSelectedContext])

  // Listen for custom event to open settings panel (context-driven)
  useEffect(() => {
    const handleOpenSettings = () => {
      setSelectedContext({ type: 'page' })
    }
    window.addEventListener('open-page-settings', handleOpenSettings)
    return () => {
      window.removeEventListener('open-page-settings', handleOpenSettings)
    }
  }, [setSelectedContext])

  // Sync page data to RightSettingsPanel when page is available
  const selectedBlockIdForPanel =
    selectedContext?.type === "block" || selectedContext?.type === "recordList"
      ? selectedContext.blockId
      : undefined
  // handlePageUpdate changes when page loads (page?.id, page?.source_view) - must not be in sync effect deps
  const handlePageUpdate = useCallback(async () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7e9b68cb-9457-4ad2-a6ab-af4806759e7a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'InterfacePageClient.tsx:handlePageUpdate:entry',message:'Page update triggered - will reload page and blocks',data:{pageId},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    pageLoadedRef.current = false
    if (pageId) {
      blocksLoadedRef.current = { pageId, loaded: false }
    }
    await Promise.all([loadPage(), loadBlocks(true)])
    if (page?.source_view) {
      loadSqlViewData()
    }
  }, [pageId, page?.id, page?.source_view])

  const handlePageUpdateRef = useRef(handlePageUpdate)
  useEffect(() => {
    handlePageUpdateRef.current = handlePageUpdate
  }, [handlePageUpdate])

  const stableHandlePageUpdate = useCallback(async () => {
    await handlePageUpdateRef.current()
  }, [])

  // CRITICAL: RightPanel sync depends ONLY on page.id, page, blocks, selectedContext - NOT handlePageUpdate
  const lastRightPanelSyncRef = useRef<{ pageRef: InterfacePage | null; blocksRef: any[]; selectedBlockId: string | undefined } | null>(null)
  const prevBlocksRef = useRef<{ blocks: any[]; signature: string }>({ blocks: [], signature: "" })
  useEffect(() => {
    if (!page) return
    const selectedBlock = selectedBlockIdForPanel != null ? blocks.find((b) => b.id === selectedBlockIdForPanel) ?? null : null
    const prev = lastRightPanelSyncRef.current
    if (prev?.pageRef === page && prev?.blocksRef === blocks && prev?.selectedBlockId === selectedBlockIdForPanel) return
    lastRightPanelSyncRef.current = { pageRef: page, blocksRef: blocks, selectedBlockId: selectedBlockIdForPanel }
    const updates: Parameters<typeof setRightPanelData>[0] = {
      page,
      onPageUpdate: stableHandlePageUpdate,
      pageTableId,
      blocks,
    }
    if (selectedBlockIdForPanel == null) {
      updates.selectedBlock = null
    } else if (selectedBlock != null) {
      updates.selectedBlock = selectedBlock
    }
    setRightPanelData(updates)
  }, [page?.id, page, pageTableId, blocks, selectedContext?.type, selectedBlockIdForPanel, setRightPanelData, stableHandlePageUpdate])

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
      // RULE: Views are currently not used; ignore saved_view_id unless explicitly enabled.
      if (VIEWS_ENABLED) {
        // Load data for pages with saved_view_id
        loadListViewData()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page?.source_view, page?.saved_view_id, page?.page_type, page?.config, page?.base_table])
  
  // CRITICAL: Watch for view updates when page uses saved_view_id
  // This ensures that when a view is edited, the interface page refreshes
  useEffect(() => {
    // RULE: Views are currently not used; disable saved_view_id polling entirely unless enabled.
    if (!VIEWS_ENABLED) {
      if (viewCheckIntervalRef.current) {
        clearInterval(viewCheckIntervalRef.current)
        viewCheckIntervalRef.current = null
      }
      return
    }

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
      // CRITICAL: Guard document access to prevent hydration issues
      if (typeof document !== 'undefined' && document.hidden) return
      
      try {
        const supabase = createClient()
        const savedViewId = normalizeUuid((page as any)?.saved_view_id)
        if (!savedViewId) return
        const { data: view, error } = await supabase
          .from('views')
          .select('updated_at')
          .eq('id', savedViewId)
          .single()
        
        if (!error && view?.updated_at) {
          const currentUpdatedAt = view.updated_at
          const previousUpdatedAt = savedViewUpdatedAtRef.current
          
          // If view was updated, reload data AND blocks
          // This ensures that blocks using the view are refreshed immediately
          if (previousUpdatedAt && currentUpdatedAt !== previousUpdatedAt) {
            debugLog(`[InterfacePageClient] View updated detected - reloading data and blocks: viewId=${page.saved_view_id}`)
            savedViewUpdatedAtRef.current = currentUpdatedAt
            // Reload both data and blocks to ensure everything reflects the saved view
            loadListViewData()
            // Force reload blocks to pick up any changes in view configuration
            if (blocksLoadedRef.current.pageId === pageId) {
              loadBlocks(true) // forceReload = true
            }
          } else if (!previousUpdatedAt) {
            // First check - just store the timestamp
            savedViewUpdatedAtRef.current = currentUpdatedAt
          }
        }
      } catch (error) {
        debugError('Error checking view updates:', error)
      }
    }
    
    // Initial check
    checkViewUpdates()
    
    // Set up interval to check every 5 seconds (less frequent to reduce load)
    viewCheckIntervalRef.current = setInterval(checkViewUpdates, 5000)
    
    // Also check when page becomes visible (user switches back to tab)
    // CRITICAL: Guard document access to prevent hydration issues
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden && page?.saved_view_id) {
        checkViewUpdates()
      }
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }
    
    // Cleanup interval and event listener on unmount or when saved_view_id changes
    return () => {
      if (viewCheckIntervalRef.current) {
        clearInterval(viewCheckIntervalRef.current)
        viewCheckIntervalRef.current = null
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page?.saved_view_id])

  // CRITICAL: loadPage + loadBlocks run in parallel when pageId changes
  // Both fetches are independent (only need pageId) - parallelizing reduces initial load time
  useEffect(() => {
    if (!pageId) return

    const abortController = new AbortController()
    const signal = abortController.signal

    const needsPage = !initialPageRef.current && !pageLoadedRef.current && !loading
    Promise.all([
      needsPage ? loadPage() : Promise.resolve(),
      loadBlocks(false, signal),
    ]).catch(() => {})

    return () => {
      abortController.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadPage/loadBlocks intentionally excluded; only pageId should trigger
  }, [pageId])

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
      debugError("Error loading page:", error)
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
      debugError("Error loading SQL view data:", error)
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
      const savedViewId = normalizeUuid((page as any)?.saved_view_id)
      if (savedViewId) {
        const { data: view, error: viewError } = await supabase
          .from('views')
          .select('table_id')
          .eq('id', savedViewId)
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
        debugError("No table ID found for record review page")
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
        debugError("Error loading table:", tableError)
        setData([])
        dataLoadingRef.current = false
        setDataLoading(false)
        return
      }

      supabaseTableName = table.supabase_table

      // Ensure we have a valid table name before querying
      if (!supabaseTableName) {
        debugError("No table name found")
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
        debugError("Error loading table data:", tableDataError)
        setData([])
        dataLoadingRef.current = false
        setDataLoading(false)
        return
      }

      // Ensure each record has an id field
      // CRITICAL: Use a stable fallback for IDs to prevent hydration mismatches
      // Only generate UUID on client-side, use a placeholder on server
      const generateId = () => {
        if (typeof window !== 'undefined' && typeof crypto !== 'undefined' && crypto.randomUUID) {
          return crypto.randomUUID()
        }
        // Fallback for SSR or environments without crypto.randomUUID
        // Use a deterministic placeholder that won't cause hydration issues
        return `temp-${Math.random().toString(36).substring(2, 15)}`
      }
      const records = (tableData || []).map((record: any) => ({
        ...record,
        id: record.id || record.record_id || generateId(), // Ensure id exists
      }))

      setData(records)
    } catch (error) {
      debugError("Error loading record review data:", error)
      setData([])
    } finally {
      dataLoadingRef.current = false
      setDataLoading(false)
    }
  }

  async function loadListViewData() {
    // RULE: Views are currently not used; don't load list view data unless explicitly enabled.
    if (!VIEWS_ENABLED) return
    if (!page?.saved_view_id) return
    
    // Prevent concurrent calls
    if (dataLoadingRef.current) return
    dataLoadingRef.current = true
    setDataLoading(true)

    try {
      const supabase = createClient()
      const savedViewId = normalizeUuid((page as any)?.saved_view_id)
      if (!savedViewId) {
        setData([])
        dataLoadingRef.current = false
        setDataLoading(false)
        return
      }
      
      // Get view with table_id and updated_at to track view changes
      const { data: view, error: viewError } = await supabase
        .from('views')
        .select('table_id, updated_at')
        .eq('id', savedViewId)
        .single()

      if (viewError || !view?.table_id) {
        debugError("Error loading view:", viewError)
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
        debugError("Error loading table:", tableError)
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
          .eq('view_id', savedViewId),
        supabase
          .from('view_sorts')
          .select('*')
          .eq('view_id', savedViewId)
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
          const col = toPostgrestColumn(fieldName)
          if (col) {
            query = query.order(col, { ascending })
          }
        }
      } else {
        // Default sort by created_at descending
        query = query.order('created_at', { ascending: false })
      }

      const { data: tableData, error: tableDataError } = await query

      if (tableDataError) {
        debugError("Error loading table data:", tableDataError)
        setData([])
      } else {
        setData(tableData || [])
      }
    } catch (error) {
      debugError("Error loading list view data:", error)
      setData([])
    } finally {
      dataLoadingRef.current = false
      setDataLoading(false)
    }
  }

  async function loadBlocks(forceReload = false, signal?: AbortSignal) {
    debugLog('🔥 loadBlocks CALLED', { pageId, forceReload, previousPageId: previousPageIdRef.current, alreadyLoading: blocksLoadingRef.current })
    if (!pageId) {
      blocksLoadingRef.current = false
      return
    }

    // CRITICAL: Prevent concurrent calls - check ref at function entry
    if (!forceReload && blocksLoadingRef.current) {
      if (process.env.NODE_ENV === 'development') {
        debugLog(`[loadBlocks] Already loading - skipping duplicate call: pageId=${pageId}`)
      }
      return
    }

    // CRITICAL: Only reset loaded state if pageId actually changed (not just on every call)
    if (blocksLoadedRef.current.pageId !== pageId) {
      debugLog(`[loadBlocks] PageId changed in loadBlocks: old=${blocksLoadedRef.current.pageId}, new=${pageId}`)
      blocksLoadedRef.current = { pageId, loaded: false }
    } else if (!forceReload && blocksLoadedRef.current.loaded && blocks.length > 0) {
      blocksLoadingRef.current = false
      return
    }

    // Set loading flag
    blocksLoadingRef.current = true

    setBlocksLoading(true)
    try {
      const res = await fetch(`/api/pages/${pageId}/blocks`, { signal })
      if (signal?.aborted) return

      if (!res.ok) {
        const errorText = await res.text()
        debugError(`[loadBlocks] API ERROR: pageId=${pageId}`, {
          status: res.status,
          statusText: res.statusText,
          errorText,
        })
        throw new Error(`Failed to load blocks: ${res.status} ${res.statusText}`)
      }
      
      const data = await res.json()
      if (signal?.aborted) return

      // CRITICAL: Log API response for debugging - show full response structure
      debugLog(`[loadBlocks] API returned: pageId=${pageId}`, {
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
            debugWarn(`[Layout Load] Block ${block.id}: NULL layout values for existing block`, {
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
          page_id: block.page_id || pageId,
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
        if (!signal?.aborted) {
          if (process.env.NODE_ENV === 'development') {
            debugWarn('[Blocks] Reload returned empty blocks, preserving existing blocks', {
              prevBlocksCount: blocks.length,
              forceReload,
              pageId
            })
          }
          blocksLoadedRef.current = { pageId, loaded: true }
        }
        return
      }
      
      // CRITICAL: Compare blocks before updating to prevent unnecessary re-renders
      // Only update if blocks actually changed (different IDs, positions, or config)
      const oldBlockIds = blocks.map((b: any) => b.id).sort().join(',')
      const newBlockIds = pageBlocks.map((b: any) => b.id).sort().join(',')
      const blockIdsChanged = oldBlockIds !== newBlockIds
      
      // Check if block positions or config changed (shallow comparison)
      let blockContentChanged = false
      if (!blockIdsChanged && blocks.length === pageBlocks.length) {
        // Same IDs and count - check if positions or config changed
        for (let i = 0; i < blocks.length; i++) {
          const oldBlock = blocks[i]
          const newBlock = pageBlocks.find((b: any) => b.id === oldBlock.id)
          if (!newBlock) {
            blockContentChanged = true
            break
          }
          // Compare key properties that would cause re-render
          if (
            oldBlock.x !== newBlock.x ||
            oldBlock.y !== newBlock.y ||
            oldBlock.w !== newBlock.w ||
            oldBlock.h !== newBlock.h ||
            JSON.stringify(oldBlock.config) !== JSON.stringify(newBlock.config)
          ) {
            blockContentChanged = true
            break
          }
        }
      }
      
      const blocksChanged = blockIdsChanged || blockContentChanged
      
      debugLog(`[loadBlocks] setBlocks CHECK: pageId=${pageId}`, {
        forceReload,
        oldBlocksCount: blocks.length,
        newBlocksCount: pageBlocks.length,
        oldBlockIds: blocks.map((b: any) => b.id),
        newBlockIds: pageBlocks.map((b: any) => b.id),
        blockIdsChanged,
        blockContentChanged,
        blocksChanged,
        willUpdate: blocksChanged || forceReload,
      })
      
      // Only update if blocks actually changed or forceReload is true (and not aborted)
      if (!signal?.aborted) {
        if (blocksChanged || forceReload) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/7e9b68cb-9457-4ad2-a6ab-af4806759e7a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'InterfacePageClient.tsx:loadBlocks:setBlocks',message:'loadBlocks updating blocks state',data:{pageId,blocksCount:pageBlocks.length,blockIds:pageBlocks.map((b:any)=>b.id),blockLayouts:pageBlocks.map((b:any)=>({id:b.id,x:b.x,y:b.y,w:b.w,h:b.h})),forceReload,blocksChanged},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          setBlocks(pageBlocks)
        } else if (process.env.NODE_ENV === 'development') {
          debugLog(`[loadBlocks] Blocks unchanged - skipping setBlocks to prevent re-render`)
        }
        blocksLoadedRef.current = { pageId, loaded: true }
      }
    } catch (error) {
      // Ignore abort errors (expected during navigation/unmount) - prevents "Uncaught (in promise)"
      if (!isAbortError(error)) {
        debugError("Error loading blocks:", error)
      }
      // CRITICAL: Never clear blocks on error - preserve existing blocks
      if (!signal?.aborted) {
        blocksLoadedRef.current = { pageId, loaded: true }
      }
    } finally {
      if (!signal?.aborted) {
        setBlocksLoading(false)
      }
      blocksLoadingRef.current = false // CRITICAL: Always clear loading flag
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
      // CRITICAL: Use stable timestamp values to prevent hydration mismatches
      // Use a fixed date instead of new Date() which would differ between server/client
      const stableTimestamp = '1970-01-01T00:00:00.000Z'
      return {
        id: '',
        name: '',
        page_type: 'content' as const,
        config: {},
        source_view: null,
        base_table: null,
        group_id: null,
        order_index: 0,
        created_at: stableTimestamp,
        updated_at: stableTimestamp,
        created_by: null,
        is_admin_only: true,
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
  // Stable fallback when page not yet loaded - ensures single render tree
  const fallbackPage = useMemo(() => ({
    id: pageId,
    name: '',
    page_type: 'content' as const,
    settings: { tableId: null, leftPanel: null, left_panel: null, primary_table_id: null, show_add_record: false, showAddRecord: false },
  }), [pageId])

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
        // CRITICAL: RecordViewPageSettings saves to config.left_panel (snake_case), so check both formats
        tableId: pageConfig.tableId || page.base_table || pageTableId || null,
        leftPanel: pageConfig.left_panel || pageConfig.leftPanel || null,
        left_panel: pageConfig.left_panel || pageConfig.leftPanel || null, // Also include snake_case for direct access
        primary_table_id: page.base_table || pageTableId || null,
        // Page-level default for "Add record" buttons inside data blocks
        show_add_record: pageConfig.show_add_record ?? pageConfig.showAddRecord ?? false,
        showAddRecord: pageConfig.showAddRecord ?? pageConfig.show_add_record ?? false,
      }
    } as any
  }, [page?.id, page?.name, page?.base_table, pageTableId]) // CRITICAL: NOT page?.page_type, NOT page?.config

  // CRITICAL: Stabilize blocks reference so same content => same array ref (prevents Canvas/BlockRenderer remounts)
  // If blocks is replaced with a new array every time (e.g. from API) but content is unchanged, return previous ref
  const memoizedBlocks = useMemo(() => {
    const result = blocks || []
    const signature = result.length === 0
      ? ""
      : result.map((b: any) => `${b.id}:${b.x ?? ""}:${b.y ?? ""}:${b.w ?? ""}:${b.h ?? ""}`).join("|")
    if (prevBlocksRef.current.signature === signature && prevBlocksRef.current.blocks.length === result.length) {
      return prevBlocksRef.current.blocks
    }
    prevBlocksRef.current = { blocks: result, signature }
    return result
  }, [blocks, page?.id]) // ONLY page.id - NOT page_type, NOT mode, NOT isViewer
  

  // Save page title with debouncing - MUST be before early returns (React Hooks rule)
  const savePageTitle = useCallback(async (newTitle: string, immediate = false): Promise<boolean | undefined> => {
    if (!page || !isAdmin) return
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }

    const doSave = async (): Promise<boolean> => {
      // Don't save if title hasn't changed
      if (newTitle.trim() === lastSavedTitleRef.current) {
        setIsSavingTitle(false)
        return true
      }

      setIsSavingTitle(true)
      setTitleError(false)

      try {
        const res = await fetch(`/api/interface-pages/${page.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newTitle.trim() }),
        })

        const data = await res.json()
        
        if (!res.ok) {
          throw new Error(data.error || 'Failed to save page title')
        }

        // Update local state
        // API returns page directly (not wrapped in { page: ... })
        setPage(data)
        lastSavedTitleRef.current = newTitle.trim()
        setTitleValue(newTitle.trim())
        setTitleError(false)
        
        // Trigger sidebar refresh to update navigation
        window.dispatchEvent(new CustomEvent('pages-updated'))
        return true
      } catch (error: any) {
        debugError('Error saving page title:', error)
        setTitleError(true)
        // Revert to last saved title
        setTitleValue(lastSavedTitleRef.current)
        // Show error to user
        alert(error.message || 'Failed to save page title. Please try again.')
        // Clear error state after a moment
        setTimeout(() => setTitleError(false), 3000)
        return false
      } finally {
        setIsSavingTitle(false)
      }
    }

    if (immediate) {
      return await doSave()
    } else {
      // Debounce: wait 1000ms (within 800-1200ms range) before saving
      saveTimeoutRef.current = setTimeout(doSave, 1000)
      return undefined
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

  // Full-page content: suppress workspace main scroll (Airtable-style). MUST be before early returns (React Hooks rule).
  const mainScroll = useMainScroll()
  useEffect(() => {
    if (!mainScroll) return
    const isRecordView = page?.page_type === 'record_view'
    const isRecordReview = page?.page_type === 'record_review'
    const useRecordReviewLayout = isRecordReview || isRecordView
    const isContentPage = !useRecordReviewLayout
    const isFullPage =
      isContentPage && blocks.length === 1 && blocks[0]?.config?.is_full_page === true
    mainScroll.setSuppressMainScroll(!!isFullPage)
  }, [mainScroll, page?.page_type, blocks])

  // CRITICAL: Stable callback for record_view layout save - MUST be before early returns (React Hooks rule).
  // Inline function caused infinite loop (RecordReviewPage effect depends on onLayoutSave; new ref every render → setRightPanelData → re-render → loop)
  const handleRecordViewLayoutSave = useCallback(
    async (fieldLayout: FieldLayoutItem[]) => {
      if (!page?.id) return
      const res = await fetch(`/api/interface-pages/${page.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: { ...(page.config || {}), field_layout: fieldLayout },
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || "Failed to save layout")
      }
      const updated = await res.json()
      setPage(updated)
    },
    [page?.id, page?.config]
  )

  const isViewer = searchParams?.get("view") === "true"
  const isRecordView = page?.page_type === 'record_view'
  const isRecordReview = page?.page_type === 'record_review'
  const useRecordReviewLayout = isRecordReview || isRecordView
  const hasPage = Boolean(page && page.id)
  const pageForRender = pageWithConfig

  const handleTitleChange = (value: string) => {
    setTitleValue(value)
    // Debounced save
    savePageTitle(value, false)
  }

  const handleTitleBlur = async () => {
    // Save immediately on blur - wait for save to complete
    if (titleValue.trim() !== lastSavedTitleRef.current) {
      const ok = await savePageTitle(titleValue.trim(), true)
      if (ok) {
        toast({
          title: "Finished editing",
          description: "Page title saved.",
        })
        router.refresh()
      }
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
    <div className={`h-screen flex flex-col ${!useRecordReviewLayout ? "overflow-x-hidden" : ""}`}>
      {/* Loading overlay: single scroll surface; do not unmount tree */}
      {loading && !hasPage && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-white">
          <LoadingSpinner size="lg" text="Loading interface page..." />
        </div>
      )}
      {/* Page not found overlay */}
      {!loading && !hasPage && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-white">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Page not found</h2>
            <p className="text-sm text-gray-500">The page you&apos;re looking for doesn&apos;t exist.</p>
          </div>
        </div>
      )}
      {/* PageActionsRegistrar: tied to page existence, inside InterfacePageClient per unified architecture */}
      {hasPage && isAdmin && (
        <PageActionsRegistrar pageId={pageId} isAdmin={isAdmin} isViewer={isViewer} />
      )}
      {/* Header with Edit Button - Admin Only */}
      {!isViewer && hasPage && isAdmin && (
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
                  {page?.name}
                </h1>
                {page?.updated_at && (
                  <span className="text-xs text-gray-500 flex-shrink-0" suppressHydrationWarning>
                    Updated {formatDateUK(page?.updated_at ?? "")}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Header without Edit Button - Non-admin with View Only badge */}
      {!isViewer && hasPage && !isAdmin && (
        <div className="border-b bg-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <h1 className="text-lg font-semibold flex-1 min-w-0 truncate">{page?.name}</h1>
            <span 
              className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded flex-shrink-0"
              title="Ask an admin to edit this page"
            >
              View only
            </span>
            {page?.updated_at && (
              <span className="text-xs text-gray-500 flex-shrink-0" suppressHydrationWarning>
                Updated {formatDateUK(page?.updated_at ?? "")}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Content Area - single stable tree; never unmount based on page/loading.
          CRITICAL: pr-0 ensures right panel overlays without pushing blocks (no width change in edit mode). */}
      <div className="flex-1 overflow-x-hidden min-w-0 min-h-0 w-full pr-0 relative">
        <div className="flex-1 w-full min-w-0 min-h-0 flex flex-col overflow-x-hidden pr-0 relative">
          {useRecordReviewLayout && hasPage ? (
            <RecordReviewPage
              page={pageForRender as any}
              initialBlocks={memoizedBlocks}
              isViewer={isViewer}
              hideHeader={true}
              onLayoutSave={page?.page_type === "record_view" ? handleRecordViewLayoutSave : undefined}
            />
          ) : (
            <div className="min-h-screen w-full min-w-0 flex flex-col">
              <InterfaceBuilder
                page={interfaceBuilderPage ?? fallbackPage}
                initialBlocks={memoizedBlocks}
                isViewer={isViewer}
                hideHeader={true}
                pageTableId={pageTableId}
                recordId={recordContext?.recordId ?? null}
                recordTableId={recordContext?.tableId ?? null}
                onRecordContextChange={setRecordContext}
                mode="view"
              />
            </div>
          )}
          {blocksLoading && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10 pointer-events-none">
              <LoadingSpinner size="lg" text="Loading blocks..." />
            </div>
          )}
        </div>
      </div>

      {/* Page settings now in RightSettingsPanel */}

    </div>
  )
}

// Export wrapper with Suspense boundary for useSearchParams
export default function InterfacePageClient(props: InterfacePageClientProps) {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center"><LoadingSpinner size="lg" text="Loading page..." /></div>}>
      <InterfacePageClientInternal {...props} />
    </Suspense>
  )
}
