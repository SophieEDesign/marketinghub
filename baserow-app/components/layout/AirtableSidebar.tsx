"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { useParams, usePathname, useRouter } from "next/navigation"
import PageCreationWizard from "@/components/interface/PageCreationWizard"
import GroupedInterfaces from "./GroupedInterfaces"
import { 
  ChevronRight, 
  ChevronDown, 
  Plus, 
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
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useBranding } from "@/contexts/BrandingContext"
import { usePageActions } from "@/contexts/PageActionsContext"
import RecentsFavoritesSection from "./RecentsFavoritesSection"
import BaseDropdown from "./BaseDropdown"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/useResponsive"
import type { Automation, Table, View } from "@/types/database"

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
  userRole?: 'admin' | 'member' | null
  isOpen?: boolean
  onClose?: () => void
  defaultPageId?: string | null // For "Back to home" - never link to abstract /
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
}: AirtableSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { brandName, logoUrl, primaryColor, sidebarColor, sidebarTextColor } = useBranding()
  const { pageActions } = usePageActions()
  const isMobile = useIsMobile()
  const previousPathnameRef = useRef<string | null>(null)
  
  // Load initial state - use default on server, sync from localStorage on client after mount
  // This prevents hydration mismatches
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["interfaces"]))
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set())
  const [isMounted, setIsMounted] = useState(false)
  
  // Sync from localStorage after mount to prevent hydration issues
  useEffect(() => {
    setIsMounted(true)
    const saved = localStorage.getItem("sidebar-sections-expanded")
    if (saved) {
      try {
        setExpandedSections(new Set(JSON.parse(saved)))
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, [])

  // Auto-expand table when viewing a view from that table
  useEffect(() => {
    const match = pathname.match(/\/tables\/([^/]+)(?:\/views\/([^/]+))?/)
    if (match) {
      const tableId = match[1]
      setExpandedTables((prev) => new Set(prev).add(tableId))
    }
  }, [pathname])
  
  // For mobile/tablet: use controlled state from parent, default to closed
  // For desktop: use internal collapsed state
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const [newPageModalOpen, setNewPageModalOpen] = useState(false)
  
  // Determine if sidebar should be visible
  const isOpen = isOpenProp !== undefined ? isOpenProp : !internalCollapsed
  const isCollapsed = isMobile ? !isOpen : internalCollapsed
  
  const isAdmin = userRole === 'admin'
  // Context-driven editing: no global edit mode; sidebar page reorder disabled for now
  const isEditMode = false

  const params = useParams()
  const isInterfacePage = (params?.pageId as string) != null
  const isSettings = pathname.includes("/settings")
  const isTablePage = pathname.includes("/tables/")
  
  // Close sidebar on mobile when navigating.
  // Note: `popstate` only fires for back/forward, not Next.js Link navigations.
  // CRITICAL: Always close on navigation to prevent overlay from blocking clicks
  useEffect(() => {
    // Skip first render so we don't immediately close on initial load.
    if (previousPathnameRef.current === null) {
      previousPathnameRef.current = pathname
      return
    }

    if (previousPathnameRef.current !== pathname) {
      previousPathnameRef.current = pathname
      // CRITICAL: Always close sidebar on navigation (mobile) to prevent overlay blocking
      if (isMobile && isOpen) {
        if (onClose) {
          onClose()
        } else {
          // Fallback: close internally if no onClose provided
          setInternalCollapsed(true)
        }
      }
    }
  }, [pathname, isMobile, isOpen, onClose])

  // Save expand/collapse state to localStorage when it changes (only after mount)
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("sidebar-sections-expanded", JSON.stringify(Array.from(expandedSections)))
    }
  }, [expandedSections, isMounted])

  function toggleSection(section: string) {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      // Persist to localStorage (only after mount to avoid hydration issues)
      if (isMounted) {
        localStorage.setItem("sidebar-sections-expanded", JSON.stringify(Array.from(next)))
      }
      return next
    })
  }


  // On mobile: if closed, don't render (toggle button is in Topbar)
  if (isMobile && !isOpen) {
    return null
  }

  // On tablet/desktop: show collapsed state with BaseDropdown for Edit/View access
  if (!isMobile && isCollapsed) {
    return (
      <div 
        className="w-12 border-r border-black/10 flex flex-col items-center py-2 gap-2"
        style={{ backgroundColor: sidebarColor }}
      >
        <BaseDropdown
          variant="sidebar"
          collapsed
          className="flex items-center justify-center p-2 min-w-0 w-full bg-transparent hover:bg-black/10 border-0 shadow-none"
          triggerStyle={{ color: sidebarTextColor }}
          onOpenPageSettings={pageActions?.onOpenPageSettings}
          onEnterEdit={pageActions?.onEnterEdit}
          onExitEdit={pageActions?.onExitEdit}
          isEditing={pageActions?.isEditing}
          defaultPageId={defaultPageId}
        />
        <button
          onClick={() => setInternalCollapsed(false)}
          className="p-2 hover:bg-black/10 rounded transition-colors"
          style={{ color: sidebarTextColor }}
          title="Expand sidebar"
          aria-label="Expand sidebar"
        >
          <ChevronRight className="h-4 w-4" style={{ color: sidebarTextColor }} />
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Overlay for mobile */}
      {isMobile && isOpen && (onClose || isOpenProp === undefined) && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 desktop:hidden"
          onClick={() => {
            // In controlled mode (mobile), parent should provide onClose.
            // In uncontrolled mode, fall back to collapsing internally so the overlay never "traps" clicks.
            if (onClose) onClose()
            else setInternalCollapsed(true)
          }}
          aria-hidden="true"
        />
      )}
      
      <div 
        data-sidebar
        className={cn(
          "flex flex-col h-screen shadow-sm transition-transform duration-300",
          isMobile 
            ? "fixed left-0 top-0 z-50 w-64" 
            : "relative w-64",
          isMobile && !isOpen && "-translate-x-full"
        )}
        style={{ backgroundColor: sidebarColor }}
      >
      {/* Header with Edit menu (BaseDropdown) - moved from page level per user request */}
      <div className="px-4 py-3 border-b border-black/10 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <BaseDropdown
            variant="sidebar"
            className="flex items-center gap-2 font-semibold h-auto py-1 px-0 bg-transparent hover:bg-black/10 border-0 shadow-none text-left min-w-0"
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
            onClick={() => {
              if (isMobile && onClose) {
                onClose()
              } else {
                setInternalCollapsed(true)
              }
            }}
            className="p-1 hover:bg-black/10 rounded transition-colors"
            style={{ color: sidebarTextColor }}
            title={isMobile ? "Close sidebar" : "Collapse sidebar"}
            aria-label={isMobile ? "Close sidebar" : "Collapse sidebar"}
          >
            <X className="h-4 w-4" style={{ color: sidebarTextColor }} />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto">
        {/* Primary Navigation (Airtable-style) */}
        <div className="py-2">
          <GroupedInterfaces
            interfacePages={interfacePages}
            interfaceGroups={interfaceGroups}
            editMode={isEditMode}
            onRefresh={() => {
              window.dispatchEvent(new CustomEvent('pages-updated'))
              router.refresh()
            }}
          />
        </div>

        {/* Recents & Favorites */}
        <RecentsFavoritesSection primaryColor={primaryColor} sidebarTextColor={sidebarTextColor} />

        {/* Debug: Show tables count in development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="px-3 py-1 text-xs opacity-70 border-t border-black/10" style={{ color: sidebarTextColor }}>
            Debug: tables.length = {tables.length}
            {tables.length > 0 && (
              <div className="mt-1">Tables: {tables.map(t => t.name).join(', ')}</div>
            )}
          </div>
        )}

        {/* Core Data Section - Admin only */}
        {isAdmin && tables.length > 0 && (
          <div className="py-2 border-t border-black/10">
            <div className="px-3 mb-1">
              <button
                onClick={() => toggleSection("core-data")}
                className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold uppercase tracking-wider hover:bg-black/10 rounded transition-colors"
                style={{ color: sidebarTextColor }}
              >
                <span>Core Data</span>
                {expandedSections.has("core-data") ? (
                  <ChevronDown className="h-3 w-3 flex-shrink-0" style={{ color: sidebarTextColor }} />
                ) : (
                  <ChevronRight className="h-3 w-3 flex-shrink-0" style={{ color: sidebarTextColor }} />
                )}
              </button>
            </div>
            {expandedSections.has("core-data") && (
              <div className="space-y-0.5 px-2">
                {tables.map((table) => {
                  const isTableActive = pathname.includes(`/tables/${table.id}`)
                  const targetPath = `/tables/${table.id}`
                  const tableViews = (views[table.id] || []).filter((v) => v.type !== "interface")
                  const isTableExpanded = expandedTables.has(table.id)

                  const toggleTableExpanded = (e: React.MouseEvent) => {
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
                          className="p-0.5 rounded hover:bg-black/10 shrink-0"
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
                            "flex items-center gap-2 px-1.5 py-1.5 rounded transition-colors hover:bg-black/10 flex-1 min-w-0",
                            isTableActive && "bg-black/20 font-medium"
                          )}
                          style={{ color: sidebarTextColor }}
                          onClick={(e) => {
                            const isCurrentlyActive = pathname === targetPath
                            if (isCurrentlyActive) {
                              e.preventDefault()
                              e.stopPropagation()
                              router.refresh()
                              return
                            }
                            // Fallback: if Next.js Link navigation doesn't complete (known issue), force full reload
                            const startPath = pathname
                            setTimeout(() => {
                              if (window.location.pathname !== targetPath && window.location.pathname === startPath) {
                                window.location.href = targetPath
                              }
                            }, 250)
                          }}
                        >
                          <Database className="h-4 w-4 flex-shrink-0" style={{ color: sidebarTextColor }} />
                          <span className="text-sm truncate">{table.name}</span>
                        </Link>
                      </div>
                      {isTableExpanded && tableViews.length > 0 && (
                        <div className="pl-5 space-y-0.5">
                          {tableViews.map((view) => {
                            const viewPath = `/tables/${table.id}/views/${view.id}`
                            const isViewActive = pathname === viewPath
                            const ViewIcon = view.type === "grid" ? Grid3x3 : view.type === "form" ? FileText : view.type === "kanban" || view.type === "gallery" ? Columns : view.type === "calendar" ? Calendar : view.type === "timeline" ? Clock : view.type === "horizontal_grouped" ? LayoutGrid : Grid3x3
                            return (
                              <Link
                                key={view.id}
                                href={viewPath}
                                className={cn(
                                  "flex items-center gap-2 px-2 py-1 rounded transition-colors hover:bg-black/10 text-sm",
                                  isViewActive && "bg-black/20 font-medium"
                                )}
                                style={{ color: sidebarTextColor }}
                                onClick={(e) => {
                                  if (isViewActive) return
                                  const startPath = pathname
                                  setTimeout(() => {
                                    if (window.location.pathname !== viewPath && window.location.pathname === startPath) {
                                      window.location.href = viewPath
                                    }
                                  }, 250)
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

        {/* Settings - Admin Only */}
        {isAdmin && (
        <div className="py-2 border-t border-black/10">
          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded transition-colors hover:bg-black/10",
              isSettings && "bg-black/20 font-medium"
            )}
            style={{ color: sidebarTextColor }}
            onClick={() => {
              if (isSettings) return
              const startPath = pathname
              setTimeout(() => {
                if (window.location.pathname !== "/settings" && window.location.pathname === startPath) {
                  window.location.href = "/settings"
                }
              }, 250)
            }}
          >
            <Settings className="h-4 w-4 flex-shrink-0" style={{ color: sidebarTextColor }} />
            <span className="text-sm">Settings</span>
          </Link>
        </div>
        )}
      </div>

      {/* New Page Modal */}
      <PageCreationWizard open={newPageModalOpen} onOpenChange={setNewPageModalOpen} defaultGroupId={null} />
      </div>
    </>
  )
}
