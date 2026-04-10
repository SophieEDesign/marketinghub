"use client"

import { useState, useEffect, useRef, type CSSProperties, type MouseEvent } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import PageCreationWizard from "@/components/interface/PageCreationWizard"
import GroupedInterfaces from "./GroupedInterfaces"
import {
  ChevronRight,
  ChevronDown,
  X,
  Settings,
  Home,
  Database,
  Grid3x3,
  FileText,
  Columns,
  Calendar,
  Clock,
  LayoutGrid,
  Check,
  Edit2,
} from "lucide-react"
import { useBranding } from "@/contexts/BrandingContext"
import { usePageActions } from "@/contexts/PageActionsContext"
import { useSidebarEditMode } from "@/contexts/EditModeContext"
import RecentsFavoritesSection from "./RecentsFavoritesSection"
import BaseDropdown from "./BaseDropdown"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/useResponsive"
import type { Table, View } from "@/types/database"

interface InterfacePage {
  id: string
  name: string
  description?: string
  group_id?: string | null
  order_index?: number
}

interface InterfaceGroup {
  id: string
  name: string
  order_index: number
  collapsed: boolean
  workspace_id?: string | null
  icon?: string | null
}

interface AirtableSidebarProps {
  interfacePages?: InterfacePage[]
  interfaceGroups?: InterfaceGroup[]
  tables?: Table[]
  views?: Record<string, View[]>
  userRole?: "admin" | "member" | null
  isOpen?: boolean
  onClose?: () => void
  defaultPageId?: string | null
  landingPageTitle?: string | null
  /** Section title for the tables tree. Default: "Data & tables" */
  coreDataSectionTitle?: string
}

