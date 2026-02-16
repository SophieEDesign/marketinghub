"use client"

import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { useBranding } from "@/contexts/BrandingContext"
import { useUIState } from "@/contexts/UIStateContext"
import { Plus, ChevronDown, ChevronRight, Home } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DevModeShellData } from "@/lib/dev-mode-data"

interface SidebarProps {
  shellData: DevModeShellData
}

export default function Sidebar({ shellData }: SidebarProps) {
  const params = useParams()
  const searchParams = useSearchParams()
  // Single source of truth: route segment first (matches app /pages/[pageId]), then query (dev ?pageId=)
  const currentPageId = (params?.pageId ?? searchParams.get("pageId")) ?? null
  const { primaryColor } = useBranding()
  const { uiMode } = useUIState()

  const editMode = uiMode === "editPages"

  const { interfacePages, interfaceGroups } = shellData

  const ungroupedId = "ungrouped-virtual"
  const groups = [
    ...interfaceGroups.filter((g) => g && g.id),
    ...(interfacePages.some((p) => !p.group_id) ? [{ id: ungroupedId, name: "Ungrouped", order_index: 9999 }] : []),
  ].sort((a, b) => (a.order_index || 0) - (b.order_index || 0))

  const pagesByGroup: Record<string, typeof interfacePages> = {}
  interfacePages.forEach((p) => {
    const gid = p.group_id || ungroupedId
    if (!pagesByGroup[gid]) pagesByGroup[gid] = []
    pagesByGroup[gid].push(p)
  })
  Object.keys(pagesByGroup).forEach((gid) => {
    pagesByGroup[gid].sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
  })

  return (
    <aside className="w-56 border-r border-gray-200 bg-white flex flex-col shrink-0">
      <div className="p-2 border-b border-gray-100">
        <Link
          href="/"
          className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-500 hover:text-gray-700 rounded"
        >
          <Home className="h-4 w-4" />
          Back to app
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
          Pages
        </div>
        {groups.map((group) => {
          const pages = pagesByGroup[group.id] || []
          if (pages.length === 0 && !editMode) return null
          return (
            <div key={group.id} className="mb-2">
              <div className="px-2 py-1 text-xs font-medium text-gray-400 truncate">
                {group.name}
              </div>
              <div className="space-y-0.5">
                {pages.map((page) => (
                  <Link
                    key={page.id}
                    href={`/dev/airtable?pageId=${page.id}`}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm rounded-md mx-1 transition-colors",
                      currentPageId === page.id
                        ? "bg-gray-100 font-medium"
                        : "text-gray-700 hover:bg-gray-50"
                    )}
                    style={currentPageId === page.id ? { color: primaryColor } : undefined}
                  >
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <span className="truncate">{page.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
        {editMode && (
          <div className="px-3 py-2 mt-2">
            <button
              type="button"
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
              title="Add page (opens Settings)"
              onClick={() => window.location.href = "/settings?tab=pages"}
            >
              <Plus className="h-4 w-4" />
              Add page
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
