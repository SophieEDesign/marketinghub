"use client"

import { useState, useEffect, useCallback } from "react"
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
  ChevronDown,
  Settings,
  X,
  Clock
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useBranding } from "@/contexts/BrandingContext"

interface ViewTopBarProps {
  viewName: string
  viewType?: "grid" | "kanban" | "calendar" | "form" | "timeline"
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
    <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 shadow-sm">
      {/* Left side - View name and controls */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <h1 className="text-base font-semibold truncate" style={{ color: primaryColor }}>{viewName}</h1>
        <span className="text-xs capitalize" style={{ color: primaryColor }}>({viewType})</span>

        {/* Search */}
        {onSearch && (
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4" style={{ color: primaryColor }} />
            <Input
              type="text"
              placeholder="Search this view…"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-8 pr-8 h-8 text-sm bg-gray-50 border-gray-200 focus:bg-white"
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4"
                style={{ color: primaryColor }}
                aria-label="Clear search"
              >
                <X className="h-4 w-4" style={{ color: primaryColor }} />
              </button>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onFilter}
            className="h-8 px-2.5 text-sm font-normal hover:bg-gray-100"
            style={{ color: primaryColor }}
          >
            <Filter className="h-4 w-4 mr-1.5" style={{ color: primaryColor }} />
            Filter
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onSort}
            className="h-8 px-2.5 text-sm font-normal hover:bg-gray-100"
            style={{ color: primaryColor }}
          >
            <ArrowUpDown className="h-4 w-4 mr-1.5" style={{ color: primaryColor }} />
            Sort
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onGroup}
            className="h-8 px-2.5 text-sm font-normal hover:bg-gray-100"
            style={{ color: primaryColor }}
          >
            <Group className="h-4 w-4 mr-1.5" style={{ color: primaryColor }} />
            Group
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onHideFields}
            className="h-8 px-2.5 text-sm font-normal hover:bg-gray-100"
            style={{ color: primaryColor }}
          >
            <Eye className="h-4 w-4 mr-1.5" style={{ color: primaryColor }} />
            Hide Fields
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onShare}
            className="h-8 px-2.5 text-sm font-normal hover:bg-gray-100"
            style={{ color: primaryColor }}
          >
            <Share2 className="h-4 w-4 mr-1.5" style={{ color: primaryColor }} />
            Share
          </Button>
        </div>
      </div>

      {/* Right side - Action buttons */}
      <div className="flex items-center gap-2">
        {onDesign && (
          <Button
            onClick={onDesign}
            size="sm"
            variant="outline"
            className="h-8 px-3 text-sm font-medium border-gray-300 hover:bg-gray-50"
            style={{ color: primaryColor }}
          >
            <Settings className="h-4 w-4 mr-1.5" style={{ color: primaryColor }} />
            Design
          </Button>
        )}
        {onAddField && (
          <Button
            onClick={onAddField}
            size="sm"
            variant="outline"
            className="h-8 px-3 text-sm font-medium border-gray-300 hover:bg-gray-50"
            style={{ color: primaryColor }}
          >
            <Plus className="h-4 w-4 mr-1.5" style={{ color: primaryColor }} />
            Add Field
          </Button>
        )}
        {onNewRecord && (
          <Button
            onClick={onNewRecord}
            size="sm"
            className="h-8 px-3 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            New Record
          </Button>
        )}
      </div>
    </div>
  )
}
