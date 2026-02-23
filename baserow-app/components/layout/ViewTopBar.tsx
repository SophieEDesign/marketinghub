"use client"

import { useState, useEffect, useRef } from "react"
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
  MoreVertical,
  Copy,
  Edit,
  Trash2,
  Star,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useBranding } from "@/contexts/BrandingContext"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/context-menu/ContextMenu"
import ViewManagementDialog from "@/components/grid/ViewManagementDialog"
import { supabase } from "@/lib/supabase/client"
import { normalizeUuid } from "@/lib/utils/ids"
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
  tableName?: string
  /** When true, show More menu (Duplicate, Rename, Delete, Set Default) and Add new view */
  canManageViews?: boolean
  /** Opens the Customize cards dialog (Kanban/Gallery) */
  onCustomizeCards?: () => void
  onFilter?: () => void
  onSort?: () => void
  onGroup?: () => void
  onHideFields?: () => void
  filterCount?: number
  sortCount?: number
  hasGroupBy?: boolean
  hiddenFieldsCount?: number
  onShare?: () => void
  onAddField?: () => void
  onNewRecord?: () => void
  onSearch?: (query: string) => void
  onDesign?: () => void
  onViewAction?: (action: "duplicate" | "rename" | "delete" | "setDefault") => void
}

export default function ViewTopBar({
  viewName,
  viewType = "grid",
  viewId,
  tableId,
  views = [],
  tableFields = [],
  tableName: _tableName,
  canManageViews = true,
  onCustomizeCards,
  onFilter,
  onSort,
  onGroup,
  onHideFields,
  filterCount = 0,
  sortCount = 0,
  hasGroupBy = false,
  hiddenFieldsCount = 0,
  onShare,
  onAddField,
  onNewRecord,
  onSearch,
  onDesign,
  onViewAction,
}: ViewTopBarProps) {
  const { primaryColor } = useBranding()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "")
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery)
  const [viewManagementDialogOpen, setViewManagementDialogOpen] = useState(false)
  const [viewManagementAction, setViewManagementAction] = useState<"rename" | "duplicate" | "delete" | null>(null)
  const [editingViewId, setEditingViewId] = useState<string | null>(null)
  const [inlineEditName, setInlineEditName] = useState("")
  const inlineInputRef = useRef<HTMLInputElement>(null)

  // Focus inline input when entering edit mode
  useEffect(() => {
    if (editingViewId && inlineInputRef.current) {
      inlineInputRef.current.focus()
      inlineInputRef.current.select()
    }
  }, [editingViewId])

  async function saveInlineRename(viewIdToSave: string, newName: string) {
    const trimmed = newName.trim()
    if (!trimmed) {
      setEditingViewId(null)
      return
    }
    const viewUuid = normalizeUuid(viewIdToSave)
    if (!viewUuid) return
    try {
      await supabase.from("views").update({ name: trimmed }).eq("id", viewUuid)
      onViewAction?.("rename")
      router.refresh()
    } catch (error) {
      console.error("Error renaming view:", error)
      alert("Failed to rename view")
    }
    setEditingViewId(null)
  }

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
      {/* Row 1: View tabs */}
      <div className="flex items-center border-b border-gray-200 overflow-x-auto shrink-0 min-w-0">
        <div className="flex items-center gap-0 flex-nowrap px-4 py-0 min-w-max">
          {views.length > 0 && tableId ? (
            views.map((v) => {
              const isActive = v.id === viewId
              const isEditing = editingViewId === v.id
              const tabClassName = cn(
                "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors shrink-0",
                isActive
                  ? "border-blue-600 text-blue-600 bg-white"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              )
              const startInlineEdit = () => {
                setEditingViewId(v.id)
                setInlineEditName(v.name)
              }
              const tabContent = (
                <>
                  <span style={isActive ? { color: primaryColor } : undefined} className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">
                    {getViewIcon(v.type)}
                  </span>
                  {isEditing ? (
                    <Input
                      ref={inlineInputRef}
                      value={inlineEditName}
                      onChange={(e) => setInlineEditName(e.target.value)}
                      onBlur={() => saveInlineRename(v.id, inlineEditName)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          saveInlineRename(v.id, inlineEditName)
                        } else if (e.key === "Escape") {
                          setEditingViewId(null)
                          setInlineEditName(v.name)
                          inlineInputRef.current?.blur()
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                      className="h-6 min-w-[60px] max-w-[120px] text-sm px-1.5 py-0 border-blue-300 focus-visible:ring-1"
                    />
                  ) : (
                    <span className="truncate max-w-[140px]">{v.name}</span>
                  )}
                  {!isEditing && <span className="text-gray-400 text-xs capitalize shrink-0">({v.type})</span>}
                </>
              )
              if (isActive && canManageViews) {
                return (
                  <ContextMenu key={v.id}>
                    <ContextMenuTrigger asChild>
                      <div
                        role="tab"
                        aria-selected="true"
                        title="Double-click to rename, right-click for menu"
                        className={tabClassName}
                        onDoubleClick={(e) => {
                          e.preventDefault()
                          if (!isEditing) startInlineEdit()
                        }}
                      >
                        {tabContent}
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem onClick={startInlineEdit}>
                        <Edit className="h-4 w-4 mr-2" />
                        Rename
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => { setViewManagementAction("duplicate"); setViewManagementDialogOpen(true) }}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate View
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => onViewAction?.("setDefault")}>
                        <Star className="h-4 w-4 mr-2" />
                        Set as Default
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={() => { setViewManagementAction("delete"); setViewManagementDialogOpen(true) }}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete View
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                )
              }
              const inactiveTabContent = isEditing ? (
                <div className={tabClassName} role="tab">
                  <span style={{ color: primaryColor }} className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">
                    {getViewIcon(v.type)}
                  </span>
                  <Input
                    ref={inlineInputRef}
                    value={inlineEditName}
                    onChange={(e) => setInlineEditName(e.target.value)}
                    onBlur={() => saveInlineRename(v.id, inlineEditName)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        saveInlineRename(v.id, inlineEditName)
                      } else if (e.key === "Escape") {
                        setEditingViewId(null)
                        setInlineEditName(v.name)
                        inlineInputRef.current?.blur()
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                    className="h-6 min-w-[60px] max-w-[120px] text-sm px-1.5 py-0 border-blue-300 focus-visible:ring-1"
                  />
                </div>
              ) : (
                <Link
                  href={`/tables/${tableId}/views/${v.id}`}
                  className={tabClassName}
                  role="tab"
                  aria-selected={isActive}
                  onDoubleClick={canManageViews ? (e) => { e.preventDefault(); startInlineEdit() } : undefined}
                  title={canManageViews ? "Double-click to rename, right-click for menu" : undefined}
                >
                  <span style={isActive ? { color: primaryColor } : undefined} className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">
                    {getViewIcon(v.type)}
                  </span>
                  <span className="truncate max-w-[140px]">{v.name}</span>
                  <span className="text-gray-400 text-xs capitalize shrink-0">({v.type})</span>
                </Link>
              )
              return (
                <ContextMenu key={v.id}>
                  <ContextMenuTrigger asChild>
                    {inactiveTabContent}
                  </ContextMenuTrigger>
                  {canManageViews && (
                    <ContextMenuContent>
                      <ContextMenuItem onClick={() => startInlineEdit()}>
                        <Edit className="h-4 w-4 mr-2" />
                        Rename
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => { setViewManagementAction("duplicate"); setViewManagementDialogOpen(true) }}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate View
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => onViewAction?.("setDefault")}>
                        <Star className="h-4 w-4 mr-2" />
                        Set as Default
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={() => { setViewManagementAction("delete"); setViewManagementDialogOpen(true) }}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete View
                      </ContextMenuItem>
                    </ContextMenuContent>
                  )}
                </ContextMenu>
              )
            })
          ) : (
            <span className="text-sm font-medium shrink-0 py-2.5" style={{ color: primaryColor }}>
              {viewName} <span className="text-gray-500 font-normal">({viewType})</span>
            </span>
          )}
          {canManageViews && tableId && (
            <Link
              href={`/tables/${tableId}/views/new`}
              className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 border-transparent border-b-2 -mb-px shrink-0 rounded-sm"
              title="Add new view"
            >
              <Plus className="h-4 w-4" />
              <span>Add view</span>
            </Link>
          )}
        </div>
      </div>

      {/* Row 2: Toolbar - Airtable-style (Filter, Sort, Search) or full toolbar */}
      <div className="h-10 flex items-center gap-3 px-4 shrink-0 min-w-0">
        <div className="flex items-center gap-3 overflow-x-auto min-w-0 flex-1">
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
              className={cn(
                "h-7 px-2.5 text-xs font-normal shrink-0",
                filterCount > 0
                  ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                  : "text-gray-600 hover:bg-gray-50"
              )}
            >
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              Filter {filterCount > 0 && `(${filterCount})`}
            </Button>
          )}
          {onSort && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSort}
              className={cn(
                "h-7 px-2.5 text-xs font-normal shrink-0",
                sortCount > 0
                  ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                  : "text-gray-600 hover:bg-gray-50"
              )}
            >
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
              Sort {sortCount > 0 && `(${sortCount})`}
            </Button>
          )}
          {onGroup && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onGroup}
              className={cn(
                "h-7 px-2.5 text-xs font-normal shrink-0",
                hasGroupBy ? "bg-blue-50 text-blue-700 hover:bg-blue-100" : "text-gray-600 hover:bg-gray-50"
              )}
            >
              <Group className="h-3.5 w-3.5 mr-1.5" />
              Group {hasGroupBy && "•"}
            </Button>
          )}
          {onHideFields && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onHideFields}
              className={cn(
                "h-7 px-2.5 text-xs font-normal shrink-0",
                hiddenFieldsCount > 0
                  ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                  : "text-gray-600 hover:bg-gray-50"
              )}
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              Hide Fields {hiddenFieldsCount > 0 && `(${hiddenFieldsCount})`}
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
        </div>

        {/* Right: More & New Record - always visible */}
        <div className="flex items-center gap-2 shrink-0 pl-2">
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
            {(viewType === "kanban" || viewType === "gallery" || viewType === "timeline") && onCustomizeCards && (
              <>
                <DropdownMenuItem onClick={onCustomizeCards}>
                  <Layout className="h-4 w-4 mr-2" />
                  {viewType === "timeline" ? "Customize timeline" : "Customize cards"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
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

      {/* Dialogs */}
      {viewId && tableId && (
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
    </div>
  )
}