export default function AirtableSidebar({
  interfacePages = [],
  interfaceGroups = [],
  tables = [],
  views = {},
  userRole = null,
  isOpen: isOpenProp,
  onClose,
  defaultPageId = null,
  landingPageTitle = null,
  coreDataSectionTitle = "Data & tables",
}: AirtableSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { primaryColor, sidebarColor, sidebarTextColor } = useBranding()
  const { pageActions } = usePageActions()
  const { isEditing: isSidebarEditMode, enter: enterSidebarEdit, exit: exitSidebarEdit } =
    useSidebarEditMode()
  const isMobile = useIsMobile()
  const previousPathnameRef = useRef<string | null>(null)

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set())
  const [isMounted, setIsMounted] = useState(false)

  const [adminSectionOpen, setAdminSectionOpen] = useState(false)
  const [adminPrefsMounted, setAdminPrefsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    const saved = localStorage.getItem("sidebar-sections-expanded")
    if (saved) {
      try {
        setExpandedSections(new Set(JSON.parse(saved)))
      } catch {
        // ignore
      }
    }
  }, [])

  useEffect(() => {
    setAdminPrefsMounted(true)
    const v = localStorage.getItem("sidebar-administration-expanded")
    if (v === "true") setAdminSectionOpen(true)
  }, [])

  useEffect(() => {
    if (adminPrefsMounted) {
      localStorage.setItem("sidebar-administration-expanded", String(adminSectionOpen))
    }
  }, [adminSectionOpen, adminPrefsMounted])

  useEffect(() => {
    const match = pathname.match(/\/tables\/([^/]+)(?:\/views\/([^/]+))?/)
    if (match) {
      const tableId = match[1]
      setExpandedTables((prev) => new Set(prev).add(tableId))
    }
  }, [pathname])

  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const [newPageModalOpen, setNewPageModalOpen] = useState(false)

  const isOpen = isOpenProp !== undefined ? isOpenProp : !internalCollapsed
  const isCollapsed = isMobile ? !isOpen : internalCollapsed

  const isAdmin = userRole === "admin"
  const isEditMode = isSidebarEditMode

  const isSettings = pathname.includes("/settings")
  const currentPageIdFromPath = pathname?.match(/\/pages\/([^/?]+)/)?.[1]
  const homeHref =
    typeof defaultPageId === "string" && defaultPageId.length > 0
      ? `/pages/${defaultPageId}`
      : null
  const isHomeActive =
    Boolean(homeHref && currentPageIdFromPath && defaultPageId === currentPageIdFromPath)

  useEffect(() => {
    if (previousPathnameRef.current === null) {
      previousPathnameRef.current = pathname
      return
    }

    if (previousPathnameRef.current !== pathname) {
      previousPathnameRef.current = pathname
      if (isMobile && isOpen) {
        if (onClose) onClose()
        else setInternalCollapsed(true)
      }
    }
  }, [pathname, isMobile, isOpen, onClose])

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("sidebar-sections-expanded", JSON.stringify(Array.from(expandedSections)))
    }
  }, [expandedSections, isMounted])

  function toggleSection(section: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      if (isMounted) {
        localStorage.setItem("sidebar-sections-expanded", JSON.stringify(Array.from(next)))
      }
      return next
    })
  }

  const sectionLabelStyle: CSSProperties = {
    color: sidebarTextColor,
    opacity: 0.65,
  }

  const navActiveStyle = (active: boolean): CSSProperties => ({
    color: active ? primaryColor : sidebarTextColor,
    ...(active ? { boxShadow: `inset 3px 0 0 0 ${primaryColor}` } : {}),
  })

  if (isMobile && !isOpen) {
    return null
  }

  if (!isMobile && isCollapsed) {
    return (
      <div
        className="w-12 border-r border-border/50 flex flex-col items-center py-2 gap-2 flex-shrink-0"
        style={{ backgroundColor: sidebarColor }}
      >
        <BaseDropdown
          variant="sidebar"
          collapsed
          className="flex items-center justify-center p-2 min-w-0 w-full bg-transparent hover:bg-black/[0.06] border-0 shadow-none"
          triggerStyle={{ color: sidebarTextColor }}
          onOpenPageSettings={pageActions?.onOpenPageSettings}
          onEnterEdit={pageActions?.onEnterEdit}
          onExitEdit={pageActions?.onExitEdit}
          isEditing={pageActions?.isEditing}
          defaultPageId={defaultPageId}
        />
        <button
          type="button"
          onClick={() => setInternalCollapsed(false)}
          className="p-2 hover:bg-black/[0.06] rounded-lg transition-colors"
          style={{ color: sidebarTextColor }}
          title="Expand sidebar"
          aria-label="Expand sidebar"
        >
          <ChevronRight className="h-4 w-4" style={{ color: sidebarTextColor }} />
        </button>
      </div>
    )
  }

  const showAdministration = isAdmin

  return (
    <>
      {isMobile && isOpen && (onClose || isOpenProp === undefined) && (
        <div
          className="fixed inset-0 bg-black/50 z-40 desktop:hidden"
          onClick={() => {
            if (onClose) onClose()
            else setInternalCollapsed(true)
          }}
          aria-hidden="true"
        />
      )}

      <div
        data-sidebar
        data-tour="sidebar"
        className={cn(
          "flex flex-col h-screen shadow-sm transition-transform duration-300 flex-shrink-0",
          isMobile ? "fixed left-0 top-0 z-50 w-64" : "relative w-64",
          isMobile && !isOpen && "-translate-x-full"
        )}
        style={{ backgroundColor: sidebarColor }}
      >
        <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <BaseDropdown
              variant="sidebar"
              className="flex items-center gap-2 font-semibold h-auto py-1 px-0 bg-transparent hover:bg-black/[0.06] border-0 shadow-none text-left min-w-0"
              triggerStyle={{ color: sidebarTextColor }}
              onOpenPageSettings={pageActions?.onOpenPageSettings}
              onEnterEdit={pageActions?.onEnterEdit}
              onExitEdit={pageActions?.onExitEdit}
              isEditing={pageActions?.isEditing}
              defaultPageId={defaultPageId}
            />
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                if (isMobile && onClose) onClose()
                else setInternalCollapsed(true)
              }}
              className="p-1 hover:bg-black/[0.06] rounded-lg transition-colors"
              style={{ color: sidebarTextColor }}
              title={isMobile ? "Close sidebar" : "Collapse sidebar"}
              aria-label={isMobile ? "Close sidebar" : "Collapse sidebar"}
            >
              <X className="h-4 w-4" style={{ color: sidebarTextColor }} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-3 pb-1">
            <div className="text-xs font-medium tracking-wide" style={sectionLabelStyle}>
              Workspace
            </div>
          </div>

          <div className="flex-shrink-0 px-3 pb-2 flex items-center border-b border-border/50">
            <button
              type="button"
              onClick={() => (isEditMode ? exitSidebarEdit() : enterSidebarEdit())}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors",
                "hover:bg-black/[0.06]",
                isEditMode && "bg-black/[0.1]"
              )}
              style={{ color: sidebarTextColor }}
              title={isEditMode ? "Finish organising the sidebar" : "Reorder pages and sections"}
              aria-label={isEditMode ? "Done organising sidebar" : "Organise sidebar"}
            >
              {isEditMode ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Done</span>
                </>
              ) : (
                <>
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>Organise</span>
                </>
              )}
            </button>
          </div>

          <div className="px-2 pt-2 pb-1 space-y-1">
            {homeHref && (
              <a
                href={homeHref}
                className={cn(
                  "relative flex items-center gap-2 rounded-lg py-2.5 pl-3 pr-3 text-sm font-medium transition-colors",
                  "hover:bg-black/[0.06]",
                  isHomeActive && "bg-black/[0.07]"
                )}
                style={navActiveStyle(isHomeActive)}
                onClick={(e) => {
                  if (isHomeActive) {
                    e.preventDefault()
                    router.refresh()
                  }
                }}
              >
                <Home className="h-4 w-4 flex-shrink-0 opacity-90" />
                <span className="truncate">{landingPageTitle ?? "Home"}</span>
              </a>
            )}
          </div>

          <div className="py-1">
            <GroupedInterfaces
              interfacePages={interfacePages}
              interfaceGroups={interfaceGroups}
              editMode={isEditMode}
              onRefresh={() => {
                window.dispatchEvent(new CustomEvent("pages-updated"))
                router.refresh()
              }}
            />
          </div>

          <RecentsFavoritesSection primaryColor={primaryColor} sidebarTextColor={sidebarTextColor} />

          {process.env.NODE_ENV === "development" && (
            <div
              className="px-3 py-1 text-xs opacity-70 border-t border-border/50"
              style={{ color: sidebarTextColor }}
            >
              Debug: tables.length = {tables.length}
              {tables.length > 0 && (
                <div className="mt-1">Tables: {tables.map((t) => t.name).join(", ")}</div>
              )}
            </div>
          )}

          {showAdministration && (
            <div className="mt-1 border-t border-border/50 py-2">
              <div className="px-3 mb-1">
                <button
                  type="button"
                  onClick={() => setAdminSectionOpen((o) => !o)}
                  className="w-full flex items-center justify-between px-2 py-2 text-xs font-medium rounded-lg hover:bg-black/[0.06] transition-colors"
                  style={{ color: sidebarTextColor }}
                >
                  <span>Administration</span>
                  {adminSectionOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 opacity-80" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 opacity-80" />
                  )}
                </button>
              </div>

              {adminSectionOpen && (
                <div className="space-y-1 px-1">
                  {tables.length > 0 && (
                    <div className="rounded-lg px-1 pb-1">
                      <button
                        type="button"
                        onClick={() => toggleSection("core-data")}
                        className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-medium rounded-lg hover:bg-black/[0.06] transition-colors"
                        style={{ color: sidebarTextColor, opacity: 0.92 }}
                      >
                        <span>{coreDataSectionTitle}</span>
                        {expandedSections.has("core-data") ? (
                          <ChevronDown className="h-3 w-3 flex-shrink-0 opacity-80" />
                        ) : (
                          <ChevronRight className="h-3 w-3 flex-shrink-0 opacity-80" />
                        )}
                      </button>
                      {expandedSections.has("core-data") && (
                        <div className="space-y-0.5 px-1 pt-0.5">
                          {tables.map((table) => {
                            const isTableActive = pathname.includes(`/tables/${table.id}`)
                            const targetPath = `/tables/${table.id}`
                            const tableViews = (views[table.id] || []).filter((v) => v.type !== "interface")
                            const isTableExpanded = expandedTables.has(table.id)

                            const toggleTableExpanded = (e: MouseEvent) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setExpandedTables((prev) => {
                                const next = new Set(prev)
                                if (next.has(table.id)) next.delete(table.id)
                                else next.add(table.id)
                                return next
                              })
                            }

                            return (
                              <div key={table.id} className="space-y-0.5">
                                <div className="flex items-center gap-0.5 min-w-0">
                                  <button
                                    type="button"
                                    onClick={toggleTableExpanded}
                                    className="p-0.5 rounded-lg hover:bg-black/[0.06] shrink-0"
                                    style={{ color: sidebarTextColor }}
                                    aria-label={isTableExpanded ? "Collapse views" : "Expand views"}
                                  >
                                    {tableViews.length > 0 ? (
                                      isTableExpanded ? (
                                        <ChevronDown className="h-3.5 w-3.5" />
                                      ) : (
                                        <ChevronRight className="h-3.5 w-3.5" />
                                      )
                                    ) : (
                                      <span className="w-3.5 h-3.5 inline-block" />
                                    )}
                                  </button>
                                  <Link
                                    href={targetPath}
                                    className={cn(
                                      "flex items-center gap-2 px-1.5 py-2 rounded-lg transition-colors hover:bg-black/[0.06] flex-1 min-w-0 text-sm",
                                      isTableActive && "bg-black/[0.07] font-medium"
                                    )}
                                    style={navActiveStyle(isTableActive)}
                                    onClick={(e) => {
                                      const isCurrentlyActive = pathname === targetPath
                                      if (isCurrentlyActive) {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        router.refresh()
                                        return
                                      }
                                      const startPath = pathname
                                      setTimeout(() => {
                                        if (
                                          window.location.pathname !== targetPath &&
                                          window.location.pathname === startPath
                                        ) {
                                          router.push(targetPath)
                                        }
                                      }, 100)
                                    }}
                                  >
                                    <Database className="h-4 w-4 flex-shrink-0 opacity-90" />
                                    <span className="truncate">{table.name}</span>
                                  </Link>
                                </div>
                                {isTableExpanded && tableViews.length > 0 && (
                                  <div className="pl-5 space-y-0.5">
                                    {tableViews.map((view) => {
                                      const viewPath = `/tables/${table.id}/views/${view.id}`
                                      const isViewActive = pathname === viewPath
                                      const ViewIcon =
                                        view.type === "grid"
                                          ? Grid3x3
                                          : view.type === "form"
                                            ? FileText
                                            : view.type === "kanban" || view.type === "gallery"
                                              ? Columns
                                              : view.type === "calendar"
                                                ? Calendar
                                                : view.type === "timeline"
                                                  ? Clock
                                                  : view.type === "horizontal_grouped"
                                                    ? LayoutGrid
                                                    : Grid3x3
                                      return (
                                        <Link
                                          key={view.id}
                                          href={viewPath}
                                          className={cn(
                                            "flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors hover:bg-black/[0.06] text-sm",
                                            isViewActive && "bg-black/[0.07] font-medium"
                                          )}
                                          style={navActiveStyle(isViewActive)}
                                          onClick={(e) => {
                                            if (isViewActive) return
                                            const startPath = pathname
                                            setTimeout(() => {
                                              if (
                                                window.location.pathname !== viewPath &&
                                                window.location.pathname === startPath
                                              ) {
                                                router.push(viewPath)
                                              }
                                            }, 100)
                                          }}
                                        >
                                          <ViewIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-80" />
                                          <span className="truncate">{view.name}</span>
                                        </Link>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="px-2 pt-0.5">
                    <Link
                      href="/settings"
                      className={cn(
                        "relative flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm hover:bg-black/[0.06]",
                        isSettings && "bg-black/[0.07] font-medium"
                      )}
                      style={navActiveStyle(isSettings)}
                      onClick={() => {
                        if (isSettings) return
                        const startPath = pathname
                        setTimeout(() => {
                          if (
                            window.location.pathname !== "/settings" &&
                            window.location.pathname === startPath
                          ) {
                            router.push("/settings")
                          }
                        }, 100)
                      }}
                    >
                      <Settings className="h-4 w-4 flex-shrink-0 opacity-90" />
                      <span>Workspace settings</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <PageCreationWizard
          open={newPageModalOpen}
          onOpenChange={setNewPageModalOpen}
          defaultGroupId={null}
        />
      </div>
    </>
  )
}
