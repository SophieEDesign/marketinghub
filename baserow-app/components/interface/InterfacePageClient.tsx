"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import InterfaceBuilder from "./InterfaceBuilder"
import type { Page, PageBlock } from "@/lib/interface/types"

interface InterfacePageClientProps {
  pageId: string
}

export default function InterfacePageClient({ pageId }: InterfacePageClientProps) {
  const searchParams = useSearchParams()
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
    return <div>Loading interface page...</div>
  }

  if (!page) {
    return <div>Page not found</div>
  }

  const isViewer = searchParams.get("view") === "true"

  return (
    <div className="h-screen -mt-14">
      <InterfaceBuilder
        page={page}
        initialBlocks={blocks}
        isViewer={isViewer}
      />
    </div>
  )
}
