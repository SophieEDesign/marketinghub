"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
  Filter,
  ArrowUpDown,
  Group,
  Eye,
  Save,
  MoreVertical,
  Grid3x3,
  Layout,
  Calendar,
  FileText,
  Image as ImageIcon,
  Copy,
  Trash2,
  Edit,
  Star,
  Minus,
  Maximize2,
  Settings,
  Plus,
  Search,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import FilterDialog from "./FilterDialog"
import SortDialog from "./SortDialog"
import GroupDialog from "./GroupDialog"
import HideFieldsDialog from "./HideFieldsDialog"
import ViewManagementDialog from "./ViewManagementDialog"
import type { TableField } from "@/types/fields"
import type { ViewType } from "@/types/database"

interface ViewBuilderToolbarProps {
  viewId: string
  viewName: string
  viewType: ViewType
  tableId: string
  tableFields: TableField[]
  viewFields: Array<{
    field_name: string
    visible: boolean
    position: number
  }>
  filters: Array<{
    id: string
    field_name: string
    operator: string
    value?: string
  }>
  sorts: Array<{
    id: string
    field_name: string
    direction: string
  }>
  groupBy?: string
  rowHeight?: "short" | "medium" | "tall"
  hiddenFields?: string[]
  userRole?: "admin" | "editor" | "viewer" | null
  onFiltersChange?: (filters: Array<{ id?: string; field_name: string; operator: string; value?: string }>) => void
  onSortsChange?: (sorts: Array<{ id?: string; field_name: string; direction: string }>) => void
  onGroupChange?: (fieldName: string | null) => void
  onRowHeightChange?: (height: "short" | "medium" | "tall") => void
  onHiddenFieldsChange?: (fields: string[]) => void
  onSaveView?: () => void
  onViewAction?: (action: "duplicate" | "rename" | "delete" | "setDefault") => void
  onDesign?: () => void
  onAddField?: () => void
  onNewRecord?: () => void
}

