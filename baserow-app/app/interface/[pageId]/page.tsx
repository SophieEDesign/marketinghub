"use client"

import { useState, useEffect } from "react"
import { useParams, useSearchParams } from "next/navigation"
import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import InterfaceBuilder from "@/components/interface/InterfaceBuilder"
import type { Page, PageBlock } from "@/lib/interface/types"

export default function InterfacePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const pageId = params.pageId as string
  const [page, setPage] = useState<Page | null>(null)
  const [blocks, setBlocks] = useState<PageBlock[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPage()
  }, [pageId])

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

  if (loading) {
    return (
      <WorkspaceShellWrapper title="Loading...">
        <div>Loading interface page...</div>
      </WorkspaceShellWrapper>
    )
  }

  if (!page) {
    return (
      <WorkspaceShellWrapper title="Page not found">
        <div>Page not found</div>
      </WorkspaceShellWrapper>
    )
  }

  const isViewer = searchParams.get("view") === "true"

  return (
    <WorkspaceShellWrapper title={page.name}>
      <div className="h-screen -mt-14">
        <InterfaceBuilder
          page={page}
          initialBlocks={blocks}
          isViewer={isViewer}
        />
      </div>
    </WorkspaceShellWrapper>
  )
}
