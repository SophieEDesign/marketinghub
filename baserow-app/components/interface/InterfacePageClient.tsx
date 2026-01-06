"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Edit2, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import dynamic from "next/dynamic"
import { createClient } from "@/lib/supabase/client"
import type { InterfacePage } from "@/lib/interface/page-types-only"
import { hasPageAnchor, getPageAnchor } from "@/lib/interface/page-utils"
import PageRenderer from "./PageRenderer"
import PageSetupState from "./PageSetupState"
import PageDisplaySettingsPanel from "./PageDisplaySettingsPanel"
import FormPageSettingsPanel from "./FormPageSettingsPanel"
import { getPageTypeDefinition, getRequiredAnchorType } from "@/lib/interface/page-types"
import { usePageEditMode, useBlockEditMode } from "@/contexts/EditModeContext"

// Lazy load InterfaceBuilder for dashboard/overview pages
const InterfaceBuilder = dynamic(() => import("./InterfaceBuilder"), { ssr: false })

interface InterfacePageClientProps {
  pageId: string
  initialPage?: InterfacePage
  initialData?: any[]
  isAdmin?: boolean
}

export default function InterfacePageClient({ 
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
  
  // Use unified editing context
  const { isEditing: isPageEditing, enter: enterPageEdit, exit: exitPageEdit } = usePageEditMode(pageId)
  const { isEditing: isBlockEditing, enter: enterBlockEdit, exit: exitBlockEdit } = useBlockEditMode(pageId)
  
  const [blocks, setBlocks] = useState<any[]>([])
  const [blocksLoading, setBlocksLoading] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [displaySettingsOpen, setDisplaySettingsOpen] = useState(false)
  const [formSettingsOpen, setFormSettingsOpen] = useState(false)
  
  // Inline title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState("")
  const [titleError, setTitleError] = useState(false)
  const [isSavingTitle, setIsSavingTitle] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedTitleRef = useRef<string>("")
  
  // Determine if we're in edit mode (page or block editing)
  const isEditing = isPageEditing || isBlockEditing

  useEffect(() => {
    if (!initialPage && !redirecting && !loading) {
      loadPage()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId])

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
    if (page && page.source_view) {
      loadSqlViewData()
    } else if (page && page.page_type === 'record_review') {
      // Load table data for record_review pages (check both saved_view_id and base_table)
      loadRecordReviewData()
    } else if (page && page.saved_view_id && page.page_type === 'list') {
      // Load table data for list view pages
      loadListViewData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page?.source_view, page?.saved_view_id, page?.page_type, page?.config, page?.base_table])

  // Load blocks for dashboard/overview/content/record_review pages in BOTH edit and view mode
  // CRITICAL: Blocks must load in view mode so they render correctly
  useEffect(() => {
    if (page && (page.page_type === 'dashboard' || page.page_type === 'overview' || page.page_type === 'content' || page.page_type === 'record_review')) {
      // Always reload blocks when page changes or when entering edit mode
      if (!blocksLoading) {
        loadBlocks()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page?.id, page?.page_type, isBlockEditing])

  async function loadPage() {
    if (redirecting || loading) return // Prevent multiple redirect attempts or concurrent loads
    
    setLoading(true)
    try {
      const res = await fetch(`/api/interface-pages/${pageId}`)
      if (!res.ok) {
        if (res.status === 404) {
          // Page not found - redirect to first available page or home
          setRedirecting(true)
          router.replace('/')
          return
        }
        throw new Error('Failed to load page')
      }
      
      const pageData = await res.json()
      setPage(pageData)
    } catch (error) {
      console.error("Error loading page:", error)
      // Redirect on error to prevent infinite loading state
      if (!redirecting) {
        setRedirecting(true)
        router.replace('/')
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadSqlViewData() {
    if (!page?.source_view) return

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
    }
  }

  async function loadRecordReviewData() {
    if (!page) return

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
        return
      }

      supabaseTableName = table.supabase_table

      // Ensure we have a valid table name before querying
      if (!supabaseTableName) {
        console.error("No table name found")
        setData([])
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
    }
  }

  async function loadListViewData() {
    if (!page?.saved_view_id) return

    try {
      const supabase = createClient()
      
      // Get view with table_id
      const { data: view, error: viewError } = await supabase
        .from('views')
        .select('table_id')
        .eq('id', page.saved_view_id)
        .single()

      if (viewError || !view?.table_id) {
        console.error("Error loading view:", viewError)
        setData([])
        return
      }

      // Get table name
      const { data: table, error: tableError } = await supabase
        .from('tables')
        .select('supabase_table')
        .eq('id', view.table_id)
        .single()

      if (tableError || !table?.supabase_table) {
        console.error("Error loading table:", tableError)
        setData([])
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
    }
  }

  async function loadBlocks() {
    if (!page) return

    setBlocksLoading(true)
    try {
      const res = await fetch(`/api/pages/${page.id}/blocks`)
      if (!res.ok) throw new Error('Failed to load blocks')
      
      const data = await res.json()
      // Convert view_blocks format to PageBlock format
      const pageBlocks = (data.blocks || []).map((block: any) => ({
        id: block.id,
        page_id: block.page_id || page.id,
        type: block.type,
        x: block.x || block.position_x || 0,
        y: block.y || block.position_y || 0,
        w: block.w || block.width || 4,
        h: block.h || block.height || 4,
        config: block.config || {},
        order_index: block.order_index || 0,
        created_at: block.created_at,
        updated_at: block.updated_at,
      }))
      setBlocks(pageBlocks)
    } catch (error) {
      console.error("Error loading blocks:", error)
      setBlocks([])
    } finally {
      setBlocksLoading(false)
    }
  }

  // Reload blocks when entering edit mode to ensure blocks are fresh
  useEffect(() => {
    if (isBlockEditing && page && (page.page_type === 'dashboard' || page.page_type === 'overview' || page.page_type === 'content' || page.page_type === 'record_review')) {
      // Reload blocks when entering edit mode to ensure we have the latest
      if (!blocksLoading) {
        loadBlocks()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBlockEditing])

  const handleGridToggle = () => {
    setIsGridMode(!isGridMode)
  }

  // Determine if grid toggle should be shown
  const showGridToggle = useMemo(() => {
    if (!page) return false
    const definition = getPageTypeDefinition(page.page_type)
    return definition.supportsGridToggle && page.page_type !== 'dashboard' && page.page_type !== 'overview'
  }, [page])

  // Merge config with grid mode override
  const pageWithConfig = useMemo(() => {
    if (!page) return null
    return {
      ...page,
      config: {
        ...page.config,
        visualisation: isGridMode ? 'grid' : (page.config?.visualisation || page.page_type),
      },
    }
  }, [page, isGridMode])

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

  if (redirecting) {
    return <div className="h-screen flex items-center justify-center">Redirecting...</div>
  }

  if (loading) {
    return <div className="h-screen flex items-center justify-center">Loading interface page...</div>
  }

  if (!page || !pageWithConfig) {
    return <div className="h-screen flex items-center justify-center">Page not found</div>
  }

  const isViewer = searchParams.get("view") === "true"
  const isDashboardOrOverview = page?.page_type === 'dashboard' || page?.page_type === 'overview' || page?.page_type === 'content'
  const isRecordReview = page?.page_type === 'record_review'
  
  // Check if page has a valid anchor
  const pageHasAnchor = page ? hasPageAnchor(page) : false
  const pageAnchor = page ? getPageAnchor(page) : null
  const requiredAnchor = page ? getRequiredAnchorType(page.page_type) : null

  // Edit page behavior based on anchor type
  const handleEditClick = () => {
    if (!page) return
    
    // If page doesn't have anchor, redirect to setup
    if (!pageHasAnchor) {
      router.push(`/settings?tab=pages&page=${page.id}&action=configure`)
      return
    }

    // Open appropriate editor based on anchor type
    switch (pageAnchor) {
      case 'dashboard':
        // For dashboard pages, enter block editing mode
        enterBlockEdit()
        break
      case 'saved_view':
        // Open page display settings panel for data-backed pages
        setDisplaySettingsOpen(true)
        break
      case 'form':
        // Open form settings panel
        setFormSettingsOpen(true)
        break
      case 'record':
        // For record review pages, check if they should use block editing or settings
        // If page has blocks, use block editing; otherwise use settings panel
        if (blocks.length > 0) {
          enterBlockEdit()
        } else {
          setDisplaySettingsOpen(true)
        }
        break
      default:
        // Fallback: try to open settings
        router.push(`/settings?tab=pages&page=${page.id}&action=configure`)
    }
  }

  async function handlePageUpdate() {
    // Reload page data after settings update
    await loadPage()
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
                    Updated {new Date(page.updated_at).toLocaleDateString()}
                  </span>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isDashboardOrOverview && isBlockEditing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => exitBlockEdit()}
              >
                Done Editing
              </Button>
            ) : (
              <>
                {isDashboardOrOverview ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      // Enter block edit mode
                      enterBlockEdit()
                      // Ensure blocks are loaded immediately
                      if (page && (page.page_type === 'dashboard' || page.page_type === 'overview' || page.page_type === 'content' || page.page_type === 'record_review')) {
                        await loadBlocks()
                      }
                    }}
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit interface
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEditClick}
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit Page
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // Open appropriate settings panel based on page type
                    if (page.page_type === 'form') {
                      setFormSettingsOpen(true)
                    } else {
                      setDisplaySettingsOpen(true)
                    }
                  }}
                  title="Page Settings"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Header without Edit Button - Non-admin */}
      {!isViewer && page && !isAdmin && (
        <div className="border-b bg-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <h1 className="text-lg font-semibold flex-1 min-w-0 truncate">{page.name}</h1>
            {page.updated_at && (
              <span className="text-xs text-gray-500 flex-shrink-0" suppressHydrationWarning>
                Updated {new Date(page.updated_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {/* Show setup state if page doesn't have anchor */}
        {page && !pageHasAnchor ? (
          <PageSetupState page={page} isAdmin={isAdmin} />
        ) : isDashboardOrOverview && isBlockEditing ? (
          // For dashboard/overview in block edit mode, use InterfaceBuilder
          blocksLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-gray-500">Loading blocks...</div>
            </div>
          ) : (
            <InterfaceBuilder
              page={{ 
                id: page.id, 
                name: page.name,
                settings: { 
                  layout_template: page.page_type === 'content' ? 'content' : 
                                  page.page_type === 'overview' ? 'overview' : 
                                  page.page_type === 'dashboard' ? 'dashboard' : null
                }
              } as any}
              initialBlocks={blocks || []}
              isViewer={false}
              hideHeader={true}
            />
          )
        ) : (
          <PageRenderer
            page={pageWithConfig}
            data={data}
            isLoading={loading}
            onGridToggle={showGridToggle ? handleGridToggle : undefined}
            showGridToggle={showGridToggle}
            blocks={(isDashboardOrOverview || page?.page_type === 'record_review' || page?.page_type === 'content') ? blocks : undefined}
          />
        )}
      </div>

      {/* Page Display Settings Panel - Only for pages with saved_view_id or base_table, not dashboard/overview/content pages */}
      {page && page.page_type !== 'dashboard' && page.page_type !== 'overview' && page.page_type !== 'content' && (
        <PageDisplaySettingsPanel
          page={page}
          isOpen={displaySettingsOpen}
          onClose={() => setDisplaySettingsOpen(false)}
          onUpdate={handlePageUpdate}
        />
      )}

      {/* Form Page Settings Panel */}
      {page && page.page_type === 'form' && (
        <FormPageSettingsPanel
          page={page}
          isOpen={formSettingsOpen}
          onClose={() => setFormSettingsOpen(false)}
          onUpdate={handlePageUpdate}
        />
      )}
    </div>
  )
}
