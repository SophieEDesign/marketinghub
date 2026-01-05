"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { Edit2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import dynamic from "next/dynamic"
import type { InterfacePage } from "@/lib/interface/pages"
import PageRenderer from "./PageRenderer"
import InterfacePageSettingsDrawer from "./InterfacePageSettingsDrawer"
import { getPageTypeDefinition } from "@/lib/interface/page-types"

// Lazy load InterfaceBuilder for dashboard/overview pages
const InterfaceBuilder = dynamic(() => import("./InterfaceBuilder"), { ssr: false })

interface InterfacePageClientProps {
  pageId: string
  initialPage?: InterfacePage
  initialData?: any[]
}

export default function InterfacePageClient({ 
  pageId, 
  initialPage,
  initialData = []
}: InterfacePageClientProps) {
  const searchParams = useSearchParams()
  const [page, setPage] = useState<InterfacePage | null>(initialPage || null)
  const [data, setData] = useState<any[]>(initialData)
  const [loading, setLoading] = useState(!initialPage)
  const [isGridMode, setIsGridMode] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false)
  const [blocks, setBlocks] = useState<any[]>([])
  const [blocksLoading, setBlocksLoading] = useState(false)

  useEffect(() => {
    if (!initialPage) {
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
    try {
      const res = await fetch(`/api/interface-pages/${pageId}`)
      if (!res.ok) throw new Error('Failed to load page')
      
      const pageData = await res.json()
      setPage(pageData)
    } catch (error) {
      console.error("Error loading page:", error)
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

  if (loading) {
    return <div className="h-screen flex items-center justify-center">Loading interface page...</div>
  }

  if (!page || !pageWithConfig) {
    return <div className="h-screen flex items-center justify-center">Page not found</div>
  }

  const isViewer = searchParams.get("view") === "true"
  const pageTypeDef = page ? getPageTypeDefinition(page.page_type) : null
  const isDashboardOrOverview = page?.page_type === 'dashboard' || page?.page_type === 'overview'

  // For dashboard/overview pages, editing means editing blocks (InterfaceBuilder)
  // For other pages, editing means editing page settings
  const handleEditClick = () => {
    if (isDashboardOrOverview) {
      setIsEditing(true)
    } else {
      setPageSettingsOpen(true)
    }
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header with Edit Button */}
      {!isViewer && page && (
        <div className="border-b bg-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">{page.name}</h1>
            {page.updated_at && (
              <span className="text-xs text-gray-500">
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
                {isDashboardOrOverview ? 'Edit Page' : 'Page Settings'}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {isDashboardOrOverview && isEditing ? (
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

      {/* Page Settings Drawer */}
      {page && (
        <InterfacePageSettingsDrawer
          pageId={page.id}
          isOpen={pageSettingsOpen}
          onClose={() => setPageSettingsOpen(false)}
          onUpdate={(updatedPage) => {
            setPage(updatedPage)
            setPageSettingsOpen(false)
          }}
        />
      )}
    </div>
  )
}