export default function ViewBuilderToolbar({
  viewId,
  viewName,
  viewType,
  tableId,
  tableFields,
  viewFields,
  filters,
  sorts,
  groupBy,
  rowHeight = "medium",
  hiddenFields = [],
  userRole = "editor",
  onFiltersChange,
  onSortsChange,
  onGroupChange,
  onRowHeightChange,
  onHiddenFieldsChange,
  onSaveView,
  onViewAction,
  onDesign,
  onAddField,
  onNewRecord,
}: ViewBuilderToolbarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [filterDialogOpen, setFilterDialogOpen] = useState(false)
  const [sortDialogOpen, setSortDialogOpen] = useState(false)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [hideFieldsDialogOpen, setHideFieldsDialogOpen] = useState(false)
  const [viewManagementDialogOpen, setViewManagementDialogOpen] = useState(false)
  const [viewManagementAction, setViewManagementAction] = useState<"rename" | "duplicate" | "delete" | null>(null)
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "")
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery)

  const canEdit = userRole === "admin" || userRole === "editor"
  const canManageViews = userRole === "admin"

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
  }, [debouncedQuery, router, searchParams])

  // Sync with URL on mount/change
  useEffect(() => {
    const urlQuery = searchParams.get("q") || ""
    if (urlQuery !== searchQuery) {
      setSearchQuery(urlQuery)
    }
  }, [searchParams, searchQuery])

  function handleClearSearch() {
    setSearchQuery("")
    setDebouncedQuery("")
  }

  function getViewIcon(type: ViewType) {
    switch (type) {
      case "grid":
        return <Grid3x3 className="h-4 w-4" />
      case "kanban":
        return <Layout className="h-4 w-4" />
      case "calendar":
        return <Calendar className="h-4 w-4" />
      case "form":
        return <FileText className="h-4 w-4" />
      case "gallery":
        return <ImageIcon className="h-4 w-4" />
      default:
        return <Grid3x3 className="h-4 w-4" />
    }
  }

  const rowHeightOptions = [
    { value: "short", label: "Short", icon: Minus },
    { value: "medium", label: "Medium", icon: Maximize2 },
    { value: "tall", label: "Tall", icon: Maximize2 },
  ]

  return (
    <>
      <div className="h-10 bg-gray-50 border-b border-gray-200 flex items-center justify-between px-4 z-10 relative">
        {/* Left side - View name (view type is locked, no selector) */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">{viewName}</span>
          <span className="text-xs text-gray-500 capitalize">({viewType})</span>
          
          {/* Search */}
          <div className="relative w-64 ml-4">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search this view…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-8 h-7 text-xs bg-white border-gray-200 focus:bg-white"
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right side - Action buttons */}
        <div className="flex items-center gap-1">
          {onDesign && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDesign}
              className="h-7 px-2.5 text-xs font-normal border-gray-300 hover:bg-gray-50"
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
              className="h-7 px-2.5 text-xs font-normal border-gray-300 hover:bg-gray-50"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Field
            </Button>
          )}
          {onNewRecord && (
            <Button
              size="sm"
              onClick={onNewRecord}
              className="h-7 px-2.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Record
            </Button>
          )}
          {canEdit && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilterDialogOpen(true)}
                className={`h-7 px-2.5 text-xs font-normal ${
                  filters.length > 0
                    ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                Filter {filters.length > 0 && `(${filters.length})`}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSortDialogOpen(true)}
                className={`h-7 px-2.5 text-xs font-normal ${
                  sorts.length > 0
                    ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
                Sort {sorts.length > 0 && `(${sorts.length})`}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setGroupDialogOpen(true)}
                className={`h-7 px-2.5 text-xs font-normal ${
                  groupBy
                    ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Group className="h-3.5 w-3.5 mr-1.5" />
                Group {groupBy && "•"}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2.5 text-xs font-normal text-gray-600 hover:bg-gray-100"
                  >
                    Row Height: {rowHeightOptions.find(o => o.value === rowHeight)?.label}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {rowHeightOptions.map((option) => {
                    const Icon = option.icon
                    return (
                      <DropdownMenuItem
                        key={option.value}
                        onClick={() => onRowHeightChange?.(option.value as "short" | "medium" | "tall")}
                        className={rowHeight === option.value ? "bg-blue-50" : ""}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        {option.label}
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setHideFieldsDialogOpen(true)}
                className={`h-7 px-2.5 text-xs font-normal ${
                  hiddenFields.length > 0
                    ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                Hide Fields {hiddenFields.length > 0 && `(${hiddenFields.length})`}
              </Button>
            </>
          )}

          {canManageViews && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={onSaveView}
                className="h-7 px-2.5 text-xs font-normal text-blue-600 hover:bg-blue-50"
              >
                <Save className="h-3.5 w-3.5 mr-1.5" />
                Save View
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-gray-600 hover:bg-gray-100"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => {
                    setViewManagementAction("duplicate")
                    setViewManagementDialogOpen(true)
                  }}>
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate View
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setViewManagementAction("rename")
                    setViewManagementDialogOpen(true)
                  }}>
                    <Edit className="h-4 w-4 mr-2" />
                    Rename View
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onViewAction?.("setDefault")}>
                    <Star className="h-4 w-4 mr-2" />
                    Set as Default
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      setViewManagementAction("delete")
                      setViewManagementDialogOpen(true)
                    }}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete View
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {canEdit && (
        <>
          <FilterDialog
            isOpen={filterDialogOpen}
            onClose={() => setFilterDialogOpen(false)}
            viewId={viewId}
            tableFields={tableFields}
            filters={filters}
            onFiltersChange={onFiltersChange}
          />
          <SortDialog
            isOpen={sortDialogOpen}
            onClose={() => setSortDialogOpen(false)}
            viewId={viewId}
            tableFields={tableFields}
            sorts={sorts}
            onSortsChange={onSortsChange}
          />
          <GroupDialog
            isOpen={groupDialogOpen}
            onClose={() => setGroupDialogOpen(false)}
            viewId={viewId}
            tableFields={tableFields}
            groupBy={groupBy}
            onGroupChange={onGroupChange}
          />
          <HideFieldsDialog
            isOpen={hideFieldsDialogOpen}
            onClose={() => setHideFieldsDialogOpen(false)}
            viewId={viewId}
            tableFields={tableFields}
            viewFields={viewFields}
            hiddenFields={hiddenFields}
            onHiddenFieldsChange={onHiddenFieldsChange}
          />
        </>
      )}

      {canManageViews && (
        <ViewManagementDialog
          isOpen={viewManagementDialogOpen}
          onClose={() => {
            setViewManagementDialogOpen(false)
            setViewManagementAction(null)
          }}
          viewId={viewId}
          viewName={viewName}
          tableId={tableId}
          initialAction={viewManagementAction || undefined}
          onAction={onViewAction}
        />
      )}
    </>
  )
}
