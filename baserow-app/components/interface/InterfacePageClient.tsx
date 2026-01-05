"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Edit2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import dynamic from "next/dynamic"
import type { InterfacePage } from "@/lib/interface/page-types-only"
import { hasPageAnchor, getPageAnchor } from "@/lib/interface/page-utils"
import PageRenderer from "./PageRenderer"
import PageSetupState from "./PageSetupState"
import PageDisplaySettingsPanel from "./PageDisplaySettingsPanel"
import { getPageTypeDefinition, getRequiredAnchorType } from "@/lib/interface/page-types"

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
  const [isEditing, setIsEditing] = useState(false)
  const [blocks, setBlocks] = useState<any[]>([])
  const [blocksLoading, setBlocksLoading] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [displaySettingsOpen, setDisplaySettingsOpen] = useState(false)

  useEffect(() => {
    if (!initialPage && !redirecting) {
      loadPage()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId])

  useEffect(() => {
    if (page && page.source_view) {
      loadSqlViewData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page?.source_view, page?.config])

  useEffect(() => {
    // Load blocks for dashboard/overview pages when entering edit mode
    if (isEditing && page && (page.page_type === 'dashboard' || page.page_type === 'overview')) {
      loadBlocks()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, page?.id, page?.page_type])

  async function loadPage() {
    if (redirecting) return // Prevent multiple redirect attempts
    
    try {
      const res = await fetch(`/api/interface-pages/${pageId}`)
      if (!res.ok) {
        if (res.status === 404) {
          // Page not found - redirect to first available page or home
          setRedirecting(true)
          router.push('/')
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
        router.push('/')
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
  const isDashboardOrOverview = page?.page_type === 'dashboard' || page?.page_type === 'overview'
  
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
        setIsEditing(true)
        break
      case 'saved_view':
        // Open page display settings panel for data-backed pages
        setDisplaySettingsOpen(true)
        break
      case 'form':
        // Open form builder (to be implemented)
        setIsEditing(true)
        break
      case 'record':
        // Open page display settings panel for record review pages
        setDisplaySettingsOpen(true)
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

  return (
    <div className="h-screen flex flex-col">
      {/* Header with Edit Button - Admin Only */}
      {!isViewer && page && isAdmin && (
        <div className="border-b bg-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">{page.name}</h1>
            {page.updated_at && (
              <span className="text-xs text-gray-500" suppressHydrationWarning>
                Updated {new Date(page.updated_at).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isDashboardOrOverview && isEditing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(false)}
              >
                Done Editing
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
          </div>
        </div>
      )}
      
      {/* Header without Edit Button - Non-admin */}
      {!isViewer && page && !isAdmin && (
        <div className="border-b bg-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">{page.name}</h1>
            {page.updated_at && (
              <span className="text-xs text-gray-500" suppressHydrationWarning>
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
        ) : isDashboardOrOverview && isEditing ? (
          // For dashboard/overview in edit mode, use InterfaceBuilder
          blocksLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-gray-500">Loading blocks...</div>
            </div>
          ) : (
            <InterfaceBuilder
              page={{ id: page.id, name: page.name } as any}
              initialBlocks={blocks}
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
          />
        )}
      </div>

      {/* Page Display Settings Panel */}
      {page && (
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
