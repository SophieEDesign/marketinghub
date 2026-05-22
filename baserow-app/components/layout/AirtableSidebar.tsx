"use client"

import { useState, useEffect, useRef, type MouseEvent } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import SidebarNavItem, { sidebarNavItemClassName } from "@/components/shell/SidebarNavItem"
// TODO: wire SidebarInviteCard to team invite flow when ready.
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
  is_hidden?: boolean
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
  /** When true, desktop sidebar defaults to compact icon rail. */
  autoCompact?: boolean
  /** Called when user manually expands while autoCompact is active. */
  onAutoCompactDismiss?: () => void
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
  coreDataSectionTitle = "Data & tables · Admin",
  autoCompact = false,
  onAutoCompactDismiss,
}: AirtableSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { brandName, logoUrl, primaryColor } = useBranding()
  const { pageActions } = usePageActions()
  const { isEditing: isSidebarEditMode, enter: enterSidebarEdit, exit: exitSidebarEdit } =
    useSidebarEditMode()
  const isMobile = useIsMobile()
  const previousPathnameRef = useRef<string | null>(null)

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set())
  const [isMounted, setIsMounted] = useState(false)

  const [adminSectionOpen, setAdminSectionOpen] = useState(false)
  /** Data & tables collapsed by default — marketing workspace first */
  const [dataTablesOpen, setDataTablesOpen] = useState(false)
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
      setDataTablesOpen(true)
      setAdminSectionOpen(true)
    }
  }, [pathname])

  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const [newPageModalOpen, setNewPageModalOpen] = useState(false)
  const [manuallyExpandedDuringAutoCompact, setManuallyExpandedDuringAutoCompact] = useState(false)
  const [desktopCollapsePrefsMounted, setDesktopCollapsePrefsMounted] = useState(false)

  useEffect(() => {
    if (!autoCompact) {
      setManuallyExpandedDuringAutoCompact(false)
    }
  }, [autoCompact])

  useEffect(() => {
    if (isMobile) return
    setDesktopCollapsePrefsMounted(true)
    const saved = localStorage.getItem("sidebar-collapsed-desktop")
    if (saved === "true") {
      setInternalCollapsed(true)
    }
  }, [isMobile])

  useEffect(() => {
    if (isMobile || !desktopCollapsePrefsMounted) return
    localStorage.setItem("sidebar-collapsed-desktop", internalCollapsed ? "true" : "false")
  }, [internalCollapsed, isMobile, desktopCollapsePrefsMounted])

  const collapseToRail = () => {
    setInternalCollapsed(true)
  }

  const expandFromRail = () => {
    if (autoCompact) {
      setManuallyExpandedDuringAutoCompact(true)
      onAutoCompactDismiss?.()
    }
    setInternalCollapsed(false)
  }

  const isOpen = isOpenProp !== undefined ? isOpenProp : !internalCollapsed
  const shouldForceCompactOnDesktop = !isMobile && autoCompact && !manuallyExpandedDuringAutoCompact
  const isCollapsed = isMobile ? !isOpen : (internalCollapsed || shouldForceCompactOnDesktop)

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

  if (isMobile && !isOpen) {
    return null
  }

  if (!isMobile && isCollapsed) {
    return (
      <div className="w-12 border-r border-hub-border bg-white flex flex-col items-center py-2 gap-2 flex-shrink-0">
        <BaseDropdown
          variant="sidebar"
          collapsed
          className="flex items-center justify-center p-2 min-w-0 w-full bg-transparent hover:bg-muted/60 border-0 shadow-none"
          triggerStyle={{ color: "inherit" }}
          onOpenPageSettings={pageActions?.onOpenPageSettings}
          onEnterEdit={pageActions?.onEnterEdit}
          onExitEdit={pageActions?.onExitEdit}
          isEditing={pageActions?.isEditing}
          defaultPageId={defaultPageId}
        />
        <button
          type="button"
          onClick={expandFromRail}
          className="p-2 hover:bg-muted/60 rounded-lg transition-colors text-muted-foreground"
          title="Expand sidebar"
          aria-label="Expand sidebar"
        >
          <ChevronRight className="h-4 w-4" />
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
        data-sidebar-appearance="light"
        data-tour="sidebar"
        className={cn(
          "flex flex-col h-screen border-r border-hub-border bg-white transition-transform duration-300 flex-shrink-0",
          isMobile ? "fixed left-0 top-0 z-50 w-[260px]" : "relative w-[260px]",
          isMobile && !isOpen && "-translate-x-full"
        )}
      >
        <div className="px-4 py-3 border-b border-hub-border flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {logoUrl ? (
              <div className="relative h-8 w-8 shrink-0">
                <Image src={logoUrl} alt={brandName} fill className="object-contain" unoptimized />
              </div>
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-hub-nav-active text-xs font-bold text-hub-primary">
                MH
              </div>
            )}
            <span className="truncate text-sm font-semibold text-foreground">{brandName}</span>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <BaseDropdown
              variant="sidebar"
              className="sr-only"
              triggerStyle={{ color: "inherit" }}
              onOpenPageSettings={pageActions?.onOpenPageSettings}
              onEnterEdit={pageActions?.onEnterEdit}
              onExitEdit={pageActions?.onExitEdit}
              isEditing={pageActions?.isEditing}
              defaultPageId={defaultPageId}
            />
            <button
              type="button"
              onClick={() => {
                if (isMobile && onClose) onClose()
                else collapseToRail()
              }}
              className="p-1.5 hover:bg-muted/60 rounded-lg transition-colors text-muted-foreground"
              title={isMobile ? "Close sidebar" : "Collapse sidebar"}
              aria-label={isMobile ? "Close sidebar" : "Collapse sidebar"}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-3 pb-1">
            <div className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Workspace
            </div>
          </div>

          {isAdmin && (
            <div className="flex-shrink-0 px-3 pb-2 flex items-center">
              <button
                type="button"
                onClick={() => (isEditMode ? exitSidebarEdit() : enterSidebarEdit())}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors text-muted-foreground",
                  "hover:bg-muted/60 hover:text-foreground",
                  isEditMode && "bg-hub-nav-active text-hub-primary"
                )}
                title={isEditMode ? "Finish organising the sidebar" : "Reorder pages and sections"}
                aria-label={isEditMode ? "Done organising sidebar" : "Organise sidebar"}
              >
                {isEditMode ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Done organising</span>
                  </>
                ) : (
                  <>
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>Organise</span>
                  </>
                )}
              </button>
            </div>
          )}

          <div className="px-2 pt-2 pb-1 space-y-1">
            {homeHref && (
              <SidebarNavItem
                href={homeHref}
                active={isHomeActive}
                icon={<Home className="h-4 w-4" />}
                onClick={(e) => {
                  if (isHomeActive) {
                    e.preventDefault()
                    router.refresh()
                  }
                }}
              >
                {landingPageTitle ?? "Home"}
              </SidebarNavItem>
            )}
          </div>

          <div className="py-0.5">
            <GroupedInterfaces
              interfacePages={interfacePages}
              interfaceGroups={interfaceGroups}
              editMode={isEditMode && isAdmin}
              onRefresh={() => {
                window.dispatchEvent(new CustomEvent("pages-updated"))
                router.refresh()
              }}
            />
          </div>

          <RecentsFavoritesSection primaryColor={primaryColor} />

          {process.env.NODE_ENV === "development" && (
            <div className="px-3 py-1 text-xs text-muted-foreground border-t border-hub-border">
              Debug: tables.length = {tables.length}
              {tables.length > 0 && (
                <div className="mt-1">Tables: {tables.map((t) => t.name).join(", ")}</div>
              )}
            </div>
          )}

          {showAdministration && (
            <div className="mt-2 border-t border-hub-border py-2">
              <div className="px-3 mb-1">
                <button
                  type="button"
                  onClick={() => setAdminSectionOpen((o) => !o)}
                  className="w-full flex items-center justify-between px-2 py-2 text-xs font-medium rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
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
                        onClick={() => setDataTablesOpen((o) => !o)}
                        className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-medium rounded-lg text-muted-foreground hover:bg-muted/60 transition-colors"
                      >
                        <span>{coreDataSectionTitle}</span>
                        {dataTablesOpen ? (
                          <ChevronDown className="h-3 w-3 flex-shrink-0 opacity-80" />
                        ) : (
                          <ChevronRight className="h-3 w-3 flex-shrink-0 opacity-80" />
                        )}
                      </button>
                      {dataTablesOpen && (
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
                                    className="p-0.5 rounded-lg hover:bg-muted/60 shrink-0 text-muted-foreground"
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
                                      sidebarNavItemClassName(isTableActive),
                                      "flex-1 min-w-0 px-2"
                                    )}
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
                                          className={cn(sidebarNavItemClassName(isViewActive), "text-sm py-1.5")}
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
                      className={sidebarNavItemClassName(isSettings)}
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
