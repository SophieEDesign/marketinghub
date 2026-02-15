"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  Filter,
  ArrowUpDown,
  Group,
  Eye,
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
import UnifiedFilterDialog from "@/components/filters/UnifiedFilterDialog"
import SortDialog from "./SortDialog"
import GroupDialog from "./GroupDialog"
import HideFieldsDialog from "./HideFieldsDialog"
import ViewManagementDialog from "./ViewManagementDialog"
import type { TableField } from "@/types/fields"
import type { ViewType, FilterType } from "@/types/database"

interface ViewSummary {
  id: string
  name: string
  type: string
}

interface ViewBuilderToolbarProps {
  viewId: string
  viewName: string
  viewType: ViewType
  tableId: string
  /** All views for this table (for view switcher dropdown) */
  views?: ViewSummary[]
  tableFields: TableField[]
  viewFields: Array<{
    field_name: string
    visible: boolean
    position: number
  }>
  filters: Array<{
    id: string
    field_name: string
    operator: FilterType
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
  onFiltersChange?: (filters: Array<{ id?: string; field_name: string; operator: FilterType; value?: string }>) => void
  onSortsChange?: (sorts: Array<{ id?: string; field_name: string; direction: string }>) => void
  onGroupChange?: (fieldName: string | null) => void
  onRowHeightChange?: (height: "short" | "medium" | "tall") => void
  onHiddenFieldsChange?: (fields: string[]) => void
  onReorderFields?: (fieldNames: string[]) => void
  onCardLayoutChange?: (primaryField: string, secondaryField: string) => void
  onViewAction?: (action: "duplicate" | "rename" | "delete" | "setDefault") => void
  onDesign?: () => void
  onAddField?: () => void
  onNewRecord?: () => void
  /** Card layout: [primary title field, secondary field] - for kanban/gallery */
  cardFields?: string[]
}

export default function ViewBuilderToolbar({
  viewId,
  viewName,
  viewType,
  tableId,
  views = [],
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
  onReorderFields,
  onCardLayoutChange,
  onViewAction,
  onDesign,
  onAddField,
  onNewRecord,
  cardFields = [],
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
      <div className="flex flex-col bg-white border-b border-gray-200 z-10 relative">
        {/* Row 1: View tabs only (horizontal scroll) */}
        <div className="flex items-center border-b border-gray-200 overflow-x-auto min-w-0 flex-shrink-0">
          <div className="flex items-center px-4 py-2 min-w-max">
            {views.length > 0 ? (
              views.map((v) => {
                const isActive = v.id === viewId
                return (
                  <Link
                    key={v.id}
                    href={`/tables/${tableId}/views/${v.id}`}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-[1px] shrink-0",
                      isActive
                        ? "border-blue-600 text-blue-600 bg-white"
                        : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    )}
                  >
                    <span className={cn("shrink-0", isActive && "text-blue-600")}>
                      {getViewIcon(v.type as ViewType)}
                    </span>
                    <span className="truncate max-w-[140px]">{v.name}</span>
                    <span className="text-gray-400 text-xs capitalize shrink-0">({v.type})</span>
                  </Link>
                )
              })
            ) : (
              <span className="text-sm font-medium text-gray-700 shrink-0">
                {viewName} <span className="text-gray-500 font-normal">({viewType})</span>
              </span>
            )}
            {canManageViews && (
              <Link
                href={`/tables/${tableId}/views/new`}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 border-transparent border-b-2 -mb-[1px] shrink-0 rounded-sm"
                title="Add new view"
              >
                <Plus className="h-4 w-4" />
                <span>Add view</span>
              </Link>
            )}
          </div>
        </div>

        {/* Row 2: Toolbar - Design | Add Field | Search | Filter | Sort | Group | Row Height | Hide Fields | More | New Record */}
        <div className="h-10 flex items-center gap-3 px-4 flex-shrink-0">
          {onDesign && (
          <Button
            variant="outline"
            size="sm"
            onClick={onDesign}
            className="h-7 px-2.5 text-xs font-normal border-gray-200 bg-white hover:bg-gray-50 shrink-0"
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
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Field
          </Button>
        )}

        {/* Search (inline with controls) */}
        <div className="relative w-48 shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            type="text"
            placeholder="Search this view…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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

        {/* View controls: Filter | Sort | Group | Row Height | Hide Fields */}
        {canEdit && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilterDialogOpen(true)}
              className={cn(
                "h-7 px-2.5 text-xs font-normal shrink-0",
                filters.length > 0
                  ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                  : "text-gray-600 hover:bg-gray-50"
              )}
            >
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              Filter {filters.length > 0 && `(${filters.length})`}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSortDialogOpen(true)}
              className={cn(
                "h-7 px-2.5 text-xs font-normal shrink-0",
                sorts.length > 0
                  ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                  : "text-gray-600 hover:bg-gray-50"
              )}
            >
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
              Sort {sorts.length > 0 && `(${sorts.length})`}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setGroupDialogOpen(true)}
              className={cn(
                "h-7 px-2.5 text-xs font-normal shrink-0",
                groupBy ? "bg-blue-50 text-blue-700 hover:bg-blue-100" : "text-gray-600 hover:bg-gray-50"
              )}
            >
              <Group className="h-3.5 w-3.5 mr-1.5" />
              Group {groupBy && "•"}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2.5 text-xs font-normal text-gray-600 hover:bg-gray-50 shrink-0"
                >
                  Row Height: {rowHeightOptions.find((o) => o.value === rowHeight)?.label}
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
              className={cn(
                "h-7 px-2.5 text-xs font-normal shrink-0",
                hiddenFields.length > 0
                  ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                  : "text-gray-600 hover:bg-gray-50"
              )}
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              Hide Fields {hiddenFields.length > 0 && `(${hiddenFields.length})`}
            </Button>
          </>
        )}

        {/* Spacer + More + New Record */}
        <div className="flex-1 min-w-0" />
        {canManageViews && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-gray-600 hover:bg-gray-50 shrink-0"
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
        )}
        {onNewRecord && (
          <Button
            size="sm"
            onClick={onNewRecord}
            className="h-7 px-2.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-sm shrink-0"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Record
          </Button>
        )}
        </div>
      </div>

      {/* Dialogs */}
      {canEdit && (
        <>
          <UnifiedFilterDialog
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
            onReorder={onReorderFields}
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
