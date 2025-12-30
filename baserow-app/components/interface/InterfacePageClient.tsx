"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import type { InterfacePage } from "@/lib/interface/pages"
import PageRenderer from "./PageRenderer"
import { getPageTypeDefinition } from "@/lib/interface/page-types"

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
  }, [page?.source_view, page?.config])

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

  return (
    <div className="h-screen flex flex-col">
      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        <PageRenderer
          page={pageWithConfig}
          data={data}
          isLoading={loading}
          onGridToggle={showGridToggle ? handleGridToggle : undefined}
          showGridToggle={showGridToggle}
        />
      </div>
    </div>
  )
}
