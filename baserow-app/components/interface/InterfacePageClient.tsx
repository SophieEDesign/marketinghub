"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import InterfaceBuilder from "./InterfaceBuilder"
import InterfaceViewTabs from "./InterfaceViewTabs"
import type { Page, PageBlock } from "@/lib/interface/types"
import { createClient } from "@/lib/supabase/client"
import type { View } from "@/types/database"
import AirtableViewPage from "@/components/grid/AirtableViewPage"

interface InterfacePageClientProps {
  pageId: string
}

export default function InterfacePageClient({ pageId }: InterfacePageClientProps) {
  const searchParams = useSearchParams()
  const [page, setPage] = useState<Page | null>(null)
  const [blocks, setBlocks] = useState<PageBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<View | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    loadPage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId])

  useEffect(() => {
    if (activeViewId) {
      loadView(activeViewId)
    } else {
      setActiveView(null)
    }
  }, [activeViewId])

  async function loadPage() {
    try {
      const [pageRes, blocksRes] = await Promise.all([
        fetch(`/api/pages/${pageId}`).catch(() => null),
        fetch(`/api/pages/${pageId}/blocks`).catch(() => null),
      ])

      if (pageRes) {
        const pageData = await pageRes.json()
        setPage(pageData.page)
      }

      if (blocksRes) {
        const blocksData = await blocksRes.json()
        setBlocks(blocksData.blocks || [])
      }
    } catch (error) {
      console.error("Error loading page:", error)
    } finally {
      setLoading(false)
    }
  }

  async function loadView(viewId: string) {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('views')
        .select('*')
        .eq('id', viewId)
        .single()

      if (!error && data) {
        setActiveView(data as View)
      }
    } catch (error) {
      console.error('Error loading view:', error)
    }
  }

  if (loading) {
    return <div className="h-screen flex items-center justify-center">Loading interface page...</div>
  }

  if (!page) {
    return <div className="h-screen flex items-center justify-center">Page not found</div>
  }

  const isViewer = searchParams.get("view") === "true"

  return (
    <div className="h-screen flex flex-col">
      {/* View Tabs */}
      <InterfaceViewTabs
        pageId={pageId}
        activeViewId={activeViewId}
        onViewChange={setActiveViewId}
        isEditing={isEditing}
      />

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeViewId && activeView ? (
          // Show linked view (Grid, Calendar, Form, etc.)
          <div className="h-full">
            {activeView.table_id ? (
              <AirtableViewPage
                tableId={activeView.table_id}
                viewId={activeView.id}
                table={{ id: activeView.table_id, supabase_table: "" } as any}
                view={activeView}
                initialViewFields={[]}
                initialViewFilters={[]}
                initialViewSorts={[]}
                initialTableFields={[]}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                View not linked to a table
              </div>
            )}
          </div>
        ) : (
          // Show interface blocks (Overview)
          <InterfaceBuilder
            page={page}
            initialBlocks={blocks}
            isViewer={isViewer}
            onEditModeChange={setIsEditing}
          />
        )}
      </div>
    </div>
  )
}
