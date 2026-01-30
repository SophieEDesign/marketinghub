"use client"

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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useBranding } from "@/contexts/BrandingContext"
import type { View } from "@/types/database"

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

  if (!views || views.length === 0) {
    return null
  }

  const newViewHref = `/tables/${tableId}/views/new`
  const isNewPage = pathname === newViewHref

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
            <Link
              key={view.id}
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
    </div>
  )
}
