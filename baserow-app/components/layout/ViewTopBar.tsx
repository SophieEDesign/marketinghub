"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import {
  Filter,
  ArrowUpDown,
  Group,
  Eye,
  Share2,
  Plus,
  Search,
  Grid3x3,
  Layout,
  Calendar,
  FileText,
  Settings,
  X,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useBranding } from "@/contexts/BrandingContext"
import type { TableField } from "@/types/fields"

interface ViewSummary {
  id: string
  name: string
  type: string
}

interface ViewTopBarProps {
  viewName: string
  viewType?: "grid" | "kanban" | "calendar" | "form" | "timeline" | "horizontal_grouped" | "gallery"
  viewId?: string
  tableId?: string
  views?: ViewSummary[]
  tableFields?: TableField[]
  cardFields?: string[]
  onCardLayoutChange?: (primaryField: string, secondaryField: string) => void
  onFilter?: () => void
  onSort?: () => void
  onGroup?: () => void
  onHideFields?: () => void
  onShare?: () => void
  onAddField?: () => void
  onNewRecord?: () => void
  onSearch?: (query: string) => void
  onDesign?: () => void
}

export default function ViewTopBar({
  viewName,
  viewType = "grid",
  viewId,
  tableId,
  views = [],
  tableFields = [],
  cardFields = [],
  onCardLayoutChange,
  onFilter,
  onSort,
  onGroup,
  onHideFields,
  onShare,
  onAddField,
  onNewRecord,
  onSearch,
  onDesign,
}: ViewTopBarProps) {
  const { primaryColor } = useBranding()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "")
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery)

  // Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Update URL when debounced query changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    if (debouncedQuery.trim()) {
      params.set("q", debouncedQuery.trim())
    } else {
      params.delete("q")
    }
    router.replace(`?${params.toString()}`, { scroll: false })
    onSearch?.(debouncedQuery)
  }, [debouncedQuery, router, searchParams, onSearch])

  // Sync with URL on mount/change
  useEffect(() => {
    const urlQuery = searchParams.get("q") || ""
    if (urlQuery !== searchQuery) {
      setSearchQuery(urlQuery)
    }
  }, [searchParams, searchQuery])

  function handleSearchChange(value: string) {
    setSearchQuery(value)
  }

  function handleClearSearch() {
    setSearchQuery("")
    setDebouncedQuery("")
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
      default:
        return <Grid3x3 className="h-4 w-4" />
    }
  }

  return (
    <div className="bg-white border-b border-gray-200 flex flex-col">
      {/* Row 1: View tabs only */}
      <div className="flex items-center border-b border-gray-200 overflow-x-auto shrink-0 min-w-0">
        <div className="flex items-center gap-0 flex-nowrap px-4 py-0 min-w-max">
          {views.length > 0 && tableId ? (
            views.map((v) => {
              const isActive = v.id === viewId
              return (
                <Link
                  key={v.id}
                  href={`/tables/${tableId}/views/${v.id}`}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors shrink-0",
                    isActive
                      ? "border-blue-600 text-blue-600 bg-white"
                      : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  )}
                >
                  <span style={isActive ? { color: primaryColor } : undefined} className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">
                    {getViewIcon(v.type)}
                  </span>
                  <span className="truncate max-w-[140px]">{v.name}</span>
                  <span className="text-gray-400 text-xs capitalize shrink-0">({v.type})</span>
                </Link>
              )
            })
          ) : (
            <span className="text-sm font-medium shrink-0 py-2.5" style={{ color: primaryColor }}>
              {viewName} <span className="text-gray-500 font-normal">({viewType})</span>
            </span>
          )}
        </div>
      </div>

      {/* Row 2: Toolbar */}
      <div className="h-10 flex items-center gap-3 px-4 shrink-0">
      {onDesign && (
        <Button
          variant="outline"
          size="sm"
          onClick={onDesign}
          className="h-7 px-2.5 text-xs font-normal border-gray-200 bg-white hover:bg-gray-50 shrink-0"
          style={{ color: primaryColor }}
        >
          <Settings className="h-3.5 w-3.5 mr-1.5" />
          Design
        </Button>
      )}
      {onAddField && (
        <Button
          variant="outline"
          size="sm"
          onClick={onAddField}
          className="h-7 px-2.5 text-xs font-normal border-gray-200 bg-white hover:bg-gray-50 shrink-0"
          style={{ color: primaryColor }}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Field
        </Button>
      )}

      {onSearch && (
        <div className="relative w-48 shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            type="text"
            placeholder="Search this view…"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-8 pr-7 h-7 text-xs bg-gray-50 border-gray-200 rounded focus:bg-white focus:ring-1"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {onFilter && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onFilter}
          className="h-7 px-2.5 text-xs font-normal text-gray-600 hover:bg-gray-50 shrink-0"
        >
          <Filter className="h-3.5 w-3.5 mr-1.5" />
          Filter
        </Button>
      )}
      {onSort && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onSort}
          className="h-7 px-2.5 text-xs font-normal text-gray-600 hover:bg-gray-50 shrink-0"
        >
          <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
          Sort
        </Button>
      )}
      {onGroup && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onGroup}
          className="h-7 px-2.5 text-xs font-normal text-gray-600 hover:bg-gray-50 shrink-0"
        >
          <Group className="h-3.5 w-3.5 mr-1.5" />
          Group
        </Button>
      )}
      {onHideFields && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onHideFields}
          className="h-7 px-2.5 text-xs font-normal text-gray-600 hover:bg-gray-50 shrink-0"
        >
          <Eye className="h-3.5 w-3.5 mr-1.5" />
          Hide Fields
        </Button>
      )}
      {onShare && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onShare}
          className="h-7 px-2.5 text-xs font-normal text-gray-600 hover:bg-gray-50 shrink-0"
        >
          <Share2 className="h-3.5 w-3.5 mr-1.5" />
          Share
        </Button>
      )}

      <div className="flex-1 min-w-0" />
      {onNewRecord && (
        <Button
          onClick={onNewRecord}
          size="sm"
          className="h-7 px-2.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white shrink-0"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New Record
        </Button>
      )}
      </div>
    </div>
  )
}
