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
  ChevronDown,
  Settings,
  X,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  const [cardLayoutOpen, setCardLayoutOpen] = useState(false)

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
        {views.length > 0 && tableId ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-base font-semibold"
                style={{ color: primaryColor }}
              >
                {viewName}
                <span className="text-xs font-normal ml-1 opacity-80">({viewType})</span>
                <ChevronDown className="h-4 w-4 ml-1" style={{ color: primaryColor }} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
              {views.map((v) => (
                <DropdownMenuItem key={v.id} asChild>
                  <Link href={`/tables/${tableId}/views/${v.id}`} className="block">
                    <span className="font-medium">{v.name}</span>
                    <span className="text-gray-500 text-xs ml-1">({v.type})</span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <>
            <h1 className="text-base font-semibold truncate" style={{ color: primaryColor }}>
              {viewName}
            </h1>
            <span className="text-xs capitalize" style={{ color: primaryColor }}>
              ({viewType})
            </span>
          </>
        )}

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

          {(viewType === "kanban" || viewType === "gallery") &&
            onCardLayoutChange &&
            tableFields.length > 0 && (
              <Popover open={cardLayoutOpen} onOpenChange={setCardLayoutOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-sm font-normal hover:bg-gray-100"
                    style={{ color: primaryColor }}
                  >
                    <Layout className="h-4 w-4 mr-1.5" style={{ color: primaryColor }} />
                    Card Layout {cardFields.length > 0 && `(${cardFields.length})`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64">
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Card Layout</h4>
                    <div className="space-y-2">
                      <Label className="text-xs">Primary title field</Label>
                      <Select
                        value={cardFields[0] || ""}
                        onValueChange={(v) =>
                          onCardLayoutChange(v, cardFields[1] || "")
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          {tableFields.map((f) => (
                            <SelectItem key={f.name} value={f.name}>
                              {f.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Secondary field</Label>
                      <Select
                        value={cardFields[1] || ""}
                        onValueChange={(v) =>
                          onCardLayoutChange(cardFields[0] || "", v)
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {tableFields.map((f) => (
                            <SelectItem key={f.name} value={f.name}>
                              {f.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}

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
