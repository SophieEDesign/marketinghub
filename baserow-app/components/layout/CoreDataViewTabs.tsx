"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Grid3x3,
  Layout,
  Calendar,
  FileText,
  Clock,
  Layers,
  Plus,
  Settings,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useBranding } from "@/contexts/BrandingContext"
import type { View } from "@/types/database"
import ViewManagementDialog from "@/components/grid/ViewManagementDialog"

const CORE_DATA_OPEN_VIEW_SETTINGS = "core-data-open-view-settings"

interface CoreDataViewTabsProps {
  tableId: string
  currentViewId: string
  views: View[]
}

function getViewIcon(type: string) {
  switch (type) {
    case "grid":
      return <Grid3x3 className="h-4 w-4" />
    case "kanban":
      return <Layout className="h-4 w-4" />
    case "calendar":
      return <Calendar className="h-4 w-4" />
    case "timeline":
      return <Clock className="h-4 w-4" />
    case "form":
      return <FileText className="h-4 w-4" />
    case "page":
      return <FileText className="h-4 w-4" />
    case "horizontal_grouped":
      return <Layers className="h-4 w-4" />
    case "gallery":
      return <Grid3x3 className="h-4 w-4" />
    default:
      return <Grid3x3 className="h-4 w-4" />
  }
}

export default function CoreDataViewTabs({
  tableId,
  currentViewId,
  views,
}: CoreDataViewTabsProps) {
  const pathname = usePathname()
  const { primaryColor } = useBranding()
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; view: View } | null>(null)
  const [managementView, setManagementView] = useState<{ view: View; action: "rename" | "duplicate" | "delete" } | null>(null)

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  useEffect(() => {
    if (!contextMenu) return
    const onPointer = () => closeContextMenu()
    window.addEventListener("click", onPointer)
    window.addEventListener("scroll", onPointer, true)
    return () => {
      window.removeEventListener("click", onPointer)
      window.removeEventListener("scroll", onPointer, true)
    }
  }, [contextMenu, closeContextMenu])

  if (!views || views.length === 0) {
    return null
  }

  const newViewHref = `/tables/${tableId}/views/new`
  const isNewPage = pathname === newViewHref

  function handleContextMenu(e: React.MouseEvent, view: View) {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, view })
  }

  function handleSettings(view: View) {
    closeContextMenu()
    window.dispatchEvent(
      new CustomEvent(CORE_DATA_OPEN_VIEW_SETTINGS, { detail: { viewId: view.id } })
    )
  }

  function handleDelete(view: View) {
    closeContextMenu()
    setManagementView({ view, action: "delete" })
  }

  return (
    <div className="border-b border-gray-200 bg-white px-4 shadow-sm">
      <nav
        className="-mb-px flex items-center gap-0 overflow-x-auto"
        aria-label="Core Data views"
      >
        {views.map((view) => {
          const href = `/tables/${tableId}/views/${view.id}`
          const isActive = view.id === currentViewId || pathname === href
          const Icon = getViewIcon(view.type)

          return (
            <div
              key={view.id}
              className="relative"
              onContextMenu={(e) => handleContextMenu(e, view)}
            >
              <Link
                href={href}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "border-current text-current"
                    : "border-transparent text-muted-foreground hover:border-gray-300 hover:text-foreground"
                )}
                style={isActive ? { borderColor: primaryColor, color: primaryColor } : undefined}
              >
                {Icon}
                {view.name}
              </Link>
            </div>
          )
        })}
        <Link
          href={newViewHref}
          className={cn(
            "flex items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-gray-300 hover:text-foreground",
            isNewPage && "border-current text-current"
          )}
          style={isNewPage ? { borderColor: primaryColor, color: primaryColor } : undefined}
          title="Create new view"
          aria-label="Create new view"
        >
          <Plus className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only sm:inline">New view</span>
        </Link>
      </nav>

      {contextMenu && (
        <div
          className="fixed z-50 min-w-[10rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
        >
          <button
            type="button"
            className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
            role="menuitem"
            onClick={() => handleSettings(contextMenu.view)}
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </button>
          <button
            type="button"
            className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground text-red-600 hover:text-red-700 focus:text-red-700"
            role="menuitem"
            onClick={() => handleDelete(contextMenu.view)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </button>
        </div>
      )}

      {managementView && (
        <ViewManagementDialog
          isOpen={true}
          onClose={() => setManagementView(null)}
          viewId={managementView.view.id}
          viewName={managementView.view.name}
          tableId={tableId}
          initialAction={managementView.action}
          onAction={() => setManagementView(null)}
        />
      )}
    </div>
  )
}
