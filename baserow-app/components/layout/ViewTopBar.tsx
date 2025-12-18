"use client"

import { useState } from "react"
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
  Settings
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface ViewTopBarProps {
  viewName: string
  viewType?: "grid" | "kanban" | "calendar" | "form"
  onFilter?: () => void
  onSort?: () => void
  onGroup?: () => void
  onHideFields?: () => void
  onShare?: () => void
  onAddField?: () => void
  onNewRecord?: () => void
  onViewChange?: (type: "grid" | "kanban" | "calendar" | "form") => void
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
  onViewChange,
  onSearch,
  onDesign,
}: ViewTopBarProps) {
  const [searchQuery, setSearchQuery] = useState("")

  function handleSearchChange(value: string) {
    setSearchQuery(value)
    onSearch?.(value)
  }

  function getViewIcon(type: string) {
    switch (type) {
      case "grid":
        return <Grid3x3 className="h-4 w-4" />
      case "kanban":
        return <Layout className="h-4 w-4" />
      case "calendar":
        return <Calendar className="h-4 w-4" />
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
        <h1 className="text-base font-semibold text-gray-900 truncate">{viewName}</h1>
        
        {/* View Switcher */}
        {onViewChange && (
          <div className="flex items-center gap-1 bg-gray-100 rounded-md p-1">
            {(["grid", "kanban", "calendar", "form"] as const).map((type) => (
              <button
                key={type}
                onClick={() => onViewChange(type)}
                className={`p-1.5 rounded transition-colors ${
                  viewType === type
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
                title={type.charAt(0).toUpperCase() + type.slice(1)}
              >
                {getViewIcon(type)}
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        {onSearch && (
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search records..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-8 h-8 text-sm bg-gray-50 border-gray-200 focus:bg-white"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onFilter}
            className="h-8 px-2.5 text-sm font-normal text-gray-700 hover:bg-gray-100"
          >
            <Filter className="h-4 w-4 mr-1.5" />
            Filter
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onSort}
            className="h-8 px-2.5 text-sm font-normal text-gray-700 hover:bg-gray-100"
          >
            <ArrowUpDown className="h-4 w-4 mr-1.5" />
            Sort
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onGroup}
            className="h-8 px-2.5 text-sm font-normal text-gray-700 hover:bg-gray-100"
          >
            <Group className="h-4 w-4 mr-1.5" />
            Group
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onHideFields}
            className="h-8 px-2.5 text-sm font-normal text-gray-700 hover:bg-gray-100"
          >
            <Eye className="h-4 w-4 mr-1.5" />
            Hide Fields
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onShare}
            className="h-8 px-2.5 text-sm font-normal text-gray-700 hover:bg-gray-100"
          >
            <Share2 className="h-4 w-4 mr-1.5" />
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
          >
            <Settings className="h-4 w-4 mr-1.5" />
            Design
          </Button>
        )}
        {onAddField && (
          <Button
            onClick={onAddField}
            size="sm"
            variant="outline"
            className="h-8 px-3 text-sm font-medium border-gray-300 hover:bg-gray-50"
          >
            <Plus className="h-4 w-4 mr-1.5" />
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
